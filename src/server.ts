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
import hardware, { Controller, Monitor, WiegandRfid } from "./hardware";
import logger from "./logger";
import SSE from "./sse";

const ProjectDirectory = path.join(__dirname, "..", "..");

let Door: Controller, Gate: Controller, GPIO: Monitor, Rfid: WiegandRfid;

const App = new Koa();
const Server = http2.createSecureServer({
	key: fs.readFileSync(path.join(ProjectDirectory, config.credentials.key)),
	cert: fs.readFileSync(path.join(ProjectDirectory, config.credentials.cert)),
	ca: fs.readFileSync(path.join(ProjectDirectory, config.credentials.ca)),
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

Router.use("/api/v1", Api.routes, Api.allowedMethods);
Router.get("/sse", EventManager.SSE);

App.use(Router.routes());
App.use(Router.allowedMethods());

App.use(serve(path.join(ProjectDirectory, "public", "www"), { maxAge: ms("7d"), gzip: false, brotli: false }));
App.use(serve(path.join(ProjectDirectory, "node_modules", "material-components-web", "dist"), { maxAge: ms("7d"), immutable: true, gzip: false, brotli: false }));

Server.listen(config.server.port, config.server.ip, () =>
	logger.Info("HTTP/2", "listening on port", config.server.port.toString()));

hardware.once('connected', Info => {
	console.log(JSON.stringify(Info, null, 2));

	Door = new Controller("door", 18);
	Gate = new Controller("gate", 25);
	GPIO = new Monitor("gpio input", 7, Name => Door.Open(Name));
	Rfid = new WiegandRfid(5, 6);

	Rfid.on("card", (Id: string) => {
		// TODO: More consistent logging
		if (config.tags.includes(Id))
			Door.Open(Id);
		else
			logger.Log(Id, "requested to open the " + Door.Name, "UNAUTHORISED");
	});

	RegisterComponent(Door);
	RegisterComponent(Gate);
});

hardware.on('error', logger.Error);
