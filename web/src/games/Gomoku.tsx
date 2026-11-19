import { useEffect, useState } from "preact/hooks";
import { useGame, nickname, type GameProps } from "./common";
import { forbiddenMove } from "../../../shared/games/gomoku/rules";
import { Critter } from "../art/ui";
export default function Gomoku(p: GameProps) {
  const d = p.view.data,
    send = useGame(p),
    [preview, setPreview] = useState<number | null>(null),
    [pending, setPending] = useState<number | null>(null),
    [resign, setResign] = useState(false),
    [warning, setWarning] = useState("");
  useEffect(() => {
    setPreview(null);
    setPending(null);
    setWarning("");
  }, [d.move, d.turn, d.revision, p.view.run]);
  const touch =
    matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  const stoneColor = (seat: number) =>
    seat === d.blackSeat ? "black" : "white";
  const stoneName = (seat: number) => (seat === d.blackSeat ? "黑棋" : "白棋");
  async function place(i: number, confirmed = false) {
    if (
      d.turn !== p.seat ||
      p.disabled ||
      d.board[i] !== -1 ||
      d.pending ||
      pending !== null
    )
      return;
    if (d.forbidden && p.seat === d.blackSeat) {
      const reason = forbiddenMove(d.board, i, p.seat);
      if (reason) {
        setPreview(null);
        setWarning(
          reason === "double-three"
            ? "这里会形成三三禁手，请换一个位置。"
            : "这里会形成四四禁手，请换一个位置。",
        );
        return;
      }
    }
    setWarning("");
    if (touch && preview !== i && !confirmed) {
      setPreview(i);
      return;
    }
    setPending(i);
    try {
      await send("place", {
        move: d.move,
        revision: d.revision,
        x: i % 15,
        y: Math.floor(i / 15),
      });
    } finally {
      setPending(null);
    }
  }
  return (
    <section class="extra-stage gomoku-stage" data-testid="gomoku-stage">
      <div class="gomoku-players">
        {[0, 1].map((seat) => {
          const prof = p.room.profiles[seat as 0 | 1];
          return (
            <div class={"gomoku-player" + (d.turn === seat ? " turn" : "")}>
              <Critter
                avatar={prof?.avatar}
                color={prof?.color || "#FF6B6B"}
                mood={d.turn === seat ? "joy" : "normal"}
                size={52}
                class={d.turn === seat ? "hop" : ""}
              />
              <span class="gomoku-side">
                <span
                  class={"gomoku-stone " + stoneColor(seat)}
                  aria-hidden="true"
                />
                {stoneName(seat)}
              </span>
              <b>{seat === p.seat ? "你" : nickname(p, seat)}</b>
            </div>
          );
        })}
      </div>
      <div class="stage-score">
        <span>
          {d.turn === p.seat
            ? "轮到你落子"
            : "等 " + nickname(p, d.turn) + " 落子"}
        </span>
        <b>第 {d.move + 1} 手</b>
      </div>
      {d.forbidden && (
        <p class="muted">
          {nickname(p, d.blackSeat)}执黑 · 三三 / 四四禁手（连五优先）
        </p>
      )}
      {warning && <p role="status">{warning}</p>}
      {d.deadline > 0 && (
        <p class="muted">
          本步剩余 {Math.max(0, Math.ceil((d.deadline - p.now) / 1000))} 秒
        </p>
      )}
      <div class="gomoku-board" role="grid" aria-label="十五乘十五棋盘">
        {d.board.map((stone: number, i: number) => (
          <button
            role="gridcell"
            data-cell={i}
            aria-label={`${(i % 15) + 1}列${Math.floor(i / 15) + 1}行${stone >= 0 ? " " + stoneName(stone) : ""}`}
            disabled={
              p.disabled || d.turn !== p.seat || stone !== -1 || !!d.pending
            }
            onClick={() => void place(i)}
            class={
              (d.line.includes(i) ? "winning " : "") +
              (preview === i || pending === i ? "preview" : "")
            }
          >
            {(stone >= 0 || preview === i || pending === i) && (
              <span
                class={
                  "gomoku-stone " + stoneColor(stone >= 0 ? stone : p.seat)
                }
                aria-hidden="true"
              />
            )}
            {d.last &&
              d.last.x === i % 15 &&
              d.last.y === Math.floor(i / 15) && <i />}
          </button>
        ))}
      </div>
      <p class="muted">
        {touch ? "点交叉点预览，再点同一点或按确认落子。" : "点击交叉点落子。"}{" "}
        {d.wager && "小约定：" + d.wager}
      </p>
      {touch && preview !== null && (
        <div class="game-actions">
          <button
            class="primary"
            disabled={
              p.disabled || d.turn !== p.seat || !!d.pending || pending !== null
            }
            onClick={() => void place(preview, true)}
          >
            确认落子
          </button>
          <button class="secondary" onClick={() => setPreview(null)}>
            取消预览
          </button>
        </div>
      )}
      {d.pending ? (
        <div class="agreement">
          <p>
            {d.pending.by === p.seat ? "你" : nickname(p, d.pending.by)}想
            {d.pending.kind === "undo" ? "悔一步" : "和棋"}。
          </p>
          {d.pending.by === p.seat ? (
            <button class="secondary" onClick={() => void send("cancel")}>
              取消请求
            </button>
          ) : (
            <>
              <button class="primary" onClick={() => void send("accept")}>
                让 TA ❤
              </button>
              <button class="secondary" onClick={() => void send("decline")}>
                不行
              </button>
            </>
          )}
        </div>
      ) : (
        <div class="game-actions">
          <button
            class="secondary"
            disabled={p.disabled || d.last?.seat !== p.seat}
            onClick={() => void send("undo")}
          >
            悔一步
          </button>
          <button
            class="secondary"
            disabled={p.disabled}
            onClick={() => void send("draw")}
          >
            求和
          </button>
          <button
            class="text-button"
            disabled={p.disabled}
            onClick={() => setResign(true)}
          >
            认输
          </button>
        </div>
      )}
      {resign && (
        <div class="agreement">
          <p>这局让 TA 赢，确定认输吗？</p>
          <button
            class="primary"
            onClick={() => {
              setResign(false);
              void send("resign");
            }}
          >
            确认认输
          </button>
          <button class="secondary" onClick={() => setResign(false)}>
            继续下
          </button>
        </div>
      )}
    </section>
  );
}
