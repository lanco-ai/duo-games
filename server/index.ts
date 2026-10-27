import { frames } from "../shared/wire";
import { randomUUID } from "node:crypto";
import { imageInfo } from "./images";
import { text as checkedText } from "../shared/text";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFileSync, statSync, existsSync } from "node:fs";
import { resolve, dirname, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { Store } from "./store";
import { cards } from "../shared/content/cards";
import { RoomManager, type LiveRoom, type Peer } from "./rooms";
import { Matchmaking } from "./matchmaking";
import { Bucket } from "./ratelimit";
import {
  VERSION,
  COLORS,
  errors,
  validProfile,
  type ErrCode,
  type Seat,
  type ClientMessage,
  type ServerMessage,
} from "../shared/protocol";
interface Options {
  port?: number;
  base?: string;
  data?: string;
  web?: string;
  lag?: number;
  creationLimit?: number;
}
export function createApp(options: Options = {}) {
  const base =
    "/" +
    (options.base ?? process.env.BASE_PATH ?? "/")
      .split("/")
      .filter(Boolean)
      .join("/");
  const prefix = base === "/" ? "" : base;
  const data =
    options.data ?? resolve(process.env.DATA_DIR || "data", "duo.db");
  const web =
    options.web ?? resolve(dirname(fileURLToPath(import.meta.url)), "web");
  const store = new Store(data),
    manager = new RoomManager(store),
    matchmaking = new Matchmaking(manager),
    matchLimits = new Map<string, { bucket: Bucket; at: number }>(),
    limits = new Map<string, { bucket: Bucket; at: number }>();
  const lag = Math.max(
    0,
    Math.min(2000, options.lag ?? (Number(process.env.DUO_LAG_MS) || 0)),
  );
  function json(res: ServerResponse, status: number, value: unknown) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(JSON.stringify(value));
  }
  async function body(req: IncomingMessage) {
    if (!req.headers["content-type"]?.startsWith("application/json"))
      throw new Error("INVALID");
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 16384) throw new Error("INVALID");
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString());
  }
  const server = createServer(async (req, res) => {
    try {
      if (req.headers.origin) {
        const origin = new URL(req.headers.origin);
        if (origin.host !== req.headers.host) {
          json(res, 403, { error: "INVALID", message: "来源不匹配" });
          return;
        }
      }
      const path = new URL(req.url || "/", "http://localhost").pathname;
      if (path === prefix + "/api/health") {
        json(res, 200, { ok: true, version: VERSION });
        return;
      }
      if (path.startsWith(prefix + "/api/")) {
        const route = path.slice((prefix + "/api/").length).split("/"),
          code = route[1];
        if (route[0] === "matchmaking" && route.length === 1) {
          if (req.method === "POST") {
            const input = await body(req);
            if (
              !validProfile(input.profile) ||
              typeof input.clientId !== "string"
            )
              throw new Error("INVALID");
            const forwarded =
              process.env.TRUST_PROXY === "1"
                ? req.headers["x-real-ip"]
                : undefined;
            const ip =
              (typeof forwarded === "string"
                ? forwarded
                : req.socket.remoteAddress) || "unknown";
            let entry = matchLimits.get(ip);
            if (!entry) {
              entry = { bucket: new Bucket(1 / 3, 20), at: Date.now() };
              matchLimits.set(ip, entry);
            }
            entry.at = Date.now();
            if (!entry.bucket.take()) throw new Error("RATE_LIMITED");
            json(
              res,
              201,
              matchmaking.start(input.clientId, {
                ...input.profile,
                nickname: input.profile.nickname.trim(),
              }),
            );
            return;
          }
          const ticket =
            req.headers.authorization?.replace(/^Bearer /, "") || "";
          if (req.method === "GET") {
            json(res, 200, matchmaking.status(ticket));
            return;
          }
          if (req.method === "DELETE") {
            json(res, 200, matchmaking.cancel(ticket));
            return;
          }
          throw new Error("INVALID");
        }
        if (route[0] !== "rooms") throw new Error("ROOM_NOT_FOUND");
        if (route.length === 1 && req.method === "POST") {
          const input = await body(req);
          if (!validProfile(input.profile)) throw new Error("INVALID");
          const forwarded =
            process.env.TRUST_PROXY === "1"
              ? req.headers["x-real-ip"]
              : undefined;
          const ip =
            (typeof forwarded === "string"
              ? forwarded
              : req.socket.remoteAddress) || "unknown";
          let entry = limits.get(ip);
          if (!entry) {
            entry = {
              bucket: new Bucket(
                (options.creationLimit ?? 10) / 3600,
                options.creationLimit ?? 10,
              ),
              at: Date.now(),
            };
            limits.set(ip, entry);
          }
          entry.at = Date.now();
          if (!entry.bucket.take()) throw new Error("RATE_LIMITED");
          json(
            res,
            201,
            manager.create({
              ...input.profile,
              nickname: input.profile.nickname.trim(),
            }),
          );
          return;
        }
        if (!/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/.test(code || ""))
          throw new Error("ROOM_NOT_FOUND");
        const room = manager.require(code);
        if (route.length === 2 && req.method === "GET") {
          const p = room.data.profiles[0];
          json(res, 200, {
            exists: true,
            full: !!room.data.profiles[1],
            host: { nickname: p.nickname, avatar: p.avatar },
            hostOnline: room.view.online[0],
            availableColors: COLORS.filter((c) => c !== p.color),
          });
          return;
        }
        if (
          route.length === 3 &&
          route[2] === "join" &&
          req.method === "POST"
        ) {
          const input = await body(req);
          if (!validProfile(input.profile)) throw new Error("INVALID");
          json(
            res,
            201,
            manager.join(code, {
              ...input.profile,
              nickname: input.profile.nickname.trim(),
            }),
          );
          return;
        }
        if (
          route.length === 3 &&
          route[2] === "rebind" &&
          req.method === "POST"
        ) {
          const input = await body(req);
          json(res, 200, manager.rebind(room, input.secret));
          return;
        }
        const seat = manager.auth(
          room,
          req.headers.authorization?.replace(/^Bearer /, ""),
        );
        if (route[2] === "images") {
          if (req.method === "POST" && route.length === 3) {
            const chunks: Buffer[] = [];
            let size = 0;
            for await (const chunk of req) {
              size += chunk.length;
              if (size > 2 * 1024 * 1024) throw new Error("INVALID");
              chunks.push(chunk);
            }
            const bytes = Buffer.concat(chunks),
              info = imageInfo(bytes);
            if (req.headers["content-type"]?.split(";")[0] !== info.mime)
              throw new Error("INVALID");
            const imageId = store.addImage(code, bytes, info.mime, info.ratio);
            manager.persist(room);
            json(res, 201, { imageId, ratio: info.ratio });
            return;
          }
          if (
            req.method === "GET" &&
            route.length === 4 &&
            /^[a-f0-9-]{36}$/.test(route[3])
          ) {
            const image = store.image(code, route[3]);
            res.writeHead(200, {
              "Content-Type": image.mime,
              "Cache-Control": "private, max-age=3600",
              "X-Content-Type-Options": "nosniff",
            });
            res.end(image.body);
            return;
          }
          throw new Error("INVALID");
        }
        if (route[2] === "game-data" && req.method === "GET") {
          const url = new URL(req.url!, "http://localhost");
          if (!room.extra || url.searchParams.get("run") !== room.extra.run)
            throw new Error("STALE");
          json(
            res,
            200,
            room.extra.data?.(seat, url.searchParams.get("kind") || "") ?? {},
          );
          return;
        }
        if (route[2] === "gallery" && req.method === "GET") {
          const offset = Number(
            new URL(req.url!, "http://localhost").searchParams.get("offset") ||
              0,
          );
          if (!Number.isSafeInteger(offset) || offset < 0)
            throw new Error("INVALID");
          json(
            res,
            200,
            route.length === 4
              ? store.galleryItem(code, route[3])
              : { items: store.gallery(code, offset) },
          );
          return;
        }
        if (route[2] === "history" && req.method === "GET") {
          json(res, 200, { matches: store.history(code) });
          return;
        }
        if (route[2] === "custom") {
          if (req.method === "GET") {
            json(res, 200, {
              items: store
                .custom(code)
                .filter((x) => x.kind !== "word" || x.author === seat),
            });
            return;
          }
          if (req.method === "POST") {
            const input = await body(req);
            if (route.length === 3) {
              let data: any;
              if (input.kind === "word")
                data = { word: checkedText(input.word, 20) };
              else if (input.kind === "question") {
                const question = checkedText(input.text, 60);
                if (
                  input.options !== undefined &&
                  (!Array.isArray(input.options) || input.options.length !== 4)
                )
                  throw new Error("INVALID");
                data = {
                  text: question,
                  options: input.options?.map((x: unknown) =>
                    checkedText(x, 30),
                  ),
                };
              } else if (input.kind === "promise")
                data = {
                  text: checkedText(input.text, 60),
                  accepted: false,
                  done: false,
                };
              else throw new Error("INVALID");
              const id = store.addCustom(code, input.kind, seat, data);
              manager.persist(room);
              json(res, 201, { id });
            } else if (route.length === 4) {
              const item = store.custom(code).find((x) => x.id === route[3]);
              if (!item || item.kind !== "promise") throw new Error("INVALID");
              if (
                input.action === "accept" &&
                seat !== item.author &&
                !item.data.accepted
              )
                item.data.accepted = true;
              else if (input.action === "done" && item.data.accepted)
                item.data.done = true;
              else throw new Error("INVALID");
              store.updateCustom(code, item.id, item.data);
              manager.persist(room);
              json(res, 200, { ok: true });
            } else throw new Error("INVALID");
            for (const p of room.peers)
              p?.send({
                t: "extra",
                event: {
                  run: "room",
                  kind: "library",
                  at: Date.now(),
                  data: {},
                },
              });
            return;
          }
        }
        if (
          route.length === 3 &&
          route[2] === "rebind-link" &&
          req.method === "POST"
        ) {
          json(res, 200, {
            secret: manager.transfer(room, seat),
            expiresIn: 600,
          });
          return;
        }
        if (route.length === 2 && req.method === "DELETE") {
          manager.delete(room);
          json(res, 200, { ok: true });
          return;
        }
        if (
          route.length === 3 &&
          route[2] === "favorites" &&
          req.method === "GET"
        ) {
          json(res, 200, {
            cards: room.data.favorites.map((ids) =>
              cards.filter((c) => ids.includes(c.id)),
            ),
          });
          return;
        }
        if (
          route.length === 3 &&
          route[2] === "journal" &&
          req.method === "GET"
        ) {
          const offset = Number(
            new URL(req.url || "/", "http://localhost").searchParams.get(
              "offset",
            ) || 0,
          );
          if (!Number.isSafeInteger(offset) || offset < 0)
            throw new Error("INVALID");
          json(res, 200, {
            entries: store.journal(code, offset),
            total: store.journalCount(code),
          });
          return;
        }
        throw new Error("INVALID");
      }
      if (req.method !== "GET" && req.method !== "HEAD") {
        json(res, 405, { error: "INVALID" });
        return;
      }
      if (path === prefix && prefix) {
        res.writeHead(308, { Location: prefix + "/" });
        res.end();
        return;
      }
      if (!path.startsWith(prefix + "/")) {
        json(res, 404, { error: "ROOM_NOT_FOUND" });
        return;
      }
      const relative = decodeURIComponent(path.slice(prefix.length + 1));
      const target = resolve(web, relative || "index.html");
      if (!target.startsWith(resolve(web) + sep)) {
        json(res, 404, { error: "INVALID" });
        return;
      }
      const file =
        existsSync(target) && statSync(target).isFile()
          ? target
          : !extname(relative)
            ? resolve(web, "index.html")
            : null;
      if (!file || !existsSync(file)) {
        json(res, 404, { error: "ROOM_NOT_FOUND" });
        return;
      }
      const types: Record<string, string> = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".svg": "image/svg+xml",
        ".png": "image/png",
      };
      res.writeHead(200, {
        "Content-Type": types[extname(file)] || "application/octet-stream",
        "Cache-Control": file.includes(`${sep}assets${sep}`)
          ? "public,max-age=31536000,immutable"
          : "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      });
      res.end(req.method === "HEAD" ? undefined : readFileSync(file));
    } catch (e) {
      const name = e instanceof Error ? e.message : "INVALID",
        code = (name in errors ? name : "INVALID") as ErrCode;
      json(
        res,
        code === "ROOM_NOT_FOUND"
          ? 404
          : code === "ROOM_FULL"
            ? 409
            : code === "BAD_TOKEN"
              ? 401
              : code === "RATE_LIMITED"
                ? 429
                : 400,
        { error: code, message: errors[code] },
      );
    }
  });
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 16384,
    perMessageDeflate: false,
  });
  server.on("upgrade", (req, socket, head) => {
    const path = new URL(req.url || "/", "http://localhost").pathname;
    let validOrigin = true;
    try {
      if (req.headers.origin)
        validOrigin = new URL(req.headers.origin).host === req.headers.host;
    } catch {
      validOrigin = false;
    }
    if (path !== prefix + "/ws" || !validOrigin) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req),
    );
  });
  wss.on("connection", (ws: WebSocket) => {
    let room: LiveRoom | undefined,
      seat: Seat | undefined,
      authenticated = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const delay = (fn: () => void) => {
      if (!lag) {
        fn();
        return;
      }
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (ws.readyState === WebSocket.OPEN) fn();
      }, lag);
      timers.add(timer);
    };
    const send = (m: ServerMessage, disposable = false) => {
      const payloads = frames(m, randomUUID());
      if (disposable && ws.bufferedAmount > 256 * 1024) return;
      if (ws.bufferedAmount > 2 * 1024 * 1024) {
        ws.close(4000);
        return;
      }
      delay(() => {
        if (ws.readyState === WebSocket.OPEN)
          for (const payload of payloads) ws.send(payload);
      });
    };
    const peer: Peer = {
      send,
      close: (code) => {
        if (lag) setTimeout(() => ws.close(code), lag + 30);
        else ws.close(code);
      },
      lastSeen: Date.now(),
      rtt: 0,
    };
    const buckets = {
      act: new Bucket(20),
      chat: new Bucket(2),
      react: new Bucket(2),
      other: new Bucket(30),
      ink: new Bucket(40),
      cur: new Bucket(35),
      rt: new Bucket(120),
    };
    const helloDeadline = setTimeout(
      () => {
        if (!authenticated) ws.close(4000);
      },
      5000 + lag * 2,
    );
    function handle(input: unknown) {
      try {
        if (!input || typeof input !== "object") throw new Error("INVALID");
        const m = input as ClientMessage;
        if (!authenticated) {
          if (m.t !== "hello") throw new Error("BAD_TOKEN");
          if (m.v !== VERSION) throw new Error("VERSION");
          if (typeof m.code !== "string") throw new Error("INVALID");
          room = manager.require(m.code);
          seat = manager.auth(room, m.token);
          authenticated = true;
          clearTimeout(helloDeadline);
          manager.connect(room, seat, peer);
          return;
        }
        if (!room || seat === undefined || room.peers[seat] !== peer) return;
        peer.lastSeen = Date.now();
        const category =
          m.t === "stream" && ["ink", "cur", "rt"].includes(m.kind)
            ? m.kind
            : m.t === "act" || m.t === "chat" || m.t === "react"
              ? m.t
              : "other";
        if (!buckets[category].take()) {
          if (m.t === "act" && typeof m.aid === "string")
            send({ t: "ack", aid: m.aid, ok: false, err: "RATE_LIMITED" });
          else
            send({ t: "err", code: "RATE_LIMITED", msg: errors.RATE_LIMITED });
          return;
        }
        switch (m.t) {
          case "ping":
            if (!Number.isFinite(m.c) || !Number.isFinite(m.rtt))
              throw new Error("INVALID");
            peer.rtt = Math.max(0, Math.min(30000, m.rtt));
            send({ t: "pong", c: m.c, s: Date.now() });
            break;
          case "stream":
            if (
              typeof m.run !== "string" ||
              !["ink", "cur", "rt"].includes(m.kind)
            )
              throw new Error("INVALID");
            manager.stream(room, seat, m.run, m.kind, m.data);
            break;
          case "act":
            if (
              typeof m.aid !== "string" ||
              m.aid.length < 8 ||
              m.aid.length > 100
            )
              throw new Error("INVALID");
            manager.act(room, seat, m.aid, m.a, m.seq);
            break;
          case "vis":
            if (typeof m.hidden !== "boolean") throw new Error("INVALID");
            manager.visibility(room, seat, m.hidden);
            break;
          case "chat":
            if (
              typeof m.text !== "string" ||
              !m.text.trim() ||
              [...m.text].length > 200
            )
              throw new Error("INVALID");
            manager.chat(room, seat, m.text.trim());
            break;
          case "react":
            if (!["❤️", "😂", "😘", "👏", "🥺"].includes(m.e))
              throw new Error("INVALID");
            for (const p of room.peers)
              p?.send(
                {
                  t: "evt",
                  seq: room.view.seq,
                  e: { type: "react", seat, emoji: m.e },
                },
                true,
              );
            break;
          default:
            throw new Error("INVALID");
        }
      } catch (e) {
        const name = e instanceof Error ? e.message : "INVALID",
          code = (name in errors ? name : "INVALID") as ErrCode;
        send({ t: "err", code, msg: errors[code] });
        if (!authenticated) setTimeout(() => ws.close(4003), lag + 30);
      }
    }
    ws.on("message", (raw, isBinary) => {
      if (isBinary) {
        ws.close(1003);
        return;
      }
      try {
        const m = JSON.parse(raw.toString());
        delay(() => handle(m));
      } catch {
        send({ t: "err", code: "INVALID", msg: errors.INVALID });
      }
    });
    ws.on("error", () => {});
    ws.on("close", () => {
      clearTimeout(helloDeadline);
      for (const t of timers) clearTimeout(t);
      if (room && seat !== undefined) manager.disconnect(room, seat, peer);
    });
  });
  const heartbeat = setInterval(() => {
    manager.maintenance();
    matchmaking.expire();
  }, 2000);
  heartbeat.unref();
  const network = setInterval(() => {
    for (const r of manager.rooms.values()) {
      const rtt: [number, number] = [
        r.peers[0]?.rtt || 0,
        r.peers[1]?.rtt || 0,
      ];
      for (const p of r.peers)
        p?.send({ t: "net", rtt, pair: Math.round((rtt[0] + rtt[1]) / 2) });
    }
  }, 3000);
  network.unref();
  const cleanup = () => {
    for (const code of store.expire(Date.now() - 30 * 86400000)) {
      const room = manager.rooms.get(code);
      if (room) manager.delete(room);
    }
    for (const [ip, v] of limits)
      if (Date.now() - v.at > 3600000) limits.delete(ip);
    for (const [ip, v] of matchLimits)
      if (Date.now() - v.at > 3600000) matchLimits.delete(ip);
  };
  const expiration = setInterval(cleanup, 3600000);
  expiration.unref();
  cleanup();
  return {
    server,
    manager,
    store,
    listen: (port = options.port ?? Number(process.env.PORT || 8790)) =>
      new Promise<number>((resolvePort) =>
        server.listen(port, "127.0.0.1", () =>
          resolvePort((server.address() as { port: number }).port),
        ),
      ),
    close: async () => {
      clearInterval(heartbeat);
      clearInterval(network);
      clearInterval(expiration);
      for (const ws of wss.clients) ws.terminate();
      await new Promise<void>((done) => wss.close(() => done()));
      await new Promise<void>((done) => server.close(() => done()));
      manager.close();
    },
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const app = createApp();
  app
    .listen()
    .then((port) =>
      console.log(
        "二人世界已启动：http://127.0.0.1:" +
          port +
          (process.env.BASE_PATH || "/"),
      ),
    );
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, () => {
      app.close().then(() => process.exit(0));
    });
}
