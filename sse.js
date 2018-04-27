const { Transform } = require("stream");
const ms = require("ms");

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

class EventManager {
    constructor() {
        this.Clients = [];
    };

    Register() {
        const Client = new EventStream();
        this.Clients.push(Client);

        Client.on("close", () => {
            this.Clients = this.Clients.filter(x => x != Client);
        });

        return Client;
    }

    Middleware(ctx) {
        ctx.assert(ctx.accepts("text/event-stream"), 403);

        ctx.type = "text/event-stream; charset=utf-8";
        ctx.status = 200;
        ctx.set("Cache-Control", "no-cache");
        ctx.set("Connection", "keep-alive");
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

// const Koa = require('koa');
// const app = module.exports = new Koa();

// const Manager = new EventManager();
// Manager.on("client", Client => {
//     Client.Send("hello", "hi client");
//     Manager.Broadcast("notice", "new client in town");
//     Manager.Broadcast("clients", Manager.Clients);
// });

// app.use(Manager.SSE);
// app.listen(8000);
