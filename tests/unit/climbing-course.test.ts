import { describe, expect, it } from "vitest";
import { createLevel, type Level } from "../../shared/games/red-thread/levels";
import {
  GRAB,
  JUMP_KEY,
  LEFT,
  RIGHT,
  P,
  STATE,
  hash,
  init,
  playerIndex,
  read,
  step,
} from "../../shared/games/red-thread/sim";
import { RollbackSession, type Frame } from "../../shared/rollback";

type Player = ReturnType<typeof read>["players"][number];
type Inputs = [number, number];

function steer(player: Player, x: number): number {
  const desiredVelocity = Math.max(-2, Math.min(2, (x - player.x) * 0.3));
  return player.vx < desiredVelocity - 0.12
    ? RIGHT
    : player.vx > desiredVelocity + 0.12
      ? LEFT
      : 0;
}

function platformColumns(row: string): number[] {
  return [...row].flatMap((tile, x) =>
    x > 0 && x < row.length - 1 && "#=ICSGP".includes(tile) ? [x] : [],
  );
}

/**
 * An offline pair of players. It only reads the level/state and presses legal
 * buttons; it never teleports actors, edits tiles, or writes simulation fields.
 * Grip provides the same immediate braking a human can use on an icy ledge.
 */
function climb(level: Level) {
  const state = init(level),
    history: Inputs[] = [],
    touched = new Set<string>();
  let targetRow = level.height - 4;
  let mode: "approach" | "jump" = "approach",
    launchX = 0,
    stageTicks = 0;
  let openedGateAt: number | null = null;
  const plateRow = level.tiles.findIndex((row) => row.includes("P"));
  const plateXs =
    plateRow < 0
      ? []
      : [...level.tiles[plateRow]].flatMap((tile, x) =>
          tile === "P" ? [x * 16 + 8] : [],
        );

  function press(inputs: Inputs) {
    history.push(inputs);
    step(state, inputs, level);
    const view = read(state);
    if (view.doorsOpen && openedGateAt === null) openedGateAt = view.tick;
    for (const player of view.players) {
      const feetRow = Math.round((player.y + 7) / 16);
      if (Math.abs(player.y + 7 - feetRow * 16) > 1) continue;
      for (
        let x = Math.floor((player.x - 5 + 0.01) / 16);
        x <= Math.floor((player.x + 5 - 0.01) / 16);
        x++
      ) {
        const tile = level.tiles[feetRow]?.[x];
        if (tile) touched.add(tile);
      }
    }
  }

  for (let frame = 0; frame < 12000 && !read(state).won; frame++) {
    const view = read(state);
    if (frame < 40) {
      press(
        view.players.map((player) =>
          Math.abs(player.x - 88) < 2 ? GRAB : steer(player, 88),
        ) as Inputs,
      );
      continue;
    }

    const row = level.tiles[targetRow];
    const columns = row.includes("G")
      ? [...row].flatMap((tile, x) => (tile === "G" ? [x] : []))
      : platformColumns(row);
    const left = columns[0] * 16,
      right = (columns.at(-1)! + 1) * 16;
    let targetX = (left + right) / 2;
    if (stageTicks === 0) {
      const below = platformColumns(level.tiles[targetRow + 2]);
      const low = below[0] * 16 - 4,
        high = (below.at(-1)! + 1) * 16 + 4;
      const cost = (x: number) =>
        Math.abs(x - view.players[0].x) + 100 * Math.max(0, low - x, x - high);
      launchX = [left - 8, right + 8].sort((a, b) => cost(a) - cost(b))[0];
      // Jump through a thin platform from a supported part of the lower ledge.
      if (row.includes("=") && !row.includes("G"))
        launchX = Math.max(low + 12, Math.min(high - 12, targetX));
    }

    // Jump between the two solid plates, then walk apart to occupy both of them.
    if (row.includes("P") && row.includes("=")) {
      launchX = (plateXs[0] + plateXs[1]) / 2;
      targetX = launchX;
    }
    if (
      targetRow === 4 &&
      view.players.every(
        (player) =>
          player.grounded && player.y < 60 && player.x > 60 && player.x < 260,
      )
    ) {
      press(
        view.players.map((player) =>
          Math.abs(player.x - 160) < 2 ? GRAB : steer(player, 160),
        ) as Inputs,
      );
      continue;
    }
    if (plateRow >= 0 && !view.doorsOpen && targetRow <= plateRow - 2) {
      press(
        view.players.map((player, seat) =>
          Math.abs(player.x - plateXs[seat]) < 1.5
            ? GRAB
            : steer(player, plateXs[seat]),
        ) as Inputs,
      );
      stageTicks++;
      if (stageTicks > 700)
        throw new Error("Could not occupy both pressure plates");
      continue;
    }

    let inputs: Inputs;
    if (mode === "approach") {
      inputs = view.players.map((player) =>
        Math.abs(player.x - launchX) < 1.5 ? GRAB : steer(player, launchX),
      ) as Inputs;
      const ready = view.players.every(
        (player, seat) =>
          (Math.abs(player.x - launchX) < 1.5 &&
            Math.abs(player.vx) < 0.4 &&
            player.grabbing) ||
          (!player.grounded &&
            state[playerIndex(seat, P.COYOTE)] > 0 &&
            Math.abs(player.x - launchX) < 2),
      );
      // A grip frame also releases the previous jump button before the next press.
      if (ready) {
        mode = "jump";
        stageTicks = 0;
        inputs = view.players.map(
          (player) => steer(player, targetX) | JUMP_KEY,
        ) as Inputs;
      }
    } else
      inputs = view.players.map(
        (player) => steer(player, targetX) | JUMP_KEY,
      ) as Inputs;
    press(inputs);
    stageTicks++;
    const after = read(state);
    const landed = after.players.every(
      (player) =>
        player.y <= targetRow * 16 - 6 &&
        (player.grounded ||
          (row.includes("S") && Math.abs(player.y + 7 - targetRow * 16) < 1)),
    );
    if (targetRow !== 4 && landed) {
      targetRow -= 2;
      mode = "approach";
      stageTicks = 0;
    }
    if (stageTicks > 700)
      throw new Error("Climbing stalled at row " + targetRow);
  }
  return { state, history, touched, openedGateAt };
}

describe("complete red-thread climbing courses", () => {
  it.each(["1", "2", "3", "4"])(
    "course %s reaches the bridge using only real two-player inputs",
    (id) => {
      const level = createLevel(id, 1),
        run = climb(level),
        view = read(run.state);
      expect(view.won).toBe(true);
      expect(view.deaths).toBe(0);
      expect(run.state[STATE.GOAL_HOLD]).toBe(30);
      expect(
        view.players.every((player) => player.grounded && player.y === 57),
      ).toBe(true);
      expect(
        run.history.every(
          (pair) =>
            pair.length === 2 &&
            pair.every(
              (bits) => Number.isInteger(bits) && bits >= 0 && bits <= 31,
            ),
        ),
      ).toBe(true);
      if (id === "3")
        for (const tile of ["I", "C", "S"])
          expect(run.touched.has(tile)).toBe(true);
      if (id === "4") {
        expect(view.doorsOpen).toBe(true);
        expect(run.openedGateAt).not.toBeNull();
        expect(run.openedGateAt!).toBeLessThan(view.tick);
      }
      const replay = init(level);
      for (const input of run.history) step(replay, input, level);
      expect(hash(replay)).toBe(hash(run.state));
    },
    15000,
  );
});

describe("climbing rollback under delayed and reordered packets", () => {
  it.each([3, 9, 15, 24])(
    "converges with %s ticks of one-way delay",
    (delay) => {
      const level = createLevel("3", 43);
      const queue: { to: 0 | 1; due: number; frame: Frame }[] = [];
      let wallTick = 0;
      const clients = ([0, 1] as const).map(
        (seat) =>
          new RollbackSession(
            init(level),
            (state, inputs) => step(state, inputs, level),
            {
              seat,
              inputDelay: 3,
              maxRollback: 20,
              send: (frame) =>
                queue.push({
                  to: (1 - seat) as 0 | 1,
                  due: wallTick + delay + (frame[0] % 5) - 2,
                  frame,
                }),
            },
          ),
      );
      for (wallTick = 0; wallTick < 1500; wallTick++) {
        // Reverse iteration deliberately delivers same-deadline packets out of order.
        for (let i = queue.length - 1; i >= 0; i--)
          if (queue[i].due <= wallTick) {
            const message = queue.splice(i, 1)[0];
            clients[message.to].receive(
              (1 - message.to) as 0 | 1,
              ...message.frame,
            );
          }
        clients.forEach((client, seat) =>
          client.advance(
            wallTick,
            (tick) =>
              (tick % (73 + seat * 7) < 25 ? RIGHT : 0) |
              (tick % 51 < 9 ? JUMP_KEY : 0),
          ),
        );
      }
      for (const message of queue)
        clients[message.to].receive(
          (1 - message.to) as 0 | 1,
          ...message.frame,
        );
      const common = Math.min(...clients.map((client) => client.confirmedTick));
      const a = clients[0].stateAt(common),
        b = clients[1].stateAt(common);
      expect(common).toBeGreaterThan(1400);
      expect(a).not.toBeNull();
      expect(b).not.toBeNull();
      expect(hash(a!)).toBe(hash(b!));
      expect(
        clients.every(
          (client) => !client.needsResync && client.stats.maxDepth <= 20,
        ),
      ).toBe(true);
      if (delay <= 15)
        expect(clients.every((client) => client.stats.freezes === 0)).toBe(
          true,
        );
      else
        expect(clients.every((client) => client.stats.freezes > 0)).toBe(true);
    },
    15000,
  );
});
