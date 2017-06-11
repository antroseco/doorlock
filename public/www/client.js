const Socket = io();
var Snackbar = undefined;

document.addEventListener("DOMContentLoaded", () => {
	Socket.on("door_status", UpdateControls.bind(null, "door"));
	Socket.on("gate_status", UpdateControls.bind(null, "gate"));

	document.getElementById("door-button").addEventListener("click", Socket.emit.bind(Socket, "open"));
	document.getElementById("gate-button").addEventListener("click", Socket.emit.bind(Socket, "gate"));

	document.getElementById("door-toggle").addEventListener("click", () =>
		Socket.emit("door_lock", document.getElementById("door-toggle").checked));
	document.getElementById("gate-toggle").addEventListener("click", () =>
		Socket.emit("gate_lock", document.getElementById("gate-toggle").checked));

	mdc.autoInit();
	Snackbar = mdc.snackbar.MDCSnackbar.attachTo(document.getElementById("snackbar"));

	Socket.on("message", Show);
});

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

	Snackbar.show({ message: Message, timeout: 2750 });
};
