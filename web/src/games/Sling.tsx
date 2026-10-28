import { useRef, useState } from "preact/hooks";
import * as sim from "../../../shared/games/puck-sling/sim";
import { useFrame, useGame, nickname, type GameProps } from "./common";
import { drawCritter, kindOf } from "../art/critter";
import { INK, chunkyText, fitCanvas, heart } from "../art/paint";
interface Drag {
  id: number;
  x: number;
  y: number;
  pointer: number;
}
const W = sim.WIDTH,
  H = sim.HEIGHT,
  R = sim.RADIUS;
export default function Sling(p: GameProps) {
  const canvas = useRef<HTMLCanvasElement>(null),
    send = useGame(p),
    data = useRef(p.view.data);
  data.current = p.view.data;
  const pending = useRef<sim.Shot[]>([]),
    cache = useRef<{ key: unknown; n: number; state: sim.State } | null>(null),
    shown = useRef<{ x: number; y: number }[]>([]),
    drag = useRef<Drag | null>(null),
    lastShot = useRef(-sim.COOLDOWN),
    [hud, setHud] = useState({
      mine: sim.PER_SIDE,
      theirs: sim.PER_SIDE,
      left: 0,
    }),
    mySeat = p.seat,
    flip = mySeat === 1;
  const color = (seat: number) =>
    p.room.profiles[seat as 0 | 1]?.color || (seat ? "#4D9DFF" : "#FF6B6B");
  function tickNow() {
    const d = data.current;
    if (d.paused || p.disabled)
      return d.pausedTick || cache.current?.state.tick || 0;
    return Math.max(0, Math.floor((p.transport.now() - d.startAt) * 0.06));
  }
  /** Board state at `tick`, advanced incrementally and rebuilt whenever the server's shot list changes. */
  function stateAt(tick: number) {
    const d = data.current,
      shots = [...d.shots, ...pending.current].sort((a, b) => a.tick - b.tick);
    let c = cache.current;
    if (
      !c ||
      c.key !== d ||
      c.n !== pending.current.length ||
      c.state.tick > tick
    )
      c = cache.current = {
        key: d,
        n: pending.current.length,
        state: sim.clone(d.base),
      };
    const target = Math.min(tick, c.state.tick + 1200, d.limit);
    while (c.state.tick < target) sim.step(c.state, shots);
    return c.state;
  }
  const toBoard = (e: PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect(),
      x = ((e.clientX - r.left) / r.width) * W,
      y = ((e.clientY - r.top) / r.height) * H;
    return flip ? { x: W - x, y: H - y } : { x, y };
  };
  function down(e: PointerEvent) {
    if (p.disabled || data.current.paused) return;
    const at = toBoard(e),
      s = stateAt(tickNow());
    let best = -1,
      bestD = (R + 18) ** 2;
    s.pucks.forEach((q, i) => {
      if (!sim.grabbable(q, mySeat)) return;
      const d = (q.x / sim.Q - at.x) ** 2 + (q.y / sim.Q - at.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best < 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id: best, ...at, pointer: e.pointerId };
  }
  function move(e: PointerEvent) {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    Object.assign(d, toBoard(e));
  }
  function up(e: PointerEvent) {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    drag.current = null;
    const tick = tickNow(),
      s = stateAt(tick),
      q = s.pucks[d.id];
    if (!sim.grabbable(q, mySeat) || tick - lastShot.current < sim.COOLDOWN)
      return;
    const pull = sim.clampPull(mySeat, d.x - q.x / sim.Q, d.y - q.y / sim.Q);
    if (!pull) return;
    const v = data.current,
      shot: sim.Shot = { tick, seat: mySeat, id: d.id, ...pull };
    lastShot.current = tick;
    pending.current = [...pending.current, shot];
    void send("shot", { epoch: v.epoch, ...shot }).then(() => {
      pending.current = pending.current.filter((x) => x !== shot);
    });
  }
  useFrame(() => {
    const c = canvas.current;
    if (!c) return;
    const d = data.current,
      tick = tickNow(),
      s = stateAt(tick),
      g = fitCanvas(c, W, H);
    g.save();
    if (flip) {
      g.translate(W, H);
      g.rotate(Math.PI);
    }
    drawTable(g);
    // Partner peeks over the far rail, you sit at the near one.
    const far = flip ? 0 : 1,
      near = mySeat;
    for (const seat of [far, near]) {
      const prof = p.room.profiles[seat as 0 | 1],
        top = seat === 1;
      g.save();
      if (top) {
        g.translate(W / 2, 8);
        g.rotate(Math.PI);
      } else g.translate(W / 2, H - 8);
      drawCritter(g, kindOf(prof?.avatar), color(seat), 0, 22, 54, {
        mood: "joy",
        pose: "up",
        alpha: 0.9,
      });
      g.restore();
    }
    if (shown.current.length !== s.pucks.length)
      shown.current = s.pucks.map((q) => ({ x: q.x / sim.Q, y: q.y / sim.Q }));
    // Paint from the far rail to the near one so nearer pucks overlap.
    const order = s.pucks
      .map((_, i) => i)
      .sort((a, b) => (s.pucks[a].y - s.pucks[b].y) * (flip ? -1 : 1));
    for (const i of order) {
      const q = s.pucks[i],
        r = shown.current[i],
        tx = q.x / sim.Q,
        ty = q.y / sim.Q;
      // Snap on big corrections, glide on small ones.
      const k = Math.hypot(tx - r.x, ty - r.y) > 40 ? 1 : 0.55;
      r.x += (tx - r.x) * k;
      r.y += (ty - r.y) * k;
      drawPuck(g, r.x, r.y, color(sim.sideOf(q)), flip, drag.current?.id === i);
    }
    const dr = drag.current;
    if (dr) {
      const q = shown.current[dr.id],
        pull = sim.clampPull(mySeat, dr.x - q.x, dr.y - q.y),
        px = q.x + (pull?.dx ?? dr.x - q.x),
        py = q.y + (pull?.dy ?? dr.y - q.y);
      g.strokeStyle = pull ? "#E8573C" : "rgba(120,80,50,.6)";
      g.lineWidth = 4;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(q.x - R, q.y);
      g.lineTo(px, py);
      g.lineTo(q.x + R, q.y);
      g.stroke();
      if (pull) {
        const power = Math.hypot(pull.dx, pull.dy) / sim.MAX_PULL;
        g.setLineDash([3, 7]);
        g.strokeStyle = "rgba(255,255,255,.85)";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(q.x, q.y);
        g.lineTo(q.x - pull.dx * 2.2, q.y - pull.dy * 2.2);
        g.stroke();
        g.setLineDash([]);
        g.fillStyle =
          power > 0.8 ? "#FF5A5F" : power > 0.45 ? "#FFB21E" : "#7BD389";
        g.beginPath();
        g.arc(px, py, 7, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = INK;
        g.lineWidth = 2;
        g.stroke();
      }
    }
    g.restore();
    const [c0, c1] = sim.counts(s),
      mine = mySeat ? c1 : c0,
      theirs = mySeat ? c0 : c1,
      left = Math.max(0, Math.ceil((d.limit - tick) / sim.HZ));
    if (!mine) chunkyText(g, "清空啦！守住它", W / 2, H * 0.72, 24, "#FFE066");
    else if (!theirs)
      chunkyText(g, "TA 快清空了！", W / 2, H * 0.72, 22, "#FFB3C1");
    if (tick - lastShot.current < sim.COOLDOWN && tick >= lastShot.current) {
      g.fillStyle = "rgba(58,38,24,.35)";
      g.fillRect(
        W / 2 - 40,
        H - 40,
        80 * (1 - (tick - lastShot.current) / sim.COOLDOWN),
        5,
      );
    }
    if (hud.mine !== mine || hud.theirs !== theirs || hud.left !== left)
      setHud({ mine, theirs, left });
  });
  const clock = `${Math.floor(hud.left / 60)}:${String(hud.left % 60).padStart(2, "0")}`;
  return (
    <section class="action-game sling-game">
      <div class="game-mini-stats">
        <span style={{ color: color(mySeat) }}>你的半场 {hud.mine}</span>
        <strong>{clock}</strong>
        <span style={{ color: color(1 - mySeat) }}>
          {nickname(p, 1 - mySeat)} {hud.theirs}
        </span>
      </div>
      <div class="bounce-stage sling-stage">
        <canvas
          ref={canvas}
          aria-label="弹射冰球球桌：按住自己半场的冰球往后拉，松手弹出"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => (drag.current = null)}
        />
      </div>
      <p class="game-status">按住冰球往后拉，松手弹过中间的小门</p>
    </section>
  );
}
function drawTable(g: CanvasRenderingContext2D) {
  g.fillStyle = "#7A4A2A";
  g.fillRect(0, 0, W, H);
  const wood = g.createLinearGradient(0, 0, W, 0);
  wood.addColorStop(0, "#E9C48E");
  wood.addColorStop(0.5, "#F4D7A6");
  wood.addColorStop(1, "#E3BA82");
  g.fillStyle = wood;
  g.fillRect(6, 6, W - 12, H - 12);
  g.strokeStyle = "rgba(160,110,60,.18)";
  g.lineWidth = 1.5;
  for (let x = 24; x < W; x += 36) {
    g.beginPath();
    g.moveTo(x, 6);
    g.bezierCurveTo(x + 8, H * 0.3, x - 8, H * 0.7, x + 4, H - 6);
    g.stroke();
  }
  // Baselines and the little hearts each player defends.
  g.strokeStyle = "rgba(122,74,42,.35)";
  g.setLineDash([6, 8]);
  g.lineWidth = 2;
  for (const y of [sim.MID + R + sim.WALL + 4, sim.MID - R - sim.WALL - 4]) {
    g.beginPath();
    g.moveTo(12, y);
    g.lineTo(W - 12, y);
    g.stroke();
  }
  g.setLineDash([]);
  heart(
    g,
    W / 2,
    H * 0.78,
    22,
    "rgba(255,120,150,.18)",
    "rgba(0,0,0,0)",
    false,
  );
  heart(
    g,
    W / 2,
    H * 0.22,
    22,
    "rgba(255,120,150,.18)",
    "rgba(0,0,0,0)",
    false,
  );
  // Middle wall with its gap, drawn with a little height for the 2.5D look.
  const y0 = sim.MID - sim.WALL,
    h = sim.WALL * 2;
  for (const [x0, x1] of [
    [0, sim.GAP_LEFT],
    [sim.GAP_RIGHT, W],
  ]) {
    g.fillStyle = "#8B5A33";
    g.beginPath();
    g.roundRect(x0, y0 + 4, x1 - x0, h, 4);
    g.fill();
    g.fillStyle = "#B97A43";
    g.strokeStyle = INK;
    g.lineWidth = 2.5;
    g.beginPath();
    g.roundRect(x0, y0 - 2, x1 - x0, h, 4);
    g.fill();
    g.stroke();
  }
  g.strokeStyle = "#5C3A1E";
  g.lineWidth = 8;
  g.strokeRect(4, 4, W - 8, H - 8);
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, W - 3, H - 3);
}
function drawPuck(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  tint: string,
  flip: boolean,
  held: boolean,
) {
  // Thickness always points down on screen, so flip it with the board.
  const t = flip ? -5 : 5;
  g.fillStyle = "rgba(60,35,15,.25)";
  g.beginPath();
  g.ellipse(x + 2, y + t * 1.2, R + 1, R, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#2E2420";
  g.beginPath();
  g.arc(x, y + t, R, 0, Math.PI * 2);
  g.fill();
  g.fillRect(x - R, Math.min(y, y + t), R * 2, Math.abs(t));
  g.fillStyle = held ? "#4A3A34" : "#3A2E29";
  g.strokeStyle = INK;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(x, y, R, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = tint;
  g.beginPath();
  g.arc(x, y, R * 0.45, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(255,255,255,.35)";
  g.beginPath();
  g.arc(x - R * 0.35, y - R * 0.35 * (flip ? -1 : 1), R * 0.22, 0, Math.PI * 2);
  g.fill();
  if (held) {
    g.strokeStyle = "#FFE066";
    g.lineWidth = 3;
    g.beginPath();
    g.arc(x, y, R + 5, 0, Math.PI * 2);
    g.stroke();
  }
}
