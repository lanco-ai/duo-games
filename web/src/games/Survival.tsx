import { useState } from "preact/hooks";
import { useGame, type GameProps } from "./common";
export default function Survival(p: GameProps) {
  const d = p.view.data,
    send = useGame(p),
    [draft, setDraft] = useState("");
  const asker = p.seat === d.asker,
    act = (cmd: string, extra: any = {}) => send(cmd, { idx: d.idx, ...extra });
  return (
    <section
      class="couple-new-stage survival-stage"
      data-testid="survival-stage"
    >
      <header class="couple-bar">
        <b>
          {d.chapterName} {d.idx + 1}/5
        </b>
        <b>
          {"❤️".repeat(d.lives)} {d.points}分
        </b>
        <span>{Math.max(0, Math.ceil((d.deadline - p.now) / 1000))}s</span>
      </header>
      <h2>{d.prompt}</h2>
      <p>
        {d.scene} ·{" "}
        {asker ? "你来提问，秘密选择最想听到的话" : "猜猜 TA 心里最想听到什么"}
      </p>
      <div class="answer-options">
        {d.phase === "choose" &&
          d.options.map((option: string, i: number) => (
            <button
              style={{ minHeight: 44 }}
              disabled={p.disabled || d.own !== null}
              onClick={() => void act("submit", { choice: i })}
            >
              {option}
            </button>
          ))}
      </div>
      {d.phase === "choose" && (
        <>
          <label>
            自己写一句
            <input
              aria-label="自己写一句"
              maxLength={asker ? 20 : 30}
              value={draft}
              onInput={(e) => setDraft(e.currentTarget.value)}
              disabled={d.own !== null}
            />
          </label>
          <button
            disabled={!draft.trim() || d.own !== null || p.disabled}
            onClick={() => void act("submit", { text: draft })}
          >
            秘密锁定
          </button>
          <p>
            {d.own !== null ? "已锁定，等 TA 一起揭晓" : "双方都选好才会揭晓"}
          </p>
          <div class="survival-objects">
            {d.objects.map((item: any, i: number) => (
              <button
                disabled={
                  !asker || d.highlight !== null || !d.hints || p.disabled
                }
                class={d.highlight === i ? "chosen" : ""}
                onClick={() => void act("hint", { item: i })}
                aria-label={"高亮线索" + item.name}
              >
                {item.icon}
                <small>{item.name}</small>
              </button>
            ))}
          </div>
          <p>提问者可用物品作暗示，剩余 {d.hints} 次</p>
        </>
      )}
      {d.answers && (
        <div class="answer-pair">
          <p>其实我想听：{d.answers[d.asker] || "未选择"}</p>
          <p>你的回答：{d.answers[1 - d.asker] || "未作答"}</p>
        </div>
      )}
      {d.phase === "rate" &&
        (asker ? (
          <div class="button-row">
            {[
              [1, "😍 加分"],
              [0, "😐 不扣"],
              [-1, "😤 一颗心"],
            ].map(([value, label]) => (
              <button
                disabled={p.disabled}
                onClick={() => void act("rate", { value })}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <p>请 TA 告诉你这句话的心动程度</p>
        ))}
      <p aria-live="polite">{d.feedback}</p>
      {d.phase === "reveal" && (
        <button
          class="primary"
          onClick={() => {
            setDraft("");
            void act("next");
          }}
        >
          下一题
        </button>
      )}
      {d.phase === "revive" &&
        (!asker ? (
          <>
            <label>
              撒娇复活：写一句想对 TA 说的话
              <input
                value={draft}
                maxLength={60}
                onInput={(e) => setDraft(e.currentTarget.value)}
                aria-label="撒娇留言"
              />
            </label>
            <button
              disabled={!draft.trim() || !!d.appeal}
              onClick={() => void act("appeal", { text: draft })}
            >
              请求再给一次机会
            </button>
          </>
        ) : d.appeal ? (
          <>
            <p>{d.appeal}</p>
            <button onClick={() => void act("revive", { accept: true })}>
              好啦，再给一次机会
            </button>
            <button onClick={() => void act("revive", { accept: false })}>
              留到下次
            </button>
          </>
        ) : (
          <p>等 TA 写一句撒娇留言吧</p>
        ))}
    </section>
  );
}
