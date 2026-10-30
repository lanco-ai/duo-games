import { useRef, useState, useEffect } from "preact/hooks";
import type { GameProps } from "./common";
import { useGame, nickname } from "./common";
import { jumpLevels } from "../../../shared/games/couple-jump/levels";
import { critterSVG, kindOf } from "../art/critter";
import { sfx } from "./sfx";
import "./jump.css";
const scenes = [
  {
    title: "春日野餐",
    tip: "第一段路，先熟悉彼此的力度",
    sky: ["#bfe8ff", "#e6fbe4"],
    below: "#5bb3e8",
    belowName: "小溪",
    pad: "#9a6a3e",
    top: "#7cc655",
    other: "#ffb3c7",
  },
  {
    title: "雪山小屋",
    tip: "冰面站不久，两秒内必须起跳",
    sky: ["#a9c8ea", "#eef6ff"],
    below: "#bfe3ff",
    belowName: "冰湖",
    pad: "#cfe9ff",
    top: "#ffffff",
    other: "#d6ccff",
  },
  {
    title: "云端城堡",
    tip: "云朵会飘，看准了再松手",
    sky: ["#c9b6ff", "#ffe2f1"],
    below: "#f3eaff",
    belowName: "云海",
    pad: "#ffffff",
    top: "#ffffff",
    other: "#ffe0ef",
  },
  {
    title: "鹊桥星河",
    tip: "金色爱心平台，同步完美落地能回一颗心",
    sky: ["#0d1238", "#3b2a6b"],
    below: "#1a1f4f",
    belowName: "银河",
    pad: "#ffd97a",
    top: "#fff3c4",
    other: "#b7a6ff",
  },
];
function Charge({
  label,
  disabled,
  sequence,
  attempt,
  send,
  onPreview,
  onHold,
}: {
  label: string;
  disabled: boolean;
  sequence: number;
  attempt: number;
  send: (c: string, p: any) => Promise<boolean>;
  onPreview: (ms: number) => void;
  onHold: (held: boolean) => void;
}) {
  const held = useRef(false),
    at = useRef(0),
    n = useRef(0),
    press = useRef<Promise<boolean>>(),
    [active, setActive] = useState(false);
  const up = () => {
    if (!held.current) return;
    held.current = false;
    setActive(false);
    onHold(false);
    if (disabled) return;
    const sequence = n.current;
    const heldMs = performance.now() - at.current;
    onPreview(heldMs);
    sfx.lever();
    void Promise.resolve(press.current).then(
      (ok) => ok && send("release", { n: sequence, heldMs }),
    );
  };
  useEffect(() => {
    held.current = false;
    setActive(false);
    onHold(false);
  }, [disabled, attempt]);
  useEffect(
    () => () => {
      held.current = false;
    },
    [],
  );
  return (
    <button
      class={"charge-button jump-pad" + (active ? " is-held" : "")}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        if (held.current) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        held.current = true;
        at.current = performance.now();
        n.current = Math.max(n.current + 1, sequence + 1);
        setActive(true);
        onHold(true);
        press.current = send("press", { n: n.current });
      }}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
    >
      {active ? "蓄力中…" : label}
    </button>
  );
}
type Flight = { distance: number; at: number; platforms: any[] };
function Platform({
  level,
  x,
  y,
  width,
  heart,
  index,
}: {
  level: number;
  x: number;
  y: number;
  width: number;
  heart: boolean;
  index: number;
}) {
  const s = scenes[level],
    fill = index ? s.other : s.pad,
    left = x - width / 2;
  if (level === 0)
    return (
      <g>
        <rect
          x={x - 9}
          y={y + 8}
          width="18"
          height="40"
          fill="#f1e1c4"
          stroke="#3a2618"
          stroke-width="2"
        />
        <path
          d={`M${left},${y + 10} Q${x},${y - 18} ${left + width},${y + 10} Z`}
          fill={index ? "#ff7a9a" : "#e8505b"}
          stroke="#3a2618"
          stroke-width="2.5"
        />
        <circle cx={x - width / 5} cy={y} r="4" fill="#fff" />
        <circle cx={x + width / 6} cy={y + 2} r="3" fill="#fff" />
      </g>
    );
  if (level === 1)
    return (
      <g>
        <rect
          x={left}
          y={y}
          width={width}
          height="26"
          rx="6"
          fill={fill}
          stroke="#5a7fa8"
          stroke-width="2.5"
        />
        <rect
          x={left + 6}
          y={y + 4}
          width={width - 12}
          height="5"
          rx="2"
          fill="#fff"
          opacity=".8"
        />
        <path
          d={`M${left + 8},${y + 26} l4,8 l4,-8 M${left + width - 18},${y + 26} l3,6 l3,-6`}
          fill="#e9f6ff"
        />
      </g>
    );
  if (level === 2)
    return (
      <g>
        {[-0.3, 0, 0.3].map((k, i) => (
          <circle
            cx={x + k * width}
            cy={y + 8 - (i === 1 ? 6 : 0)}
            r={width / (i === 1 ? 3.4 : 4.4)}
            fill={fill}
            stroke="#b9a6e8"
            stroke-width="2"
          />
        ))}
      </g>
    );
  return (
    <g class={heart ? "jump-glow" : ""}>
      <ellipse
        cx={x}
        cy={y + 10}
        rx={width / 2}
        ry="11"
        fill={heart ? "#ffd23f" : fill}
        stroke="#3a2618"
        stroke-width="2.5"
      />
      <ellipse
        cx={x}
        cy={y + 6}
        rx={width / 2 - 6}
        ry="5"
        fill="#fff"
        opacity=".5"
      />
      {heart && (
        <text x={x} y={y - 6} text-anchor="middle" font-size="18">
          💖
        </text>
      )}
    </g>
  );
}
function Scenery({ level, time }: { level: number; time: number }) {
  const s = scenes[level];
  return (
    <g aria-hidden="true">
      <defs>
        <linearGradient id={"jump-sky-" + level} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color={s.sky[0]} />
          <stop offset="1" stop-color={s.sky[1]} />
        </linearGradient>
      </defs>
      <rect width="500" height="320" fill={`url(#jump-sky-${level})`} />
      {level === 0 && (
        <>
          <circle cx="430" cy="52" r="26" fill="#ffe680" />
          <path
            d="M0 210 Q90 150 180 200 T360 190 T500 200 V320 H0Z"
            fill="#a6e07a"
          />
          <path d="M0 240 Q120 200 240 235 T500 230 V320 H0Z" fill="#79cc50" />
          {[60, 150, 330, 420].map((x, i) => (
            <text x={x} y={232 + (i % 2) * 6} font-size="14">
              {i % 2 ? "🌼" : "🌷"}
            </text>
          ))}
        </>
      )}
      {level === 1 && (
        <>
          <path
            d="M0 220 L90 110 L170 200 L260 90 L360 190 L440 120 L500 170 V320 H0Z"
            fill="#8fb3d9"
          />
          <path
            d="M90 110 l-18 22 h36Z M260 90 l-22 26 h44Z M440 120 l-16 20 h32Z"
            fill="#fff"
          />
          <text x="400" y="215" font-size="26">
            🏠
          </text>
          {Array.from({ length: 24 }, (_, i) => (
            <circle
              cx={(i * 47 + time * 0.01 * ((i % 3) + 1)) % 500}
              cy={(i * 31 + time * 0.03 * ((i % 2) + 1)) % 320}
              r={i % 3 ? 1.6 : 2.4}
              fill="#fff"
              opacity=".85"
            />
          ))}
        </>
      )}
      {level === 2 && (
        <>
          <path
            d="M40 260 A200 200 0 0 1 460 260"
            fill="none"
            stroke="#ff9aa8"
            stroke-width="8"
            opacity=".5"
          />
          <path
            d="M52 260 A188 188 0 0 1 448 260"
            fill="none"
            stroke="#ffd36e"
            stroke-width="8"
            opacity=".5"
          />
          <path
            d="M64 260 A176 176 0 0 1 436 260"
            fill="none"
            stroke="#8ce99a"
            stroke-width="8"
            opacity=".5"
          />
          <path
            d="M76 260 A164 164 0 0 1 424 260"
            fill="none"
            stroke="#74c0fc"
            stroke-width="8"
            opacity=".5"
          />
          <text x="370" y="120" font-size="40">
            🏰
          </text>
          {[0, 1, 2].map((i) => (
            <ellipse
              cx={((i * 190 + time * 0.012) % 620) - 60}
              cy={60 + i * 40}
              rx="46"
              ry="16"
              fill="#fff"
              opacity=".8"
            />
          ))}
        </>
      )}
      {level === 3 && (
        <>
          <path
            d="M-20 260 Q200 40 520 80"
            fill="none"
            stroke="rgba(200,180,255,.25)"
            stroke-width="60"
          />
          {Array.from({ length: 40 }, (_, i) => (
            <circle
              cx={(i * 73) % 500}
              cy={(i * 41) % 260}
              r={i % 5 ? 1.2 : 2.2}
              fill={i % 7 ? "#fff" : "#ffe58a"}
              opacity={0.4 + 0.6 * Math.abs(Math.sin(time / 600 + i))}
            />
          ))}
          <text x="410" y="60" font-size="20">
            🐦‍⬛
          </text>
          <text x="440" y="80" font-size="16">
            🐦‍⬛
          </text>
        </>
      )}
      <rect y="262" width="500" height="58" fill={s.below} opacity=".9" />
      <path
        d={`M0 266 ${Array.from({ length: 26 }, (_, i) => `Q${i * 20 + 10} ${262 + Math.sin(time / 400 + i) * 4} ${(i + 1) * 20} 266`).join(" ")}`}
        fill="none"
        stroke="#fff"
        stroke-width="2"
        opacity=".6"
      />
    </g>
  );
}
export default function Jump(p: GameProps) {
  const d = p.view.data,
    send = useGame(p),
    [flights, setFlights] = useState<(Flight | null)[]>([null, null]),
    [frame, setFrame] = useState(performance.now()),
    [holding, setHolding] = useState([false, false]),
    holdStart = useRef([0, 0]),
    clock = useRef(p.transport.now()),
    lastAttempt = useRef(d.attempt);
  if (!p.disabled) clock.current = p.transport.now();
  useEffect(() => {
    let id: number;
    const draw = () => {
      setFrame(performance.now());
      id = requestAnimationFrame(draw);
    };
    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (p.disabled) setFlights([null, null]);
  }, [p.disabled]);
  useEffect(() => {
    if (d.attempt === lastAttempt.current) return;
    lastAttempt.current = d.attempt;
    const last = d.last;
    if (!last) return;
    setTimeout(
      () =>
        last.perfect
          ? sfx.jackpot()
          : last.center
            ? sfx.heart()
            : last.landed
              ? sfx.coin()
              : sfx.fall(),
      last.landings ? 600 : 0,
    );
  }, [d.attempt]);
  useEffect(() => {
    const last = d.last;
    if (!last?.landings || last.attempt !== d.attempt - 1 || p.disabled) return;
    const elapsed = Math.max(0, p.transport.now() - last.at);
    if (elapsed >= 650) return;
    setFlights((old) => {
      const next = [...old];
      (last.seats || [p.seat]).forEach((seat: number, i: number) => {
        const prior = old[seat],
          fresh = prior && performance.now() - prior.at < 550;
        next[seat] = {
          distance: last.landings[i].distance,
          at: fresh ? prior.at : performance.now() - elapsed,
          platforms: last.platforms || d.platforms,
        };
      });
      return next;
    });
  }, [d.attempt]);
  const active = (f: Flight | null) => (f && frame - f.at < 650 ? f : null),
    flight = flights.map(active).find(Boolean),
    platforms = flight
      ? flight.platforms
      : d.platforms.map((t: any) => ({
          ...t,
          x:
            t.baseX +
            Math.sin((clock.current - d.startAt) / 1300 + t.phase) *
              t.amplitude,
        })),
    animals = [0, 1].map((seat) => {
      const f = d.mode === "sync" ? active(flights[seat]) : flight,
        k = f ? Math.max(0, Math.min(1, (frame - f.at) / 650)) : 0,
        target = platforms[d.mode === "sync" ? seat : 0],
        offset = (seat ? 16 : -16) * (d.mode === "sync" ? 1 - k : 1);
      return {
        x: 70 + offset + (f ? f.distance * k : 0),
        y:
          225 +
          ((target?.y || 225) - 225) * k -
          Math.sin(k * Math.PI) * (seat ? 90 : 100),
        flying: !!f,
      };
    });
  const level = d.level as number,
    scene = scenes[level],
    total = d.total ?? Math.max(10, d.step + 3),
    intro = clock.current - d.startAt < 1800 && d.step === 0 && !d.last,
    result =
      d.last &&
      clock.current - d.last.at < 1500 &&
      d.last.attempt === d.attempt - 1
        ? d.last
        : null,
    relaySeat = d.step % 2;
  return (
    <section
      class={"couple-new-stage jump-stage jump-level-" + level}
      data-testid="jump-stage"
    >
      <header class="jump-top">
        <div class="jump-title">
          <b>
            {d.levelName} · {scene.title}
          </b>
          <small>
            {d.mode === "sync" ? "同步蓄力" : "轮流接力"} · {d.points} 分
            {d.combo >= 2 ? ` · 🔥 连续正中 ×${d.combo}` : ""}
          </small>
        </div>
        <span class="jump-lives" aria-label={"剩余生命 " + d.lives}>
          {"❤️".repeat(d.lives)}
          {"🤍".repeat(Math.max(0, 3 - d.lives))}
        </span>
      </header>
      <div class="jump-track" aria-label={`第 ${d.step}/${d.total ?? "∞"} 跳`}>
        {Array.from({ length: total }, (_, i) => (
          <i class={i < d.step ? "done" : i === d.step ? "now" : ""} />
        ))}
        <b>
          {d.levelName} {d.step}/{d.total ?? "∞"}
        </b>
      </div>
      <div class="jump-view">
        <svg viewBox="0 0 500 320" role="img" aria-label="根据平台距离蓄力跳跃">
          <Scenery level={level} time={frame} />
          <g>
            <rect
              x="35"
              y="225"
              width="70"
              height="40"
              rx="12"
              fill={scene.pad}
              stroke="#3a2618"
              stroke-width="2.5"
            />
            <rect
              x="35"
              y="225"
              width="70"
              height="9"
              rx="4"
              fill={scene.top}
            />
          </g>
          {platforms
            .slice(0, d.mode === "sync" ? 2 : 1)
            .map((t: any, i: number) => (
              <g>
                <rect
                  data-testid={"jump-platform-" + i}
                  data-distance={t.x}
                  x={70 + t.x - t.width / 2}
                  y={t.y}
                  width={t.width}
                  height="1"
                  fill="none"
                />
                <Platform
                  level={level}
                  x={70 + t.x}
                  y={t.y}
                  width={t.width}
                  heart={t.heart}
                  index={i}
                />
                <circle
                  cx={70 + t.x}
                  cy={t.y + 2}
                  r="3.5"
                  fill="#fff"
                  stroke="#3a2618"
                />
                {d.mode === "sync" && (
                  <text
                    x={70 + t.x}
                    y={t.y + 46}
                    text-anchor="middle"
                    class="jump-tag"
                  >
                    {nickname(p, i)}
                  </text>
                )}
              </g>
            ))}
          <path
            d={`M${animals[0].x},${animals[0].y - 18} Q${(animals[0].x + animals[1].x) / 2},${Math.max(animals[0].y, animals[1].y) + 6} ${animals[1].x},${animals[1].y - 18}`}
            fill="none"
            stroke="#ed6684"
            stroke-width="3"
            stroke-linecap="round"
          />
          {animals.map((a, seat) => {
            const prof = p.room.profiles[seat as 0 | 1],
              charging = holding[seat] && !a.flying,
              squash = charging
                ? Math.min(
                    0.28,
                    (performance.now() - holdStart.current[seat]) / 6000,
                  )
                : 0;
            return (
              <g
                data-testid={"jump-animal-" + seat}
                transform={`translate(${a.x} ${a.y})`}
              >
                <ellipse cx="0" cy="2" rx="14" ry="4" fill="rgba(0,0,0,.2)" />
                <g transform={`scale(${1 + squash * 0.5} ${1 - squash})`}>
                  <svg
                    x="-22"
                    y="-42"
                    width="44"
                    height="44"
                    viewBox="-4 -8 108 108"
                    dangerouslySetInnerHTML={{
                      __html: critterSVG(
                        kindOf(prof?.avatar),
                        prof?.color || (seat ? "#4D9DFF" : "#FF6B6B"),
                        a.flying ? "wow" : charging ? "normal" : "joy",
                        a.flying ? "up" : "stand",
                        false,
                      ),
                    }}
                  />
                </g>
              </g>
            );
          })}
          {result && (
            <g class="jump-result">
              <text x="250" y="70" text-anchor="middle">
                {result.perfect
                  ? "💖 心有灵犀！"
                  : result.center
                    ? "✨ 正中靶心！"
                    : result.landed
                      ? "稳稳落地"
                      : "扑通！掉进" + scene.belowName}
              </text>
            </g>
          )}
          {d.iceDeadline && !flight && (
            <g>
              <rect
                x="35"
                y="268"
                width="70"
                height="6"
                rx="3"
                fill="rgba(255,255,255,.5)"
              />
              <rect
                x="35"
                y="268"
                width={
                  70 *
                  Math.max(
                    0,
                    Math.min(1, (d.iceDeadline - clock.current) / 2000),
                  )
                }
                height="6"
                rx="3"
                fill="#4dabf7"
              />
            </g>
          )}
        </svg>
        {intro && (
          <div class="jump-intro">
            <small>第 {level + 1} 段旅程</small>
            <b>
              {d.levelName} · {scene.title}
            </b>
            <span>{scene.tip}</span>
          </div>
        )}
      </div>
      <p class="jump-hint">
        {d.mode === "sync"
          ? "各自瞄准对应平台，听口令一起松手"
          : "轮到玩家 " + (relaySeat + 1) + "，看距离蓄力"}
      </p>
      {d.iceDeadline && <p class="jump-ice">❄️ 冰面即将融化，快跳！</p>}
      <p aria-live="polite" class="jump-feedback">
        {d.last
          ? d.last.perfect
            ? "💖 心有灵犀！"
            : d.last.landed
              ? "稳稳落地"
              : "再试一次，我们还有机会"
          : "不看秒表，靠眼睛和默契"}
      </p>
      <div class="jump-pads">
        {[p.seat, ...(p.local ? [p.local.seat] : [])].map((s) => (
          <Charge
            key={s}
            sequence={d.inputN?.[s] ?? -1}
            attempt={d.attempt}
            label={
              p.local
                ? s
                  ? "🟥 玩家二：按住蓄力"
                  : "🟦 玩家一：按住蓄力"
                : "按住蓄力 · 松开起跳"
            }
            disabled={
              p.disabled ||
              (d.last?.landings &&
                d.last.attempt === d.attempt - 1 &&
                clock.current < d.last.at + 650) ||
              (d.mode === "sync" ? !!active(flights[s]) : !!flight) ||
              (d.mode === "relay" && s !== d.step % 2) ||
              d.released[s]
            }
            onHold={(on) => {
              if (on) holdStart.current[s] = performance.now();
              setHolding((old) => {
                const next = [...old];
                next[s] = on;
                return next;
              });
            }}
            send={(c, payload) =>
              s === p.seat
                ? send(c, payload)
                : p.local!.send({
                    type: "game",
                    run: p.view.run,
                    command: c,
                    payload,
                  })
            }
            onPreview={(ms) =>
              setFlights((old) => {
                const next = [...old];
                next[s] = {
                  distance: Math.min(ms, 2200) * 0.25,
                  at: performance.now(),
                  platforms,
                };
                return next;
              })
            }
          />
        ))}
      </div>
    </section>
  );
}
