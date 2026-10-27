import { useEffect, useState } from "preact/hooks";
import "./couple.css";
import type {
  Action,
  TalkView,
  Seat,
  Profile,
  Card,
} from "../../../shared/protocol";
import { chime } from "../ui/common";
import { Critter } from "../art/ui";
export default function Talk({
  view,
  seat,
  profiles,
  now,
  send,
  busy,
  onWrite,
  sendLocal,
}: {
  view: TalkView;
  seat: Seat;
  profiles: [Profile, Profile | null];
  now: number;
  send: (a: Action) => Promise<boolean>;
  busy: boolean;
  onWrite: (card: Card) => void;
  sendLocal?: (a: Action) => Promise<boolean>;
}) {
  const [pool, setPool] = useState<"truth" | "dare">("truth");
  const visible = view.phase === "shown" && now >= view.flipAt,
    mine = view.turn === seat || !!sendLocal,
    sendTurn = view.turn === seat ? send : sendLocal || send;
  useEffect(() => {
    if (visible) chime();
  }, [visible, view.idx]);
  const drawer = profiles[view.turn];
  return (
    <div class="talk-stage">
      <div class="talk-overline">☾ 今晚，认真听你说</div>
      <div class="talk-turn">
        {drawer && (
          <Critter
            avatar={drawer.avatar}
            color={drawer.color}
            mood={visible ? "joy" : "normal"}
            pose={mine && view.phase === "draw" ? "up" : "stand"}
            size={58}
            class="hop"
          />
        )}
        <p class="turn-label">
          {mine
            ? "轮到你抽卡"
            : "轮到 " + profiles[view.turn]?.nickname + " 抽卡"}{" "}
          <span>· 第 {view.idx + 1} 张</span>
        </p>
      </div>
      <button
        class={"talk-card " + (visible ? "revealed" : "")}
        data-testid="talk-card"
        disabled={view.phase !== "draw" || !mine || busy || view.mode === "pro"}
        onClick={() => void sendTurn({ type: "draw" })}
      >
        {visible && view.card ? (
          <>
            <span class="card-deck">
              {view.card.deck === "小挑战"
                ? "🎲 给抽卡人的小挑战"
                : {
                    轻松: "🍬 轻松一点",
                    走心: "🌙 走近一点",
                    未来: "🔮 想远一点",
                  }[view.card.deck]}
            </span>
            <span class="question" data-testid="card-question">
              {view.card.text}
            </span>
            <span class="card-foot">
              {view.card.deck === "小挑战"
                ? profiles[view.turn]?.nickname + "，轮到你啦"
                : "没有标准答案，只想多懂你一点。"}
            </span>
          </>
        ) : (
          <>
            <span class="card-moon" aria-hidden="true" />
            <span class="card-stars">✦ · ✧ · ✦</span>
            <span class="card-back-title">深夜聊天卡</span>
            <span class="card-foot">
              {view.phase === "shown"
                ? "正在一起翻开…"
                : mine
                  ? "轻点卡片，开启一段对话"
                  : "等 TA 抽一张卡"}
            </span>
          </>
        )}
      </button>
      {visible && view.mode === "pro" && view.pro && (
        <div class="trigger-result">
          {view.pro.trigger.startsWith("wheel")
            ? "🎡 大转盘"
            : view.pro.trigger.startsWith("dice")
              ? "🎲 骰子"
              : "🃏 鬼牌"}{" "}
          · {view.pro.trigger.split(":")[1]} ·{" "}
          {view.pro.pool === "truth" ? "真心话" : "大冒险"}
        </div>
      )}
      {view.mode === "pro" && view.phase === "draw" && (
        <div class="pro-controls">
          <div>
            <button
              aria-pressed={pool === "truth"}
              onClick={() => setPool("truth")}
            >
              💬 真心话
            </button>
            <button
              aria-pressed={pool === "dare"}
              onClick={() => setPool("dare")}
            >
              🔥 大冒险
            </button>
          </div>
          <p>选择方式，替当前玩家抽取一张卡</p>
          <div>
            {(
              [
                ["wheel", "🎡 大转盘"],
                ["dice", "🎲 摇骰子"],
                ["joker", "🃏 抽鬼牌"],
              ] as const
            ).map(([trigger, label]) => (
              <button
                disabled={busy || !mine}
                onClick={() =>
                  void sendTurn({ type: "pro-draw", trigger, pool })
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {visible && view.mode === "pro" && view.pro?.pool === "dare" && (
        <div class="pro-controls">
          <strong>
            🔥 大冒险　
            {Math.max(0, Math.ceil((view.pro.deadline - now) / 1000))} 秒
          </strong>
          {view.pro.outcome ? (
            <p>
              本次：
              {view.pro.outcome === "complete"
                ? "完成"
                : view.pro.outcome === "drink"
                  ? "认怂喝酒"
                  : "惩罚券"}
            </p>
          ) : (
            <div>
              {now >= view.pro.deadline && <p>时间到了，请选择惩罚。</p>}
              {(
                [
                  ["complete", "完成挑战"],
                  ["drink", "认怂喝酒"],
                  ["coupon", "使用惩罚券"],
                ] as const
              ).map(([outcome, label]) => (
                <button
                  disabled={
                    busy ||
                    !mine ||
                    (outcome === "complete" && now >= view.pro!.deadline)
                  }
                  onClick={() =>
                    void sendTurn({ type: "pro-resolve", outcome })
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div class="talk-actions">
        {visible && view.card ? (
          <>
            <button
              class="talk-next go big"
              disabled={
                busy ||
                (view.mode === "pro" &&
                  view.pro?.pool === "dare" &&
                  !view.pro.outcome)
              }
              onClick={() => void send({ type: "next", idx: view.idx })}
            >
              聊好了，下一张 →
            </button>
            <div class="talk-tools">
              <button
                class="secondary"
                disabled={busy || !mine}
                onClick={() => void send({ type: "skip", idx: view.idx })}
              >
                ↻ 换一张
              </button>
              <button
                class="secondary"
                disabled={busy}
                aria-pressed={view.favorites[seat].includes(view.card.id)}
                onClick={() =>
                  void send({
                    type: "fav",
                    cardId: view.card!.id,
                    on: !view.favorites[seat].includes(view.card!.id),
                  })
                }
              >
                {view.favorites[seat].includes(view.card.id)
                  ? "★ 已收藏"
                  : "☆ 收藏"}
              </button>
              <button
                class="secondary"
                onClick={() => {
                  onWrite(view.card!);
                }}
              >
                ✎ 写下来
              </button>
            </div>
          </>
        ) : (
          <p class="talk-hint">慢慢聊，不着急。想跳过的问题，随时可以换。</p>
        )}
      </div>
    </div>
  );
}
