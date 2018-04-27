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

const RestApi = require("./api.js");
const Api = new RestApi();
App.use(Api.routes);
App.use(Api.allowedMethods);

Api.Register(Door);
Api.Register(Gate);

const SSE = require("./sse");
const EventManager = new SSE();
App.use(mount("/sse", EventManager.SSE));

Door.on("open", () => {
	EventManager.Broadcast("message", "Door opened");
});
Door.on("lock", Value => {
	EventManager.Broadcast("door_status", JSON.stringify(Value));
});

Gate.on("open", () => {
	EventManager.Broadcast("message", "Gate opened");
});
Gate.on("lock", Value => {
	EventManager.Broadcast("gate_status", JSON.stringify(Value));
});

App.use(serve(path.join(__dirname, "public", "www"), { maxAge: ms("7d"), gzip: false, brotli: false }));
App.use(serve(path.join(__dirname, "node_modules", "material-components-web", "dist"), { maxAge: ms("7d"), immutable: true, gzip: false, brotli: false }));
App.use(mount("/ca", serve(path.join(__dirname, "public", "ca"), { maxAge: ms("28d"), immutable: true, gzip: false, brotli: false })));

function RegisterComponent(Socket, Id, Component) {
	Socket.on(Component.Name + "_open", () => {
		Component.Open(Id);
	});
	Socket.on(Component.Name + "_lock", Value => {
		Component.Lock(Id, Value)
	});
	Socket.emit(Component.Name + "_status", Component.Locked);
}

Server.listen(443, "192.168.1.254", () =>
	logger.Info("HTTPS", "listening on port", "443"));
