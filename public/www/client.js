"use strict";

const Events = new EventSource("/sse");
let Snackbar = undefined;

document.addEventListener("DOMContentLoaded", () => {
	mdc.autoInit();
	Snackbar = mdc.snackbar.MDCSnackbar.attachTo(document.getElementById("snackbar"));

	RegisterControls("door");
	RegisterControls("gate");

	Events.addEventListener("message", Event =>
		Snackbar.show({ message: Event.data }));
});

async function RegisterControls(Control) {
	Events.addEventListener(Control + "_status", Event => {
		UpdateControls(Control, JSON.parse(Event.data));
	});

	document.getElementById(Control + "-button").addEventListener("click", () => {
		Post(`/api/v1/${Control}`);
	});

	document.getElementById(Control + "-toggle").addEventListener("click", () => {
		const Data = { status: document.getElementById(Control + "-toggle").checked };
		Post(`/api/v1/${Control}/lock`, JSON.stringify(Data));
	});

	const Json = await Get(`/api/v1/${Control}/lock`);
	if (Json) {
		UpdateControls(Control, Json.status);
	}
}

function UpdateControls(Control, Value) {
	if (typeof Value != "boolean") {
		console.error("Received corrupt response from server: " + Value);
		return;
	}

	document.getElementById(Control + "-toggle").checked = Value;
	document.getElementById(Control + "-toggle").disabled = false;
	document.getElementById(Control + "-button").disabled = Value;
};

async function Fetch(Method, Url, Data) {
	try {
		const Response = await fetch(Url, {
			method: Method,
			mode: "same-origin",
			redirect: "error",
			body: Data
		});

		if (!Response.ok) {
			throw Error(Response.statusText);
		}

		// Nothing to parse if 204 NO CONTENT
		return Response.status == 204 ? undefined : await Response.json();
	} catch(error) {
		Snackbar.show({ message: error });
		return undefined;
	}
};

const Get  = Fetch.bind(this, "GET" );
const Post = Fetch.bind(this, "POST");
