const Socket = io();

document.addEventListener("DOMContentLoaded", () => {
	document.getElementById("door-button").addEventListener("click", Socket.emit.bind(Socket, "open"));
	document.getElementById("gate-button").addEventListener("click", Socket.emit.bind(Socket, "gate"));

	document.getElementById("door-toggle").addEventListener("click", () =>
		Socket.emit("lock", document.getElementById("door-toggle").checked));

	mdc.autoInit();
});

Socket.on("lock_status", (Value) => {
	if (typeof Value != "boolean") {
		console.log("Received corrupt response from server: " + Value);
		return;
	}

	document.getElementById("door-toggle").checked = Value;
	document.getElementById("door-toggle").disabled = false;
	document.getElementById("door-button").disabled = Value;
});
