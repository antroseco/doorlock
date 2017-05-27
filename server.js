const path = require("path");
const fs = require("fs");
const rpio = require("rpio");
const express = require("express");

const HttpsOptions = {
	key: fs.readFileSync(path.join(__dirname, "private", "raspberrypi_lan.server.key")),
	cert: fs.readFileSync(path.join(__dirname, "public", "ca", "raspberrypi_lan.server.crt")),
	crl: fs.readFileSync(path.join(__dirname, "public", "ca", "raspberrypi_lan.ca.crl")),
	ca: fs.readFileSync(path.join(__dirname, "public", "ca", "raspberrypi_lan.ca.crt")),
	requestCert: true,
	rejectUnauthorized: true
};

const App = express();
const Server = require("https").createServer(HttpsOptions, App);
const io = require("socket.io")(Server);

const HttpApp = require("express")();
const HttpServer = require("http").createServer(HttpApp);

rpio.open(8, rpio.OUTPUT, rpio.LOW);
rpio.open(26, rpio.INPUT, rpio.PULL_DOWN);
// rpio.POLL_HIGH doesn't actually do anything in the current version of rpio
rpio.poll(26, (Pin) => { if (rpio.read(Pin)) Open(); }, rpio.POLL_HIGH);

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

App.use("/ca", express.static(path.join(__dirname, "public", "ca")));

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

Server.listen(3443, () => {
	console.log("Listening on port 3443 for HTTPS connections");
});

HttpApp.get("*", (req, res) => {
	res.redirect("https://raspberrypi.lan" +  req.originalUrl);
});

HttpApp.listen(3080, () => {
	console.log("Listening on port 3080 for HTTP connections");
});
