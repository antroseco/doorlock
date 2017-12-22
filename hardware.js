const rpio = require("rpio");
const logger = require("./logger.js");

class Monitor {
	constructor(Name, Pin, Action) {
		this.Name = Name;
		this.Pin = Pin;
		this.Timeout = false;
		this.Action = Action;

		rpio.open(this.Pin, rpio.INPUT, rpio.PULL_DOWN);
		rpio.poll(this.Pin, this.Process.bind(this), rpio.POLL_HIGH);
	}

	async Process() {
// POLL_HIGH doesn't do anything, so confirm that this is a rising edge
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
				setTimeout(() => resolve(rpio.read(this.Pin)), 2 ** (3 * i)));
		}

		return Values.reduce(async (x, y) => await x && await y);
	}
}

class Controller {
	constructor(Name, Pin) {
		this.Name = Name;
		this.Pin = Pin;
		this.Locked = false;
		this.Timeout = null;

		rpio.open(this.Pin, rpio.OUTPUT, rpio.LOW);
	}

	Open(Id) {
		if (this.Locked) {
			logger.Log(Id, "requested to open the " + this.Name, "REJECTED");
			return false;
		}

		clearTimeout(this.Timeout);
		rpio.write(this.Pin, rpio.HIGH);
		this.Timeout = setTimeout(() => rpio.write(this.Pin, rpio.LOW), 500);

		logger.Log(Id, "requested to open the " + this.Name, "GRANTED");

		return true;
	}

	Lock(Id, Value) {
		if (typeof Value != "boolean" || Value === this.Locked) {
			logger.Log(Id, "received corrupt response", typeof Value);
			return false;
		}

		this.Locked = Value;

		logger.Log(Id, "updated the " + this.Name + " lock status", Value.toString());

		return true;
	}
}

module.exports.Monitor = Monitor;
module.exports.Controller = Controller;
