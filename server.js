const rpio = require("rpio");
const App = require("express")();
const path = require("path");
const Server = require("http").createServer(App);
const io = require("socket.io")(Server);

rpio.open(8, rpio.OUTPUT, rpio.LOW);
var Locked = false;
var Timeout = null;

function Open() {
	if (!Locked) {
		clearTimeout(Timeout);
		rpio.write(8, rpio.HIGH);
		Timeout = setTimeout(() => { rpio.write(8, rpio.LOW); }, 500);
	}
};

function Lock(Value) {
	if (typeof Value != "boolean") {
		console.log("Received corrupt response from client: " + Value);
		return;
	}

	Locked = Value;
	io.emit("lock_status", Locked);
};

App.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, "public", "index.html"));
});

App.get("/client.js", (req, res) => {
	res.sendFile(path.join(__dirname, "public", "client.js"));
});

io.on("connection", (Socket) => {
	Socket.on("open", Open);
	Socket.on("lock", Lock);
	Socket.emit("lock_status", Locked);
});

Server.listen(3080, function() {
	console.log("Listening on port 3080!");
});
