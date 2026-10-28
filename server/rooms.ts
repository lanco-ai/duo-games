import { levelProgress } from "../shared/games/progress";
import { createGame } from "./games/index";
import {
  isExtra,
  gameOptions,
  type Engine,
  type ExtraView,
} from "../shared/games/types";
import { HeartBounce } from "./games/action";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import {
  ALPHABET,
  errors,
  validProfile,
  type Action,
  type ErrCode,
  type RoomView,
  type Seat,
  type ServerMessage,
  type Profile,
  type GameResult,
} from "../shared/protocol";
import { transition } from "../shared/room";
import * as talk from "../shared/games/talk-cards/rules";
import { Store, type StoredRoom } from "./store";
export interface Peer {
  send: (m: ServerMessage, disposable?: boolean) => void;
  close: (code: number) => void;
  lastSeen: number;
  rtt: number;
}
export interface LiveRoom {
  data: StoredRoom;
  view: RoomView;
  game: talk.TalkState | null;
  extra?: Engine | null;
  pausedAt?: number;
  savedAt?: number;
  peers: [Peer | null, Peer | null];
  acks: [
    Map<string, Extract<ServerMessage, { t: "ack" }>>,
    Map<string, Extract<ServerMessage, { t: "ack" }>>,
  ];
  timer?: ReturnType<typeof setTimeout>;
  idleAt: number;
  transfer?: { hash: string; seat: Seat; expires: number };
}
const token = () => randomBytes(16).toString("base64url");
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export class RoomManager {
  rooms = new Map<string, LiveRoom>();
  extraTimer?: ReturnType<typeof setInterval>;
  constructor(public store: Store) {}
  load(code: string): LiveRoom | null {
    const existing = this.rooms.get(code);
    if (existing) return existing;
    const data = this.store.get(code);
    if (!data) return null;
    if (data.lastActiveAt < Date.now() - 30 * 86400000) {
      this.store.delete(code);
      return null;
    }
    const room: LiveRoom = {
      data,
      view: {
        code,
        seq: 0,
        profiles: structuredClone(data.profiles),
        online: [false, false],
        away: [false, false],
        phase: data.profiles[1] ? "lobby" : "waiting",
        proposal: null,
        settings: data.settings,
        ready: [false, false],
        startAt: null,
        pauseDeadline: null,
        rematch: [false, false],
        result: null,
        journal: this.store.journal(code, 0, 2),
        journalCount: this.store.journalCount(code),
        favorites: data.favorites,
        chat: [],
        restartNotice: data.active,
      },
      game: null,
      peers: [null, null],
      acks: [new Map(), new Map()],
      idleAt: Date.now(),
    };
    data.active = false;
    this.store.save(data);
    this.rooms.set(code, room);
    return room;
  }
  create(profile: Profile) {
    let code: string;
    do {
      code = Array.from(
        randomBytes(6),
        (n) => ALPHABET[n % ALPHABET.length],
      ).join("");
    } while (this.store.get(code));
    const secret = token(),
      now = Date.now();
    this.store.save({
      code,
      createdAt: now,
      lastActiveAt: now,
      hashes: [hash(secret), null],
      profiles: [profile, null],
      settings: { decks: ["轻松", "走心"], limit: 10 },
      seen: [],
      favorites: [[], []],
      active: false,
    });
    this.load(code);
    return { code, seat: 0 as Seat, token: secret };
  }
  join(code: string, profile: Profile) {
    const r = this.require(code);
    if (r.data.profiles[1]) throw new Error("ROOM_FULL");
    if (profile.color === r.data.profiles[0].color) throw new Error("INVALID");
    const secret = token();
    r.data.hashes[1] = hash(secret);
    r.data.profiles[1] = profile;
    r.view.profiles = structuredClone(r.data.profiles);
    if (r.view.phase === "waiting") r.view.phase = "lobby";
    this.persist(r);
    this.publish(r);
    return { code, seat: 1 as Seat, token: secret };
  }
  require(code: string) {
    const r = this.load(code);
    if (!r) throw new Error("ROOM_NOT_FOUND");
    return r;
  }
  auth(r: LiveRoom, secret: unknown): Seat {
    if (typeof secret !== "string" || secret.length > 100)
      throw new Error("BAD_TOKEN");
    const h = hash(secret),
      seat = r.data.hashes.indexOf(h);
    if (seat < 0) throw new Error("BAD_TOKEN");
    return seat as Seat;
  }
  connect(r: LiveRoom, seat: Seat, p: Peer) {
    const old = r.peers[seat];
    r.peers[seat] = p;
    if (old) {
      // A new socket can arrive before the old close event during refresh.
      this.pause(r);
      old.send({ t: "err", code: "REPLACED", msg: errors.REPLACED });
      old.close(4001);
    }
    r.view.online[seat] = true;
    r.view.away[seat] = false;
    this.persist(r);
    if (
      r.view.phase === "paused" &&
      r.view.online.every(Boolean) &&
      !r.view.away.some(Boolean)
    ) {
      clearTimeout(r.timer);
      r.view.phase = "countdown";
      r.view.startAt = Date.now() + 3500;
      r.view.pauseDeadline = null;
      this.shiftAfterPause(r);
      this.schedule(r);
    }
    r.view.seq++;
    p.send({
      t: "welcome",
      seat,
      now: Date.now(),
      room: this.snapshot(r),
      game: this.gameView(r, seat),
    });
    this.broadcast(r);
  }
  disconnect(r: LiveRoom, seat: Seat, p: Peer) {
    if (r.peers[seat] !== p) return;
    r.peers[seat] = null;
    r.view.online[seat] = false;
    r.view.away[seat] = false;
    this.pause(r);
    if (r.extra instanceof HeartBounce)
      r.extra.ownerDisconnected(seat, Date.now());
    r.idleAt = Date.now();
    this.publish(r);
  }
  schedule(r: LiveRoom) {
    clearTimeout(r.timer);
    r.timer = setTimeout(
      () => {
        if (r.view.phase !== "countdown") return;
        r.view.phase = "playing";
        r.extra?.resume?.(Date.now());
        if (r.game) {
          const result = talk.result(r.game);
          if (result) this.finish(r, false, result);
        }
        this.publish(r);
      },
      Math.max(0, (r.view.startAt || 0) - Date.now()),
    );
    r.timer.unref();
  }
  persist(r: LiveRoom) {
    r.data.lastActiveAt = Date.now();
    r.data.settings = r.view.settings;
    r.data.active = ["playing", "countdown", "paused"].includes(r.view.phase);
    this.store.save(r.data);
    r.savedAt = Date.now();
  }
  snapshot(r: LiveRoom): RoomView {
    const view = {
      ...r.view,
      progress: levelProgress(r.data.seenQuestions || []),
      journal: [...r.view.journal],
      chat: r.view.chat.slice(-10),
    };
    // Reserve space for the game view inside a welcome frame.
    while (Buffer.byteLength(JSON.stringify(view)) > 12000) {
      if (view.journal.length) view.journal.pop();
      else if (view.chat.length) view.chat.shift();
      else break;
    }
    return view;
  }
  gameView(
    r: LiveRoom,
    seat: Seat,
  ): ReturnType<typeof talk.view> | ExtraView | null {
    return r.extra
      ? {
          kind: r.extra.id,
          run: r.extra.run,
          data: r.extra.view(seat, r.pausedAt ?? Date.now()),
        }
      : r.game
        ? talk.view(r.game)
        : null;
  }
  broadcast(r: LiveRoom) {
    for (const seat of [0, 1] as Seat[]) {
      const p = r.peers[seat];
      p?.send({ t: "room", seq: r.view.seq, room: this.snapshot(r) });
      p?.send({ t: "game", seq: r.view.seq, view: this.gameView(r, seat) });
    }
  }
  pause(r: LiveRoom) {
    if (!["playing", "countdown"].includes(r.view.phase)) return;
    clearTimeout(r.timer);
    r.pausedAt = Date.now();
    r.extra?.pause?.(r.pausedAt);
    r.view.phase = "paused";
    r.view.pauseDeadline = r.pausedAt + 60000;
    r.view.startAt = null;
    r.timer = setTimeout(() => {
      this.finish(r, true);
      this.publish(r);
    }, 60000);
    r.timer.unref();
  }
  shiftAfterPause(r: LiveRoom) {
    if (r.pausedAt === undefined || r.view.startAt === null) return;
    const elapsed = r.view.startAt - r.pausedAt;
    if (r.extra) r.extra.shift(elapsed);
    else if (r.game?.mode === "pro" && r.game.pro && !r.game.pro.outcome) {
      if (r.game.pro.deadline) r.game.pro.deadline += elapsed;
      if (r.game.flipAt > r.pausedAt) r.game.flipAt += elapsed;
    }
    r.pausedAt = undefined;
  }
  resume(r: LiveRoom) {
    if (
      r.view.phase !== "paused" ||
      !r.view.online.every(Boolean) ||
      r.view.away.some(Boolean)
    )
      return;
    clearTimeout(r.timer);
    r.view.phase = "countdown";
    r.view.startAt = Date.now() + 3500;
    r.view.pauseDeadline = null;
    this.shiftAfterPause(r);
    this.schedule(r);
  }
  startExtra(r: LiveRoom) {
    const id = r.view.proposal!.gameId;
    if (!isExtra(id)) return;
    const options = gameOptions(id, r.view.settings.games?.[id]);
    let imageRatio = 1.5;
    if (id === "puzzle-us" && !String(options.image).startsWith("scene:"))
      imageRatio = this.store.imageMeta(
        r.data.code,
        String(options.image),
      ).ratio;
    const run = randomUUID();
    r.extra = createGame(
      id,
      run,
      options,
      randomBytes(4).readUInt32LE(),
      r.view.startAt!,
      {
        custom: this.store.custom(r.data.code),
        seen: r.data.seenQuestions || [],
        pair: r.peers.reduce((n, p) => n + (p?.rtt || 0) / 2, 0),
        imageRatio,
        gallery: (kind, title, data) =>
          this.store.addGallery(r.data.code, kind, title, data),
        journal: (question, text, seat) => {
          const entry = {
            id: randomUUID(),
            cardId: "ludo-memory",
            question,
            text,
            seat,
            at: Date.now(),
          };
          this.store.addAnswer(r.data.code, entry);
          r.view.journal = [entry, ...r.view.journal].slice(0, 2);
          r.view.journalCount++;
        },
        seenQuestion: (id) => {
          r.data.seenQuestions = [
            ...new Set([...(r.data.seenQuestions || []), id]),
          ];
          this.persist(r);
        },
        emit: (kind, data, to, disposable = false) => {
          for (const seat of [0, 1] as Seat[])
            if (to === undefined || to === seat)
              r.peers[seat]?.send(
                { t: "extra", event: { run, kind, at: Date.now(), data } },
                disposable,
              );
        },
      },
    );
    r.game = null;
    if (!this.extraTimer) {
      this.extraTimer = setInterval(() => this.tickExtras(), 100);
      this.extraTimer.unref();
    }
  }
  tickExtras() {
    let active = false;
    const now = Date.now();
    for (const r of this.rooms.values()) {
      if (
        !r.extra ||
        !["countdown", "playing", "paused"].includes(r.view.phase)
      )
        continue;
      active = true;
      if (
        r.view.phase !== "playing" &&
        !(r.view.phase === "paused" && r.extra.id === "heart-bounce")
      )
        continue;
      try {
        let changed = r.extra.tick(now);
        if (r.extra.result) {
          this.finish(r, false, r.extra.result);
          changed = true;
        }
        if (changed) {
          if (now - (r.savedAt || 0) > 5000) this.persist(r);
          this.publish(r);
        }
      } catch {
        this.finish(r, true);
        this.publish(r);
      }
    }
    if (!active) {
      clearInterval(this.extraTimer);
      this.extraTimer = undefined;
    }
  }
  stream(r: LiveRoom, seat: Seat, run: string, kind: string, data: any) {
    if (!r.extra || r.extra.run !== run || r.view.phase !== "playing") return;
    r.extra.stream?.(seat, kind, data, Date.now());
    r.data.lastActiveAt = Date.now();
    if (Date.now() - (r.savedAt || 0) > 15000) this.persist(r);
  }
  publish(r: LiveRoom) {
    r.view.seq++;
    this.broadcast(r);
  }
  finish(r: LiveRoom, aborted = false, result?: GameResult) {
    if (r.view.phase === "result") return;
    clearTimeout(r.timer);
    r.view.phase = "result";
    r.view.pauseDeadline = null;
    r.view.startAt = null;
    r.view.rematch = [false, false];
    r.view.result = result || {
      primary: {
        label: aborted ? "本局已中断" : "本局聊了",
        value: r.extra ? "下次继续" : (r.game?.played || 0) + " 张",
      },
      highlights: [
        aborted
          ? "下次再继续，房间和写下的回答都在。"
          : "每一次倾听，都让我们更靠近。",
      ],
      stats: { played: r.game?.played || 0, favorites: 0 },
      aborted,
    };
    const named = (text: string) =>
      text
        .replace(
          /玩家 ([12])/g,
          (_, n) => r.view.profiles[(Number(n) - 1) as Seat]?.nickname || "TA",
        )
        .replaceAll("{name}", "TA");
    r.view.result.primary.value = named(r.view.result.primary.value);
    r.view.result.highlights = r.view.result.highlights.map(named);
    r.view.result.gameId = r.view.proposal?.gameId || "talk-cards";
    r.view.result.endedAt = Date.now();
    this.store.match(r.data.code, r.view.result);
    this.persist(r);
  }
  act(r: LiveRoom, seat: Seat, aid: string, a: Action, seq?: number) {
    const cache = r.acks[seat],
      old = cache.get(aid);
    if (old) {
      r.peers[seat]?.send(old);
      return;
    }
    let error: ErrCode | undefined,
      changed = false;
    if (!a || typeof a !== "object" || typeof a.type !== "string")
      error = "INVALID";
    else if (a.type === "game") {
      if (!r.extra || a.run !== r.extra.run || r.view.phase !== "playing")
        error = "STALE";
      else
        try {
          if (
            r.extra.id === "gomoku" &&
            a.command === "place" &&
            seq !== r.view.seq
          )
            throw new Error("STALE");
          changed = r.extra.act(seat, a.command, a.payload, Date.now());
          if (r.extra.result) {
            this.finish(r, false, r.extra.result);
            changed = true;
          }
        } catch (e) {
          const name = e instanceof Error ? e.message : "INVALID";
          error = (name in errors ? name : "INVALID") as ErrCode;
        }
    } else if (a.type === "profile") {
      if (
        !validProfile(a.profile) ||
        a.profile.color === r.view.profiles[(1 - seat) as Seat]?.color
      )
        error = "INVALID";
      else {
        r.view.profiles[seat] = {
          ...a.profile,
          nickname: a.profile.nickname.trim(),
        };
        r.data.profiles = structuredClone(r.view.profiles);
        changed = true;
      }
    } else if (a.type === "exit") {
      if (["playing", "paused", "countdown"].includes(r.view.phase)) {
        this.finish(r, true);
        changed = true;
      } else error = "INVALID";
    } else if (
      [
        "draw",
        "next",
        "skip",
        "fav",
        "answer",
        "pro-draw",
        "pro-resolve",
      ].includes(a.type)
    ) {
      if (
        (r.view.phase !== "playing" &&
          !(r.view.phase === "result" && a.type === "answer")) ||
        !r.game
      )
        error = "INVALID";
      else if ((a.type === "draw" || a.type === "skip") && seq !== r.view.seq)
        error = "STALE";
      else {
        const out = talk.apply(r.game, seat, a, Date.now());
        error = out.error;
        if (!error && out.changed) {
          r.game = out.s;
          changed = true;
          r.data.favorites = r.game.favorites;
          r.view.favorites = r.game.favorites;
          r.data.seen = [...new Set([...r.data.seen, ...r.game.discussed])];
          if (out.answer) {
            const entry = {
              id: randomUUID(),
              cardId: out.answer.card.id,
              question: out.answer.card.text,
              text: out.answer.text,
              seat,
              at: Date.now(),
            };
            this.store.addAnswer(r.data.code, entry);
            r.view.journal = [entry, ...r.view.journal].slice(0, 2);
            r.view.journalCount++;
          }
          const result = talk.result(r.game);
          if (result && r.view.phase !== "result")
            this.finish(r, false, result);
        }
      }
    } else {
      const out = transition(r.view, seat, a, Date.now());
      error = out.error;
      if (out.changed) {
        r.view = out.room;
        changed = true;
        if (out.start) {
          try {
            if (isExtra(r.view.proposal!.gameId)) this.startExtra(r);
            else {
              r.extra = null;
              r.game = talk.init(
                r.view.settings,
                randomBytes(4).readUInt32LE(),
                r.data.seen,
                r.data.favorites,
              );
            }
            this.schedule(r);
          } catch (e) {
            const name = e instanceof Error ? e.message : "INVALID";
            error = (name in errors ? name : "INVALID") as ErrCode;
            r.view.phase = "intro";
            r.view.ready = [false, false];
            r.view.startAt = null;
            r.extra = null;
            r.game = null;
          }
        }
        if (a.type === "lobby") {
          clearTimeout(r.timer);
          r.game = null;
          r.extra = null;
        }
      }
    }
    const ack: Extract<ServerMessage, { t: "ack" }> = {
      t: "ack",
      aid,
      ok: !error,
      ...(error ? { err: error } : {}),
    };
    cache.set(aid, ack);
    if (cache.size > 200) cache.delete(cache.keys().next().value!);
    if (changed) {
      if (
        a.type !== "game" ||
        Date.now() - (r.savedAt || 0) > 5000 ||
        r.view.phase === "result"
      )
        this.persist(r);
      this.publish(r);
    }
    r.peers[seat]?.send(ack);
  }
  chat(r: LiveRoom, seat: Seat, text: string) {
    r.view.chat = [
      ...r.view.chat,
      { id: randomUUID(), seat, text, at: Date.now() },
    ].slice(-50);
    this.persist(r);
    this.publish(r);
  }
  visibility(r: LiveRoom, seat: Seat, hidden: boolean) {
    r.view.away[seat] = hidden;
    if (r.extra && ["red-thread", "heart-bounce"].includes(r.extra.id)) {
      if (hidden) this.pause(r);
    }
    if (!hidden) this.resume(r);
    this.publish(r);
  }
  transfer(r: LiveRoom, seat: Seat) {
    const secret = token();
    r.transfer = { hash: hash(secret), seat, expires: Date.now() + 600000 };
    return secret;
  }
  rebind(r: LiveRoom, secret: unknown) {
    if (
      typeof secret !== "string" ||
      !r.transfer ||
      r.transfer.expires < Date.now() ||
      r.transfer.hash !== hash(secret)
    )
      throw new Error("BAD_TOKEN");
    const seat = r.transfer.seat;
    r.transfer = undefined;
    return this.rotateSeat(r, seat);
  }
  rotateSeat(r: LiveRoom, seat: Seat, keepDevice?: string) {
    const next = token();
    this.store.revokeDevices(r.data.code, seat, keepDevice);
    r.data.hashes[seat] = hash(next);
    r.acks[seat].clear();
    const peer = r.peers[seat];
    if (peer) {
      peer.send({ t: "err", code: "REPLACED", msg: errors.REPLACED });
      peer.close(4001);
      this.disconnect(r, seat, peer);
    }
    this.persist(r);
    return { code: r.data.code, seat, token: next };
  }
  delete(r: LiveRoom) {
    clearTimeout(r.timer);
    for (const p of r.peers) {
      p?.send({ t: "evt", seq: r.view.seq, e: { type: "deleted" } });
      p?.close(4004);
    }
    r.peers = [null, null];
    this.store.delete(r.data.code);
    this.rooms.delete(r.data.code);
  }
  maintenance() {
    const now = Date.now();
    for (const r of this.rooms.values()) {
      for (const seat of [0, 1] as Seat[]) {
        const p = r.peers[seat];
        if (p && now - p.lastSeen > 10000) {
          this.disconnect(r, seat, p);
          p.close(4000);
        }
      }
      if (!r.peers.some(Boolean) && now - r.idleAt > 600000) {
        clearTimeout(r.timer);
        this.rooms.delete(r.data.code);
      }
    }
  }
  close() {
    clearInterval(this.extraTimer);
    for (const r of this.rooms.values()) {
      clearTimeout(r.timer);
      for (const p of r.peers) p?.close(1001);
    }
    this.store.close();
  }
}
