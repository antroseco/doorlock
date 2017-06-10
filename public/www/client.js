const Socket = io();
var LockStatus;

function OpenDoor() {
	Socket.emit("open");
};

function OpenGate() {
	Socket.emit("gate");
};

function ToggleLock() {
	if (LockStatus != undefined)
		Socket.emit("lock", !LockStatus);
};

document.addEventListener("DOMContentLoaded", () => {
	document.getElementById("door-button").addEventListener("click", OpenDoor);
	document.getElementById("gate-button").addEventListener("click", OpenGate);
	document.getElementById("door-toggle").addEventListener("click", ToggleLock);

	mdc.autoInit();
});

Socket.on("lock_status", (Value) => {
	if (typeof Value != "boolean") {
		console.log("Received corrupt response from server: " + Value);
		return;
	}

	LockStatus = Value;
	document.getElementById("door-toggle").checked = Value;
	document.getElementById("door-toggle").disabled = false;
	document.getElementById("door-button").disabled = Value;
});
