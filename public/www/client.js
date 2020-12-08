"use strict";

const Events = new EventSource("/sse");
let Snackbar;

class SnackbarWrapper {
	constructor(Query) {
		this.queue = [];

		this.native = document.querySelector(Query);
		this.native.addEventListener("MDCSnackbar:closed", () => {
			if (this.queue.length)
				this.pop();
		});

		this.handle = new mdc.snackbar.MDCSnackbar(this.native);
		this.handle.timeoutMs = 4000;
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
	const Native = Root.querySelector("input");
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

	Native.addEventListener("change", () => {
		const Data = { status: Native.checked };
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
