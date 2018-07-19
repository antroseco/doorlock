"use strict";

const { Gpio } = require("onoff");
const logger = require("./logger.js");
const EventEmitter = require("events");

class Monitor {
	constructor(Name, Pin, Action) {
		this.Name = Name;
		this.Timeout = false;
		this.Action = Action;

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
			logger.Info(this.Name, "signal was", "debounced");
		}
	}

	async Debounce() {
		let Values = [];
		for (let i = 0; i <= 3 ; ++i) {
			Values[i] = new Promise(resolve =>
				setTimeout(() => resolve(this.gpio.readSync()), 2 ** (3 * i)));
		}

		return Values.reduce(async (x, y) => await x && await y);
	}
}

class Controller extends EventEmitter {
	constructor(Name, Pin) {
		super();

		this.Name = Name;
		this.Locked = false;
		this.Timeout = null;

		this.gpio = new Gpio(Pin, "low");
		process.on("exit", () => this.gpio.unexport());
	}

	Open(Id) {
		if (this.Locked) {
			logger.Log(Id, "requested to open the " + this.Name, "REJECTED");
			return false;
		}

		clearTimeout(this.Timeout);
		this.gpio.writeSync(Gpio.HIGH);
		this.Timeout = setTimeout(() => this.gpio.writeSync(Gpio.LOW), 500);

		logger.Log(Id, "requested to open the " + this.Name, "GRANTED");
		this.emit("open");

		return true;
	}

	Lock(Id, Value) {
		if (typeof Value != "boolean" || Value === this.Locked) {
			logger.Log(Id, "received corrupt response", typeof Value);
			return false;
		}

		this.Locked = Value;

		logger.Log(Id, "updated the " + this.Name + " lock status", Value.toString());
		this.emit("lock", Value);

		return true;
	}
}

module.exports.Monitor = Monitor;
module.exports.Controller = Controller;
