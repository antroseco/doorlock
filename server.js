const path = require("path");
const fs = require("fs");
const rpio = require("rpio");
const colors = require("colors");
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

const io = require("socket.io")();
io.origins((Origin, Callback) => {
	const Result = Origin === "https://raspberrypi.lan/";

	if (!Result)
		Warn(Origin, "rejected socket connection from", "invalid origin");

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
		Log(Id, "requested to open the door", "REJECTED");
		return;
	}

	clearTimeout(Timeout);
	rpio.write(8, rpio.HIGH);
	Timeout = setTimeout(() => rpio.write(8, rpio.LOW), 3000);

	Log(Id, "requested to open the door", "GRANTED");
};

function Lock(Id, Value) {
	if (typeof Value != "boolean") {
		Log(Id, "received corrupt response", typeof Value);
		return;
	}

	Locked = Value;
	io.emit("lock_status", Value);

	Log(Id, "updated the Lock status", Value.toString());
};

Timestamp = () => ('[' +  new Date().toUTCString() + ']').green;

Log = (User, Message, Details) => console.log(Timestamp(), User.white.bold, Message.white, Details.white.bold);

Info = (User, Message, Details) => console.info(Timestamp(), User.gray.bold, Message.gray, Details.gray.bold);

Warn = (User, Message, Details) => console.warn(Timestamp(), User.yellow.bold, Message.yellow, Details.yellow.bold);

App.all("*", (req, res, next) => {
	if (!req.hostname.endsWith(".lan"))
		res.redirect(301, "https://raspberrypi.lan" + req.originalUrl);
	else
		next();
});

App.use(express.static(path.join(__dirname, "public", "www")));
App.use("/ca", express.static(path.join(__dirname, "public", "ca")));

App.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

App.post("/report-violation", (req, res) => {
	Warn(req.client.getPeerCertificate().subject.CN, "reported a", "CSP violation");

	res.status(204).end();
});

io.on("connection", (Socket) => {
	const Id = Socket.client.request.client.getPeerCertificate().subject.CN;

	Socket.on("open", Open.bind(null, Id));
	Socket.on("lock", Lock.bind(null, Id));
	Socket.emit("lock_status", Locked);
});

Server.listen(3443, () => Info("HTTPS", "listening on port", "3443"));

HttpApp.get("*", (req, res) => res.redirect(301, "https://raspberrypi.lan" +  req.originalUrl));

HttpApp.all("*", (req, res) => res.sendStatus(403));

HttpApp.listen(3080, () => Info("HTTP ", "listening on port", "3080"));
