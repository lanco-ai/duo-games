import { useEffect, useRef, useState } from "preact/hooks";
import { useGame, nickname, type GameProps } from "./common";
import { Critter } from "../art/ui";
function answerText(q: any, a: any) {
  if (q.type === "choice") return q.options[a];
  if (q.type === "rank") return a.map((i: number) => q.options[i]).join(" → ");
  return String(a);
}
export default function Know(p: GameProps) {
  const d = p.view.data,
    q = d.question,
    send = useGame(p),
    [answer, setAnswer] = useState<any>(null),
    [busy, setBusy] = useState(false),
    drag = useRef<number | null>(null);
  useEffect(() => {
    setAnswer(
      d.own ??
        (q.type === "slider"
          ? 50
          : q.type === "rank"
            ? [0, 1, 2, 3]
            : q.type === "text"
              ? ""
              : null),
    );
    setBusy(false);
  }, [d.idx]);
  const submitted = d.submitted[p.seat],
    show = d.answers && p.now >= d.revealAt;
  const reorder = (from: number, to: number) => {
    const next = [...answer];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setAnswer(next);
  };
  return (
    <section class="extra-stage know-stage" data-testid="know-stage">
      <span class="game-eyebrow">
        第 {d.idx + 1} / {d.total} 题 · 主角是 {nickname(p, d.hero)}
      </span>
      <div class="question-board">
        <Critter
          avatar={p.room.profiles[d.hero as 0 | 1]?.avatar}
          color={p.room.profiles[d.hero as 0 | 1]?.color || "#FF6B6B"}
          mood={show ? "wow" : "joy"}
          size={64}
          class="question-hero"
        />
        <h2>{q.text.replaceAll("{name}", nickname(p, d.hero))}</h2>
      </div>
      <p class="muted">
        {p.seat === d.hero
          ? "答你自己的情况，让 TA 更懂你。"
          : "猜猜 TA 会怎么回答。"}
      </p>
      {show ? (
        <>
          <div class="answer-pair">
            {[0, 1].map((seat) => (
              <article>
                <small>
                  {nickname(p, seat)}
                  {seat === d.hero ? "的答案" : "的猜测"}
                </small>
                <strong>{answerText(q, d.answers[seat])}</strong>
              </article>
            ))}
          </div>
          {d.phase === "grade" ? (
            p.seat === d.hero ? (
              <div class="game-actions">
                <p>你是主角，TA 猜得怎么样？</p>
                {[
                  [10, "猜对了"],
                  [5, "差不多"],
                  [0, "还不对"],
                ].map(([score, label]) => (
                  <button
                    class="secondary"
                    onClick={() => void send("grade", { idx: d.idx, score })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <p>等 TA 来判定这道题…</p>
            )
          ) : d.phase === "revealed" ? (
            <>
              <p class="round-score">
                这一题 +{d.history.at(-1)?.score || 0} 分
              </p>
              <button
                class="primary"
                onClick={() => void send("next", { idx: d.idx })}
              >
                {d.idx + 1 === d.total ? "看看默契指数" : "下一题 →"}
              </button>
            </>
          ) : (
            <p>一起揭晓…</p>
          )}
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await send("submit", { idx: d.idx, answer });
            setBusy(false);
          }}
        >
          <fieldset disabled={p.disabled || submitted || busy}>
            {q.type === "choice" && (
              <div class="choice-grid">
                {q.options.map((option: string, i: number) => (
                  <button
                    type="button"
                    class={answer === i ? "choice selected" : "choice"}
                    aria-pressed={answer === i}
                    onClick={() => setAnswer(i)}
                  >
                    {String.fromCharCode(65 + i)} · {option}
                  </button>
                ))}
              </div>
            )}
            {q.type === "slider" && (
              <label class="range-answer">
                <strong>{answer ?? 50}</strong>
                <input
                  type="range"
                  aria-label="你的评分"
                  min="0"
                  max="100"
                  value={answer ?? 50}
                  onInput={(e) => setAnswer(Number(e.currentTarget.value))}
                />
                <span>
                  完全不 <i /> 非常
                </span>
              </label>
            )}
            {q.type === "rank" && Array.isArray(answer) && (
              <div class="ranking">
                {answer.map((option: number, i: number) => (
                  <div
                    draggable
                    onDragStart={() => (drag.current = i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (drag.current !== null) reorder(drag.current, i);
                      drag.current = null;
                    }}
                  >
                    <span>
                      ☰ {i + 1}. {q.options[option]}
                    </span>
                    <button
                      type="button"
                      aria-label={"上移" + q.options[option]}
                      disabled={i === 0}
                      onClick={() => reorder(i, i - 1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={"下移" + q.options[option]}
                      disabled={i === 3}
                      onClick={() => reorder(i, i + 1)}
                    >
                      ↓
                    </button>
                  </div>
                ))}
              </div>
            )}
            {q.type === "text" && (
              <textarea
                aria-label="你的答案"
                maxLength={120}
                rows={3}
                value={answer || ""}
                onInput={(e) => setAnswer(e.currentTarget.value)}
                placeholder="写下心里的答案…"
              />
            )}
            <button
              class="primary wide"
              disabled={
                answer === null ||
                (typeof answer === "string" && !answer.trim())
              }
            >
              {submitted ? "已提交，等 TA 一起揭晓" : "锁定我的答案 ❤"}
            </button>
          </fieldset>
          {d.submitted[1 - p.seat] && <p role="status">TA 已作答</p>}
          {d.revealAt > p.now && <p>答案已锁定，马上一起翻开…</p>}
        </form>
      )}
    </section>
  );
}
