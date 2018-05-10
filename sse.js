const { Transform } = require("stream");
const ms = require("ms");
const EventEmitter = require("events");

class EventStream extends Transform {
    constructor() {
        super({
            writableObjectMode: true,
            allowHalfOpen: false
        });
    };

    _transform(Message, Encoding, Callback) {
        let Result = `event: ${ Message.Event }\n`;

        const Data = Message.Data instanceof Array ? Message.Data : [ Message.Data ];
        for (const Chunk of Data) {
            Result += `data: ${ Chunk }\n`;
        }

        Result += "\n";

        this.push(Result, "utf8");
        Callback();
    };

    Send(event, data) {
        this.write({
            Event: event,
            Data: data
        });
    };
};

class EventManager extends EventEmitter {
    constructor() {
        super();

        this.Clients = new Set();
    };

    Register() {
        const Client = new EventStream();
        this.Clients.add(Client);

        Client.on("close", () => {
            this.Clients.delete(Client);
        });

        this.emit("client", Client);

        return Client;
    }

    Middleware(ctx) {
        ctx.assert(ctx.accepts("text/event-stream"), 403);

        ctx.type = "text/event-stream; charset=utf-8";
        ctx.status = 200;
        ctx.set("Cache-Control", "no-cache");
        ctx.flushHeaders();

        ctx.req.setTimeout(ms("10m"));
        ctx.req.socket.setNoDelay(true);

        ctx.body = this.Register();
    };

    Broadcast(Event, Data) {
        for (const Client of this.Clients) {
            Client.Send(Event, Data);
        }
    };

    get SSE() {
        return this.Middleware.bind(this);
    }
};

module.exports = EventManager;
