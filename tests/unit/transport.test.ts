import { afterEach, expect, it, vi } from "vitest";
import { Transport } from "../../web/src/net/transport";
class FakeSocket {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 1;
  sent: unknown[] = [];
  onopen?: () => void;
  onmessage?: (e: { data: string }) => void;
  onclose?: (e: { code: number }) => void;
  onerror?: () => void;
  constructor(_url: string) {
    FakeSocket.instances.push(this);
  }
  send(s: string) {
    this.sent.push(JSON.parse(s));
  }
  close() {
    this.readyState = 3;
  }
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  FakeSocket.instances = [];
});
it("terminal takeover stops even when the delayed error has not arrived", () => {
  vi.useFakeTimers();
  vi.stubGlobal("location", { search: "?lag=600" });
  vi.stubGlobal("WebSocket", FakeSocket);
  const messages: unknown[] = [];
  const t = new Transport(
    "ws://test",
    "ABCDEF",
    "secret",
    (m) => messages.push(m),
    () => {},
  );
  const ws = FakeSocket.instances[0];
  ws.onmessage?.({
    data: JSON.stringify({
      t: "err",
      code: "REPLACED",
      msg: "已在其他页面打开",
    }),
  });
  ws.onclose?.({ code: 4001 });
  vi.advanceTimersByTime(3000);
  expect(t.stopped).toBe(true);
  expect(FakeSocket.instances).toHaveLength(1);
  expect(messages).toContainEqual({
    t: "err",
    code: "REPLACED",
    msg: "已在其他页面打开",
  });
  t.stop();
});
it("jitter never reorders outgoing actions", () => {
  vi.useFakeTimers();
  vi.stubGlobal("location", { search: "?lag=300&jitter=200" });
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.spyOn(Math, "random")
    .mockReturnValueOnce(1)
    .mockReturnValueOnce(0)
    .mockReturnValueOnce(0.5);
  const t = new Transport(
    "ws://test",
    "ABCDEF",
    "secret",
    () => {},
    () => {},
  );
  t.send({ t: "chat", text: "first" });
  t.send({ t: "chat", text: "second" });
  t.send({ t: "chat", text: "third" });
  vi.advanceTimersByTime(1000);
  expect(FakeSocket.instances[0].sent).toEqual([
    { t: "chat", text: "first" },
    { t: "chat", text: "second" },
    { t: "chat", text: "third" },
  ]);
  t.stop();
});

it("authentication close preserves the delayed VERSION error without retrying", () => {
  vi.useFakeTimers();
  vi.stubGlobal("location", { search: "?lag=900" });
  vi.stubGlobal("WebSocket", FakeSocket);
  const messages: unknown[] = [];
  const t = new Transport(
    "ws://test",
    "ABCDEF",
    "secret",
    (m) => messages.push(m),
    () => {},
  );
  const ws = FakeSocket.instances[0];
  ws.onmessage?.({
    data: JSON.stringify({ t: "err", code: "VERSION", msg: "请刷新页面" }),
  });
  ws.onclose?.({ code: 4003 });
  vi.advanceTimersByTime(3000);
  expect(t.stopped).toBe(true);
  expect(FakeSocket.instances).toHaveLength(1);
  expect(messages).toContainEqual({
    t: "err",
    code: "VERSION",
    msg: "请刷新页面",
  });
  t.stop();
});
it("a dense delayed burst uses a FIFO even when browser timers wake together", () => {
  vi.useFakeTimers();
  vi.stubGlobal("location", { search: "?lag=200&jitter=40" });
  vi.stubGlobal("WebSocket", FakeSocket);
  const t = new Transport(
      "ws://test",
      "ABCDEF",
      "secret",
      () => {},
      () => {},
    ),
    callbacks: (() => void)[] = [];
  const clock = vi.spyOn(performance, "now").mockReturnValue(0);
  vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void) => {
    callbacks.push(fn);
    return 98765;
  }) as any);
  for (let i = 0; i < 100; i++) t.send({ t: "chat", text: String(i) });
  expect(callbacks).toHaveLength(1);
  clock.mockReturnValue(1000);
  for (const fn of callbacks.reverse()) fn();
  expect(FakeSocket.instances[0].sent).toEqual(
    Array.from({ length: 100 }, (_, i) => ({ t: "chat", text: String(i) })),
  );
  t.stop();
});
