const Socket = io();
var LockStatus;

function Open() {
	Socket.emit("open");
};

function ToggleLock() {
	if (LockStatus == null)
		return;

	Socket.emit("lock", !LockStatus);
};

document.addEventListener("DOMContentLoaded", () => {
	document.getElementById("open").addEventListener("click", Open);
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
