import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { outline } from "../../../shared/games/puzzle-us/shape";
import { usePicture } from "./image";
import { useEvents, useFrame, useGame, type GameProps } from "./common";
import { canvasPoint } from "./canvas-point";
interface Group {
  id: number;
  x: number;
  y: number;
  pieces: number[];
  lockedBy: number | null;
  leaseUntil: number;
  placed: boolean;
}
interface Drag {
  gid: number;
  dx: number;
  dy: number;
  ready: Promise<boolean>;
  released: boolean;
  origin: { x: number; y: number };
}
export default function Puzzle(p: GameProps) {
  const d = p.view.data,
    canvas = useRef<HTMLCanvasElement>(null),
    groups = useRef<Group[]>([]),
    drag = useRef<Drag | null>(null),
    pan = useRef({ x: 0, y: 0, scale: 1 }),
    pointers = useRef(new Map<number, { x: number; y: number }>()),
    lastPointer = useRef<{ x: number; y: number } | null>(null),
    lastStream = useRef(0),
    hand = useRef<{ x: number; y: number; at: number } | null>(null),
    send = useGame(p),
    { image, error } = usePicture(d.image, p.code, p.token),
    [preview, setPreview] = useState(false),
    [message, setMessage] = useState(""),
    [zoom, setZoom] = useState(100),
    target = useRef(new Map<number, { x: number; y: number; at: number }>());
  const paths = useMemo(
    () =>
      Array.from({ length: d.cols * d.rows }, (_, i) =>
        outline(i, d.cols, d.rows, d.pw, d.ph, d.seed),
      ),
    [d.seed],
  );
  const pieces = useMemo(() => {
    if (!image) return [];
    return paths.map((path, i) => {
      const margin = Math.ceil(Math.min(d.pw, d.ph) * 0.25) + 2,
        c = document.createElement("canvas");
      c.width = Math.ceil(d.pw + 2 * margin);
      c.height = Math.ceil(d.ph + 2 * margin);
      const ctx = c.getContext("2d")!;
      ctx.translate(margin, margin);
      ctx.save();
      ctx.translate(1.5, 3);
      ctx.fillStyle = "rgba(58,38,24,.28)";
      ctx.fill(path);
      ctx.restore();
      ctx.save();
      ctx.clip(path);
      ctx.drawImage(
        image,
        (-i % d.cols) * d.pw,
        -Math.floor(i / d.cols) * d.ph,
        d.width,
        d.height,
      );
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,.55)";
      ctx.lineWidth = 2.4;
      ctx.stroke(path);
      ctx.strokeStyle = "#3A2618";
      ctx.lineWidth = 1.3;
      ctx.stroke(path);
      return { canvas: c, margin };
    });
  }, [image, paths]);
  useEffect(() => {
    target.current.clear();
    const held = groups.current.find((g) => g.id === drag.current?.gid);
    groups.current = d.groups.map((g: Group) => ({
      ...g,
      pieces: [...g.pieces],
    }));
    if (held && drag.current && !drag.current.released) {
      const g = groups.current.find((g) => g.id === held.id);
      if (g && g.lockedBy === p.seat) {
        g.x = held.x;
        g.y = held.y;
      }
    }
    if (drag.current) {
      const g = groups.current.find((g) => g.id === drag.current!.gid);
      if (!g || g.placed || (g.lockedBy !== null && g.lockedBy !== p.seat)) {
        drag.current = null;
        setMessage("这块拼图已经被 TA 移动了");
      }
    }
  }, [d.groups]);
  useEffect(() => {
    const c = canvas.current!;
    const scale = Math.min(
      c.width / (d.width + d.pw * 6),
      c.height / (d.height + d.ph * 5),
    );
    pan.current = {
      scale,
      x: (c.width - d.width * scale) / 2,
      y: (c.height - d.height * scale) / 2,
    };
    setZoom(Math.round(scale * 100));
  }, [d.width, d.height]);
  useEvents(p, (e) => {
    if (e.kind === "piece" && e.data.seat !== p.seat) {
      target.current.set(e.data.gid, { ...e.data, at: performance.now() });
      const g = groups.current.find((g) => g.id === e.data.gid);
      if (g) {
        g.lockedBy = e.data.seat;
        g.leaseUntil = e.data.leaseUntil;
      }
    }
    if (e.kind === "hand" && e.data.seat !== p.seat)
      hand.current = { ...e.data, at: performance.now() };
  });
  function point(e: PointerEvent) {
    return canvasPoint(canvas.current!, e);
  }
  function world(pt: { x: number; y: number }) {
    return {
      x: (pt.x - pan.current.x) / pan.current.scale,
      y: (pt.y - pan.current.y) / pan.current.scale,
    };
  }
  async function release() {
    const a = drag.current;
    if (!a || a.released) return;
    a.released = true;
    const g = groups.current.find((g) => g.id === a.gid),
      position = g ? { x: g.x, y: g.y } : a.origin;
    const ok = await a.ready;
    if (ok) await send("drop", { gid: a.gid, ...position });
    if (drag.current === a) drag.current = null;
  }
  function down(e: PointerEvent) {
    if (p.disabled) return;
    e.preventDefault();
    e.currentTarget instanceof Element &&
      e.currentTarget.setPointerCapture(e.pointerId);
    const pt = point(e);
    pointers.current.set(e.pointerId, pt);
    lastPointer.current = pt;
    if (pointers.current.size > 1) {
      void release();
      return;
    }
    const w = world(pt),
      ctx = canvas.current!.getContext("2d")!;
    for (const g of [...groups.current].reverse()) {
      if (g.placed) continue;
      const hit = g.pieces.some((i) =>
        ctx.isPointInPath(
          paths[i],
          w.x - g.x - (i % d.cols) * d.pw,
          w.y - g.y - Math.floor(i / d.cols) * d.ph,
        ),
      );
      if (!hit) continue;
      if (g.lockedBy !== null && g.lockedBy !== p.seat) {
        setMessage("TA 正拿着这块，试试旁边的吧");
        return;
      }
      const a: Drag = {
        gid: g.id,
        dx: w.x - g.x,
        dy: w.y - g.y,
        origin: { x: g.x, y: g.y },
        released: false,
        ready: Promise.resolve(false),
      };
      drag.current = a;
      groups.current = groups.current.filter((x) => x !== g).concat(g);
      g.lockedBy = p.seat;
      setMessage("");
      a.ready = send("grab", { gid: g.id }).then((ok) => {
        if (!ok) {
          g.x = a.origin.x;
          g.y = a.origin.y;
          g.lockedBy = null;
          if (drag.current === a) drag.current = null;
        }
        return ok;
      });
      break;
    }
  }
  function move(e: PointerEvent) {
    const pt = point(e),
      old = pointers.current.get(e.pointerId);
    if (!old) return;
    const values = [...pointers.current.values()];
    pointers.current.set(e.pointerId, pt);
    if (pointers.current.size === 2) {
      const next = [...pointers.current.values()],
        before = Math.hypot(
          values[0].x - values[1].x,
          values[0].y - values[1].y,
        ),
        after = Math.hypot(next[0].x - next[1].x, next[0].y - next[1].y),
        center = {
          x: (next[0].x + next[1].x) / 2,
          y: (next[0].y + next[1].y) / 2,
        };
      scaleAt((pan.current.scale * after) / Math.max(1, before), center);
      return;
    }
    const a = drag.current,
      w = world(pt);
    if (a && !a.released) {
      const g = groups.current.find((g) => g.id === a.gid);
      if (g) {
        g.x = w.x - a.dx;
        g.y = w.y - a.dy;
      }
    } else {
      pan.current.x += pt.x - old.x;
      pan.current.y += pt.y - old.y;
    }
    lastPointer.current = pt;
  }
  function up(e: PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (!pointers.current.size) void release();
  }
  function scaleAt(scale: number, center = { x: 360, y: 250 }) {
    const w = world(center);
    pan.current.scale = Math.max(0.12, Math.min(2, scale));
    pan.current.x = center.x - w.x * pan.current.scale;
    pan.current.y = center.y - w.y * pan.current.scale;
    setZoom(Math.round(pan.current.scale * 100));
  }
  useFrame((time) => {
    const c = canvas.current,
      ctx = c?.getContext("2d");
    if (!ctx || !c) return;
    ctx.fillStyle = "#D9A066";
    ctx.fillRect(0, 0, 720, 500);
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = i % 2 ? "#D29659" : "#DDA66E";
      ctx.fillRect(0, i * 58, 720, 56);
      ctx.fillStyle = "#B87A3F";
      ctx.fillRect(0, i * 58 + 56, 720, 2);
      ctx.strokeStyle = "rgba(140,85,40,.18)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const y = i * 58 + 12 + k * 15;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(240, y - 4, 480, y + 5, 720, y);
      }
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(pan.current.x, pan.current.y);
    ctx.scale(pan.current.scale, pan.current.scale);
    ctx.fillStyle = "#FFF8E8";
    ctx.strokeStyle = "#3A2618";
    ctx.lineWidth = 4 / pan.current.scale;
    ctx.fillRect(-6, -6, d.width + 12, d.height + 12);
    ctx.strokeRect(-6, -6, d.width + 12, d.height + 12);
    if (image) {
      ctx.globalAlpha = 0.13;
      ctx.drawImage(image, 0, 0, d.width, d.height);
      ctx.globalAlpha = 1;
    }
    const ordered = [
      ...groups.current.filter((g) => g.placed),
      ...groups.current.filter((g) => !g.placed),
    ];
    for (const g of ordered) {
      const t = target.current.get(g.id);
      if (t && !g.placed && drag.current?.gid !== g.id) {
        const a = Math.min(1, Math.max(0.05, (time - t.at) / 120));
        g.x += (t.x - g.x) * a;
        g.y += (t.y - g.y) * a;
        if (a === 1) target.current.delete(g.id);
      }
      for (const id of g.pieces) {
        const tile = pieces[id];
        if (!tile) continue;
        const x = (id % d.cols) * d.pw + g.x,
          y = Math.floor(id / d.cols) * d.ph + g.y;
        ctx.drawImage(tile.canvas, x - tile.margin, y - tile.margin);
        if (g.lockedBy !== null) {
          ctx.save();
          ctx.translate(x, y);
          ctx.strokeStyle = g.lockedBy === p.seat ? "#dd8595" : "#86ae98";
          ctx.lineWidth = 3 / pan.current.scale;
          ctx.stroke(paths[id]);
          ctx.restore();
        }
      }
    }
    if (hand.current && time - hand.current.at < 2500) {
      const k = 1 / pan.current.scale,
        hx = hand.current.x,
        hy = hand.current.y,
        tint = p.room.profiles[(1 - p.seat) as 0 | 1]?.color || "#4D9DFF";
      ctx.fillStyle = tint;
      ctx.strokeStyle = "#3A2618";
      ctx.lineWidth = 2.2 * k;
      ctx.beginPath();
      ctx.ellipse(hx, hy + 6 * k, 9 * k, 8 * k, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      for (const [dx, dy] of [
        [-9, -6],
        [-3, -11],
        [4, -11],
        [10, -6],
      ]) {
        ctx.beginPath();
        ctx.ellipse(hx + dx * k, hy + dy * k, 3.6 * k, 4.2 * k, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
    if (!p.disabled && time - lastStream.current > 65) {
      const a = drag.current,
        g = groups.current.find((g) => g.id === a?.gid);
      if (g && a && !a.released)
        p.transport.send({
          t: "stream",
          run: p.view.run,
          kind: "cur",
          data: { op: "move", gid: g.id, x: g.x, y: g.y },
        });
      if (lastPointer.current)
        p.transport.send({
          t: "stream",
          run: p.view.run,
          kind: "cur",
          data: { op: "hand", ...world(lastPointer.current) },
        });
      lastStream.current = time;
    }
  });
  const done = d.groups
    .filter((g: Group) => g.placed)
    .reduce((n: number, g: Group) => n + g.pieces.length, 0);
  return (
    <section class="puzzle-game">
      <div class="game-mini-stats">
        <span>
          已拼好 {done} / {d.cols * d.rows}
        </span>
        <span>
          你 {d.counts[p.seat]} · TA {d.counts[1 - p.seat]}
        </span>
      </div>
      <div class="puzzle-tools">
        <button class="secondary small" onClick={() => setPreview(!preview)}>
          {preview ? "收起原图" : "看原图"}
        </button>
        <button
          class="round-small mini"
          aria-label="缩小拼图"
          onClick={() => scaleAt(pan.current.scale / 1.2)}
        >
          −
        </button>
        <span class="zoom-pill">{zoom}%</span>
        <button
          class="round-small mini"
          aria-label="放大拼图"
          onClick={() => scaleAt(pan.current.scale * 1.2)}
        >
          ＋
        </button>
        <button
          class="secondary small"
          disabled={p.disabled}
          onClick={() => void send("focus", world({ x: 360, y: 250 }))}
        >
          TA 看这里
        </button>
      </div>
      {preview && image && (
        <img class="puzzle-preview" src={image.src} alt="拼图原图" />
      )}
      <canvas
        ref={canvas}
        width="720"
        height="500"
        aria-label="双人拼图桌面"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={(e) => {
          e.preventDefault();
          scaleAt(pan.current.scale * Math.exp(-e.deltaY * 0.002));
        }}
      />
      {d.focus?.by !== p.seat && d.focus?.at > p.now - 15000 && (
        <button
          class="text-button"
          onClick={() => {
            pan.current.x = 360 - d.focus.x * pan.current.scale;
            pan.current.y = 250 - d.focus.y * pan.current.scale;
          }}
        >
          ↗ 看 TA 指的位置
        </button>
      )}
      <p class="game-status" role="status">
        {error ||
          message ||
          "拖动拼图块，接近时自动吸附；空白处拖动画面，双指缩放。"}
      </p>
    </section>
  );
}
