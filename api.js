"use strict";

const Router = require("koa-router");
const Hardware = require("./hardware.js")
const { URL } = require("url");

class RestApi {
    constructor() {
        this.Controllers = {};

        this.api = new Router({
            prefix: "/api/v1"
        });

        this.api
            // Stateless CSRF protection
            .use(async (ctx, next) => {
                if (ctx.headers.origin) {
                    var RequestOrigin = ctx.headers.origin;
                } else if (ctx.headers.referer) {
                    const Referer = new URL(ctx.headers.referer);

                    var RequestOrigin = Referer.origin;
                }

                ctx.assert(RequestOrigin == ctx.origin, 403);

                await next();
            })
            // Save client ID
            .use(async (ctx, next) => {
                ctx.state.id = ctx.socket.getPeerCertificate().subject.CN;

                await next();
            })
            // Verify device exists
            .param("device", async (device, ctx, next) => {
                ctx.assert(this.Controllers[device], 404);

                await next();
            })
            // Trigger device
            .post("/:device", ctx => {
                this.Controllers[ctx.params.device].Open(ctx.state.id);

                ctx.status = 204;
            })
            // Query lock status
            .get("/:device/lock", ctx => {
                ctx.type = "application/json";
                ctx.body = JSON.stringify({
                    status: this.Controllers[ctx.params.device].Locked
                });
            })
            // Set lock value
            .post("/:device/lock", async ctx => {
                try {
                    const Post = await GetPost(ctx);
                    const Data = JSON.parse(Post);

                    ctx.assert(typeof Data.status == "boolean", 400);
                    this.Controllers[ctx.params.device].Lock(ctx.state.id, Data.status);

                    ctx.status = 204;
                } catch(error) {
                    /* GetPOST() throws 413 if the request is too large,
                     * otherwise assume a malformed JSON payload */
                    ctx.throw(error == 413 ? 413 : 400);
                }
            });
    };

    Register(Component) {
        if (Component instanceof Hardware.Controller) {
            this.Controllers[Component.Name] = Component;
        } else {
            throw Error("Invalid arguments");
        }
    };

    get routes() {
        return this.api.routes();
    };

    get allowedMethods() {
        return this.api.allowedMethods();
    };
};

function GetPost(ctx) {
    let Buffer = "";

    return new Promise((resolve, reject) => {
        ctx.req.on("data", chunk => {
            Buffer += chunk;

            if (Buffer.length > 16) {
                reject(413);
            }
        });
        ctx.req.on("end", () => {
            resolve(Buffer);
        });
        ctx.req.on("error", error => {
            reject(error);
        });
    });
};

module.exports = RestApi;
