import { useEffect } from "preact/hooks";
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
}: {
  view: TalkView;
  seat: Seat;
  profiles: [Profile, Profile | null];
  now: number;
  send: (a: Action) => Promise<boolean>;
  busy: boolean;
  onWrite: (card: Card) => void;
}) {
  const visible = view.phase === "shown" && now >= view.flipAt,
    mine = view.turn === seat;
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
        disabled={view.phase !== "draw" || !mine || busy}
        onClick={() => void send({ type: "draw" })}
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
      <div class="talk-actions">
        {visible && view.card ? (
          <>
            <button
              class="talk-next go big"
              disabled={busy}
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
