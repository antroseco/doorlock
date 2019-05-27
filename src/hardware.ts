import { Gpio, pigpio, Pull, BinaryValue } from "pigpio-client";
import logger from "./logger";
import { promisify } from "util";
import { EventEmitter } from "events";

function Sleep(ms: number): Promise<void> {
	return new Promise(resolve =>
		setTimeout(resolve, ms));
}

class GpioHandle {
	public static Client = pigpio({ host: "localhost" });
	protected gpio: Gpio;

	constructor(Pin: number) {
		this.gpio = GpioHandle.Client.gpio(Pin);
		this.read = promisify(this.gpio.read);
		this.write = promisify(this.gpio.write);
		this.on = this.gpio.on;
		this.emit = this.gpio.emit;
	}

	protected read: () => Promise<BinaryValue>;
	protected write: (Value: BinaryValue) => Promise<undefined>;

	public on: EventEmitter["on"];
	protected emit: EventEmitter["emit"];
}

export class Monitor extends GpioHandle {
	private Timeout = false;

	constructor(readonly Name: string, Pin: number, private Action: (name: string) => any) {
		super(Pin);

		this.gpio.modeSet("input");
		this.gpio.pullUpDown(Pull.DOWN);
		this.gpio.glitchSet(300); // TODO

		this.gpio.notify(this.Process.bind(this));
	}

	async Process(Value: BinaryValue) {
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
		return this.read();
	}

	private async Debounce() {
		const Promises: Promise<BinaryValue>[] = [];

		for (let i = 0; i < 4; ++i)
			Promises.push(this.DelayedRead(i));

		const Values = await Promise.all(Promises);
		return !Values.some(Value => Value === BinaryValue.LOW);
	}
}

export class Controller extends GpioHandle {
	public Locked = false;
	private Timeout?: NodeJS.Timeout;

	constructor(readonly Name: string, Pin: number) {
		super(Pin);

		this.gpio.modeSet("output");
		this.gpio.write(BinaryValue.LOW);
	}

	async Open(Id: string) {
		if (this.Locked) {
			logger.Log(Id, "requested to open the " + this.Name, "REJECTED");
			return;
		}

		clearTimeout(this.Timeout!);
		await this.write(BinaryValue.HIGH);

		logger.Log(Id, "requested to open the " + this.Name, "GRANTED");
		this.emit("open");

		await Sleep(500);
		await this.write(BinaryValue.LOW);
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

GpioHandle.Client.on('disconnected', (Reason: string) => {
	logger.Warn('pigpiod', 'disconnected, reason:', Reason);
	logger.Info('pigpiod', 'attempting to reconnect in', '1 second');

	setTimeout(GpioHandle.Client.connect, 1000);
});

export default {
	Monitor,
	Controller,
	on: GpioHandle.Client.on.bind(GpioHandle.Client),
	once: GpioHandle.Client.once.bind(GpioHandle.Client)
};
