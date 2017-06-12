const path = require("path");
const fs = require("fs");
const rpio = require("rpio");
const express = require("express");
const logger = require("./logger.js");

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

const io = require("socket.io")();
io.origins((Origin, Callback) => {
	const Result = Origin === "https://raspberrypi.lan/";

	if (!Result)
		logger.Warn(Origin, "rejected socket connection from", "invalid origin");

	Callback(null, Result);
});
io.attach(Server);

const helmet = require("helmet");
App.use(helmet());
App.use(helmet.contentSecurityPolicy({
	directives: {
		defaultSrc: ["'none'"],
		styleSrc: ["'self'"],
		scriptSrc: ["'self'"],
		connectSrc: ["'self'", "wss://raspberrypi.lan"],
		reportUri: "/report-violation"
	}
}));

rpio.open(8, rpio.OUTPUT, rpio.LOW);
rpio.open(22, rpio.OUTPUT, rpio.LOW);
rpio.open(26, rpio.INPUT, rpio.PULL_DOWN);
// rpio.POLL_HIGH doesn't actually do anything in the current version of rpio
rpio.poll(26, Pin => { if (rpio.read(Pin)) OpenDoor("GPIO Input"); }, rpio.POLL_HIGH);

var DoorLocked = false;
var GateLocked = false;
var DoorTimeout = null;
var GateTimeout = null;

function OpenDoor(Id) {
	if (DoorLocked) {
		logger.Log(Id, "requested to open the door", "REJECTED");
		return;
	}

	clearTimeout(DoorTimeout);
	rpio.write(8, rpio.HIGH);
	DoorTimeout = setTimeout(() => rpio.write(8, rpio.LOW), 500);

	io.emit("message", "Door opened");
	logger.Log(Id, "requested to open the door", "GRANTED");
};

function OpenGate(Id) {
	if (GateLocked) {
		logger.Log(Id, "requested to open the gate", "REJECTED");
		return;
	}

	clearTimeout(GateTimeout);
	rpio.write(22, rpio.HIGH);
	GateTimeout = setTimeout(() => rpio.write(22, rpio.LOW), 1000);

	io.emit("message", "Gate opened");
	logger.Log(Id, "requested to open the gate", "GRANTED");
};

function LockDoor(Id, Value) {
	if (typeof Value != "boolean" || Value === DoorLocked) {
		logger.Log(Id, "received corrupt response", typeof Value);
		return;
	}

	DoorLocked = Value;
	io.emit("door_status", Value);

	logger.Log(Id, "updated the Door Lock status", Value.toString());
};

function LockGate(Id, Value) {
	if (typeof Value != "boolean" || Value === GateLocked) {
		logger.Log(Id, "received corrupt response", typeof Value);
		return;
	}

	GateLocked = Value;
	io.emit("gate_status", Value);

	logger.Log(Id, "updated the Gate Lock status", Value.toString());
};

App.all("*", (req, res, next) => {
	if (!req.hostname.endsWith(".lan"))
		res.redirect(301, "https://raspberrypi.lan" + req.originalUrl);
	else
		next();
});

App.use(express.static(path.join(__dirname, "public", "www")));
App.use(express.static(path.join(__dirname, "node_modules", "material-components-web", "dist")));
App.use("/ca", express.static(path.join(__dirname, "public", "ca")));

App.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

App.post("/report-violation", (req, res) => {
	logger.Warn(req.client.getPeerCertificate().subject.CN, "reported a", "CSP violation");

	res.status(204).end();
});

io.on("connection", Socket => {
	const Id = Socket.client.request.client.getPeerCertificate().subject.CN;

	Socket.on("open", OpenDoor.bind(null, Id));
	Socket.on("gate", OpenGate.bind(null, Id));
	Socket.on("door_lock", LockDoor.bind(null, Id));
	Socket.on("gate_lock", LockGate.bind(null, Id));
	Socket.emit("door_status", DoorLocked);
	Socket.emit("gate_status", GateLocked);
});

Server.listen(3443, () => logger.Info("HTTPS", "listening on port", "3443"));
