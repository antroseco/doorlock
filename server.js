const path = require("path");
const fs = require("fs");
const express = require("express");
const logger = require("./logger.js");
const hardware = require("./hardware.js");

const Door = new hardware.Controller("door", 12);
const Gate = new hardware.Controller("gate", 22);
const GPIO = new hardware.Monitor("gpio input", 26, Name => Door.Open(Name));

const HttpsOptions = {
	key:  fs.readFileSync(path.join(__dirname, "private",      "raspberrypi_lan.server.key")),
	cert: fs.readFileSync(path.join(__dirname, "public", "ca", "raspberrypi_lan.server.crt")),
	crl:  fs.readFileSync(path.join(__dirname, "public", "ca", "raspberrypi_lan.ca.crl")),
	ca:   fs.readFileSync(path.join(__dirname, "public", "ca", "raspberrypi_lan.ca.crt")),
	requestCert: true,
	rejectUnauthorized: true
};

const App = express();
const Server = require("https").createServer(HttpsOptions, App);

const shrinkRay = require("shrink-ray");
App.use(shrinkRay());

const io = require("socket.io")();
io.origins(["raspberrypi.lan:443", "192.168.1.254:443"]);
io.attach(Server);

const helmet = require("helmet");
App.use(helmet());
App.use(helmet.contentSecurityPolicy({
	directives: {
		defaultSrc: ["'none'"],
		styleSrc: ["'self'"],
		scriptSrc: ["'self'"],
		imgSrc: ["'self'"],
		manifestSrc: ["'self'"],
		connectSrc: ["'self'", "wss:"],
		reportUri: "/report-violation",
		blockAllMixedContent: true
	}
}));

App.use(express.static(path.join(__dirname, "public", "www"), { maxAge: "7d" }));
App.use(express.static(path.join(__dirname, "node_modules", "material-components-web", "dist"), { maxAge: "7d", immutable: true }));
App.use("/ca", express.static(path.join(__dirname, "public", "ca"), { maxAge: "28d", immutable: true }));

App.post("/report-violation", (req, res) => {
	logger.Warn(req.client.getPeerCertificate().subject.CN, "reported a", "CSP violation");

	res.status(204).end();
});

function RegisterComponent(Socket, Id, Component) {
	Socket.on(Component.Name + "_open", () => {
		if (Component.Open(Id))
			io.emit("message", Component.Name + " opened");
	});
	Socket.on(Component.Name + "_lock", Value => {
		Component.Lock(Id, Value);
		io.emit(Component.Name + "_status", Component.Locked);
	});
	Socket.emit(Component.Name + "_status", Component.Locked);
}

io.on("connection", Socket => {
	const Id = Socket.client.request.client.getPeerCertificate().subject.CN;

	RegisterComponent(Socket, Id, Door);
	RegisterComponent(Socket, Id, Gate);
});

Server.listen(3443, () => logger.Info("HTTPS", "listening on port", "3443"));
