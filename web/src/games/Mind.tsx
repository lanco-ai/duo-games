import { useEffect, useState } from "preact/hooks";
import { useGame, nickname, type GameProps } from "./common";
import { Critter } from "../art/ui";
export default function Mind(p: GameProps) {
  const d = p.view.data,
    send = useGame(p),
    [word, setWord] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setWord("");
    setBusy(false);
  }, [d.round]);
  const revealed = d.answers && p.now >= d.revealAt,
    seats = [p.seat, 1 - p.seat],
    last = d.history.at(-1) as string[] | undefined,
    thought = (seat: number) =>
      revealed
        ? d.answers[seat]
        : d.revealAt > 0
          ? "♡"
          : d.submitted[seat]
            ? seat === p.seat && d.own
              ? d.own
              : "✓ 写好了"
            : last
              ? "想想…"
              : "…";
  return (
    <section class="extra-stage mind-stage" data-testid="mind-stage">
      <span class="game-eyebrow">把两个念头，慢慢变成一个</span>
      <h2 class="ribbon round-ribbon">第 {Math.min(d.round + 1, 10)} 轮</h2>
      {d.topic && d.topic !== "自由联想" && (
        <p class="muted">
          本局主题：{d.topic} · 围绕这个主题联想，再寻找共同的词
        </p>
      )}
      <div class="mind-duo">
        {seats.map((seat, i) => {
          const prof = p.room.profiles[seat as 0 | 1];
          return (
            <div class={"mind-head" + (i ? " right" : "")}>
              <span
                class={
                  "thought" +
                  (revealed ? " shown" : d.submitted[seat] ? " done" : "")
                }
              >
                {thought(seat)}
              </span>
              <Critter
                avatar={prof?.avatar}
                color={prof?.color || "#FF6B6B"}
                mood={revealed ? "wow" : d.submitted[seat] ? "joy" : "normal"}
                size={78}
                class={d.submitted[seat] ? "" : "hop" + (i ? " late" : "")}
              />
              <span class="name-tag" style={{ "--player": prof?.color }}>
                {seat === p.seat ? "你" : nickname(p, seat)}
              </span>
            </div>
          );
        })}
      </div>
      <div class="word-chain">
        {d.history.map((pair: string[], i: number) => (
          <div class="word-pair" key={i}>
            <span>{pair[0]}</span>
            <i>♡</i>
            <span>{pair[1]}</span>
          </div>
        ))}
      </div>
      {d.revealAt > 0 && (
        <div class="word-pair revealing">
          <span>{revealed ? d.answers[0] : "♡"}</span>
          <i>⋯</i>
          <span>{revealed ? d.answers[1] : "♡"}</span>
        </div>
      )}
      {d.deadline > 0 && (
        <p class="muted">
          还有 {Math.max(0, Math.ceil((d.deadline - p.now) / 1000))} 秒
        </p>
      )}
      {d.round < 10 && (
        <form
          class="mind-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await send("submit", { round: d.round, word });
            setBusy(false);
          }}
        >
          <label>
            你的联想词
            <input
              aria-label="你的联想词"
              value={word}
              onInput={(e) => setWord(e.currentTarget.value)}
              maxLength={16}
              disabled={p.disabled || busy || d.submitted[p.seat]}
              placeholder={
                d.round ? "和上面两个词都有关的词" : "写下第一个想到的词"
              }
            />
          </label>
          <p class="muted">1–8 个汉字或 16 个英文字母，不能重复之前的词。</p>
          <button
            class="primary big wide"
            disabled={p.disabled || busy || !word.trim() || d.submitted[p.seat]}
          >
            {d.submitted[p.seat]
              ? "你写好了，等 TA 一起揭晓"
              : "写好了，一起揭晓"}
          </button>
        </form>
      )}
      {d.submitted[1 - p.seat] && !d.revealAt && (
        <p role="status">TA 写好了，答案先替 TA 保密。</p>
      )}
      {d.round > 0 && !d.submitted.some(Boolean) && !d.revealAt && (
        <div class="agreement">
          <p>
            {d.agrees[1 - p.seat]
              ? "TA 觉得意思一样，你呢？"
              : "这两个词的意思一样吗？两人同意就算成功。"}
          </p>
          <button
            class="secondary"
            disabled={p.disabled || d.agrees[p.seat]}
            onClick={() => void send("agree", { round: d.round })}
          >
            {d.agrees[p.seat] ? "等 TA 确认…" : "算我们一样 ❤"}
          </button>
          {d.round === 10 && (
            <button class="text-button" onClick={() => void send("finish")}>
              结束，保存我们的词链
            </button>
          )}
        </div>
      )}
    </section>
  );
}
