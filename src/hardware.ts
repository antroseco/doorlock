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
		Pull?: Pull,
		Debounce?: number
	}) {
		this.gpio = Client.gpio(Options.Pin);
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

	constructor(readonly Name: string, Pin: number, private Action: (name: string) => any) {
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
			Mode: "output"
		});
		this.Handle.write(BinaryValue.LOW);
	}

	async Open(Id: string) {
		if (this.Locked) {
			logger.Log(Id, "requested to open the " + this.Name, "REJECTED");
			return;
		}

		clearTimeout(this.Timeout!);
		await this.Handle.write(BinaryValue.HIGH);

		logger.Log(Id, "requested to open the " + this.Name, "GRANTED");
		this.emit("open");

		await Sleep(500);
		await this.Handle.write(BinaryValue.LOW);
	}

	Lock(Id: string, Value: any) {
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

export default {
	Monitor,
	Controller,
	on: Client.on.bind(Client),
	once: Client.once.bind(Client)
};
