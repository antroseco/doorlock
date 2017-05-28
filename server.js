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
rpio.poll(26, (Pin) => { if (rpio.read(Pin)) Open("GPIO Input"); }, rpio.POLL_HIGH);

var Locked = false;
var Timeout = null;

function Open(Id) {
	if (Locked) {
		Log("User " + Id + " requested to open the door - REJECTED");
		return;
	}

	clearTimeout(Timeout);
	rpio.write(8, rpio.HIGH);
	Timeout = setTimeout(() => { rpio.write(8, rpio.LOW); }, 3000);

	Log("User " + Id + " requested to open the door - GRANTED");
};

function Lock(Id, Value) {
	if (typeof Value != "boolean") {
		Log("Received corrupt response from user " + Id + ": " + Value);
		return;
	}

	Locked = Value;
	io.emit("lock_status", Locked);

	Log("User " + Id + " changed the Lock value to " + Value);
};

function Timestamp() {
	return '[' +  new Date().toUTCString() + ']';
};

function Log(Message) {
	console.log(Timestamp() + ' ' + Message);
};

App.use("/ca", express.static(path.join(__dirname, "public", "ca")));

App.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, "public", "index.html"));
});

App.get("/client.js", (req, res) => {
	res.sendFile(path.join(__dirname, "public", "client.js"));
});

App.get("/style.css", (req, res) => {
	 res.sendFile(path.join(__dirname, "public", "style.css"));
});

io.on("connection", (Socket) => {
	const Id = Socket.client.request.client.getPeerCertificate().subject.CN;

	Socket.on("open", Open.bind(null, Id));
	Socket.on("lock", Lock.bind(null, Id));
	Socket.emit("lock_status", Locked);
});

Server.listen(3443, () => {
	Log("Listening on port 3443 for HTTPS connections");
});

HttpApp.get("*", (req, res) => {
	res.redirect("https://raspberrypi.lan" +  req.originalUrl);
});

HttpApp.listen(3080, () => {
	Log("Listening on port 3080 for HTTP connections");
});
