import { useState, useEffect, useRef } from "preact/hooks";
import { useGame, nickname, type GameProps } from "./common";
import { Critter } from "../art/ui";
import { critterSVG, kindOf } from "../art/critter";
import { sfx } from "./sfx";
import "./ludo.css";
import {
  ludoBoard,
  cellIcons,
  cellInfo,
  pathPoint,
  zoneScenes,
  LUDO_W,
  LUDO_H,
} from "../../../shared/games/couple-ludo/board";
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};
function Die({ n, rolling }: { n: number; rolling?: boolean }) {
  return (
    <span class={"ludo-die" + (rolling ? " rolling" : "")} aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <i class={PIPS[n]?.includes(i) ? "on" : ""} />
      ))}
    </span>
  );
}
/** A smooth road through every tile, with rounded U-turns between zones. */
function roadPath() {
  let d = "";
  for (let i = 0; i < 36; i++) {
    const p = pathPoint(i);
    if (!i) d = `M${p.x},${p.y}`;
    else {
      const q = pathPoint(i - 1);
      if (q.y !== p.y) {
        const side = p.x > 180 ? 1 : -1,
          cx = q.x + side * 34;
        d += ` C${cx},${q.y} ${p.x + side * 34},${p.y} ${p.x},${p.y}`;
      } else d += ` L${p.x},${p.y}`;
    }
  }
  return d;
}
const ROAD = roadPath();
export default function Ludo(p: GameProps) {
  const d = p.view.data,
    send = useGame(p),
    [draft, setDraft] = useState(""),
    [wordSeat, setWordSeat] = useState(0),
    [rolling, setRolling] = useState(false),
    [chapter, setChapter] = useState(""),
    lastZone = useRef<number[]>(
      d.positions.map((x: number) => ludoBoard[x].zone),
    );
  useEffect(() => {
    setWordSeat(0);
    setDraft("");
  }, [d.task?.id]);
  useEffect(() => {
    if (!d.dice.length) return;
    setRolling(true);
    sfx.lever();
    const t = setTimeout(() => setRolling(false), 650);
    return () => clearTimeout(t);
  }, [d.moves]);
  useEffect(() => {
    d.positions.forEach((x: number, seat: number) => {
      const zone = ludoBoard[x].zone;
      if (zone > lastZone.current[seat]) {
        setChapter(
          `${nickname(p, seat)} 进入「${zoneScenes[zone].name} · ${zoneScenes[zone].sub}」`,
        );
        sfx.heart();
        setTimeout(() => setChapter(""), 2200);
      }
      lastZone.current[seat] = zone;
    });
  }, [d.positions[0], d.positions[1]]);
  const actor = p.local ? d.turn : p.seat,
    can = p.seat === d.turn || !!p.local;
  const act = (cmd: string, payload: any = {}, seat = actor) =>
    seat === p.seat
      ? send(cmd, payload)
      : p.local!.send({ type: "game", run: p.view.run, command: cmd, payload });
  const land = (die: number) =>
    Math.min(35, d.positions[d.turn] + die + d.bank[d.turn]);
  const preview = d.phase === "choose" && can ? d.dice.map(land) : [];
  const zoneTop = (z: number) => pathPoint(z * 7).y - 42;
  const who = (seat: number) =>
    seat === p.seat && !p.local ? "你" : nickname(p, seat);
  const taskKind =
    d.phase === "truth"
      ? "truth"
      : d.phase === "challenge"
        ? "challenge"
        : d.phase === "memory"
          ? "memory"
          : d.phase === "rate"
            ? "rate"
            : d.phase === "fork"
              ? "fork"
              : "";
  return (
    <section
      class="couple-new-stage ludo-stage"
      data-testid="ludo-stage"
      data-phase={d.phase}
      data-turn={d.turn}
      data-task={d.task?.kind || ""}
      data-state={JSON.stringify([
        d.phase,
        d.turn,
        d.positions,
        d.dice,
        d.checks,
        d.submitted,
      ])}
    >
      <header class="ludo-players">
        {[0, 1].map((seat) => {
          const profile = p.room.profiles[seat as 0 | 1],
            zone = ludoBoard[d.positions[seat]].zone;
          return (
            <div class={"ludo-player" + (d.turn === seat ? " active" : "")}>
              <Critter
                avatar={profile?.avatar}
                color={profile?.color || (seat ? "#4D9DFF" : "#FF6B6B")}
                mood={d.turn === seat ? "joy" : "normal"}
                shadow={false}
                size={42}
              />
              <div>
                <b>{nickname(p, seat)}</b>
                <small>
                  {zoneScenes[zone].name} · {d.positions[seat]}/35
                </small>
                {d.bank[seat] > 0 && (
                  <small class="gift">🎁 TA 送的 +{d.bank[seat]} 步</small>
                )}
              </div>
              {d.turn === seat && <em>轮到{who(seat)}</em>}
            </div>
          );
        })}
      </header>
      <div class="ludo-meta">
        <span>{d.victory === "versus" ? "⚔️ 较量模式" : "🤝 合作模式"}</span>
        <span>第 {d.moves} 回合</span>
        <span>💌 回忆 {d.memories.length}</span>
      </div>
      <div class="ludo-board-wrap">
        <svg
          class="ludo-board"
          viewBox={`0 0 ${LUDO_W} ${LUDO_H}`}
          aria-label="五个区域的三十六格心动路线"
        >
          <defs>
            {zoneScenes.map((z, i) => (
              <linearGradient id={"zone-sky-" + i} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color={z.sky[1]} />
                <stop offset="1" stop-color={z.sky[0]} />
              </linearGradient>
            ))}
          </defs>
          <rect width={LUDO_W} height="76" fill="#1d1640" />
          {Array.from({ length: 14 }, (_, i) => (
            <circle
              cx={(i * 53) % LUDO_W}
              cy={8 + ((i * 29) % 60)}
              r={i % 3 ? 1 : 1.8}
              fill="#fff"
              opacity=".8"
            />
          ))}
          {zoneScenes.map((z, i) => (
            <g class={"ludo-zone zone-" + i}>
              <rect
                y={zoneTop(i)}
                width={LUDO_W}
                height="84"
                fill={`url(#zone-sky-${i})`}
              />
              {/* Labels sit in the top corner the road never turns through;
                  scenery sits in the free bottom corner. */}
              <text
                x={i % 2 ? LUDO_W - 12 : 12}
                y={zoneTop(i) + 16}
                text-anchor={i % 2 ? "end" : "start"}
                class="zone-label"
              >
                {z.name} · {z.sub}
              </text>
              {z.deco.map((icon, k) => (
                <text
                  x={i % 2 ? 22 + k * 22 : LUDO_W - 22 - k * 22}
                  y={zoneTop(i) + 80}
                  font-size="15"
                  text-anchor="middle"
                  opacity=".85"
                >
                  {icon}
                </text>
              ))}
            </g>
          ))}
          <path d={ROAD} class="ludo-road-edge" />
          <path d={ROAD} class="ludo-road" />
          <path
            d={`M${pathPoint(34).x},${pathPoint(34).y} C${pathPoint(34).x + 30},${pathPoint(34).y - 30} 240,34 180,34`}
            class="ludo-road"
          />
          <text x="180" y="22" text-anchor="middle" font-size="18">
            ⛪
          </text>
          {ludoBoard.map((c, i) => {
            const at = pathPoint(i),
              finish = c.kind === "finish",
              target = preview.includes(i);
            return (
              <g
                class={"ludo-tile" + (target ? " target" : "")}
                transform={`translate(${at.x} ${at.y})`}
              >
                {finish ? (
                  <circle
                    r="20"
                    fill={cellInfo.finish.color}
                    class="tile-shape"
                  />
                ) : (
                  <rect
                    x="-16"
                    y="-16"
                    width="32"
                    height="32"
                    rx="9"
                    fill={cellInfo[c.kind].color}
                    class="tile-shape"
                  />
                )}
                <text y="6" text-anchor="middle" font-size={finish ? 20 : 15}>
                  {cellIcons[c.kind]}
                </text>
                {!finish && (
                  <text y="-19" x="13" class="tile-no">
                    {i}
                  </text>
                )}
              </g>
            );
          })}
          {[0, 1].map((seat) => {
            const at = pathPoint(d.positions[seat]),
              profile = p.room.profiles[seat as 0 | 1],
              same = d.positions[0] === d.positions[1],
              dx = same ? (seat ? 10 : -10) : 0;
            return (
              <g
                class={"ludo-token" + (d.turn === seat ? " active" : "")}
                style={{
                  transform: `translate(${at.x + dx - 22}px, ${at.y - 44}px)`,
                }}
              >
                <ellipse
                  cx="22"
                  cy="42"
                  rx="13"
                  ry="4"
                  fill="rgba(0,0,0,.25)"
                />
                <svg
                  width="44"
                  height="44"
                  viewBox="-4 -8 108 108"
                  dangerouslySetInnerHTML={{
                    __html: critterSVG(
                      kindOf(profile?.avatar),
                      profile?.color || (seat ? "#4D9DFF" : "#FF6B6B"),
                      d.turn === seat ? "joy" : "normal",
                      "stand",
                      false,
                    ),
                  }}
                />
              </g>
            );
          })}
        </svg>
        {chapter && <div class="ludo-chapter">{chapter}</div>}
      </div>
      {d.event && (
        <p class="ludo-event" aria-live="polite">
          {d.event}
        </p>
      )}
      <div class="ludo-console">
        {d.phase === "roll" && (
          <div class="ludo-roll">
            <p>
              {can
                ? (p.local ? nickname(p, d.turn) + "，" : "") +
                  "摇一摇，投两颗骰子，只用其中一颗"
                : `等 ${nickname(p, d.turn)} 投骰子…`}
            </p>
            <button
              class="primary ludo-roll-button"
              disabled={!can || p.disabled}
              onClick={() => void act("roll")}
            >
              🎲 投掷两颗骰子
            </button>
          </div>
        )}
        {d.phase === "choose" && (
          <div class="ludo-choose">
            <p>
              {can
                ? "选一颗骰子走，或者把两颗都送给 TA"
                : `${nickname(p, d.turn)} 正在挑骰子…`}
            </p>
            <div class="ludo-dice-row">
              {d.dice.map((n: number, index: number) => {
                const to = land(n),
                  cell = ludoBoard[to];
                return (
                  <button
                    class="ludo-die-card"
                    aria-label={`选 ${n} 点`}
                    disabled={!can || p.disabled}
                    onClick={() => void act("choose", { index })}
                  >
                    <Die n={n} rolling={rolling} />
                    <span>选 {n} 点</span>
                    <small>
                      → 第 {to} 格 {cellIcons[cell.kind]}{" "}
                      {cellInfo[cell.kind].name}
                    </small>
                  </button>
                );
              })}
              <button
                class="ludo-die-card gift"
                aria-label="让一步 · 两颗都给 TA"
                disabled={!can || p.disabled}
                onClick={() => void act("gift")}
              >
                <span class="gift-icon">🎁</span>
                <span>让一步</span>
                <small>两颗都给 TA，+{d.dice[0] + d.dice[1]} 步</small>
              </button>
            </div>
          </div>
        )}
        {taskKind && (
          <div class={"ludo-card card-" + taskKind}>
            <div class="card-tag">
              {
                {
                  truth: "💬 真心话 · " + who(d.turn) + " 来回答",
                  challenge:
                    d.task?.kind === "word"
                      ? "🎯 默契挑战 · 两人同时写"
                      : "🎯 小挑战 · 一起完成",
                  memory: "🎁 回忆格 · 写下一段共同回忆",
                  rate: "💗 打分时间 · TA 的回答",
                  fork: "🌀 岔路口 · 选一条路",
                }[taskKind]
              }
            </div>
            {d.task && <p class="card-text">{d.task.text}</p>}
            {d.phase === "memory" && (
              <p class="card-text">
                在「{zoneScenes[ludoBoard[d.positions[d.turn]].zone].name}
                」这一站，你们有什么难忘的事？
              </p>
            )}
            {(((d.phase === "truth" || d.phase === "memory") && can) ||
              (d.phase === "challenge" &&
                d.task?.kind === "word" &&
                !d.submitted[p.local ? wordSeat : p.seat])) && (
              <div class="card-input">
                <label>
                  写一句
                  <input
                    aria-label="写一句"
                    maxLength={d.phase === "challenge" ? 20 : 120}
                    value={draft}
                    placeholder={
                      d.phase === "challenge"
                        ? "一个词，别让 TA 看到"
                        : "认真写哦"
                    }
                    onInput={(e) => setDraft(e.currentTarget.value)}
                  />
                </label>
                <button
                  class="primary"
                  disabled={p.disabled || !draft.trim()}
                  onClick={() => {
                    void act(
                      d.phase === "truth"
                        ? "answer"
                        : d.phase === "memory"
                          ? "memory"
                          : "word",
                      { text: draft },
                      d.phase === "challenge" && p.local ? wordSeat : actor,
                    );
                    setDraft("");
                  }}
                >
                  提交
                </button>
              </div>
            )}
            {(d.phase === "truth" || d.phase === "memory") && !can && (
              <p class="muted">{nickname(p, d.turn)} 正在写…</p>
            )}
            {d.phase === "rate" && (
              <>
                <blockquote>{d.answer}</blockquote>
                {!can || p.local ? (
                  <div class="rate-row">
                    {[1, 2, 3].map((hearts) => (
                      <button
                        disabled={p.disabled}
                        aria-label={"❤️".repeat(hearts)}
                        onClick={() => {
                          sfx.heart();
                          void act("rate", { hearts }, 1 - d.turn);
                        }}
                      >
                        {"❤️".repeat(hearts)}
                        <small>前进 {hearts} 格</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p class="muted">等 TA 给你的回答打分…</p>
                )}
              </>
            )}
            {d.phase === "challenge" && d.task?.kind !== "word" && (
              <div class="game-actions">
                {(p.local ? [0, 1] : [p.seat]).map((seat) => (
                  <button
                    class={d.checks[seat] ? "done" : "primary"}
                    aria-label={`玩家 ${seat + 1}：一起完成了`}
                    disabled={d.checks[seat] || p.disabled}
                    onClick={() => void act("confirm", {}, seat)}
                  >
                    {d.checks[seat] ? "✓ " : ""}
                    {nickname(p, seat)}：一起完成了
                  </button>
                ))}
                <small class="muted">两人都确认后，一起前进 2 格</small>
              </div>
            )}
            {d.phase === "challenge" &&
              d.task?.kind === "word" &&
              p.local &&
              d.submitted[0] &&
              !d.submitted[1] &&
              wordSeat === 0 && (
                <button
                  onClick={() => {
                    setWordSeat(1);
                    setDraft("");
                  }}
                >
                  请交给玩家二，别偷看
                </button>
              )}
            {d.phase === "challenge" &&
              d.task?.kind === "word" &&
              d.submitted.some(Boolean) && (
                <p class="muted">
                  已写好：{d.submitted.filter(Boolean).length}/2 ·
                  写出同一个词一起前进 2 格
                </p>
              )}
            {d.phase === "fork" && (
              <div class="fork-row">
                <button
                  class="fork-sign short"
                  aria-label="近路 · 两颗新骰子总和 ≥8"
                  disabled={!can || p.disabled}
                  onClick={() => void act("route", { route: "short" })}
                >
                  <b>⚡ 近路</b>
                  <small>再投两颗，总和 ≥8 前进 4 格，否则后退 2 格</small>
                </button>
                <button
                  class="fork-sign long"
                  aria-label="远路 · 稳走一步"
                  disabled={!can || p.disabled}
                  onClick={() => void act("route", { route: "long" })}
                >
                  <b>🌿 远路</b>
                  <small>慢慢走，稳稳前进 1 格</small>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {d.lastWords && (
        <p class="ludo-event">默契词揭晓：{d.lastWords.join(" / ")}</p>
      )}
      <ul class="ludo-legend" aria-label="格子说明">
        {["truth", "challenge", "memory", "fork", "redline"].map((k) => (
          <li>
            <i style={{ background: cellInfo[k].color }}>{cellIcons[k]}</i>
            {cellInfo[k].name}
          </li>
        ))}
      </ul>
      {d.memories.length > 0 && (
        <p class="muted">
          已留下 {d.memories.length} 条回忆，打开问答本可查看。
        </p>
      )}
    </section>
  );
}
