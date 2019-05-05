import { EventEmitter } from "events";
import { Gpio, BinaryValue } from "onoff";
import { Info, Log } from "./logger.js";

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
			console.log(Err);
			return;
		}

		if (!this.Timeout && await this.Debounce()) {
			this.Timeout = true;
			this.Action(this.Name);

			await Sleep(4000);
			this.Timeout = false;
		} else {
			Info(this.Name, "signal was", "debounced");
		}
	}

	async Debounce() {
		let Values: Promise<BinaryValue>[] = [];
		for (let i = 0; i <= 3; ++i) {
			Values[i] = new Promise(async resolve => {
				await Sleep(2 ** (3 * i));
				resolve(this.gpio.read());
			});
		}

		return await Values.reduce(async (x, y) => await x && await y) !== State.LOW;
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
			Log(Id, "requested to open the " + this.Name, "REJECTED");
			return;
		}

		clearTimeout(this.Timeout!);
		await this.gpio.write(State.HIGH);

		Log(Id, "requested to open the " + this.Name, "GRANTED");
		this.emit("open");

		await Sleep(500);
		await this.gpio.write(State.LOW);
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
