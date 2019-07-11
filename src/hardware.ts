import { Gpio, pigpio, Pull, BinaryValue, GpioMode } from "pigpio-client";
import logger from "./logger";
import { promisify } from "util";
import { EventEmitter } from "events";

const Client = pigpio({ host: "localhost" });

Client.on('disconnected', (Reason: string) => {
	logger.Warn('pigpiod', 'disconnected, reason:', Reason);
	logger.Info('pigpiod', 'attempting to reconnect in', '1 second');

	setTimeout(Client.connect, 1000);
});

function Sleep(ms: number): Promise<void> {
	return new Promise(resolve =>
		setTimeout(resolve, ms));
}

class GpioHandle {
	private gpio: Gpio;

	constructor(Options: {
		Pin: number,
		Mode: GpioMode,
		Level?: BinaryValue,
		Pull?: Pull,
		Debounce?: number
	}) {
		this.gpio = Client.gpio(Options.Pin);
		// pigpio automatically sets mode to OUTPUT when write is called
		if (Options.Level)
			this.gpio.write(Options.Level)
		else
			this.gpio.modeSet(Options.Mode);
		if (Options.Pull)
			this.gpio.pullUpDown(Options.Pull);
		if (Options.Debounce)
			this.gpio.glitchSet(Options.Debounce);

		this.read = promisify(this.gpio.read);
		this.write = promisify(this.gpio.write);
		this.notify = this.gpio.notify;
	}

	public read: () => Promise<BinaryValue>;
	public write: (Value: BinaryValue) => Promise<undefined>;
	public notify: Gpio["notify"];
}

export class Monitor {
	private Handle: GpioHandle;
	private Timeout = false;

	constructor(readonly Name: string, Pin: number, private Action: (name: string) => void) {
		this.Handle = new GpioHandle({
			Pin,
			Mode: "input",
			Pull: Pull.DOWN,
			Debounce: 300
		});

		this.Handle.notify(this.Process.bind(this));
	}

	async Process(Value: BinaryValue) {
		// Ignore the falling edge
		if (Value === BinaryValue.LOW)
			return;

		if (!this.Timeout && await this.Debounce()) {
			this.Timeout = true;
			this.Action(this.Name);

			await Sleep(4000);
			this.Timeout = false;
		} else {
			logger.Info(this.Name, "signal was", "debounced");
		}
	}

	private async DelayedRead(Exponent: number) {
		await Sleep(2 ** (3 * Exponent));
		return this.Handle.read();
	}

	private async Debounce() {
		const Promises: Promise<BinaryValue>[] = [];

		for (let i = 0; i < 4; ++i)
			Promises.push(this.DelayedRead(i));

		const Values = await Promise.all(Promises);
		return !Values.some(Value => Value === BinaryValue.LOW);
	}
}

export class Controller extends EventEmitter {
	public Locked = false;
	private Handle: GpioHandle;
	private Timeout?: NodeJS.Timeout;

	constructor(readonly Name: string, Pin: number) {
		super();

		this.Handle = new GpioHandle({
			Pin,
			Mode: "output",
			Level: BinaryValue.HIGH
		});
	}

	async Open(Id: string) {
		if (this.Locked) {
			logger.Log(Id, "requested to open the " + this.Name, "REJECTED");
			return;
		}

		clearTimeout(this.Timeout!);
		await this.Handle.write(BinaryValue.LOW);

		logger.Log(Id, "requested to open the " + this.Name, "GRANTED");
		this.emit("open");

		await Sleep(500);
		await this.Handle.write(BinaryValue.HIGH);
	}

	Lock(Id: string, Value: unknown) {
		if (typeof Value !== "boolean" || Value === this.Locked) {
			logger.Log(Id, "received corrupt response", typeof Value);
			return false;
		}

		this.Locked = Value;

		logger.Log(Id, "updated the " + this.Name + " lock status", Value.toString());
		this.emit("lock", Value);

		return true;
	}
}

export class WiegandRfid extends EventEmitter {
	private d0: GpioHandle;
	private d1: GpioHandle;

	private Bits: number[] = [];
	private Timeout?: NodeJS.Timeout;

	constructor(d0Pin: number, d1Pin: number) {
		super();

		const Options = {
			Mode: "input" as GpioMode,
			Pull: Pull.DOWN,
			Debounce: 300
		};

		this.d0 = new GpioHandle({
			Pin: d0Pin,
			...Options
		});

		this.d1 = new GpioHandle({
			Pin: d1Pin,
			...Options
		});

		this.d0.notify(this.Pulse.bind(this, 0));
		this.d1.notify(this.Pulse.bind(this, 1));
	}

	private Pulse(Value: number, State: BinaryValue) {
		if (State === BinaryValue.LOW) {
			this.Bits.push(Value);
			clearTimeout(this.Timeout!);
			this.Timeout = setTimeout(this.Done.bind(this), 16);
		}
	}

	private Done() {
		if (this.Bits.length === 26) {
			// Check parity
			const Even = this.Bits.slice(0, 13);
			const Odd = this.Bits.slice(13, 26);

			const EvenCount = Even.filter(x => x === 1).length;
			const OddCount = Odd.filter(x => x === 1).length;

			if (EvenCount % 2 === 0 && OddCount % 2 === 1) {
				const Data = this.Bits.slice(1, 25).join("");
				const Hex = parseInt(Data, 2).toString(16).padStart(6, "0");

				this.emit("card", Hex);
			} else {
				logger.Warn("Wiegand", "parity check failed", this.Bits.join(""));
			}
		} else {
			logger.Warn("Wiegand", "discarding", this.Bits.join(""));
		}

		this.Bits = [];
	}
}

export default {
	Monitor,
	Controller,
	WiegandRfid,
	on: Client.on.bind(Client),
	once: Client.once.bind(Client)
};
