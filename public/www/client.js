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
	document.getElementById("open").addEventListener("click", OpenDoor);
	document.getElementById("gate").addEventListener("click", OpenGate);
	document.getElementById("lock").addEventListener("click", ToggleLock);
});

Socket.on("lock_status", (Value) => {
	if (typeof Value != "boolean") {
		console.log("Received corrupt response from server: " + Value);
		return;
	}

	LockStatus = Value;
	document.getElementById("lock").innerHTML = Value;
});
