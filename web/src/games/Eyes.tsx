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
import { sfx } from "./sfx";
const sweet = [
  "第一步，从相信 TA 开始。",
  "萤火虫说：你们走得好默契。",
  "再甜的迷宫，也甜不过你们。",
  "星星记住了你们牵手的方向。",
  "月光下，TA 一直是你的眼。",
  "鹊桥搭好了，一起回家吧。",
];
const replies = ["收到！", "你确定？", "我怕怕", "再说一遍", "爱你哟", "冲鸭"];
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
    eatenClick = useRef(false),
    [pops, setPops] = useState<{ id: number; text: string; tone: string }[]>(
      [],
    ),
    popId = useRef(0),
    [reply, setReply] = useState(""),
    [spooked, setSpooked] = useState(false);
  function pop(text: string, tone = "") {
    const id = ++popId.current;
    setPops((list) => [...list.slice(-3), { id, text, tone }]);
    setTimeout(() => setPops((list) => list.filter((x) => x.id !== id)), 1300);
  }
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
    setPops([]);
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
        sfx.bump();
        pop("咚！撞墙了", "bad");
      } else if (e.data.trap) {
        sfx.fall();
        pop("掉进坑里，回到起点…", "bad");
      } else if (!e.data.scared) sfx.step();
      if (e.data.key) {
        sfx.key();
        pop("拿到钥匙 🔑", "good");
      }
      if (e.data.heart) {
        sfx.heart();
        pop("+1 💗", "love");
      }
      if (!e.data.bump && [5, 10, 15, 20, 30].includes(e.data.streak))
        pop("默契连走 ×" + e.data.streak + " 🔥", "good");
    }
    if (e.kind === "scared" && e.data.round === d.round) {
      inFlight.current.clear();
      setOptimistic(e.data.pos);
      next.current = Math.max(
        next.current,
        latest.current.view.data.lastMove + 1,
      );
      sfx.spooky();
      setSpooked(true);
      setTimeout(() => setSpooked(false), 600);
      pop(walker ? "👻 哇！被吓退三步" : "👻 TA 被幽灵吓跑了", "bad");
    }
    if (e.kind === "signal") {
      setSignal(e.data.text);
      sfx.ping();
      setTimeout(() => setSignal(""), 2800);
    }
    if (e.kind === "reply") {
      setReply(e.data.text);
      sfx.ping();
      setTimeout(() => setReply(""), 2800);
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
    if (d.stage === "complete") sfx.win();
  }, [d.stage, d.round]);
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
      if (d.hearts.includes(i) && !d.got.includes(i)) return "heart";
      if (d.door === i && !d.hasKey) return "door";
      if (d.exit === i) return "exit";
      return "floor";
    }
    if (d.triggered.includes(i)) return "trap";
    if (d.walls.includes(i)) return d.door === i ? "door" : "wall";
    if (d.exit === i) return "exit";
    if (d.nearHearts.includes(i)) return "heart";
    if (d.seen.includes(i)) return "floor";
    if (d.light?.cell === i && p.now < d.light.until)
      return d.light.wall ? "wall" : "floor";
    return "fog";
  };
  return (
    <section class="extra-stage eyes-stage" data-testid="eyes-stage">
      <div class="stage-score">
        <span>
          第 {d.round + 1}/6 关 · {d.scene} ·{" "}
          {walker ? "你是行者" : "你是引路人"}
        </span>
        <b>
          ★ {d.stars} · 💗 {d.got.length}/{d.heartGoal}
        </b>
      </div>
      <p class="muted">
        {walker
          ? "听 TA 指挥，身边有 💗 会闪光，感到寒意要小心 👻"
          : d.round >= 2
            ? "幽灵在岔路巡逻，💗 藏在死胡同里，要不要冒险去拿？"
            : "带 TA 找出口，顺路捡起 💗；点格子可点亮 3 秒。"}
      </p>
      <div
        class={
          "maze-board scene-" +
          d.round +
          (bump ? " bump" : "") +
          (spooked ? " spooked" : "")
        }
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
                  {
                    trap: "✦",
                    key: "⚿",
                    exit: "♡",
                    door: "▥",
                    heart: "♥",
                  } as Record<string, string>
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
        {(walker ? d.nearGhosts : d.ghosts).map((cell: number, i: number) => (
          <div
            key={"ghost" + i}
            class="maze-ghost"
            aria-label="幽灵"
            style={{
              left: ((cell % d.w) / d.w) * 100 + "%",
              top: (Math.floor(cell / d.w) / d.h) * 100 + "%",
              width: 100 / d.w + "%",
              height: 100 / d.h + "%",
            }}
          >
            👻
          </div>
        ))}
        {signal && walker && (
          <div class="maze-signal" role="status">
            {signal}
          </div>
        )}
        {reply && !walker && (
          <div class="maze-signal reply" role="status">
            {reply}
          </div>
        )}
        <div class="maze-pops" aria-live="polite">
          {pops.map((x) => (
            <span key={x.id} class={"maze-pop " + x.tone}>
              {x.text}
            </span>
          ))}
        </div>
        {d.streak >= 5 && d.stage === "walking" && (
          <div class="maze-combo">默契 ×{d.streak}</div>
        )}
      </div>
      <div class="stage-score">
        <small>
          撞墙 {d.bumps} · 陷阱 {d.falls}
          {d.round >= 2 ? " · 惊吓 " + d.scares : ""}
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
        <div class="agreement maze-win">
          <div class="maze-confetti" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => (
              <i style={{ "--i": i }}>{i % 3 ? "💗" : "✨"}</i>
            ))}
          </div>
          <h3>找到出口啦！{"★".repeat(d.history.at(-1)?.stars || 0)}</h3>
          <p class="maze-sweet">{sweet[d.round]}</p>
          <p class="muted">
            用时 {d.history.at(-1)?.time.toFixed(1)} 秒 · 💗{" "}
            {d.history.at(-1)?.hearts}/{d.heartGoal} · 最长连走 {d.bestStreak}{" "}
            步
          </p>
          <button
            class="primary"
            onClick={() => void send("next", { round: d.round })}
          >
            {d.round === 5 ? "看看我们的星星" : "交换身份，下一关 →"}
          </button>
        </div>
      ) : walker ? (
        <>
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
          <div class="game-actions maze-replies">
            {replies.map((text) => (
              <button
                class="chip"
                disabled={p.disabled}
                onClick={() => void send("reply", { round: d.round, text })}
              >
                {text}
              </button>
            ))}
          </div>
        </>
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
            {[
              "往前走两步",
              "回头",
              "左边有坑",
              "对对对",
              "别动",
              "那边有💗",
              ...(d.round >= 2 ? ["有幽灵，快跑！"] : []),
              "相信我",
            ].map((text) => (
              <button
                class="chip"
                onClick={() => void send("signal", { round: d.round, text })}
              >
                {text}
              </button>
            ))}
          </div>
          <p class="muted">还可以点亮 {d.lights} 次</p>
        </div>
      )}
    </section>
  );
}
