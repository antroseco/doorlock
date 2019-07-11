import { EventEmitter } from "events";
import { Context } from "koa";
import ms from "ms";
import { Transform } from "stream";

type Packet = {
    Event: string,
    Data: string | ReadonlyArray<string>
};

class EventStream extends Transform {
    constructor() {
        super({
            writableObjectMode: true,
            allowHalfOpen: false
        });
    };

    _transform(Message: Packet, _Encoding: string, Callback: () => void) {
        let Result = `event: ${Message.Event}\n`;

        const Data = [Message.Data].flat();
        for (const Chunk of Data) {
            Result += `data: ${Chunk}\n`;
        }

        Result += "\n";

        this.push(Result, "utf8");
        Callback();
    };

    Send(Event: string, Data: string) {
        this.write({ Event, Data });
    };
};

export default class EventManager extends EventEmitter {
    private Clients = new Set<EventStream>();

    constructor() {
        super();
    };

    Register() {
        const Client = new EventStream();
        this.Clients.add(Client);

        Client.on("close", () => {
            this.Clients.delete(Client);
        });

        this.emit("client", Client);

        return Client;
    };

    Middleware(ctx: Context) {
        ctx.assert(ctx.accepts("text/event-stream"), 403);

        ctx.type = "text/event-stream; charset=utf-8";
        ctx.status = 200;
        ctx.set("Cache-Control", "no-cache");
        ctx.flushHeaders();

        ctx.req.setTimeout(ms("10m"), () => ctx.req.destroy());
        ctx.req.socket.setNoDelay(true);

        ctx.body = this.Register();
    };

    Broadcast(Event: string, Data: string) {
        for (const Client of this.Clients) {
            Client.Send(Event, Data);
        }
    };

    get SSE() {
        return this.Middleware.bind(this);
    }
};
