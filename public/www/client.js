const Socket = io();

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
});

function UpdateControls(Control, Value) {
	if (typeof Value != "boolean") {
		console.log("Received corrupt response from server: " + Value);
		return;
	}

	document.getElementById(Control + "-toggle").checked = Value;
	document.getElementById(Control + "-toggle").disabled = false;
	document.getElementById(Control + "-button").disabled = Value;
};
