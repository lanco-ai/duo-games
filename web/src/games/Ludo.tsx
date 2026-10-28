import { useState, useEffect } from "preact/hooks";
import { useGame, type GameProps } from "./common";
import {
  ludoBoard,
  ludoZones,
  zoneColors,
  cellIcons,
  boardPoint,
} from "../../../shared/games/couple-ludo/board";
export default function Ludo(p: GameProps) {
  const d = p.view.data,
    send = useGame(p),
    [draft, setDraft] = useState(""),
    [wordSeat, setWordSeat] = useState(0);
  useEffect(() => {
    setWordSeat(0);
    setDraft("");
  }, [d.task?.id]);
  const actor = p.local ? d.turn : p.seat,
    can = p.seat === d.turn || !!p.local;
  const act = (cmd: string, payload: any = {}, seat = actor) =>
    seat === p.seat
      ? send(cmd, payload)
      : p.local!.send({ type: "game", run: p.view.run, command: cmd, payload });
  return (
    <section
      class="couple-new-stage"
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
      <header class="couple-bar">
        <b>心动棋 · {d.victory === "versus" ? "较量" : "合作"}</b>
        <b>第 {d.moves} 回合</b>
      </header>
      <svg
        viewBox="0 0 300 300"
        aria-label="五个区域的三十六格心动路线"
        style={{ width: "100%" }}
      >
        <ellipse
          cx="150"
          cy="150"
          rx="120"
          ry="120"
          fill="none"
          stroke="#dc93aa"
          stroke-width="8"
        />
        {ludoBoard.map((c, i) => {
          const pos = boardPoint(i);
          return (
            <g>
              <circle
                cx={pos.x}
                cy={pos.y}
                r="10"
                fill={zoneColors[c.zone]}
                stroke="#aa7580"
              />
              <text x={pos.x} y={pos.y + 4} font-size="10" text-anchor="middle">
                {cellIcons[c.kind]}
              </text>
            </g>
          );
        })}
        {d.positions.map((position: number, seat: number) => {
          const pos = boardPoint(position);
          return (
            <text
              x={pos.x + (seat ? 6 : -6)}
              y={pos.y - 10}
              font-size="21"
              text-anchor="middle"
            >
              {seat ? "🐻" : "🐰"}
            </text>
          );
        })}
        <text x="150" y="126" text-anchor="middle" font-size="16">
          {ludoZones[ludoBoard[d.positions[d.turn]].zone]}
        </text>
        <text x="150" y="152" text-anchor="middle" font-size="14">
          两个人，一起走到承诺
        </text>
        <text x="150" y="179" text-anchor="middle" font-size="12">
          🐰 {d.positions[0]}/35　🐻 {d.positions[1]}/35
        </text>
      </svg>
      <p>
        💞 当前：玩家 {d.turn + 1} · 给 TA 的额外步数 {d.bank[1 - d.turn]}
      </p>
      <p aria-live="polite">{d.event}</p>
      {d.phase === "roll" && (
        <button
          class="primary"
          disabled={!can || p.disabled}
          onClick={() => void act("roll")}
        >
          🎲 投掷两颗骰子
        </button>
      )}
      {d.phase === "choose" && (
        <div>
          {d.dice.map((n: number, index: number) => (
            <button
              class="primary"
              disabled={!can || p.disabled}
              onClick={() => void act("choose", { index })}
            >
              选 {n} 点
            </button>
          ))}
          <button
            disabled={!can || p.disabled}
            onClick={() => void act("gift")}
          >
            让一步 · 两颗都给 TA
          </button>
        </div>
      )}
      {d.task && (
        <div class="ludo-task">
          <p>{d.task.text}</p>
        </div>
      )}
      {(((d.phase === "truth" || d.phase === "memory") && can) ||
        (d.phase === "challenge" &&
          d.task?.kind === "word" &&
          !d.submitted[p.local ? wordSeat : p.seat])) && (
        <>
          <label>
            写一句
            <input
              aria-label="写一句"
              maxLength={d.phase === "challenge" ? 20 : 120}
              value={draft}
              onInput={(e) => setDraft(e.currentTarget.value)}
            />
          </label>
          <button
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
        </>
      )}
      {d.phase === "rate" && (
        <>
          <p>{d.answer}</p>
          {(!can || p.local) &&
            [1, 2, 3].map((hearts) => (
              <button
                disabled={p.disabled}
                onClick={() => void act("rate", { hearts }, 1 - d.turn)}
              >
                {"❤️".repeat(hearts)}
              </button>
            ))}
        </>
      )}
      {d.phase === "challenge" && d.task?.kind !== "word" && (
        <div>
          {(p.local ? [0, 1] : [p.seat]).map((seat) => (
            <button
              disabled={d.checks[seat] || p.disabled}
              onClick={() => void act("confirm", {}, seat)}
            >
              玩家 {seat + 1}：一起完成了
            </button>
          ))}
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
      {d.phase === "fork" && (
        <div>
          <button
            disabled={!can || p.disabled}
            onClick={() => void act("route", { route: "short" })}
          >
            近路 · 两颗新骰子总和 ≥8
          </button>
          <button
            disabled={!can || p.disabled}
            onClick={() => void act("route", { route: "long" })}
          >
            远路 · 稳走一步
          </button>
        </div>
      )}
      {d.lastWords && <p>默契词揭晓：{d.lastWords.join(" / ")}</p>}
      {d.memories.length > 0 && (
        <p>已留下 {d.memories.length} 条回忆，打开问答本可查看。</p>
      )}
    </section>
  );
}
