import { EventEmitter } from "events";
import { Gpio, BinaryValue } from "onoff";
import logger from "./logger";

const enum State { LOW, HIGH };

function Sleep(ms: number): Promise<void> {
	return new Promise(resolve =>
		setTimeout(resolve, ms));
}

export class Monitor {
	private Timeout = false;
	private readonly gpio: Gpio;

	constructor(readonly Name: string, Pin: number, private Action: (name: string) => any) {
		this.gpio = new Gpio(Pin, "in", "rising", { debounceTimeout: 10 });
		process.on("exit", this.gpio.unexport.bind(this));

		this.gpio.watch(this.Process.bind(this));
	}

	async Process(Err: Error | null | undefined) {
		if (Err) {
			logger.Error(Err);
			return;
		}

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
		return this.gpio.read();
	}

	private async Debounce() {
		const Promises: Promise<BinaryValue>[] = [];

		for (let i = 0; i < 4; ++i)
			Promises.push(this.DelayedRead(i));

		const Values = await Promise.all(Promises);
		return !Values.some(Value => Value === State.LOW);
	}
}

export class Controller extends EventEmitter {
	public Locked = false;
	private Timeout?: NodeJS.Timeout;
	private readonly gpio: Gpio;

	constructor(readonly Name: string, Pin: number) {
		super();

		this.gpio = new Gpio(Pin, "low");
		process.on("exit", () => this.gpio.unexport());
	}

	async Open(Id: string) {
		if (this.Locked) {
			logger.Log(Id, "requested to open the " + this.Name, "REJECTED");
			return;
		}

		clearTimeout(this.Timeout!);
		await this.gpio.write(State.HIGH);

		logger.Log(Id, "requested to open the " + this.Name, "GRANTED");
		this.emit("open");

		await Sleep(500);
		await this.gpio.write(State.LOW);
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

export default { Monitor, Controller };
