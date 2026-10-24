import { Assembler } from "../../../shared/wire";
import { Clock } from "../../../shared/clock";
import {
  VERSION,
  errors,
  type Action,
  type ClientMessage,
  type ServerMessage,
} from "../../../shared/protocol";
export class Transport {
  clock = new Clock();
  private assembler = new Assembler();
  private listeners = new Set<(m: ServerMessage) => void>();
  debug = { rollbacks: 0, maxDepth: 0, freezes: 0, inputDelay: 0, desyncs: 0 };
  subscribe(listener: (m: ServerMessage) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private dispatch(m: ServerMessage) {
    this.onMessage(m);
    for (const listener of this.listeners) listener(m);
  }
  pair = 0;
  rtts: [number, number] = [0, 0];
  connected = false;
  stopped = false;
  recentReconnect = 0;
  private ws?: WebSocket;
  private attempt = 0;
  private generation = 0;
  private lastOut = 0;
  private lastIn = 0;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private heartbeat?: ReturnType<typeof setTimeout>;
  private pending = new Map<
    string,
    {
      m: ClientMessage;
      resolve: () => void;
      reject: (e: Error) => void;
      sent: number;
    }
  >();
  private retry: ReturnType<typeof setInterval>;
  private seq = -1;
  lag: number;
  jitter: number;
  constructor(
    private url: string,
    private code: string,
    private token: string,
    private onMessage: (m: ServerMessage) => void,
    private onStatus: (s: string) => void,
  ) {
    const params = new URLSearchParams(location.search);
    this.lag = Math.max(0, Math.min(2000, Number(params.get("lag")) || 0));
    this.jitter = Math.max(0, Math.min(500, Number(params.get("jitter")) || 0));
    this.retry = setInterval(() => {
      if (this.connected)
        for (const p of this.pending.values())
          if (performance.now() - p.sent > 3000) {
            p.sent = performance.now();
            this.send(p.m);
          }
    }, 1000);
    this.open();
  }
  private delivery = {
    in: [] as { due: number; fn: () => void; generation: number }[],
    out: [] as { due: number; fn: () => void; generation: number }[],
  };
  private pumping = { in: false, out: false };
  private queue(
    direction: "in" | "out",
    fn: () => void,
    generation = this.generation,
  ) {
    const now = performance.now(),
      previous = direction === "in" ? this.lastIn : this.lastOut;
    const due = Math.max(
      previous,
      now + Math.max(0, this.lag + (Math.random() * 2 - 1) * this.jitter),
    );
    if (direction === "in") this.lastIn = due;
    else this.lastOut = due;
    this.delivery[direction].push({ due, fn, generation });
    if (this.pumping[direction]) return;
    this.pumping[direction] = true;
    const pump = () => {
      const queue = this.delivery[direction];
      while (queue.length && queue[0].due <= performance.now()) {
        const item = queue.shift()!;
        if (!this.stopped && item.generation === this.generation) item.fn();
      }
      if (!queue.length) {
        this.pumping[direction] = false;
        return;
      }
      const timer = setTimeout(
        () => {
          this.timers.delete(timer);
          pump();
        },
        Math.max(1, queue[0].due - performance.now()),
      );
      this.timers.add(timer);
    };
    const timer = setTimeout(
      () => {
        this.timers.delete(timer);
        pump();
      },
      Math.max(0, due - now),
    );
    this.timers.add(timer);
  }
  private open() {
    if (this.stopped) return;
    const generation = ++this.generation;
    this.lastIn = this.lastOut = 0;
    this.assembler.clear();
    this.seq = -1;
    this.onStatus(this.attempt ? "正在重新连接…" : "正在连接…");
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () =>
      this.send({ t: "hello", code: this.code, token: this.token, v: VERSION });
    let terminalError: Extract<ServerMessage, { t: "err" }> | undefined;
    ws.onmessage = (ev) => {
      let message: ServerMessage;
      try {
        message = this.assembler.accept(JSON.parse(ev.data));
        if (!message) return;
      } catch {
        return;
      }
      if (
        message.t === "err" &&
        ["REPLACED", "BAD_TOKEN", "ROOM_NOT_FOUND", "VERSION"].includes(
          message.code,
        )
      )
        terminalError = message;
      this.queue(
        "in",
        () => {
          const m = message;
          if (m.t === "welcome") {
            this.connected = true;
            this.attempt = 0;
            this.seq = m.room.seq;
            this.clock.offset = m.now - performance.now();
            this.onStatus("已连接");
            this.ping(performance.now());
            for (const p of this.pending.values()) {
              p.sent = performance.now();
              this.send(p.m);
            }
          }
          if (m.t === "room" || m.t === "game") {
            if (m.seq < this.seq) return;
            if (m.seq > this.seq + 1) {
              ws.close(4000);
              return;
            }
            this.seq = m.seq;
          }
          if (m.t === "pong") this.clock.sample(m.c, m.s, performance.now());
          if (m.t === "net") {
            this.pair = m.pair;
            this.rtts = m.rtt;
          }
          if (m.t === "ack") {
            const p = this.pending.get(m.aid);
            if (p) {
              this.pending.delete(m.aid);
              if (m.ok) p.resolve();
              else p.reject(new Error(errors[m.err || "INVALID"]));
            }
          }
          if (
            m.t === "err" &&
            ["REPLACED", "BAD_TOKEN", "ROOM_NOT_FOUND", "VERSION"].includes(
              m.code,
            )
          ) {
            this.onStatus(m.msg);
            this.stop();
          }
          if (m.t === "evt" && m.e.type === "deleted") {
            this.onStatus("房间已解散");
            this.stop();
          }
          this.dispatch(m);
        },
        generation,
      );
    };
    ws.onclose = (event) => {
      if (generation !== this.generation) return;
      if (event.code === 4003) {
        const message = terminalError || {
          t: "err" as const,
          code: "BAD_TOKEN" as const,
          msg: errors.BAD_TOKEN,
        };
        this.onStatus(message.msg);
        this.stop();
        this.dispatch(message);
        return;
      }
      if (event.code === 4001 || event.code === 4004) {
        const msg = event.code === 4001 ? errors.REPLACED : "房间已解散";
        this.onStatus(msg);
        this.stop();
        if (event.code === 4001)
          this.dispatch({ t: "err", code: "REPLACED", msg });
        else this.dispatch({ t: "evt", seq: this.seq, e: { type: "deleted" } });
        return;
      }
      this.connected = false;
      clearTimeout(this.heartbeat);
      if (this.stopped) return;
      this.recentReconnect = performance.now();
      this.onStatus("连接断开，正在重连…");
      const delay = Math.min(5000, 500 * 2 ** this.attempt++);
      const t = setTimeout(() => {
        this.timers.delete(t);
        this.open();
      }, delay);
      this.timers.add(t);
    };
    ws.onerror = () => {};
  }
  private ping(start: number) {
    clearTimeout(this.heartbeat);
    if (!this.connected) return;
    this.send({ t: "ping", c: performance.now(), rtt: this.clock.rtt });
    this.heartbeat = setTimeout(
      () => this.ping(start),
      performance.now() - start < 3000 ? 250 : 2000,
    );
  }
  send(m: ClientMessage) {
    const ws = this.ws;
    this.queue("out", () => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
    });
  }
  action(a: Action, seq: number) {
    if (!this.connected || this.stopped)
      return Promise.reject(new Error("正在重新连接，请稍等"));
    const aid =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) =>
            x.toString(16).padStart(2, "0"),
          ).join("");
    const m: ClientMessage = { t: "act", aid, a, seq };
    return new Promise<void>((resolve, reject) => {
      this.pending.set(aid, { m, resolve, reject, sent: performance.now() });
      this.send(m);
    });
  }
  now() {
    return this.clock.now(performance.now());
  }
  stop() {
    this.stopped = true;
    this.connected = false;
    this.generation++;
    clearInterval(this.retry);
    clearTimeout(this.heartbeat);
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.delivery.in = [];
    this.delivery.out = [];
    this.pumping = { in: false, out: false };
    this.ws?.close();
    this.assembler.clear();
    for (const p of this.pending.values()) p.reject(new Error("连接已关闭"));
    this.pending.clear();
  }
}
