"use strict";

const Events = new EventSource("/sse");
let Snackbar;

class SnackbarWrapper {
	constructor(Query) {
		this.queue = [];

		this.handle = new mdc.snackbar.MDCSnackbar(document.querySelector(Query));
		this.handle.timeoutMs = 4000;

		// Undocumented, but inherited from MDCComponent
		this.handle.listen("MDCSnackbar:closed", () => {
			if (this.queue.length)
				this.pop();
		});
	}

	notify(Message) {
		this.queue.push(Message);

		if (!this.handle.isOpen)
			this.pop();
	}

	pop() {
		this.handle.labelText = this.queue.shift();
		this.handle.open();
	}
}

document.addEventListener("DOMContentLoaded", () => {
	Snackbar = new SnackbarWrapper(".mdc-snackbar");
	mdc.topAppBar.MDCTopAppBar.attachTo(document.querySelector(".mdc-top-app-bar"));

	RegisterControls("door");
	RegisterControls("gate");

	Events.addEventListener("message", e => Snackbar.notify(e.data));
});

function RegisterControls(Control) {
	const Root = document.getElementById(Control);
	const Button = Root.querySelector("button");
	const Switch = new mdc.switchControl.MDCSwitch(Root.querySelector(".mdc-switch"));

	mdc.ripple.MDCRipple.attachTo(Button);

	Switch.disabled = false;

	Events.addEventListener(`${Control}_status`, e => {
		try {
			UpdateControls({ Button, Switch }, JSON.parse(e.data));
		} catch (error) {
			Snackbar.notify(error);
		}
	});

	Button.addEventListener("click", () =>
		Post(`/api/v1/${Control}`));

	// Undocumented, but inherited from MDCComponent
	Switch.listen("change", () => {
		const Data = { status: Switch.checked };
		Post(`/api/v1/${Control}/lock`, JSON.stringify(Data));
	});
}

function UpdateControls(Controls, Value) {
	Controls.Switch.checked = Value;
	Controls.Switch.disabled = false;
	Controls.Button.disabled = Value;
}

async function Fetch(Method, Url, Data) {
	try {
		const Response = await fetch(Url, {
			method: Method,
			mode: "same-origin",
			credentials: "same-origin",
			redirect: "error",
			body: Data
		});

		if (!Response.ok) {
			throw Error(Response.statusText);
		}

		// Nothing to parse if 204 NO CONTENT
		return Response.status === 204 ? undefined : Response.json();
	} catch (error) {
		Snackbar.notify(error);
		return undefined;
	}
}

const Get = Fetch.bind(this, "GET");
const Post = Fetch.bind(this, "POST");
