import { EventEmitter } from "events";
import { Gpio } from "onoff";
import { Info, Log } from "./logger.js";

const enum State { LOW, HIGH };

export class Monitor {
	private Timeout = false;
	private readonly gpio: Gpio;

	constructor(readonly Name: string, Pin: number, private Action: (name: string) => any) {
		this.gpio = new Gpio(Pin, "in", "rising", { debounceTimeout: 10 });
		process.on("exit", () => this.gpio.unexport());

		this.gpio.watch(Err => {
			if (Err) {
				console.log(Err);
			} else {
				this.Process();
			}
		});
	}

	async Process() {
		if (!this.Timeout && await this.Debounce()) {
			this.Timeout = true;
			setTimeout(() => this.Timeout = false, 4000);

			this.Action(this.Name);
		} else {
			Info(this.Name, "signal was", "debounced");
		}
	}

	async Debounce() {
		let Values = [];
		for (let i = 0; i <= 3; ++i) {
			Values[i] = new Promise(resolve =>
				setTimeout(() => resolve(this.gpio.readSync()), 2 ** (3 * i)));
		}

		return Values.reduce(async (x, y) => await x && await y);
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

	Open(Id: string) {
		if (this.Locked) {
			Log(Id, "requested to open the " + this.Name, "REJECTED");
			return false;
		}

		clearTimeout(this.Timeout!);
		this.gpio.writeSync(State.HIGH);
		this.Timeout = setTimeout(() => this.gpio.writeSync(State.LOW), 500);

		Log(Id, "requested to open the " + this.Name, "GRANTED");
		this.emit("open");

		return true;
	}

	Lock(Id: string, Value: any) {
		if (typeof Value !== "boolean" || Value === this.Locked) {
			Log(Id, "received corrupt response", typeof Value);
			return false;
		}

		this.Locked = Value;

		Log(Id, "updated the " + this.Name + " lock status", Value.toString());
		this.emit("lock", Value);

		return true;
	}
}

export default { Monitor, Controller };
