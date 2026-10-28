import { useEffect, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import Jump from "./Jump";
import { differenceObjects } from "../../../shared/games/couple-content";
import { useGame, typing, type GameProps } from "./common";
import { Critter, TetheredPair } from "../art/ui";

function Survival(p: GameProps) {
  const d = p.view.data,
    send = useGame(p);
  return (
    <section
      class="couple-new-stage survival-stage"
      data-testid="survival-stage"
    >
      <header class="couple-bar">
        <b>❤️ {d.lives}</b>
        <b>
          第 {d.idx + 1} / {d.total} 关
        </b>
        <button onClick={() => void send("hint")}>💡 提示</button>
      </header>
      <div
        class={
          "survival-scene " +
          (d.dangerAt && p.now - d.dangerAt < 1000 ? "survival-upset" : "")
        }
      >
        <div class="scene-window">☁️ 🌤️ ☁️</div>
        <span class="scene-caption">{d.scene} · 一起发现小秘密</span>
        <div class="scene-furniture">🪟　🛋️　🪴　🖼️</div>
        <div class="scene-characters">
          <TetheredPair
            left={p.room.profiles[0]}
            right={p.room.profiles[1]}
            size={58}
          />
        </div>
        {d.searching && (
          <div class="hotspots">
            {["💄", "📱", "📦", "📝"].map((x, i) => (
              <button
                aria-label={"调查" + ["口红", "手机", "礼物盒", "纸条"][i]}
                onClick={() => void send("clue", { id: i })}
              >
                {x}
              </button>
            ))}
          </div>
        )}
      </div>
      <div class="dialogue">💬 {d.prompt}</div>
      {d.hint && <p class="couple-hint">💡 {d.hint}</p>}
      {d.feedback && <p aria-live="polite">{d.feedback}</p>}
      <div class="answer-options">
        {d.options.map((x: string, i: number) => (
          <button
            disabled={p.disabled || d.ending || (d.searching && !d.clueFound)}
            onClick={() => void send("answer", { idx: d.idx, choice: i })}
          >
            <b>{"ABC"[i]}</b>
            {x}
          </button>
        ))}
      </div>
      {d.searching && !d.clueFound && <p>先点场景里的物品，找到线索。</p>}
    </section>
  );
}

function Spot(p: GameProps) {
  const d = p.view.data,
    send = useGame(p),
    [zoom, setZoom] = useState(false);
  const scene = (bottom: boolean) => (
    <div class={"spot-panel " + (zoom ? "zoomed" : "")}>
      <svg
        viewBox="0 0 100 90"
        role="img"
        aria-label={bottom ? "修改图" : "原图"}
        onClick={(e: JSX.TargetedMouseEvent<SVGSVGElement>) => {
          const r = e.currentTarget.getBoundingClientRect();
          void send("tap", {
            x: ((e.clientX - r.left) / r.width) * 100,
            y: ((e.clientY - r.top) / r.height) * 90,
          });
        }}
      >
        <rect
          width="100"
          height="90"
          rx="4"
          fill={
            ["#ffe8d3", "#dfd9fb", "#d0e8fc", "#fce1ef", "#d1eff0"][d.sceneId]
          }
        />
        <rect
          x="4"
          y="5"
          width="92"
          height="80"
          rx="4"
          fill="#fff9ed"
          stroke="#b98172"
          stroke-width="1"
        />
        <rect x="6" y="55" width="88" height="28" fill="#f4d4b9" />
        {d.sceneId === 0 && (
          <g aria-hidden="true">
            <rect
              x="10"
              y="18"
              width="30"
              height="29"
              rx="2"
              fill="#bfe4ee"
              stroke="#aa7766"
            />
            <path d="M25 18v29M10 32h30" stroke="#aa7766" />
            <path d="M54 54v-13h36v13" fill="#c99073" stroke="#9b6953" />
            <path d="M57 41v-5h30v5" fill="#ffe1af" />
          </g>
        )}
        {d.sceneId === 1 && (
          <g aria-hidden="true">
            <rect
              x="17"
              y="19"
              width="66"
              height="29"
              rx="2"
              fill="#383049"
              stroke="#a07d7d"
            />
            <rect x="22" y="22" width="56" height="22" fill="#cee9f1" />
            <path d="M17 19l9 28H17zm66 0-9 28h9" fill="#bf6670" />
            <path d="M11 53h78" stroke="#a44757" stroke-width="4" />
          </g>
        )}
        {d.sceneId === 2 && (
          <g aria-hidden="true" fill="none" stroke="#d19ab8">
            <circle cx="51" cy="32" r="19" stroke-width="2" />
            <path
              d="M51 13v38M32 32h38M38 19l26 26M64 19 38 45M51 32 38 54M51 32l13 22"
              stroke-width="1"
            />
            <path
              d="M9 54q10-18 20 0m42 0q10-18 20 0"
              stroke="#e69d75"
              stroke-width="2"
            />
          </g>
        )}
        {d.sceneId === 3 && (
          <g aria-hidden="true">
            <rect
              x="15"
              y="29"
              width="70"
              height="25"
              rx="4"
              fill="#dcadc2"
              stroke="#af8095"
            />
            <rect x="19" y="25" width="25" height="15" rx="4" fill="#fff1e7" />
            <rect x="56" y="25" width="25" height="15" rx="4" fill="#fff1e7" />
            <path d="M15 47h70v8H15z" fill="#bd89a7" />
          </g>
        )}
        {d.sceneId === 4 && (
          <g aria-hidden="true">
            <rect x="7" y="18" width="86" height="37" fill="#a9dfe8" />
            <circle cx="50" cy="32" r="10" fill="#ffca85" />
            <path d="M7 45q10-5 20 0t20 0 20 0 26 0v10H7z" fill="#72c1cf" />
            <path
              d="M7 52q12-4 24 0t24 0 24 0 14 0"
              fill="none"
              stroke="#fff7e9"
            />
          </g>
        )}
        <text x="50" y="14" text-anchor="middle" font-size="5">
          {d.scene} · 我们的约会
        </text>
        <path d="M7 55H93" stroke="#b98172" />
        <ellipse cx="50" cy="76" rx="34" ry="5" fill="#e8bda9" opacity=".5" />
        <text x="9" y="49" font-size="7">
          {
            [
              "☕ 咖啡时光",
              "🎬 电影之夜",
              "🎡 浪漫游乐园",
              "🛏️ 温暖的家",
              "🏝️ 日落海岸",
            ][d.sceneId]
          }
        </text>
        <text x="40" y="78" font-size="12">
          🐰
        </text>
        <text x="53" y="78" font-size="12">
          🐻
        </text>
        {differenceObjects.map((obj) => {
          const diff = bottom && d.differences.includes(obj.id),
            found = d.found.includes(obj.id),
            variant = obj.id % 5;
          return (
            <g
              key={obj.id}
              transform={
                diff && variant === 1
                  ? `translate(${obj.x * 2} 0) scale(-1 1)`
                  : diff && variant === 4
                    ? "translate(3 0)"
                    : undefined
              }
            >
              <circle
                cx={obj.x}
                cy={obj.y}
                r="5"
                fill={diff && variant === 0 ? "#7fd1ed" : "#f5dbc6"}
              />
              <text
                x={obj.x}
                y={obj.y + 3}
                text-anchor="middle"
                font-size={diff && variant === 2 ? "10" : "7"}
                opacity={diff && variant === 3 ? 0 : 1}
              >
                {obj.emoji}
              </text>
              {found && (
                <circle
                  cx={obj.x}
                  cy={obj.y}
                  r="8"
                  fill="none"
                  stroke="#29ba79"
                  stroke-width="2"
                />
              )}
            </g>
          );
        })}
        {d.lastMiss && p.now - d.lastMiss.at < 1200 && (
          <text x={d.lastMiss.x} y={d.lastMiss.y} font-size="7">
            ❌
          </text>
        )}
      </svg>
    </div>
  );
  return (
    <section class="couple-new-stage" data-testid="spot-stage">
      <header class="couple-bar">
        <b>⏱ {Math.max(0, Math.ceil((d.deadline - p.now) / 1000))} 秒</b>
        <b>找到 {d.found.length} / 5</b>
        <button onClick={() => setZoom(!zoom)}>
          🔍 {zoom ? "缩小" : "放大"}
        </button>
      </header>
      <p>两人一起点图里不同的地方</p>
      {scene(false)}
      {scene(true)}
    </section>
  );
}

// Equal steps around the edge of a cross, kept in the same order as the engine.
const ludoOutline: [[number, number], [number, number]][] = [
  [
    [42, 2],
    [88, 2],
  ],
  [
    [88, 2],
    [88, 42],
  ],
  [
    [88, 42],
    [128, 42],
  ],
  [
    [128, 42],
    [128, 88],
  ],
  [
    [128, 88],
    [88, 88],
  ],
  [
    [88, 88],
    [88, 128],
  ],
  [
    [88, 128],
    [42, 128],
  ],
  [
    [42, 128],
    [42, 88],
  ],
  [
    [42, 88],
    [2, 88],
  ],
  [
    [2, 88],
    [2, 42],
  ],
  [
    [2, 42],
    [42, 42],
  ],
  [
    [42, 42],
    [42, 2],
  ],
];
function trackPoint(i: number) {
  const lengths = ludoOutline.map(([[x, y], [a, b]]) =>
      Math.hypot(a - x, b - y),
    ),
    total = lengths.reduce((a, b) => a + b, 0);
  let distance = ((i + 0.5) * total) / 48;
  for (let n = 0; n < ludoOutline.length; n++) {
    const [[x, y], [a, b]] = ludoOutline[n];
    if (distance <= lengths[n]) {
      const f = distance / lengths[n];
      return [x + (a - x) * f, y + (b - y) * f];
    }
    distance -= lengths[n];
  }
  return [42, 2];
}
function Ludo(p: GameProps) {
  const d = p.view.data,
    send = useGame(p),
    cells = Array.from({ length: 48 }, (_, i) => i);
  const act = (cmd: string) =>
    d.turn === p.seat
      ? send(cmd)
      : p.local?.send({
          type: "game",
          run: p.view.run,
          command: cmd,
          payload: {},
        });
  return (
    <section class="couple-new-stage" data-testid="ludo-stage">
      <header class="couple-bar">
        <b>🟦 玩家一</b>
        <b>🎲 {d.dice || "?"}</b>
        <b>🟥 玩家二</b>
      </header>
      <div class="ludo-cross">
        <svg viewBox="-8 -8 146 146" role="img" aria-label="48 格飞行棋棋盘">
          <path
            d="M42 2H88V42H128V88H88V128H42V88H2V42H42Z"
            fill="#f2d1b6"
            stroke="#8f615e"
            stroke-width="2"
          />
          <path
            d="M65 7V62M65 123V68"
            stroke="#ff9db1"
            stroke-width="7"
            stroke-dasharray="5 3"
          />
          <path
            d="M7 65H62M123 65H68"
            stroke="#9bcfff"
            stroke-width="7"
            stroke-dasharray="5 3"
          />
          <text x="65" y="68" font-size="9" text-anchor="middle">
            🏁
          </text>
          {cells.map((i) => {
            const [x, y] = trackPoint(i);
            return (
              <g key={i}>
                <rect
                  x={x - 4.5}
                  y={y - 4.5}
                  width="9"
                  height="9"
                  rx="2"
                  fill={["#ffe0e8", "#e1edff", "#fff5ca", "#dfefde"][i % 4]}
                  stroke="#aa8071"
                  stroke-width=".7"
                />
                <text x={x} y={y + 2} font-size="5.8" text-anchor="middle">
                  {["❤️", "💬", "⚡", "💣"][i % 4]}
                </text>
              </g>
            );
          })}
          {d.positions.map((pos: number, s: number) => {
            const [x, y] =
              pos < 0
                ? [s ? 113 : 17, s ? 17 : 113]
                : pos < 48
                  ? trackPoint(pos)
                  : [
                      s ? 65 : 65,
                      s ? 85 - (pos - 48) * 4 : 45 + (pos - 48) * 4,
                    ];
            return (
              <g transform={`translate(${x - 7} ${y - 7})`}>
                <Critter
                  avatar={p.room.profiles[s as 0 | 1]?.avatar}
                  color={p.room.profiles[s as 0 | 1]?.color || "#FF6B6B"}
                  size={14}
                />
              </g>
            );
          })}
        </svg>
      </div>
      <div class="ludo-center">
        <strong>💞 当前：玩家 {d.turn + 1}</strong>
        <p>
          🐰{" "}
          {d.positions[0] < 0
            ? "基地"
            : d.positions[0] >= 48
              ? "冲刺 " + (d.positions[0] - 47)
              : d.positions[0] + 1}
          　🐻{" "}
          {d.positions[1] < 0
            ? "基地"
            : d.positions[1] >= 48
              ? "冲刺 " + (d.positions[1] - 47)
              : d.positions[1] + 1}
        </p>
        <button
          class="primary"
          disabled={p.disabled || (p.seat !== d.turn && !p.local) || !!d.task}
          onClick={() => void act("roll")}
        >
          🎲 投掷骰子
        </button>
      </div>
      {d.task && (
        <div class="ludo-task">
          <strong>{d.event} 甜蜜任务</strong>
          <p>{d.task}</p>
          <button
            disabled={p.seat !== d.turn && !p.local}
            onClick={() => void act("continue")}
          >
            完成，交给 TA
          </button>
        </div>
      )}
    </section>
  );
}

const ingredientLabels: Record<string, string> = {
  tomato: "🍅",
  lettuce: "🥬",
  meat: "🥩",
  bread: "🍞",
};
function itemLabel(item: any) {
  return item
    ? ingredientLabels[item.kind] +
        (
          { raw: "生", chopped: "切好", cooked: "熟", burned: "焦" } as Record<
            string,
            string
          >
        )[item.stage]
    : "";
}
function VirtualStick({
  move,
  label,
}: {
  move: (dx: number, dy: number) => void;
  label: string;
}) {
  const timer = useRef<ReturnType<typeof setInterval>>(),
    dir = useRef<[number, number]>([0, 0]),
    [dot, setDot] = useState<[number, number]>([0, 0]);
  const stop = () => {
    clearInterval(timer.current);
    timer.current = undefined;
    dir.current = [0, 0];
    setDot([0, 0]);
  };
  useEffect(() => stop, []);
  const update = (e: JSX.TargetedPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect(),
      x = (e.clientX - r.left - r.width / 2) / (r.width / 2),
      y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const len = Math.max(1, Math.hypot(x, y));
    setDot([(x / len) * 30, (y / len) * 30]);
    dir.current =
      Math.hypot(x, y) < 0.2
        ? [0, 0]
        : Math.abs(x) > Math.abs(y)
          ? [x > 0 ? 1 : -1, 0]
          : [0, y > 0 ? 1 : -1];
  };
  return (
    <div
      class="virtual-stick"
      role="group"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
        if (!timer.current)
          timer.current = setInterval(() => {
            const [x, y] = dir.current;
            if (x || y) move(x, y);
          }, 200);
      }}
      onPointerMove={(e) => {
        if (timer.current) update(e);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
    >
      <span style={{ transform: `translate(${dot[0]}px,${dot[1]}px)` }} />
    </div>
  );
}
function Kitchen(p: GameProps) {
  const lastKeyboard = useRef<[number, number]>([-Infinity, -Infinity]);
  const d = p.view.data,
    send = useGame(p),
    pos = d.players[p.seat],
    near = d.stations.filter(
      (s: any) => Math.abs(s.x - pos.x) + Math.abs(s.y - pos.y) <= 1,
    );
  const sendFor = (seat: number, command: string, payload: any) =>
    seat === p.seat
      ? send(command, payload)
      : p.local
        ? p.local.send({ type: "game", run: p.view.run, command, payload })
        : Promise.resolve(false);
  const nearFor = (seat: number) =>
    d.stations.filter(
      (s: any) =>
        Math.abs(s.x - d.players[seat].x) + Math.abs(s.y - d.players[seat].y) <=
        1,
    );
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      const dirs: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        w: [0, -1],
        s: [0, 1],
        a: [-1, 0],
        d: [1, 0],
      };
      const dir = dirs[e.key];
      const actor = p.local && e.key.startsWith("Arrow") ? 1 : p.seat;
      if (dir) {
        e.preventDefault();
        const now = performance.now();
        if (now - lastKeyboard.current[actor] < 100) return;
        lastKeyboard.current[actor] = now;
        void sendFor(actor, "move", { dx: dir[0], dy: dir[1] });
      } else if (e.key === " " || e.key === "Enter") {
        const who = p.local && e.key === "Enter" ? 1 : p.seat;
        const stations = nearFor(who);
        if (stations.length) {
          e.preventDefault();
          const now = performance.now();
          if (now - lastKeyboard.current[who] < 100) return;
          lastKeyboard.current[who] = now;
          void sendFor(who, "interact", { station: stations[0].id });
        }
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [
    d.players[0].x,
    d.players[0].y,
    d.players[1].x,
    d.players[1].y,
    p.view.run,
    p.local?.token,
  ]);
  const pad = (actor: number) => (
    <div class="kitchen-controls">
      <strong>{actor === 0 ? "🟦 玩家一" : "🟥 玩家二"}</strong>
      <div class="near-stations">
        {nearFor(actor).map((s: any) => (
          <button
            onClick={() => void sendFor(actor, "interact", { station: s.id })}
          >
            {s.label}
          </button>
        ))}
      </div>
      <VirtualStick
        label={"玩家" + (actor + 1) + "摇杆"}
        move={(dx, dy) => void sendFor(actor, "move", { dx, dy })}
      />
      <div class="move-pad">
        <button onClick={() => void sendFor(actor, "move", { dx: 0, dy: -1 })}>
          ↑
        </button>
        <div>
          <button
            onClick={() => void sendFor(actor, "move", { dx: -1, dy: 0 })}
          >
            ←
          </button>
          <button onClick={() => void sendFor(actor, "move", { dx: 0, dy: 1 })}>
            ↓
          </button>
          <button onClick={() => void sendFor(actor, "move", { dx: 1, dy: 0 })}>
            →
          </button>
        </div>
      </div>
    </div>
  );
  return (
    <section class="couple-new-stage" data-testid="kitchen-stage">
      <header class="couple-bar">
        <b>
          📋{" "}
          {d.orders
            .map(
              (o: any) =>
                (o.kind === "burger" ? "🍔" : "🥗") +
                " " +
                Math.max(0, Math.ceil((o.deadline - p.now) / 1000)) +
                "s",
            )
            .join("　")}
        </b>
        <b>💰 {d.score}</b>
      </header>
      <div class="kitchen-grid">
        {Array.from({ length: 64 }, (_, i) => {
          const x = i % 8,
            y = Math.floor(i / 8),
            station = d.stations.find((s: any) => s.x === x && s.y === y),
            people = d.players
              .map((s: any, j: number) => (s.x === x && s.y === y ? j : -1))
              .filter((j: number) => j >= 0);
          return (
            <div
              class={"kitchen-cell " + (station ? "workstation" : "")}
              key={i}
            >
              {station && (
                <span title={station.label}>{station.label.split(" ")[0]}</span>
              )}
              {people.map((j: number) => (
                <Critter
                  class={"chef player-" + j}
                  avatar={p.room.profiles[j as 0 | 1]?.avatar}
                  color={p.room.profiles[j as 0 | 1]?.color || "#FF6B6B"}
                  size={32}
                />
              ))}
            </div>
          );
        })}
      </div>
      <p>
        你拿着：{itemLabel(pos.held) || "空手"}　🍽️{" "}
        {d.plate.map(itemLabel).join(" + ") || "空盘"}
      </p>
      <p>
        🔪 {d.boards.map(itemLabel).join(" / ") || "空"}　🍳{" "}
        {d.pans
          .map((pan: any) =>
            pan
              ? (pan.item.stage === "burned" ? "🔥 " : "") +
                itemLabel(pan.item) +
                " " +
                Math.floor((p.now - pan.at) / 1000) +
                "s"
              : "空",
          )
          .join(" / ")}
      </p>
      <div class="pan-progress">
        {d.pans.map((pan: any, index: number) => (
          <label>
            煎锅 {index + 1}{" "}
            <progress
              aria-label={"煎锅" + (index + 1) + "进度"}
              max="10"
              value={
                pan ? Math.min(10, Math.max(0, (p.now - pan.at) / 1000)) : 0
              }
            />
          </label>
        ))}
      </div>
      <div class={p.local ? "dual-kitchen" : ""}>
        {pad(p.seat)}
        {p.local && pad(1)}
      </div>
      <p class="muted">
        走到台面旁操作。切菜点击三次，煎 5 秒取出，超过 10 秒会焦。🍔
        面包＋煎熟肉饼；🥗 切好的番茄＋生菜。
      </p>
    </section>
  );
}

const rooms = ["卧室", "客厅", "浴室", "厨房"];
const objects = ["🪴", "💡", "🧸"];
function HideView(p: GameProps) {
  const d = p.view.data,
    send = useGame(p),
    [choice, setChoice] = useState<number | null>(null),
    [decoys, setDecoys] = useState<number[]>([]),
    [prop, setProp] = useState("🪴");
  const choosing = d.phase === "hide" && p.seat === 1,
    hidden = d.phase === "hide" && p.seat === 0;
  const move = (dx: number, dy: number) => {
    if (d.phase !== "seek" || d.mode !== "realtime") return;
    if (p.seat === 0) {
      const room = d.seeker,
        row = Math.floor(room / 2),
        col = room % 2;
      const r = Math.max(0, Math.min(1, row + dy)),
        c = Math.max(0, Math.min(1, col + dx));
      if (r * 2 + c !== room) void send("light", { room: r * 2 + c });
    } else {
      const old = d.ownHide;
      if (old === null) return;
      const next = Math.max(0, Math.min(11, old + dx + dy * 3));
      if (next !== old) void send("move", { id: next });
    }
  };
  const searchCurrent = () => {
    const id = [0, 1, 2]
      .map((x) => d.seeker * 3 + x)
      .find((x) => !d.searches.includes(x));
    if (id !== undefined) void send("search", { id });
  };
  useEffect(() => {
    if (d.mode !== "realtime" || d.phase !== "seek") return;
    const down = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      const dirs: Record<string, [number, number]> =
        p.seat === 0
          ? { w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }
          : {
              ArrowUp: [0, -1],
              ArrowDown: [0, 1],
              ArrowLeft: [-1, 0],
              ArrowRight: [1, 0],
            };
      if (dirs[e.key]) {
        e.preventDefault();
        move(...dirs[e.key]);
      } else if (p.seat === 0 && e.key === " ") {
        e.preventDefault();
        searchCurrent();
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [
    p.view.run,
    p.seat,
    d.phase,
    d.mode,
    d.seeker,
    d.ownHide,
    d.searches.length,
  ]);
  const select = (id: number) => {
    if (choosing) {
      if (choice === null) {
        setChoice(id);
        return;
      }
      if (id === choice) {
        setChoice(null);
        return;
      }
      setDecoys(
        decoys.includes(id)
          ? decoys.filter((x) => x !== id)
          : decoys.length < 2
            ? [...decoys, id]
            : decoys,
      );
      return;
    }
    if (d.phase === "seek") void send(p.seat === 0 ? "search" : "move", { id });
  };
  return (
    <section class="couple-new-stage" data-testid="hide-stage">
      <header class="couple-bar">
        <b>👁️ 抓捕者 vs 🎭 躲藏者</b>
        <b>⏱ {Math.max(0, Math.ceil((d.deadline - p.now) / 1000))}s</b>
      </header>
      <p>
        {hidden
          ? "请把设备交给躲藏者，等待 TA 选好。"
          : choosing
            ? "先选藏身处，再选两个诱饵。"
            : p.seat === 0
              ? `还可寻找 ${d.attempts - d.searches.length} 次`
              : `找到 3 把钥匙逃脱：${d.collected}/3`}
      </p>
      {d.hint && p.seat === 0 && <p aria-live="polite">🔎 {d.hint}</p>}
      {!hidden && (
        <div class="hide-map">
          {rooms.map((room, r) => (
            <div
              class={
                "hide-room " +
                (d.mode === "realtime" &&
                d.phase === "seek" &&
                p.seat === 0 &&
                d.seeker !== r
                  ? "fog"
                  : "")
              }
            >
              <strong>🚪 {room}</strong>
              {d.mode === "realtime" && d.phase === "seek" && p.seat === 0 && (
                <button onClick={() => void send("light", { room: r })}>
                  🔦 照这里
                </button>
              )}
              <div>
                {[0, 1, 2].map((i) => {
                  const id = r * 3 + i;
                  return (
                    <button
                      disabled={
                        d.phase === "seek" &&
                        p.seat === 0 &&
                        (d.mode === "turn"
                          ? d.searches.includes(id)
                          : d.seeker !== r)
                      }
                      class={
                        ((choosing && choice === id) || d.ownHide === id
                          ? "chosen "
                          : "") +
                        ((choosing || p.seat === 1) && decoys.includes(id)
                          ? "decoy "
                          : "")
                      }
                      onClick={() => select(id)}
                    >
                      {d.mode === "realtime" ? d.furniture[id] : objects[i]}
                      {d.keys.includes(id) ? "🔑" : ""}
                      {d.searches.includes(id) ? "❌" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {choosing && (
        <>
          {d.mode === "realtime" && (
            <label>
              伪装为{" "}
              <select
                value={prop}
                onChange={(e) => setProp(e.currentTarget.value)}
              >
                {objects.map((x) => (
                  <option>{x}</option>
                ))}
              </select>
            </label>
          )}
          <button
            class="primary"
            disabled={
              choice === null || (d.mode === "turn" && decoys.length !== 2)
            }
            onClick={() => void send("hide", { id: choice, decoys, prop })}
          >
            藏好了
          </button>
        </>
      )}
      {d.phase === "seek" && d.mode === "realtime" && (
        <div class="hide-controls">
          <VirtualStick
            label={p.seat === 0 ? "抓捕者摇杆" : "躲藏者摇杆"}
            move={move}
          />
          {p.seat === 0 && (
            <button onClick={searchCurrent}>🔍 搜索照亮区域</button>
          )}
        </div>
      )}
      {d.phase === "seek" && d.mode === "turn" && p.seat === 1 && (
        <p>请将手机交给抓捕者，别让 TA 看见你的屏幕。</p>
      )}
    </section>
  );
}

function Hide(p: GameProps) {
  const [handed, setHanded] = useState(false),
    [localViewer, setLocalViewer] = useState<0 | 1>(0),
    local = p.local;
  if (!local || !local.view) return <HideView {...p} />;
  if (p.view.data.phase === "hide")
    return (
      <HideView
        {...p}
        seat={1}
        view={local.view}
        send={local.send}
        transport={local.transport}
        token={local.token}
        local={undefined}
      />
    );
  if (p.view.data.mode === "realtime")
    return (
      <div class="dual-hide">
        <HideView {...p} local={undefined} />
        <HideView
          {...p}
          seat={1}
          view={local.view}
          send={local.send}
          transport={local.transport}
          token={local.token}
          local={undefined}
        />
      </div>
    );
  if (!handed)
    return (
      <section class="couple-new-stage">
        <h2>请交给抓捕者</h2>
        <p>遮住屏幕，准备好后点击继续。</p>
        <button onClick={() => setHanded(true)}>开始寻找</button>
      </section>
    );
  const selected =
    localViewer === 1
      ? {
          ...p,
          seat: 1 as const,
          view: local.view,
          send: local.send,
          transport: local.transport,
          token: local.token,
          local: undefined,
        }
      : p;
  return (
    <>
      <div class="hide-local-switch">
        <button onClick={() => setLocalViewer(0)}>👁️ 抓捕者</button>
        <button onClick={() => setLocalViewer(1)}>🎭 躲藏者</button>
      </div>
      <HideView {...selected} />
    </>
  );
}

export default function CoupleGames(p: GameProps) {
  switch (p.view.kind) {
    case "survival":
      return <Survival {...p} />;
    case "spot-difference":
      return <Spot {...p} />;
    case "coop-kitchen":
      return <Kitchen {...p} />;
    case "couple-ludo":
      return <Ludo {...p} />;
    case "hide-seek":
      return <Hide {...p} />;
    case "couple-jump":
      return <Jump {...p} />;
    default:
      return null;
  }
}
