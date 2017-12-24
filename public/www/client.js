const Socket = io();
var Snackbar = undefined;

document.addEventListener("DOMContentLoaded", () => {
	RegisterControls("door");
	RegisterControls("gate");

	mdc.autoInit();
	Snackbar = mdc.snackbar.MDCSnackbar.attachTo(document.getElementById("snackbar"));

	Socket.on("message", Show);
});

function RegisterControls(Control) {
	Socket.on(Control + "_status", Value =>
		UpdateControls(Control, Value));
	document.getElementById(Control + "-button").addEventListener("click", () =>
		Socket.emit(Control + "_open"));
	document.getElementById(Control + "-toggle").addEventListener("click", () =>
		Socket.emit(Control + "_lock", document.getElementById(Control + "-toggle").checked));
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

function Show(Message) {
	if (typeof Message != "string") {
		console.error("Received corrupt response from server: " + Message);
		return;
	}

	Snackbar.show({ message: Message });
};
