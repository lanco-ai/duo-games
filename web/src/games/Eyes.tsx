import { useEffect, useRef, useState } from "preact/hooks";
import {
  useGame,
  useEvents,
  useLatest,
  nickname,
  typing,
  type GameProps,
} from "./common";
import { Critter } from "../art/ui";
export default function Eyes(p: GameProps) {
  const d = p.view.data,
    send = useGame(p),
    walker = d.walker === p.seat,
    latest = useLatest(p),
    next = useRef(d.lastMove + 1),
    inFlight = useRef(new Set<number>()),
    [optimistic, setOptimistic] = useState(d.pos),
    [bump, setBump] = useState(false),
    start = useRef<[number, number] | null>(null),
    [signal, setSignal] = useState(""),
    [drawing, setDrawing] = useState(false),
    [draft, setDraft] = useState<number[]>([]),
    path = useRef<number[]>([]),
    eatenClick = useRef(false);
  const clock = useRef(p.now);
  if (p.room.phase !== "paused") clock.current = p.now;
  const now = clock.current;
  const route = drawing
    ? draft
    : d.route && now < d.route.until
      ? d.route.cells
      : [];
  function drawAt(e: PointerEvent & { currentTarget: HTMLDivElement }) {
    if (!drawing || walker || p.disabled || d.routeUsed) return;
    const rect = e.currentTarget.getBoundingClientRect(),
      x = Math.floor(((e.clientX - rect.left) / rect.width) * d.w),
      y = Math.floor(((e.clientY - rect.top) / rect.height) * d.h),
      cell = y * d.w + x,
      prev = path.current.at(-1);
    if (
      x < 0 ||
      x >= d.w ||
      y < 0 ||
      y >= d.h ||
      d.grid[cell] ||
      path.current.includes(cell)
    )
      return;
    if (
      prev === undefined
        ? cell !== d.pos
        : Math.abs((cell % d.w) - (prev % d.w)) +
            Math.abs(Math.floor(cell / d.w) - Math.floor(prev / d.w)) !==
          1
    )
      return;
    path.current = [...path.current, cell];
    setDraft(path.current);
  }
  useEffect(() => {
    next.current = d.lastMove + 1;
    inFlight.current.clear();
    setOptimistic(d.pos);
    setDrawing(false);
    setDraft([]);
    path.current = [];
  }, [d.round, p.view.run]);
  useEffect(() => {
    for (const n of inFlight.current)
      if (n <= d.lastMove) inFlight.current.delete(n);
    next.current = Math.max(next.current, d.lastMove + 1);
    if (!inFlight.current.size) setOptimistic(d.pos);
  }, [d.pos, d.lastMove]);
  useEvents(p, (e) => {
    if (e.kind === "moved" && e.data.round === d.round) {
      inFlight.current.delete(e.data.n);
      if (e.data.bump || e.data.trap || !inFlight.current.size)
        setOptimistic(e.data.pos);
      if (e.data.bump) {
        setBump(true);
        setTimeout(() => setBump(false), 250);
      }
    }
    if (e.kind === "signal") {
      setSignal(e.data.text);
      setTimeout(() => setSignal(""), 2800);
    }
  });
  async function move(dir: number) {
    const cur = latest.current;
    if (
      cur.disabled ||
      cur.view.data.stage !== "walking" ||
      cur.seat !== cur.view.data.walker ||
      inFlight.current.size >= 2
    )
      return;
    const n = next.current++;
    inFlight.current.add(n);
    const [dx, dy] = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ][dir];
    setOptimistic((pos: number) => {
      const x = (pos % d.w) + dx,
        y = Math.floor(pos / d.w) + dy;
      return x >= 0 && x < d.w && y >= 0 && y < d.h ? y * d.w + x : pos;
    });
    if (!(await send("move", { round: d.round, dir, n }))) {
      inFlight.current.delete(n);
      next.current = latest.current.view.data.lastMove + 1;
      setOptimistic(latest.current.view.data.pos);
    }
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      const dir = (
        {
          ArrowUp: 0,
          w: 0,
          W: 0,
          ArrowRight: 1,
          d: 1,
          D: 1,
          ArrowDown: 2,
          s: 2,
          S: 2,
          ArrowLeft: 3,
          a: 3,
          A: 3,
        } as Record<string, number>
      )[e.key];
      if (dir !== undefined) {
        e.preventDefault();
        void move(dir);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [d.round, p.disabled]);
  const tile = (i: number) => {
    if (!walker) {
      if (d.grid[i]) return "wall";
      if (d.traps.includes(i)) return "trap";
      if (d.key === i && !d.hasKey) return "key";
      if (d.door === i && !d.hasKey) return "door";
      if (d.exit === i) return "exit";
      return "floor";
    }
    if (d.triggered.includes(i)) return "trap";
    if (d.walls.includes(i)) return d.door === i ? "door" : "wall";
    if (d.exit === i) return "exit";
    if (d.seen.includes(i)) return "floor";
    if (d.light?.cell === i && p.now < d.light.until)
      return d.light.wall ? "wall" : "floor";
    return "fog";
  };
  return (
    <section class="extra-stage eyes-stage" data-testid="eyes-stage">
      <div class="stage-score">
        <span>
          第 {d.round + 1}/6 关 · {walker ? "你是行者" : "你是引路人"}
        </span>
        <b>★ {d.stars}</b>
      </div>
      <p class="muted">
        {walker
          ? "听 TA 的指挥，走过的路会亮起来。"
          : "点击一个格子可点亮 3 秒；每关有 3 次。"}
      </p>
      <div
        class={"maze-board " + (bump ? "bump" : "")}
        style={{ aspectRatio: `${d.w}/${d.h}`, "--ratio": d.w / d.h }}
        onPointerDown={(e) => {
          start.current = [e.clientX, e.clientY];
          if (drawing) {
            e.currentTarget.setPointerCapture(e.pointerId);
            drawAt(e);
          }
        }}
        onPointerMove={(e) => {
          if (start.current) drawAt(e);
        }}
        onPointerCancel={() => {
          start.current = null;
          path.current = [];
          setDraft([]);
        }}
        onPointerUp={(e) => {
          if (drawing) {
            eatenClick.current = true;
            setTimeout(() => {
              eatenClick.current = false;
            }, 0);
            if (path.current.length > 1)
              void send("route", { round: d.round, cells: path.current });
            setDrawing(false);
            setDraft([]);
            path.current = [];
            start.current = null;
            return;
          }
          if (!walker || !start.current) {
            start.current = null;
            return;
          }
          const dx = e.clientX - start.current[0],
            dy = e.clientY - start.current[1];
          if (Math.max(Math.abs(dx), Math.abs(dy)) > 18)
            void move(
              Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0,
            );
          start.current = null;
        }}
      >
        <div
          class="maze-cells"
          style={{ gridTemplateColumns: `repeat(${d.w},1fr)` }}
        >
          {Array.from({ length: d.w * d.h }, (_, i) => {
            const kind = tile(i);
            return (
              <button
                class={
                  "maze-cell " +
                  kind +
                  (d.light?.cell === i && p.now < d.light.until ? " lit" : "")
                }
                aria-label={"迷宫格" + i}
                disabled={
                  walker ||
                  (!d.lights && !drawing) ||
                  p.disabled ||
                  d.stage !== "walking"
                }
                onClick={() => {
                  if (!drawing && !start.current && !eatenClick.current)
                    void send("light", { round: d.round, cell: i });
                  eatenClick.current = false;
                }}
              >
                {(
                  { trap: "✦", key: "⚿", exit: "♡", door: "▥" } as Record<
                    string,
                    string
                  >
                )[kind] || ""}
                {d.seen.includes(i) && kind === "floor" ? <i /> : null}
              </button>
            );
          })}
        </div>
        {route.length > 1 && (
          <svg
            class="maze-route"
            viewBox={`0 0 ${d.w * 100} ${d.h * 100}`}
            aria-label="引路人画的路线"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              opacity: drawing ? 1 : Math.min(1, (d.route.until - now) / 500),
            }}
          >
            <polyline
              points={route
                .map(
                  (cell: number) =>
                    `${(cell % d.w) * 100 + 50},${Math.floor(cell / d.w) * 100 + 50}`,
                )
                .join(" ")}
              fill="none"
              stroke="#FFA62B"
              stroke-width="16"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        )}
        <div
          class="maze-player"
          style={{
            left: (((walker ? optimistic : d.pos) % d.w) / d.w) * 100 + "%",
            top:
              (Math.floor((walker ? optimistic : d.pos) / d.w) / d.h) * 100 +
              "%",
            width: 100 / d.w + "%",
            height: 100 / d.h + "%",
            color: p.room.profiles[d.walker as 0 | 1]!.color,
          }}
        >
          <Critter
            avatar={p.room.profiles[d.walker as 0 | 1]?.avatar}
            color={p.room.profiles[d.walker as 0 | 1]?.color || "#FF6B6B"}
            mood={bump ? "wow" : "joy"}
            shadow={false}
            size={40}
          />
        </div>
        {signal && walker && (
          <div class="maze-signal" role="status">
            {signal}
          </div>
        )}
      </div>
      <div class="stage-score">
        <small>
          撞墙 {d.bumps} · 陷阱 {d.falls}
        </small>
        <small>
          {d.hasKey
            ? "已拿到钥匙"
            : !walker && d.key >= 0
              ? "先拿钥匙再开门"
              : ""}
        </small>
      </div>
      {d.stage === "complete" ? (
        <div class="agreement">
          <h3>找到出口啦！{"★".repeat(d.history.at(-1)?.stars || 0)}</h3>
          <button
            class="primary"
            onClick={() => void send("next", { round: d.round })}
          >
            {d.round === 5 ? "看看我们的星星" : "交换身份，下一关 →"}
          </button>
        </div>
      ) : walker ? (
        <div class="dpad">
          {[
            ["↑", 0],
            ["←", 3],
            ["↓", 2],
            ["→", 1],
          ].map(([label, dir]) => (
            <button
              class={"direction pad-button move dir-" + dir}
              aria-label={["向上", "向右", "向下", "向左"][Number(dir)]}
              disabled={p.disabled}
              onClick={() => void move(Number(dir))}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <div class="guide-controls">
          <button
            class="secondary"
            disabled={p.disabled || d.routeUsed}
            onClick={() => {
              setDrawing(!drawing);
              path.current = [];
              setDraft([]);
            }}
          >
            {d.routeUsed
              ? "本关路线已画过"
              : drawing
                ? "取消画路线"
                : "画一条路线（显示 2 秒）"}
          </button>
          {drawing && (
            <p class="muted">从行者所在格开始，沿通路拖动，松手发送。</p>
          )}
          <div class="game-actions">
            {["↑", "→", "↓", "←", "停！"].map((text) => (
              <button
                class="secondary signal-button"
                disabled={p.disabled}
                onClick={() => void send("signal", { round: d.round, text })}
              >
                {text}
              </button>
            ))}
          </div>
          <div class="game-actions">
            {["往前走两步", "回头", "左边有坑", "对对对", "别动"].map(
              (text) => (
                <button
                  class="chip"
                  onClick={() => void send("signal", { round: d.round, text })}
                >
                  {text}
                </button>
              ),
            )}
          </div>
          <p class="muted">还可以点亮 {d.lights} 次</p>
        </div>
      )}
    </section>
  );
}
