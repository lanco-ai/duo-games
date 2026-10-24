import { describe, expect, it } from "vitest";
import { RollbackSession, parameters, type Frame } from "../../shared/rollback";
import { createLevel } from "../../shared/games/red-thread/levels";
import { hash, init, step } from "../../shared/games/red-thread/sim";
describe("rollback prediction and confirmation", () => {
  it("corrects late and reordered inputs to the exact deterministic state", () => {
    const level = createLevel("1", 4),
      sent: Frame[] = [];
    const session = new RollbackSession(
      init(level),
      (s, i) => step(s, i, level),
      { seat: 0, inputDelay: 2, maxRollback: 20, send: (f) => sent.push(f) },
    );
    session.advance(14, 2);
    for (let t = 13; t >= 2; t--) session.receive(1, t, t < 9 ? 1 : 4);
    const baseline = init(level);
    for (let t = 0; t < 14; t++)
      step(baseline, [t < 2 ? 0 : 2, t < 2 ? 0 : t < 9 ? 1 : 4], level);
    expect(hash(session.state)).toBe(hash(baseline));
    expect(session.stats.rollbacks).toBeGreaterThan(0);
    expect(session.confirmedState()?.hash).toBe(hash(baseline));
    expect(sent).toHaveLength(14);
    expect(session.snapshots.size).toBeLessThanOrEqual(23);
  });
  it("freezes at the bounded prediction horizon, resumes, and never rewrites confirmed inputs", () => {
    const s = new RollbackSession(
      new Int32Array(2),
      (state, input) => {
        state[0]++;
        state[1] += input[0] + input[1];
      },
      { seat: 0, inputDelay: 1, maxRollback: 8 },
    );
    s.advance(100, 1);
    expect(s.frozen).toBe(true);
    expect(s.tick).toBeLessThanOrEqual(9);
    for (let t = 1; t < 20; t++) s.receive(1, t, 2);
    s.advance(18, 1);
    expect(s.frozen).toBe(false);
    expect(s.tick).toBe(18);
    expect(() => s.receive(1, 4, 3)).toThrow(/cannot change/);
  });
  it("converges two peers under 250ms delay and reordered delivery", () => {
    const level = createLevel("2", 93),
      messages: { to: number; due: number; frame: Frame }[] = [];
    let wall = 0;
    const clients = [0, 1].map(
      (seat) =>
        new RollbackSession(init(level), (s, input) => step(s, input, level), {
          seat: seat as 0 | 1,
          inputDelay: 3,
          maxRollback: 20,
          send: (frame) =>
            messages.push({
              to: 1 - seat,
              due: wall + 13 + (frame[0] % 5),
              frame,
            }),
        }),
    );
    for (wall = 0; wall < 700; wall++) {
      for (let i = messages.length - 1; i >= 0; i--)
        if (messages[i].due <= wall) {
          const message = messages.splice(i, 1)[0];
          clients[message.to].receive(
            (1 - message.to) as 0 | 1,
            ...message.frame,
          );
        }
      clients.forEach((client, seat) =>
        client.advance(wall, (tick) =>
          tick % (70 + seat * 3) < 20 ? 2 : tick % 41 === 0 ? 4 : 0,
        ),
      );
    }
    for (const message of messages)
      clients[message.to].receive((1 - message.to) as 0 | 1, ...message.frame);
    const common = Math.min(...clients.map((c) => c.confirmedTick));
    expect(common).toBeGreaterThan(650);
    expect(hash(clients[0].stateAt(common)!)).toBe(
      hash(clients[1].stateAt(common)!),
    );
    expect(clients[0].stats.maxDepth).toBeLessThanOrEqual(20);
  });
  it("pauses at a shared boundary and resumes from history after refresh", () => {
    const simulate = (s: Int32Array, input: [number, number]) => {
      s[0]++;
      s[1] += input[0] - input[1];
    };
    const a = new RollbackSession(new Int32Array(2), simulate, {
      seat: 0,
      inputDelay: 2,
      maxRollback: 20,
    });
    for (let t = 2; t < 15; t++) a.receive(1, t, 3);
    a.advance(12, 2);
    const pause = a.pause(10),
      history = a.history();
    expect(a.tick).toBe(10);
    expect(a.inputs[0].get(12)).toBeUndefined();
    const fresh = new RollbackSession(new Int32Array(2), simulate, {
      seat: 1,
      inputDelay: 2,
      maxRollback: 20,
    });
    fresh.reset(pause, history);
    fresh.replay(12);
    a.replay(12);
    expect(fresh.state).toEqual(a.state);
    expect(parameters(200)).toEqual({ inputDelay: 3, maxRollback: 16 });
  });
});
it("live resync does not invent neutral remote inputs, and endless history stays bounded", () => {
  const simulate = (s: Int32Array, input: [number, number]) => {
    s[0]++;
    s[1] += input[0] - input[1];
  };
  const s = new RollbackSession(new Int32Array([100, 0]), simulate, {
    seat: 0,
    inputDelay: 3,
  });
  s.reset(new Int32Array([100, 0]), [[], []], false);
  expect(s.inputs[1].has(100)).toBe(false);
  s.receive(1, 100, 4);
  expect(s.inputs[1].get(100)).toBe(4);
  const live = new RollbackSession(new Int32Array(2), simulate, {
    seat: 0,
    inputDelay: 2,
  });
  for (let t = 0; t < 12000; t++) {
    if (t >= 2) live.receive(1, t, 0);
    live.advance(t + 1, 0);
  }
  expect(live.inputs[0].size).toBeLessThanOrEqual(3603);
  expect(live.inputs[1].size).toBeLessThanOrEqual(3601);
  expect(live.tick).toBe(12000);
});
