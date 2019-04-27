import { constants } from "crypto";
import fs from "fs";
import http2 from "http2";
import Koa from "koa";
import compress from "koa-compress";
import helmet from "koa-helmet";
import router from "koa-router";
import serve from "koa-static";
import ms from "ms";
import path from "path";
import config from "../config.json";
import Api from "./api";
import { Controller, Monitor } from "./hardware";
import logger from "./logger";
import SSE from "./sse";

const Door = new Controller("door", 18);
const Gate = new Controller("gate", 25);
const GPIO = new Monitor("gpio input", 7, Name => Door.Open(Name));

const App = new Koa();
const Server = http2.createSecureServer({
	key: fs.readFileSync(path.join(__dirname, config.credentials.key)),
	cert: fs.readFileSync(path.join(__dirname, config.credentials.cert)),
	ca: fs.readFileSync(path.join(__dirname, config.credentials.ca)),
	requestCert: true,
	rejectUnauthorized: true,
	allowHTTP1: true,
	secureOptions: constants.SSL_OP_NO_TLSv1
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

function RegisterComponent(Component: Controller) {
	Api.Register(Component);

	Component.on("open", () => {
		EventManager.Broadcast("message", `${Component.Name} opened`);
	});
	Component.on("lock", Value => {
		EventManager.Broadcast(`${Component.Name}_status`, JSON.stringify(Value));
	});

	EventManager.on("client", Client => {
		Client.Send(`${Component.Name}_status`, JSON.stringify(Component.Locked));
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
	logger.Info("HTTP/2", "listening on port", config.server.port.toString()));
