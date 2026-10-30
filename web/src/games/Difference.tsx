import { useEffect, useRef, useState } from "preact/hooks";
import { useGame, nickname, type GameProps } from "./common";
import { sfx } from "./sfx";
import "./difference.css";
const RECOLOR = "#284ddf";
const groups = [
  ["左上角", "右上角", "左下角", "右下角", "中间"],
  ["桌子上", "墙上", "地上", "右边", "下面"],
  ["有几个", "颜色不一样", "方向反了", "变大了", "不见了", "多了条纹"],
];
/** Hand-drawn backdrops in the same 100×100 space as the objects. */
function Backdrop({ level }: { level: number }) {
  if (level === 0)
    return (
      <g>
        <rect width="100" height="58" fill="#f6dcc0" />
        <path d="M0 6h100" stroke="#e3bf98" stroke-width="1" />
        <rect
          x="4"
          y="16"
          width="26"
          height="22"
          rx="2"
          fill="#bfe6ff"
          stroke="#9a6a3e"
          stroke-width="1.5"
        />
        <path d="M17 16v22M4 27h26" stroke="#9a6a3e" stroke-width="1" />
        <rect x="2" y="38" width="30" height="3" fill="#9a6a3e" />
        <rect x="74" y="6" width="20" height="16" rx="1" fill="#3a2a22" />
        <rect x="80" y="40" width="18" height="2" fill="#9a6a3e" />
        <rect x="0" y="54" width="100" height="6" fill="#b5835a" />
        <rect y="58" width="100" height="42" fill="#e9c9a3" />
        {Array.from({ length: 10 }, (_, i) => (
          <rect
            x={i * 10}
            y={i % 2 ? 58 : 79}
            width="10"
            height="21"
            fill="#dcb88f"
          />
        ))}
        <ellipse cx="52" cy="74" rx="40" ry="8" fill="#a8744d" />
        <rect x="50" y="76" width="4" height="16" fill="#8a5a31" />
      </g>
    );
  if (level === 1)
    return (
      <g>
        <rect width="100" height="100" fill="#2a2140" />
        <rect x="20" y="2" width="60" height="22" rx="2" fill="#f5f0ff" />
        <path d="M14 2v28M86 2v28" stroke="#a8243f" stroke-width="6" />
        <path d="M12 8l14 0M88 8l-14 0" stroke="#7a1a2e" stroke-width="2" />
        {[30, 48].map((y) =>
          Array.from({ length: 6 }, (_, i) => (
            <rect
              x={6 + i * 16}
              y={y}
              width="12"
              height="8"
              rx="2"
              fill="#c0304f"
            />
          )),
        )}
        <rect y="52" width="100" height="48" fill="#3b2f55" />
        <rect x="6" y="54" width="88" height="14" rx="3" fill="#f4c27a" />
        <rect x="6" y="66" width="88" height="3" fill="#b07a32" />
        {[14, 32, 50, 68, 86].map((x) => (
          <circle cx={x} cy="96" r="1.4" fill="#ffd23f" />
        ))}
      </g>
    );
  if (level === 2)
    return (
      <g>
        <rect width="100" height="58" fill="#bfe8ff" />
        <circle cx="94" cy="6" r="6" fill="#ffe066" />
        <path d="M0 56 Q25 40 50 52 T100 48 V60 H0Z" fill="#a6e07a" />
        <rect y="56" width="100" height="44" fill="#9fd87a" />
        <path d="M0 78 Q50 62 100 78 V86 Q50 72 0 86Z" fill="#f2dfb2" />
        {[8, 26, 46, 66, 86].map((x, i) => (
          <path
            d={`M${x} 0 L${x + 6} 6 L${x + 12} 0`}
            fill={["#ff6b6b", "#ffd23f", "#4dabf7", "#69db7c", "#b197fc"][i]}
          />
        ))}
      </g>
    );
  if (level === 3)
    return (
      <g>
        <rect width="100" height="56" fill="#ffe3ee" />
        <rect
          x="4"
          y="4"
          width="24"
          height="24"
          rx="2"
          fill="#cfe9ff"
          stroke="#c98fa8"
          stroke-width="1.5"
        />
        <path d="M16 4v24M4 16h24" stroke="#c98fa8" stroke-width="1" />
        <rect
          x="76"
          y="6"
          width="20"
          height="40"
          rx="2"
          fill="#e8c6a8"
          stroke="#a8744d"
          stroke-width="1"
        />
        <rect y="54" width="100" height="46" fill="#f2d6c4" />
        <ellipse cx="54" cy="78" rx="34" ry="10" fill="#ffc2d6" opacity=".7" />
        <rect
          x="44"
          y="38"
          width="40"
          height="14"
          rx="3"
          fill="#fff"
          stroke="#c98fa8"
          stroke-width="1"
        />
        <rect x="44" y="36" width="10" height="8" rx="2" fill="#ffd1e0" />
        <rect x="28" y="40" width="12" height="10" fill="#c49a76" />
      </g>
    );
  return (
    <g>
      <rect width="100" height="36" fill="#9fdcff" />
      <circle cx="10" cy="8" r="5" fill="#ffe066" />
      <rect y="34" width="100" height="22" fill="#3d9ae0" />
      {[38, 44, 50].map((y) => (
        <path
          d={`M0 ${y} Q12 ${y - 2} 25 ${y} T50 ${y} T75 ${y} T100 ${y}`}
          fill="none"
          stroke="#fff"
          stroke-width=".7"
          opacity=".7"
        />
      ))}
      <path d="M0 56 Q50 50 100 56 V100 H0Z" fill="#f7dfa3" />
      {Array.from({ length: 14 }, (_, i) => (
        <circle
          cx={(i * 37) % 100}
          cy={64 + ((i * 23) % 34)}
          r=".6"
          fill="#d9b773"
        />
      ))}
    </g>
  );
}
function Thing({ o, found }: { o: any; found: boolean }) {
  const recolor = o.color === RECOLOR,
    mirror = o.direction < 0,
    icons = Array.from({ length: o.count }, (_, i) => i);
  return (
    <g data-id={o.id} data-found={found ? "yes" : "no"}>
      <rect x={o.x - 7} y={o.y - 7} width="14" height="14" fill="transparent" />
      {o.pattern === "striped" && (
        <g>
          <rect
            x={o.x - 5}
            y={o.y + 2}
            width="10"
            height="4"
            rx="1"
            fill="#fff"
          />
          {[0, 1, 2, 3].map((n) => (
            <path
              d={`M${o.x - 4 + n * 2.6},${o.y + 2}v4`}
              stroke="#c2185b"
              stroke-width="1.1"
            />
          ))}
        </g>
      )}
      {icons.map((i) => (
        <text
          x={o.x + (o.count > 1 ? (i - 1) * o.size * 0.55 : 0)}
          y={o.y + (o.count > 1 ? (i % 2 ? -1 : 1) : 0)}
          text-anchor="middle"
          dominant-baseline="middle"
          font-size={o.size}
          class={"spot-thing" + (recolor ? " recolor" : "")}
          transform={mirror ? `translate(${2 * o.x} 0) scale(-1 1)` : undefined}
        >
          {o.icon}
        </text>
      ))}
    </g>
  );
}
export default function Difference(p: GameProps) {
  const d = p.view.data,
    send = useGame(p),
    [tab, setTab] = useState(0),
    [pop, setPop] = useState<{ x: number; y: number; key: number } | null>(
      null,
    ),
    lastFound = useRef(d.found.length),
    lastMiss = useRef(d.lastMiss?.x);
  useEffect(() => {
    if (d.found.length > lastFound.current) {
      sfx.heart();
      const f = d.found.at(-1);
      setPop({ x: f.x, y: f.y, key: Date.now() });
    }
    lastFound.current = d.found.length;
  }, [d.found.length]);
  useEffect(() => {
    if (d.lastMiss && d.lastMiss.x !== lastMiss.current) sfx.bump();
    lastMiss.current = d.lastMiss?.x;
  }, [d.lastMiss?.x]);
  const left = Math.max(0, Math.ceil((d.deadline - p.now) / 1000));
  function panel(objects: any[], label: string, mine: boolean) {
    return (
      <div class={"spot-panel" + (mine ? " mine" : "")}>
        <b class="spot-label">{label}</b>
        <svg
          viewBox="0 0 100 100"
          aria-label={d.scene + label}
          role="img"
          style={{ touchAction: "manipulation" }}
          onPointerDown={(e) => {
            if (p.disabled) return;
            const rect = e.currentTarget.getBoundingClientRect();
            void send("tap", {
              x: ((e.clientX - rect.left) / rect.width) * 100,
              y: ((e.clientY - rect.top) / rect.height) * 100,
            });
          }}
        >
          <Backdrop level={d.level} />
          {objects.map((o) => (
            <Thing o={o} found={d.found.some((f: any) => f.id === o.id)} />
          ))}
          {d.hint && (
            <circle cx={d.hint.x} cy={d.hint.y} r="13" class="spot-hint" />
          )}
          {d.found.map((f: any) => (
            <g class="spot-found">
              <circle cx={f.x} cy={f.y} r="7.5" />
              <text x={f.x + 6} y={f.y - 5} font-size="4">
                💗
              </text>
            </g>
          ))}
          {pop && (
            <circle
              key={pop.key}
              cx={pop.x}
              cy={pop.y}
              r="7.5"
              class="spot-burst"
            />
          )}
          {d.lastMiss && (
            <g class="spot-miss">
              <path
                d={`M${d.lastMiss.x - 3},${d.lastMiss.y - 3}l6,6m0,-6l-6,6`}
                stroke="#e8364f"
                stroke-width="1.6"
                stroke-linecap="round"
              />
              <text
                x={d.lastMiss.x}
                y={d.lastMiss.y - 5}
                font-size="4"
                text-anchor="middle"
                fill="#e8364f"
              >
                -3s
              </text>
            </g>
          )}
        </svg>
      </div>
    );
  }
  return (
    <section
      class={"couple-new-stage spot-stage spot-level-" + d.level}
      data-testid="spot-stage"
    >
      <header class="spot-top">
        <div>
          <b>
            {d.scene} · 找到 {d.found.length} / {d.total}
          </b>
          <div class="spot-slots" aria-hidden="true">
            {Array.from({ length: d.total }, (_, i) => (
              <i class={i < d.found.length ? "on" : ""}>
                {i < d.found.length ? "💗" : ""}
              </i>
            ))}
          </div>
        </div>
        <span class={"spot-clock" + (left <= 15 ? " urgent" : "")}>
          ⏱ {left}s
        </span>
      </header>
      <p class="spot-tip">
        {d.mode === "easy"
          ? "教学：两张图都给你们看，点出 " + d.total + " 处不同"
          : `你只能看「${d.side}」，把看到的说给 ${nickname(p, 1 - p.seat)} 听`}
      </p>
      {d.images ? (
        <div class="spot-pair">
          {panel(d.images[0], "原图", p.seat === 0)}
          {panel(d.images[1], "修改图", p.seat === 1)}
        </div>
      ) : (
        panel(d.objects, d.side, true)
      )}
      {d.signal && (
        <p
          class={"spot-signal" + (d.signal.seat === p.seat ? " mine" : "")}
          aria-live="polite"
        >
          {d.signal.seat === p.seat ? "你" : "TA"}：{d.signal.text}
        </p>
      )}
      <div class="spot-tabs" role="tablist">
        {["位置", "地方", "哪里不同"].map((name, i) => (
          <button
            role="tab"
            aria-selected={tab === i}
            class={tab === i ? "on" : ""}
            onClick={() => setTab(i)}
          >
            {name}
          </button>
        ))}
        <button
          class="spot-magnifier"
          disabled={p.disabled || d.hintUsed}
          onClick={() => void send("hint", {})}
        >
          🔍 {d.hintUsed ? "放大镜已用" : "放大镜 -10s"}
        </button>
      </div>
      <div class="button-row spot-phrases">
        {groups[tab].map((text) => (
          <button
            style={{ minHeight: 44 }}
            disabled={p.disabled}
            onClick={() => void send("signal", { text })}
          >
            {text}
          </button>
        ))}
      </div>
    </section>
  );
}
