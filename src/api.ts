import { Context } from "koa";
import Router from "koa-router";
import { TLSSocket } from "tls";
import { URL } from "url";
import config from "../config.json";
import { Controller } from "./hardware";

export const Rest = {
    Controllers: new Map(),

    api: new Router(),

    get routes() {
        return this.api.routes();
    },

    get allowedMethods() {
        return this.api.allowedMethods();
    },

    Register(Component: Controller) {
        this.Controllers.set(Component.Name, Component);
    }
};

function Act(ctx: Context) {
    ctx.state.device.Open(ctx.state.id);

    ctx.status = 204;
}

Rest.api
    // Stateless CSRF protection
    .use(async (ctx, next) => {
        const Re = /^(\w+\.)*doorlock\.party$/i;

        const Origin = ctx.headers.origin || ctx.headers.referer;
        const Hostname = new URL(Origin).hostname;

        ctx.assert(Re.test(Hostname) || Hostname == config.server.ip, 403);

        await next();
    })
    // Save client ID
    .use(async (ctx, next) => {
        ctx.state.id = (ctx.socket as TLSSocket).getPeerCertificate().subject.CN;

        await next();
    })
    // Verify device exists
    .param("device", async (device, ctx, next) => {
        ctx.assert(Rest.Controllers.has(device), 404);
        ctx.state.device = Rest.Controllers.get(device);

        await next();
    })
    // Verify tag is allowed
    .param("tag", async (tag, ctx, next) => {
        const Tag = config.tags.find(x => x.id === tag);

        ctx.assert(Tag, 403);
        ctx.state.device = Rest.Controllers.get(Tag!.device);

        await next();
    })
    // Trigger device
    .post("/tag/:tag", Act)
    .post("/:device", Act)
    // Query lock status
    .get("/:device/lock", ctx => {
        ctx.type = "application/json";
        ctx.body = JSON.stringify({
            status: ctx.state.device.Locked
        });
    })
    // Set lock value
    .post("/:device/lock", async ctx => {
        try {
            const Post = await GetPost(ctx);
            const Data = JSON.parse(Post);

            ctx.assert(typeof Data.status == "boolean", 400);
            ctx.state.device.Lock(ctx.state.id, Data.status);

            ctx.status = 204;
        } catch (error) {
            /* GetPOST() throws 413 if the request is too large,
             * otherwise assume a malformed JSON payload */
            ctx.throw(error == 413 ? 413 : 400);
        }
    });

function GetPost(ctx: Context): Promise<string> {
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

export default Rest;
