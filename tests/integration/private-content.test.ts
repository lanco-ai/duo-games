import { afterEach, expect, it } from "vitest";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../server/index";
const directories: string[] = [];
let app: ReturnType<typeof createApp> | undefined;
afterEach(async () => {
  if (app) await app.close();
  app = undefined;
  for (const dir of directories.splice(0))
    rmSync(dir, { recursive: true, force: true });
});
async function setup() {
  const directory = mkdtempSync(join(tmpdir(), "duo-private-"));
  directories.push(directory);
  app = createApp({ data: join(directory, "duo.db") });
  const url = "http://127.0.0.1:" + (await app.listen(0)) + "/api/";
  const request = async (
    path: string,
    method = "GET",
    value?: any,
    token?: string,
  ) => {
    const r = await fetch(url + path, {
      method,
      headers: {
        ...(value ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: value ? JSON.stringify(value) : undefined,
    });
    return { status: r.status, body: await r.json() };
  };
  const host = (
      await request("rooms", "POST", {
        profile: { nickname: "甲", avatar: "🐰", color: "#FF6B6B" },
      })
    ).body,
    guest = (
      await request("rooms/" + host.code + "/join", "POST", {
        profile: { nickname: "乙", avatar: "🐻", color: "#4D9DFF" },
      })
    ).body;
  return { directory, url, request, host, guest };
}
it("private words never leave their author; promises require the other player to accept", async () => {
  const { request, host, guest } = await setup(),
    base = "rooms/" + host.code + "/custom";
  await request(
    base,
    "POST",
    { kind: "word", word: "只给画手的秘密" },
    host.token,
  );
  const promise = (
    await request(
      base,
      "POST",
      { kind: "promise", text: "周末一起看海" },
      host.token,
    )
  ).body.id;
  expect((await request(base)).status).toBe(401);
  expect(
    JSON.stringify((await request(base, "GET", undefined, guest.token)).body),
  ).not.toContain("只给画手的秘密");
  expect(
    (
      await request(
        base + "/" + promise,
        "POST",
        { action: "accept" },
        host.token,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await request(
        base + "/" + promise,
        "POST",
        { action: "accept" },
        guest.token,
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await request(
        base + "/" + promise,
        "POST",
        { action: "done" },
        host.token,
      )
    ).status,
  ).toBe(200);
});
it("image, gallery, history and replay require a room credential; deleting that test room removes only its media", async () => {
  const { directory, url, request, host, guest } = await setup(),
    base = "rooms/" + host.code;
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1sAAAAASUVORK5CYII=",
    "base64",
  );
  const upload = await fetch(url + base + "/images", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + host.token,
      "Content-Type": "image/png",
    },
    body: png,
  });
  expect(upload.status).toBe(201);
  const { id, imageId } = (await upload.json()) as any;
  const file = join(directory, "rooms", host.code, imageId || id);
  expect(existsSync(file)).toBe(true);
  for (const route of [
    "images/" + imageId,
    "gallery",
    "history",
    "game-data?run=fake&kind=drawing",
  ])
    expect((await request(base + "/" + route)).status).toBe(401);
  expect(
    (
      await fetch(url + base + "/images/" + imageId, {
        headers: { Authorization: "Bearer " + guest.token },
      })
    ).status,
  ).toBe(200);
  const other = (
    await request("rooms", "POST", {
      profile: { nickname: "旁观者", avatar: "🐰", color: "#FF6B6B" },
    })
  ).body;
  expect(
    (await request(base + "/gallery", "GET", undefined, other.token)).status,
  ).toBe(401);
  await request(base, "DELETE", undefined, host.token);
  expect(existsSync(file)).toBe(false);
  expect((await request("rooms/" + other.code)).status).toBe(200);
});
it("rejects SVG, MIME spoofing and oversized dimensions before writing media", async () => {
  const { url, host, directory } = await setup(),
    endpoint = url + "rooms/" + host.code + "/images";
  for (const [mime, body] of [
    ["image/svg+xml", Buffer.from("<svg/>")],
    ["image/jpeg", Buffer.from("not-a-jpeg")],
  ] as const) {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: "Bearer " + host.token, "Content-Type": mime },
      body,
    });
    expect(r.status).toBe(400);
  }
  const png = Buffer.alloc(32);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.write("IHDR", 12);
  png.writeUInt32BE(99999, 16);
  png.writeUInt32BE(800, 20);
  expect(
    (
      await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + host.token,
          "Content-Type": "image/png",
        },
        body: png,
      })
    ).status,
  ).toBe(400);
  expect(existsSync(join(directory, "rooms", host.code))).toBe(false);
});
