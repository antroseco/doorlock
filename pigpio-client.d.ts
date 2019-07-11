import { EventEmitter } from 'events';

declare module 'pigpio-client' {
    const enum BinaryValue { LOW = 0, HIGH = 1 }

    const enum Pull { CLEAR = 0, DOWN = 1, HIGH = 2 }

    type Callback<T = any> = (error: Error | null, response: T) => void;

    type GpioMode = 'input' | 'in' | 'output' | 'out';

    export function pigpio(Options: {
        host?: string,
        port?: number,
        pipelining?: boolean,
        timeout?: number
    }): PigpioClient;

    class PigpioClient extends EventEmitter {
        private constructor();

        // pigpio methods
        gpio(Pin: number): Gpio;
        serialport(rx: number, tx: number, dtr: number): Serialport;
        getInfo(cb?: Callback<object>): void;
        getCurrentTick(cb?: Callback<number>): void;
        readBank1(cb?: Callback<number>): void;
        end(cb?: Callback<undefined>): void;
        destroy(): void;
        connect(): void;
    }

    class Gpio {
        private constructor();

        // GPIO basic methods
        modeSet(mode: GpioMode, cb?: Callback<undefined>): void;
        modeGet(cb: Callback<number>): void;
        pullUpDown(pud: Pull, cb?: Callback<undefined>): void;
        read(cb: Callback<BinaryValue>): void;
        write(level: BinaryValue, cb?: Callback<undefined>): void;
        analogWrite(DutyCycle: number, cb?: Callback): void;
        setServoPulsewidth(pulseWidth: number, cb?: Callback): void;
        getServoPulsewidth(cb: Callback): void;

        // GPIO waveform methods
        static waveClear(cb?: Callback): void;
        static waveCreate(cb: Callback): void;
        static waveBusy(cb: Callback): void;
        static waveNotBusy(interval: number, cb: Callback): void;
        waveAddPulse(pulse: [BinaryValue, BinaryValue, number], cb?: Callback): void;
        waveChainTx(wids: number[], Options: {
            loop: number,
            delay: number
        }, cb?: Callback): void;
        waveSendSync(wid: number, cb?: Callback): void;
        waveSendOnce(wid: number, cb?: Callback): void;
        waveTxAt(cb: Callback): void;
        waveDelete(wid: number, cb?: Callback): void;

        // GPIO notification methods
        notify(cb: (level: BinaryValue, tick: number) => void): void;
        endNotify(cb?: Callback): void;
        glitchSet(steady: number, cb?: Callback<undefined>): void;

        // GPIO bit_bang_serial methods
        serialReadOpen(baudRate: number, dataBits: number, cb?: Callback): void;
        serialRead(count: number, cb?: Callback): void;
        serialReadClose(cb?: Callback): void;
        serialReadInvert(mode: 'invert' | 'normal', cb?: Callback): void;
        waveAddSerial(baud: number, bits: number, delay: number,
            data: ArrayBuffer | SharedArrayBuffer | ReadonlyArray<number> | Uint8Array | string,
            cb?: Callback): void;
    }

    class Serialport {
        private constructor();

        // Serialport methods
        open(baudrate: number, databits: number, cb?: Callback): void;
        read(cb: Callback): void;
        read(size: number, cb: Callback): void;
        write(data: string | Uint8Array): number;
        close(cb?: Callback): void;
        end(cb?: Callback): void;
    }
}
