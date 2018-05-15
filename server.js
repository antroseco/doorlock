"use strict";

const config = require("./config.json");

const path = require("path");
const fs = require("fs");
const Koa = require("koa");
const serve = require("koa-static");
const router = require("koa-router");
const compress = require("koa-compress");
const helmet = require("koa-helmet");
const ms = require("ms");
const http2 = require("http2");

const SSE = require("./sse");
const Api = require("./api.js");
const logger = require("./logger.js");
const hardware = require("./hardware.js");

const Door = new hardware.Controller("door", 12);
const Gate = new hardware.Controller("gate", 22);
const GPIO = new hardware.Monitor("gpio input", 26, Name => Door.Open(Name));

const App = new Koa();
const Server = http2.createSecureServer({
	key:  fs.readFileSync(path.join(__dirname, config.credentials.key )),
	cert: fs.readFileSync(path.join(__dirname, config.credentials.cert)),
	ca:   fs.readFileSync(path.join(__dirname, config.credentials.ca  )),
	requestCert: true,
	rejectUnauthorized: true
}, App.callback());

App.use(compress());

App.use(helmet({
	frameguard: {
		action: "deny"
	},
	contentSecurityPolicy: {
		directives: {
			defaultSrc: ["'none'"],
			styleSrc: ["'self'"],
			scriptSrc: ["'self'"],
			imgSrc: ["'self'"],
			manifestSrc: ["'self'"],
			connectSrc: ["'self'"],
			blockAllMixedContent: true
		}
	}
}));

const Router = new router();
const EventManager = new SSE();

function RegisterComponent(Component) {
	Api.Register(Component);

	Component.on("open", () => {
		EventManager.Broadcast("message", `${ Component.Name } opened`);
	});
	Component.on("lock", Value => {
		EventManager.Broadcast(`${ Component.Name }_status`, JSON.stringify(Value));
	});

	EventManager.on("client", Client => {
		Client.Send(`${ Component.Name }_status`, JSON.stringify(Component.Locked));
	});
};

RegisterComponent(Door);
RegisterComponent(Gate);

Router.use("/api/v1", Api.routes, Api.allowedMethods);
Router.get("/sse", EventManager.SSE);

App.use(Router.routes());
App.use(Router.allowedMethods());

App.use(serve(path.join(__dirname, "public", "www"), { maxAge: ms("7d"), gzip: false, brotli: false }));
App.use(serve(path.join(__dirname, "node_modules", "material-components-web", "dist"), { maxAge: ms("7d"), immutable: true, gzip: false, brotli: false }));

Server.listen(config.server.port, config.server.ip, () =>
	logger.Info("HTTP/2", "listening on port", config.server.port));
