import { DatabaseSync } from "node:sqlite";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { Subscription } from "./push";
import type { AsyncMatch } from "./tide-async";
import type { Island } from "../shared/island/rules";
import type { CustomItem } from "../shared/games/types";
import { dirname, resolve, join } from "node:path";
import type {
  JournalEntry,
  Profile,
  Seat,
  Settings,
  GameResult,
} from "../shared/protocol";
export interface StoredRoom {
  code: string;
  createdAt: number;
  lastActiveAt: number;
  hashes: [string, string | null];
  profiles: [Profile, Profile | null];
  settings: Settings;
  seen: string[];
  favorites: [string[], string[]];
  active: boolean;
  seenQuestions?: string[];
}
export class Store {
  db: DatabaseSync;
  mediaRoot: string;
  constructor(path: string) {
    this.mediaRoot = resolve(dirname(path), "rooms");
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS rooms(code TEXT PRIMARY KEY, last_active_at INTEGER NOT NULL, data TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS journal(id TEXT PRIMARY KEY, room_code TEXT REFERENCES rooms(code) ON DELETE CASCADE, data TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY, room_code TEXT REFERENCES rooms(code) ON DELETE CASCADE, data TEXT NOT NULL);`);
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS gallery(id TEXT PRIMARY KEY, room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE, kind TEXT NOT NULL, title TEXT NOT NULL, at INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS custom_content(id TEXT PRIMARY KEY, room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE, kind TEXT NOT NULL, author INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS images(id TEXT PRIMARY KEY, room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE, mime TEXT NOT NULL, size INTEGER NOT NULL, ratio REAL NOT NULL);
      CREATE INDEX IF NOT EXISTS gallery_room ON gallery(room_code, at);
      CREATE INDEX IF NOT EXISTS journal_room ON journal(room_code);
      CREATE INDEX IF NOT EXISTS matches_room ON matches(room_code);`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS device_rooms(
      device_hash TEXT NOT NULL,
      room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
      slot TEXT NOT NULL CHECK(slot IN ('primary','local')),
      seat INTEGER NOT NULL CHECK(seat IN (0,1)),
      expires_at INTEGER NOT NULL,
      used_at INTEGER NOT NULL,
      PRIMARY KEY(device_hash, room_code, slot)
    );`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS push_subscriptions(
      endpoint TEXT PRIMARY KEY,
      room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
      seat INTEGER NOT NULL CHECK(seat IN (0,1)),
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS push_room ON push_subscriptions(room_code, seat);`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS tide_matches(
      id TEXT PRIMARY KEY,
      room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS tide_room ON tide_matches(room_code, created_at);`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS islands(
      room_code TEXT PRIMARY KEY REFERENCES rooms(code) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      data TEXT NOT NULL
    );`);
  }
  island(code: string): { version: number; island: Island } | null {
    const row = this.db
      .prepare("SELECT version, data FROM islands WHERE room_code=?")
      .get(code) as { version: number; data: string } | undefined;
    return row ? { version: row.version, island: JSON.parse(row.data) } : null;
  }
  saveIsland(code: string, version: number, island: Island) {
    this.db
      .prepare(
        `INSERT INTO islands VALUES(?,?,?)
      ON CONFLICT(room_code) DO UPDATE SET version=excluded.version, data=excluded.data`,
      )
      .run(code, version, JSON.stringify(island));
  }
  tideLatest(code: string): AsyncMatch | null {
    const row = this.db
      .prepare(
        "SELECT data FROM tide_matches WHERE room_code=? ORDER BY created_at DESC LIMIT 1",
      )
      .get(code) as { data: string } | undefined;
    return row ? JSON.parse(row.data) : null;
  }
  tideSave(code: string, m: AsyncMatch) {
    this.db
      .prepare(
        `INSERT INTO tide_matches VALUES(?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET data=excluded.data`,
      )
      .run(m.id, code, m.createdAt, JSON.stringify(m));
  }
  savePush(code: string, seat: Seat, sub: Subscription, now: number) {
    this.db
      .prepare(
        `INSERT INTO push_subscriptions VALUES(?,?,?,?,?,?)
      ON CONFLICT(endpoint) DO UPDATE SET room_code=excluded.room_code,seat=excluded.seat,p256dh=excluded.p256dh,auth=excluded.auth`,
      )
      .run(sub.endpoint, code, seat, sub.keys.p256dh, sub.keys.auth, now);
  }
  pushTargets(code: string, seat: Seat): Subscription[] {
    return (
      this.db
        .prepare(
          "SELECT endpoint,p256dh,auth FROM push_subscriptions WHERE room_code=? AND seat=?",
        )
        .all(code, seat) as { endpoint: string; p256dh: string; auth: string }[]
    ).map((r) => ({
      endpoint: r.endpoint,
      keys: { p256dh: r.p256dh, auth: r.auth },
    }));
  }
  deletePush(endpoint: string, code?: string, seat?: Seat) {
    if (code === undefined)
      this.db
        .prepare("DELETE FROM push_subscriptions WHERE endpoint=?")
        .run(endpoint);
    else
      this.db
        .prepare(
          "DELETE FROM push_subscriptions WHERE endpoint=? AND room_code=? AND seat=?",
        )
        .run(endpoint, code, seat!);
  }
  bindDevice(
    device: string,
    code: string,
    slot: "primary" | "local",
    seat: Seat,
    now: number,
  ) {
    this.db
      .prepare(
        `INSERT INTO device_rooms VALUES(?,?,?,?,?,?)
      ON CONFLICT(device_hash,room_code,slot) DO UPDATE SET seat=excluded.seat,expires_at=excluded.expires_at,used_at=excluded.used_at`,
      )
      .run(device, code, slot, seat, now + 90 * 86400000, now);
  }
  deviceSeat(
    device: string,
    code: string,
    slot: "primary" | "local",
    now: number,
  ): Seat | null {
    const row = this.db
      .prepare(
        "SELECT seat FROM device_rooms WHERE device_hash=? AND room_code=? AND slot=? AND expires_at>?",
      )
      .get(device, code, slot, now) as { seat: Seat } | undefined;
    return row?.seat ?? null;
  }
  deviceLast(device: string, now: number): string | null {
    const row = this.db
      .prepare(
        "SELECT room_code FROM device_rooms WHERE device_hash=? AND slot='primary' AND expires_at>? ORDER BY used_at DESC LIMIT 1",
      )
      .get(device, now) as { room_code: string } | undefined;
    return row?.room_code ?? null;
  }
  revokeDevices(code: string, seat: Seat, except?: string) {
    this.db
      .prepare("DELETE FROM push_subscriptions WHERE room_code=? AND seat=?")
      .run(code, seat);
    if (except)
      this.db
        .prepare(
          "DELETE FROM device_rooms WHERE room_code=? AND seat=? AND device_hash<>?",
        )
        .run(code, seat, except);
    else
      this.db
        .prepare("DELETE FROM device_rooms WHERE room_code=? AND seat=?")
        .run(code, seat);
  }
  get(code: string): StoredRoom | null {
    const r = this.db
      .prepare("SELECT data FROM rooms WHERE code=?")
      .get(code) as { data: string } | undefined;
    return r ? JSON.parse(r.data) : null;
  }
  save(r: StoredRoom) {
    this.db
      .prepare(
        "INSERT INTO rooms VALUES(?,?,?) ON CONFLICT(code) DO UPDATE SET last_active_at=excluded.last_active_at,data=excluded.data",
      )
      .run(r.code, r.lastActiveAt, JSON.stringify(r));
  }
  addAnswer(code: string, e: JournalEntry) {
    this.db
      .prepare("INSERT INTO journal VALUES(?,?,?)")
      .run(e.id, code, JSON.stringify(e));
  }
  journal(code: string, offset = 0, limit = 50): JournalEntry[] {
    return (
      this.db
        .prepare(
          "SELECT data FROM journal WHERE room_code=? ORDER BY rowid DESC LIMIT ? OFFSET ?",
        )
        .all(code, limit, offset) as { data: string }[]
    ).map((r) => JSON.parse(r.data));
  }
  journalCount(code: string): number {
    return Number(
      (
        this.db
          .prepare("SELECT COUNT(*) AS total FROM journal WHERE room_code=?")
          .get(code) as { total: number }
      ).total,
    );
  }
  match(code: string, result: GameResult) {
    this.db
      .prepare("INSERT INTO matches VALUES(?,?,?)")
      .run(crypto.randomUUID(), code, JSON.stringify(result));
  }
  delete(code: string) {
    this.db.prepare("DELETE FROM rooms WHERE code=?").run(code);
    this.removeImages(code);
  }
  private removeImages(code: string) {
    if (/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/.test(code))
      rmSync(join(this.mediaRoot, code), { recursive: true, force: true });
  }
  custom(code: string): CustomItem[] {
    return (
      this.db
        .prepare(
          "SELECT id,kind,author,data FROM custom_content WHERE room_code=? ORDER BY rowid",
        )
        .all(code) as any[]
    ).map((row) => ({ ...row, data: JSON.parse(row.data) }));
  }
  addCustom(code: string, kind: string, author: Seat, data: unknown) {
    if (this.custom(code).filter((x) => x.kind === kind).length >= 100)
      throw new Error("RATE_LIMITED");
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO custom_content VALUES(?,?,?,?,?)")
      .run(id, code, kind, author, JSON.stringify(data));
    return id;
  }
  updateCustom(code: string, id: string, data: unknown) {
    this.db
      .prepare("UPDATE custom_content SET data=? WHERE room_code=? AND id=?")
      .run(JSON.stringify(data), code, id);
  }
  gallery(code: string, offset = 0) {
    return this.db
      .prepare(
        "SELECT id,kind,title,at FROM gallery WHERE room_code=? ORDER BY at DESC LIMIT 20 OFFSET ?",
      )
      .all(code, offset);
  }
  addGallery(code: string, kind: string, title: string, data: unknown) {
    const id = randomUUID();
    this.db
      .prepare("INSERT INTO gallery VALUES(?,?,?,?,?,?)")
      .run(id, code, kind, title, Date.now(), JSON.stringify(data));
    return id;
  }
  galleryItem(code: string, id: string) {
    const row = this.db
      .prepare(
        "SELECT id,kind,title,at,data FROM gallery WHERE room_code=? AND id=?",
      )
      .get(code, id) as any;
    if (!row) throw new Error("ROOM_NOT_FOUND");
    return { ...row, data: JSON.parse(row.data) };
  }
  history(code: string) {
    return (
      this.db
        .prepare(
          "SELECT data FROM matches WHERE room_code=? ORDER BY rowid DESC LIMIT 50",
        )
        .all(code) as { data: string }[]
    ).map((row) => JSON.parse(row.data));
  }
  addImage(code: string, body: Buffer, mime: string, ratio: number) {
    const used = this.db
      .prepare(
        "SELECT COALESCE(SUM(size),0) AS size FROM images WHERE room_code=?",
      )
      .get(code) as { size: number };
    if (used.size + body.length > 20 * 1024 * 1024)
      throw new Error("RATE_LIMITED");
    const id = randomUUID(),
      directory = join(this.mediaRoot, code);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    writeFileSync(join(directory, id), body, { mode: 0o600 });
    this.db
      .prepare("INSERT INTO images VALUES(?,?,?,?,?)")
      .run(id, code, mime, body.length, ratio);
    return id;
  }
  imageMeta(code: string, id: string) {
    const row = this.db
      .prepare("SELECT mime,ratio FROM images WHERE room_code=? AND id=?")
      .get(code, id) as { mime: string; ratio: number } | undefined;
    if (!row) throw new Error("ROOM_NOT_FOUND");
    return row;
  }
  image(code: string, id: string) {
    const meta = this.imageMeta(code, id);
    return { ...meta, body: readFileSync(join(this.mediaRoot, code, id)) };
  }
  expire(before: number): string[] {
    const codes = (
      this.db
        .prepare("SELECT code FROM rooms WHERE last_active_at<?")
        .all(before) as { code: string }[]
    ).map((r) => r.code);
    this.db.prepare("DELETE FROM rooms WHERE last_active_at<?").run(before);
    for (const code of codes) this.removeImages(code);
    return codes;
  }
  close() {
    this.db.close();
  }
}
