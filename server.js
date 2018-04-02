"use strict";

const path = require("path");
const fs = require("fs");
const Koa = require("koa");
const serve = require("koa-static");
const mount = require("koa-mount");
const ms = require("ms");
const logger = require("./logger.js");
const hardware = require("./hardware.js");

const Door = new hardware.Controller("door", 12);
const Gate = new hardware.Controller("gate", 22);
const GPIO = new hardware.Monitor("gpio input", 26, Name => Door.Open(Name));

const HttpsOptions = {
	key:  fs.readFileSync(path.join(__dirname, "private",      "raspberrypi_home.server.key")),
	cert: fs.readFileSync(path.join(__dirname, "public", "ca", "raspberrypi_home.server.crt")),
	crl:  fs.readFileSync(path.join(__dirname, "public", "ca", "raspberrypi_home.ca.crl")),
	ca:   fs.readFileSync(path.join(__dirname, "public", "ca", "raspberrypi_home.ca.crt")),
	requestCert: true,
	rejectUnauthorized: true
};

const App = new Koa();
const Server = require("https").createServer(HttpsOptions, App.callback());

const compress = require("koa-compress");
App.use(compress());

const io = require("socket.io")();
io.origins(["raspberrypi.home:443", "192.168.1.254:443"]);
io.serveClient(false);
io.attach(Server);

const helmet = require("koa-helmet");
App.use(helmet());
App.use(helmet.contentSecurityPolicy({
	directives: {
		defaultSrc: ["'none'"],
		styleSrc: ["'self'"],
		scriptSrc: ["'self'"],
		imgSrc: ["'self'"],
		manifestSrc: ["'self'"],
		connectSrc: ["'self'", "wss:"],
		blockAllMixedContent: true
	}
}));

App.use(serve(path.join(__dirname, "public", "www"), { maxAge: ms("7d"), gzip: false, brotli: false }));
App.use(serve(path.join(__dirname, "node_modules", "material-components-web", "dist"), { maxAge: ms("7d"), immutable: true, gzip: false, brotli: false }));
App.use(serve(path.join(__dirname, "node_modules", "socket.io-client", "dist"), { maxAge: ms("7d"), immutable: true, gzip: false, brotli: false }));
App.use(mount("/ca", serve(path.join(__dirname, "public", "ca"), { maxAge: ms("28d"), immutable: true, gzip: false, brotli: false })));

function RegisterComponent(Socket, Id, Component) {
	Socket.on(Component.Name + "_open", () => {
		if (Component.Open(Id))
			io.emit("message", Component.Name + " opened");
	});
	Socket.on(Component.Name + "_lock", Value => {
		if (Component.Lock(Id, Value))
			io.emit(Component.Name + "_status", Component.Locked);
	});
	Socket.emit(Component.Name + "_status", Component.Locked);
}

io.on("connection", Socket => {
	const Id = Socket.client.request.socket.getPeerCertificate().subject.CN;

	RegisterComponent(Socket, Id, Door);
	RegisterComponent(Socket, Id, Gate);
});

Server.listen(443, "192.168.1.254", () =>
	logger.Info("HTTPS", "listening on port", "443"));
