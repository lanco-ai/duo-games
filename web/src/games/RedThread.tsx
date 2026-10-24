import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { api } from "../api";
import { HeldControls } from "./held-controls";
import { RollbackSession, type Frame } from "../../../shared/rollback";
import { createLevel } from "../../../shared/games/red-thread/levels";
import * as sim from "../../../shared/games/red-thread/sim";
import {
  useEvents,
  useFrame,
  useGame,
  useLatest,
  typing,
  type GameProps,
} from "./common";
import { drawCritter, kindOf, type Mood } from "../art/critter";
import {
  INK,
  bridgeTile,
  chunkyText,
  cloud,
  crumbleBlock,
  door,
  fitCanvas,
  flag,
  groundTile,
  heart,
  hills,
  iceBlock,
  plank,
  plate,
  rope,
  spikes,
  spring,
  stars,
} from "../art/paint";
const SKIES = [
  ["#56B6FF", "#9FD9FF", "#DDF4FF"],
  ["#8C86FF", "#FFA6C9", "#FFD9A8"],
  ["#141B45", "#2B3479", "#4D4FA3"],
];
function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)),
    pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return (
    "rgb(" + pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(",") + ")"
  );
}
function skyAt(progress: number) {
  const k = progress < 0.5 ? 0 : 1,
    t = progress < 0.5 ? progress / 0.5 : (progress - 0.5) / 0.5;
  return SKIES[0].map((_, i) => mix(SKIES[k][i], SKIES[k + 1][i], t));
}
export default function RedThread(p: GameProps) {
  const d = p.view.data,
    level = useMemo(
      () => createLevel(String(d.level), d.seed),
      [d.level, d.seed],
    ),
    canvas = useRef<HTMLCanvasElement>(null),
    session = useRef<RollbackSession>(),
    controls = useRef(new HeldControls()),
    current = useLatest(p),
    epoch = useRef(d.epoch),
    pending = useRef<Frame[]>([]),
    lastFlush = useRef(0),
    lastHash = useRef(-1),
    buffer = useRef<any[]>([]),
    loading = useRef(false),
    alive = useRef(true),
    [message, setMessage] = useState("正在牵好红线…"),
    [stats, setStats] = useState(sim.read(sim.init(level))),
    lastUi = useRef(0),
    camera = useRef<number>(),
    send = useGame(p),
    lastError = useRef(0);
  const offsets = useRef([
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ]);
  const box = useRef<HTMLDivElement>(null),
    viewH = useRef(440),
    facing = useRef([1, -1]),
    prevVy = useRef([0, 0]),
    squash = useRef([0, 0]),
    spawnY = level.spawn[0].y,
    goalY = level.goals.length
      ? Math.min(...level.goals.map((g) => g.y))
      : spawnY - 3000;
  useEffect(() => {
    const el = box.current!;
    const fit = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0)
        viewH.current = Math.max(
          340,
          Math.min(700, Math.round((320 * r.height) / r.width)),
        );
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  function paintWorld(
    ctx: CanvasRenderingContext2D,
    raw: Int32Array,
    state: ReturnType<typeof sim.read>,
    top: number,
    W: number,
    H: number,
    time: number,
  ) {
    const progress = level.endless
      ? 0.5 - 0.5 * Math.cos((state.height / 260) * Math.PI * 2)
      : Math.max(
          0,
          Math.min(
            1,
            (spawnY - (top + H * 0.56)) / Math.max(1, spawnY - goalY),
          ),
        );
    const colors = skyAt(progress),
      g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, colors[0]);
    g.addColorStop(0.62, colors[1]);
    g.addColorStop(1, colors[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (progress > 0.55) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (progress - 0.55) / 0.35);
      stars(ctx, W, H, time, -top * 0.08);
      ctx.restore();
      if (progress > 0.75) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (progress - 0.75) / 0.2);
        ctx.fillStyle = "#FFE58A";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(W - 46, 52, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
    const cloudAlpha = 1 - Math.max(0, (progress - 0.55) / 0.45) * 0.75;
    for (let i = 0; i < 7; i++) {
      const span = H + 180,
        y = ((((i * 137 - top * 0.35) % span) + span) % span) - 90,
        x = ((i * 97) % 280) - 40 + Math.sin(time / 5000 + i) * 12;
      cloud(ctx, x, y, 64 + (i % 3) * 24, cloudAlpha * (i % 2 ? 0.85 : 1));
    }
    const groundY = (level.height - 2) * 16 - top;
    hills(
      ctx,
      W,
      H * 0.56 - 40 + (groundY - H * 0.56) * 0.6,
      70,
      progress > 0.7,
    );
    ctx.save();
    ctx.translate(0, -top);
    const y0 = Math.floor(top / 16) - 1,
      y1 = Math.ceil((top + H) / 16) + 1;
    const solid = (x: number, y: number) =>
      y >= level.height - 1 || sim.renderTile(raw, level, x, y) === "#";
    for (let y = y0; y <= y1; y++)
      for (let x = 0; x < level.width; x++) {
        const t = sim.renderTile(raw, level, x, y),
          px = x * 16,
          py = y * 16;
        if (t === "#")
          groundTile(ctx, x, y, 16, {
            top: !solid(x, y - 1),
            bottom: !solid(x, y + 1),
            left: x > 0 && !solid(x - 1, y),
            right: x < level.width - 1 && !solid(x + 1, y),
          });
        else if (t === "=") plank(ctx, px, py, 16, 6);
        else if (t === "I") iceBlock(ctx, px, py, 16);
        else if (t === "C") crumbleBlock(ctx, px, py, 16);
        else if (t === "S")
          spring(
            ctx,
            px,
            py,
            16,
            state.players.some(
              (v) => Math.abs(v.x - px - 8) < 12 && Math.abs(v.y + 7 - py) < 3,
            )
              ? 1
              : 0,
          );
        else if (t === "^") spikes(ctx, px, py, 16);
        else if (t === "F")
          flag(
            ctx,
            px,
            py,
            16,
            Math.abs(state.checkpoint.x - px - 8) < 40 &&
              Math.abs(state.checkpoint.y - py - 8) < 40,
            time,
          );
        else if (t === "H")
          heart(ctx, px + 8, py + 8 + Math.sin(time / 280 + x) * 1.6, 5.8);
        else if (t === "G") bridgeTile(ctx, px, py, 16, x);
        else if (t === "P")
          plate(
            ctx,
            px,
            py,
            16,
            state.doorsOpen ||
              state.players.some(
                (v) =>
                  Math.abs(v.x - px - 8) < 12 && Math.abs(v.y + 7 - py) < 4,
              ),
          );
        else if (t === "D") door(ctx, px, py, 16);
      }
    const groundTop = (level.height - 2) * 16;
    if (y1 * 16 > groundTop + 16) {
      const soilTop = groundTop + 16;
      ctx.fillStyle = "#A8703F";
      ctx.fillRect(0, soilTop, W, y1 * 16 - soilTop + 16);
      ctx.fillStyle = "#8E5A31";
      for (let i = 0; i < 26; i++) {
        ctx.beginPath();
        ctx.ellipse(
          (i * 53) % W,
          soilTop + 10 + ((i * 37) % 90),
          2,
          1.4,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    level.moving.forEach((_, i) => {
      const v = sim.platformPosition(level, i, state.tick);
      cloud(ctx, v.x / 256 - 5, v.y / 256 + 1, v.width / 256 + 10);
    });
    const players = state.players.map((v, i) => {
      offsets.current[i].x *= 0.78;
      offsets.current[i].y *= 0.78;
      return {
        ...v,
        x: v.x + offsets.current[i].x,
        y: v.y + offsets.current[i].y,
      };
    });
    rope(
      ctx,
      players[0].x,
      players[0].y - 1,
      players[1].x,
      players[1].y - 1,
      level.ropeLength,
      time,
    );
    players.forEach((v, i) => {
      const prof = p.room.profiles[i as 0 | 1];
      if (Math.abs(v.vx) > 0.15) facing.current[i] = v.vx > 0 ? 1 : -1;
      if (prevVy.current[i] > 2.2 && v.grounded) squash.current[i] = 1;
      prevVy.current[i] = v.vy;
      squash.current[i] *= 0.8;
      const air = !v.grounded,
        mood: Mood = v.hanging
          ? "wow"
          : air && v.vy > 3
            ? "wow"
            : v.grabbing
              ? "normal"
              : "joy",
        bob =
          v.grounded && Math.abs(v.vx) > 0.2
            ? -Math.abs(Math.sin(time / 85)) * 1.6
            : 0,
        sq = squash.current[i];
      drawCritter(
        ctx,
        kindOf(prof?.avatar),
        prof?.color || (i ? "#4D9DFF" : "#FF6B6B"),
        v.x,
        v.y + 7.5 + bob,
        38,
        {
          mood,
          pose: v.hanging || (air && v.vy < -0.4) ? "up" : "stand",
          facing: facing.current[i],
          sx: 1 + sq * 0.2,
          sy: 1 - sq * 0.16,
        },
      );
      if (level.stamina && v.stamina < sim.STAMINA) {
        ctx.strokeStyle = "rgba(58,38,24,.35)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(v.x, v.y - 33, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = v.stamina < 80 ? "#F04E5E" : "#6CCB2E";
        ctx.beginPath();
        ctx.arc(
          v.x,
          v.y - 33,
          5,
          -Math.PI / 2,
          -Math.PI / 2 + (Math.PI * 2 * v.stamina) / sim.STAMINA,
        );
        ctx.stroke();
      } else if (i === p.seat) {
        const ty = v.y - 35 + Math.sin(time / 220) * 1.2;
        ctx.fillStyle = "#FFFFFF";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(v.x - 4, ty);
        ctx.lineTo(v.x + 4, ty);
        ctx.lineTo(v.x, ty + 4.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    });
    ctx.restore();
    if (state.deathDelay) {
      ctx.fillStyle = "rgba(255,240,245,.55)";
      ctx.fillRect(0, 0, W, H);
      chunkyText(
        ctx,
        "拉住你，再来一次！",
        W / 2,
        H * 0.42,
        24,
        "#FF6B8B",
        "#7A1E2E",
      );
    } else if (state.won)
      chunkyText(ctx, "鹊桥相会！", W / 2, H * 0.3, 34, "#FFD23F", "#8A3F0A");
  }
  function flush() {
    const s = session.current;
    if (!s || current.current.disabled) return;
    while (pending.current.length) {
      current.current.transport.send({
        t: "stream",
        run: p.view.run,
        kind: "rt",
        data: { epoch: epoch.current, frames: pending.current.splice(0, 8) },
      });
    }
  }
  async function restore() {
    if (loading.current) return;
    loading.current = true;
    setMessage("正在对齐两个人的位置…");
    try {
      const old = session.current,
        expected = epoch.current;
      const data = await api(
        "rooms/" + p.code + "/game-data?run=" + p.view.run + "&kind=replay",
        "GET",
        undefined,
        p.token,
      );
      if (
        !alive.current ||
        data.epoch !== expected ||
        epoch.current !== expected
      )
        return;
      const history = data.frames as [Frame[], Frame[]],
        tick = data.tick;
      // Preserve locally emitted inputs while the HTTP snapshot was in flight.
      if (old)
        for (const frame of old.history()[p.seat])
          if (
            frame[0] >= tick &&
            !history[p.seat].some((x) => x[0] === frame[0])
          )
            history[p.seat].push(frame);
      const s = new RollbackSession(
        Int32Array.from(data.state),
        (state, input) => sim.step(state, input, level),
        {
          seat: p.seat,
          inputDelay: d.inputDelay,
          maxRollback: d.maxRollback,
          send: (f) => pending.current.push(f),
        },
      );
      s.reset(Int32Array.from(data.state), history, false);
      for (let t = tick; t < tick + s.inputDelay; t++)
        if (!s.inputs[p.seat].has(t)) {
          s.receive(p.seat, t, 0);
          pending.current.push([t, 0]);
        }
      session.current = s;
      loading.current = false;
      for (const event of buffer.current.splice(0)) receive(event);
      lastHash.current = -1;
      setMessage("");
    } catch {
      lastError.current = performance.now();
      setMessage("网络正在恢复，稍等一下…");
    } finally {
      loading.current = false;
    }
  }
  function receive(data: any) {
    const s = session.current;
    if (data.epoch !== epoch.current) return;
    if (!s || loading.current) {
      buffer.current.push(data);
      return;
    }
    const before = sim.read(s.state).players;
    try {
      for (const [tick, b] of data.frames) s.receive(data.seat, tick, b);
    } catch {
      s.needsResync = true;
    }
    const after = sim.read(s.state).players;
    for (let i = 0; i < 2; i++) {
      offsets.current[i].x += before[i].x - after[i].x;
      offsets.current[i].y += before[i].y - after[i].y;
    }
  }
  useEvents(p, (e) => {
    if (e.kind === "rt") receive(e.data);
    if (e.kind === "resync") void restore();
  });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    epoch.current = d.epoch;
    session.current = undefined;
    pending.current = [];
    buffer.current = [];
    controls.current.clear();
    void restore();
  }, [d.epoch]);
  useEffect(() => {
    if (p.disabled) controls.current.clear();
  }, [p.disabled]);
  useEffect(() => {
    const key = (e: KeyboardEvent, on: boolean) => {
      if (on && (typing(e.target) || current.current.disabled)) return;
      const b = (
        {
          ArrowLeft: 1,
          a: 1,
          A: 1,
          ArrowRight: 2,
          d: 2,
          D: 2,
          ArrowUp: 4,
          w: 4,
          W: 4,
          " ": 4,
          ArrowDown: 16,
          s: 16,
          S: 16,
          Shift: 16,
        } as Record<string, number>
      )[e.key];
      if (b) {
        if (!typing(e.target)) e.preventDefault();
        controls.current.key(e.code || e.key, b, on);
      }
    };
    const down = (e: KeyboardEvent) => key(e, true),
      up = (e: KeyboardEvent) => key(e, false),
      blur = () => {
        controls.current.clear();
      };
    const focus = (e: FocusEvent) => {
      if (typing(e.target)) controls.current.clear();
    };
    window.addEventListener("focusin", focus);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("focusin", focus);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
  useFrame((time) => {
    const s = session.current,
      c = canvas.current,
      ctx = c?.getContext("2d");
    if (!s || !ctx || !c) {
      if (!loading.current && time - lastError.current > 3000) void restore();
      return;
    }
    if (!p.disabled && !loading.current) {
      const target = Math.max(
        0,
        Math.floor((p.transport.now() - d.startAt) * 0.06),
      );
      s.advance(Math.min(target, s.tick + 120), controls.current.bits);
      if (time - lastFlush.current >= 30) {
        flush();
        lastFlush.current = time;
      }
      if (s.needsResync) void restore();
      const confirmed = s.confirmedState();
      if (confirmed) {
        const checkTick = Math.floor(confirmed.tick / 60) * 60,
          state = s.stateAt(checkTick);
        if (state && checkTick !== lastHash.current) {
          lastHash.current = checkTick;
          void send("chk", {
            epoch: epoch.current,
            tick: checkTick,
            hash: sim.hash(state),
          });
        }
      }
    }
    const state = sim.read(s.state),
      mid = (state.players[0].y + state.players[1].y) / 2,
      W = 320,
      H = viewH.current;
    const ctx2 = fitCanvas(c, W, H);
    camera.current ??= mid;
    camera.current += (mid - camera.current) * 0.12;
    const groundTop = (level.height - 2) * 16,
      top = Math.min(camera.current - H * 0.56, groundTop + 104 - H);
    paintWorld(ctx2, s.state, state, top, W, H, time);
    if (time - lastUi.current > 250) {
      setStats(state);
      setMessage(
        s.frozen
          ? "网络有点慢，等红线另一端跟上…"
          : loading.current
            ? "正在对齐两个人的位置…"
            : "",
      );
      Object.assign(p.transport.debug, s.stats, {
        inputDelay: s.inputDelay,
        desyncs: d.desyncs,
      });
      lastUi.current = time;
    }
  });
  const button = (
    bit: number,
    label: string,
    content: ComponentChildren,
    cls: string,
  ) => (
    <button
      class={"pad-button " + cls}
      aria-label={label}
      disabled={p.disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        controls.current.pointer(e.pointerId, bit, true);
      }}
      onPointerUp={(e) => {
        controls.current.pointer(e.pointerId, bit, false);
      }}
      onPointerCancel={(e) => {
        controls.current.pointer(e.pointerId, bit, false);
      }}
      onLostPointerCapture={(e) => {
        controls.current.pointer(e.pointerId, bit, false);
      }}
    >
      {content}
    </button>
  );
  return (
    <section class="action-game red-game">
      <div class="game-mini-stats">
        <span>↑ {stats.height} 米</span>
        <span class="heart-pill">♥ {stats.hearts}</span>
        <span>拉住 TA {stats.rescues} 次</span>
      </div>
      <div class="red-stage" ref={box}>
        <canvas ref={canvas} aria-label="一线牵攀登画面" />
        {message && (
          <p class="stage-banner" role="status">
            {message}
          </p>
        )}
        <div class="action-controls">
          <div class="pad">
            {button(1, "向左", "◀", "move")}
            {button(2, "向右", "▶", "move")}
          </div>
          <div class="pad">
            {button(16, "抓", "抓", "grab")}
            {button(4, "跳", "跳", "jump")}
          </div>
        </div>
      </div>
      <p class="keyboard-help">
        方向键 / A D 移动 · 空格跳 · Shift 或 S / ↓ 抓住
      </p>
      {d.level === "endless" && (
        <button
          class="secondary"
          disabled={p.disabled}
          onClick={() => void send("finish")}
        >
          把这次的高度记下来
        </button>
      )}
    </section>
  );
}
