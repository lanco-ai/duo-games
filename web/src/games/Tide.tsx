// 潮汐棋的棋盘界面。实时对局（房间里）和异步对局（大厅的棋桌）共用 TideBoard。
// 规则全在 shared/games/tide/rules.ts，这里只负责画面、选牌选格和结算反馈。
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { useGame, type GameProps } from "./common";
import type { Profile, Seat } from "../../../shared/protocol";
import { Critter } from "../art/ui";
import { CardArt, CardBack, PieceArt } from "../art/tide";
import {
  CARD_NAMES,
  COLS,
  FLAT,
  ROWS,
  TURNS,
  boatTargets,
  flooded,
  hasTarget,
  netTargets,
  placeTargets,
  side,
  type Card,
  type Outcome,
  type Piece,
  type Play,
  type TideState,
  type TurnRecord,
} from "../../../shared/games/tide/rules";
import "./tide.css";

const EFFECT: Record<Card, string> = {
  lamp: "干地上每回合 1 分",
  coral: "水下每回合 1 分",
  stone: "挡住身后的水",
  boat: "挪一枚子 2 格",
  net: "收走相邻敌子",
  wave: "对方潮位 +1",
};
const OUTCOME: Record<Outcome, string> = {
  ok: "",
  clash: "撞格落空",
  blocked: "格子被占",
  missed: "没网到",
  timeout: "超时弃牌",
  discard: "弃牌",
};

export default function Tide(p: GameProps) {
  const send = useGame(p);
  return (
    <TideBoard
      d={p.view.data}
      seat={p.seat}
      profiles={p.room.profiles}
      now={p.now}
      disabled={p.disabled}
      send={send}
      runKey={p.view.run}
      compact
    />
  );
}

export interface TideBoardProps {
  d: Record<string, any>;
  seat: Seat;
  profiles: [Profile | null, Profile | null];
  now: number;
  disabled: boolean;
  send: (command: string, payload?: any) => Promise<unknown>;
  runKey: string;
  /** 放在回合标记旁边的控件（异步对局的“实时”开关） */
  extra?: ComponentChildren;
  /** 有返回键时显示在左上角（异步对局的浮层） */
  back?: () => void;
  /** 棋盘下方的附加内容（结束这局） */
  footer?: ComponentChildren;
  /** 房间里的实时对局：空间紧，结算浮在棋盘上几秒后淡出 */
  compact?: boolean;
}

/** 潮汐曲线：12 回合的潮位，当前回合标出数字 */
function TideChart({ tides, turn }: { tides: number[]; turn: number }) {
  const W = 240,
    H = 56,
    x = (i: number) => ((i + 0.5) / TURNS) * W,
    y = (t: number) => H - 15 - (t * (H - 30)) / 3;
  const line = tides.map((t, i) => `${i ? "L" : "M"}${x(i)} ${y(t)}`).join(" ");
  const now = Math.min(turn, TURNS - 1);
  return (
    <div
      class="tide-chart"
      aria-label={`潮汐表，这一回合潮位 ${tides[now]}，下一回合 ${tides[now + 1] ?? "—"}`}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d={`${line} L${x(TURNS - 1)} ${H} L${x(0)} ${H}Z`}
          class="tide-chart-water"
        />
        <path d={line} class="tide-chart-line" />
        <rect
          x="0"
          y="0"
          width={x(now) - W / TURNS / 2}
          height={H}
          class="tide-chart-past"
        />
      </svg>
      <span class="tide-chart-label" aria-hidden="true">
        潮位
      </span>
      <span
        class="tide-chart-now"
        style={{
          left: `${((now + 0.5) / TURNS) * 100}%`,
          top: `${(y(tides[now]) / H) * 100}%`,
        }}
      >
        {tides[now]}
      </span>
    </div>
  );
}

export function TideBoard(p: TideBoardProps) {
  const d = p.d,
    send = p.send,
    me = p.seat,
    other = (1 - me) as Seat;
  const [card, setCard] = useState<number | null>(null),
    [from, setFrom] = useState<number | null>(null),
    [target, setTarget] = useState<number | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setCard(null);
    setFrom(null);
    setTarget(null);
  }, [d.turn, p.runKey]);

  const board: (Piece | null)[] = d.board;
  const last: TurnRecord | null = d.last;
  const name = (seat: Seat) =>
    seat === me ? "你" : p.profiles[seat]?.nickname || "TA";
  const color = (seat: Seat) => p.profiles[seat]?.color || "#FF6B6B";
  const chosen: Card | null = card !== null ? d.hand[card] : null;
  const state = {
    board,
    hands: [d.hand, d.hand],
    turn: d.turn,
  } as unknown as TideState;

  const options = useMemo(() => {
    if (!chosen || d.pick) return new Set<number>();
    if (chosen === "boat")
      return new Set(
        from === null
          ? board.flatMap((x, i) =>
              x?.owner === me && boatTargets(board, i).length ? [i] : [],
            )
          : boatTargets(board, from),
      );
    if (chosen === "net") return new Set(netTargets(board, me));
    if (chosen === "wave") return new Set<number>();
    return new Set(placeTargets(state, me, chosen));
  }, [chosen, from, d.turn, d.pick]);

  const finished = d.turn >= TURNS;
  const level = d.tides[Math.min(d.turn, TURNS - 1)];
  const water = (i: number) => flooded(board, i, [level, level]);
  const rows = me === 0 ? [6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6];
  const left = Math.max(0, Math.ceil((d.deadline - p.now) / 1000));
  const discard = !!chosen && !hasTarget(state, me, chosen);
  const ready =
    chosen === "wave" ||
    discard ||
    (chosen === "boat" ? from !== null && target !== null : target !== null);
  const reveal = !!last && !chosen && !d.pick;

  // 结算后：哪些棋子刚得了分（按结算时的潮位）
  const scored = useMemo(() => {
    if (!last) return new Set<number>();
    return new Set(
      last.board.flatMap((x, i) => {
        if (!x || x.kind === "stone") return [];
        const wet = flooded(last.board, i, last.tide);
        return (x.kind === "lamp" && !wet) || (x.kind === "coral" && wet)
          ? [i]
          : [];
      }),
    );
  }, [last?.turn, p.runKey]);
  // 分数变化时数字跳一下
  const prev = useRef<[number, number]>(d.scores);
  const [pop, setPop] = useState<[number, number]>([0, 0]);
  useEffect(() => {
    const gain: [number, number] = [
      d.scores[0] - prev.current[0],
      d.scores[1] - prev.current[1],
    ];
    prev.current = d.scores;
    if (gain[0] || gain[1]) setPop(gain);
    const t = setTimeout(() => setPop([0, 0]), 1600);
    return () => clearTimeout(t);
  }, [d.scores[0], d.scores[1]]);

  async function play() {
    if (!chosen || !ready || busy) return;
    const payload: Play & { turn: number } = { turn: d.turn, card: chosen };
    if (!discard && chosen === "boat")
      Object.assign(payload, { at: from, to: target });
    else if (!discard && chosen !== "wave") payload.at = target!;
    setBusy(true);
    try {
      await send("play", payload);
    } finally {
      setBusy(false);
    }
  }
  function tap(i: number) {
    if (!options.has(i)) return;
    if (chosen === "boat" && from === null) setFrom(i);
    else if (chosen === "boat" && i === from) setFrom(null);
    else setTarget(i === target ? null : i);
  }
  const hint = !chosen
    ? "选一张牌"
    : discard
      ? "弃掉这张"
      : chosen === "wave"
        ? "出牌 · 浪"
        : chosen === "boat" && from === null
          ? "点你要挪的棋子"
          : chosen === "boat" && target === null
            ? "点船要去的格子"
            : target === null
              ? "点一个亮着的格子"
              : "出牌 · " + CARD_NAMES[chosen];

  const scoreSide = (seat: Seat) => (
    <div
      class={"tide-side" + (seat === me ? " me" : "")}
      style={{ "--player": color(seat) }}
    >
      <span class="tide-avatar">
        <Critter
          avatar={p.profiles[seat]?.avatar}
          color={color(seat)}
          mood={d.picked[seat] ? "joy" : "normal"}
          size={40}
          shadow={false}
        />
        {seat !== me && !finished && (
          <i
            class={"tide-status" + (d.picked[seat] ? " done" : "")}
            aria-label={d.picked[seat] ? "已出牌" : "在想"}
          >
            {d.picked[seat] ? "✓" : "…"}
          </i>
        )}
      </span>
      <span class="tide-name">{name(seat)}</span>
      <b
        class={"tide-score" + (pop[seat] ? " pop" : "")}
        key={seat + ":" + d.scores[seat]}
      >
        {d.scores[seat]}
      </b>
      {pop[seat] > 0 && <em class="tide-gain">+{pop[seat]}</em>}
    </div>
  );

  const revealCard = reveal && (
    <div class="tide-reveal" role="status" key={"r" + last!.turn}>
      <h4>第 {last!.turn + 1} 回合</h4>
      <div class="tide-reveal-cards">
        {([me, other] as Seat[]).map((s) => {
          const play = last!.plays[s];
          return (
            <div
              class={"tide-mini" + (s === me ? " me" : "")}
              style={{ "--player": color(s) }}
            >
              <span class="tide-mini-card">
                {play ? <CardArt card={play.card} /> : <CardBack />}
              </span>
              <span class="tide-mini-text">
                <b>{name(s)}</b>
                <span>{play ? CARD_NAMES[play.card] : "没出牌"}</span>
                {OUTCOME[last!.outcomes[s]] && (
                  <em>{OUTCOME[last!.outcomes[s]]}</em>
                )}
              </span>
              <strong>+{last!.gained[s]}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <section
      class={
        "tide-stage" +
        (p.back ? " overlay" : "") +
        (p.compact ? " compact" : "")
      }
      data-testid="tide-stage"
    >
      <header class="tide-hud">
        {p.back && (
          <button class="tide-round" aria-label="收起棋盘" onClick={p.back}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M15 5l-7 7 7 7"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        )}
        <div class="tide-scoreboard">
          {scoreSide(me)}
          <span class="tide-vs">:</span>
          {scoreSide(other)}
        </div>
        <div class="tide-turn">
          <b>
            {Math.min(d.turn + 1, TURNS)}
            <small>/{TURNS}</small>
          </b>
          {d.deadline > 0 && !finished && (
            <span
              class={"tide-clock" + (left <= 5 ? " urgent" : "")}
              style={{ "--left": left / 30 }}
            >
              {left}
            </span>
          )}
          {p.extra}
        </div>
      </header>

      <div class="tide-main">
        <TideChart tides={d.tides} turn={d.turn} />
        <div class="tide-bay-wrap">
          {p.compact && revealCard}
          <div
            class={"tide-bay" + (options.size ? " choosing" : "")}
            role="grid"
            aria-label="潮汐棋盘"
            style={{ "--cols": COLS, "--rows": ROWS }}
          >
            {rows.flatMap((r) =>
              Array.from({ length: COLS }, (_, c) => {
                const i = r * COLS + c,
                  piece = board[i],
                  s = side(i),
                  wet = water(i),
                  isOption = options.has(i),
                  mineLast =
                    reveal &&
                    (last!.plays[me]?.at === i || last!.plays[me]?.to === i),
                  theirLast =
                    reveal &&
                    (last!.plays[other]?.at === i ||
                      last!.plays[other]?.to === i),
                  caught = reveal && last!.captured.includes(i),
                  picked =
                    (d.pick && (d.pick.at === i || d.pick.to === i)) ||
                    i === target ||
                    i === from;
                const active = piece
                  ? piece.kind === "lamp"
                    ? !wet
                    : piece.kind === "coral"
                      ? wet
                      : false
                  : false;
                return (
                  <button
                    key={i}
                    data-cell={i}
                    class={[
                      "tide-cell",
                      s === null ? "flat" : s === me ? "mine" : "theirs",
                      wet && "wet",
                      r === FLAT && "flat-row",
                      isOption && "option",
                      picked && "picked",
                      mineLast && "last-mine",
                      theirLast && "last-theirs",
                      caught && "caught",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{ "--me": color(me), "--them": color(other) }}
                    aria-label={`${r + 1}行${c + 1}列${wet ? " 水下" : ""}${piece ? " " + (piece.owner === me ? "你的" : name(other) + "的") + CARD_NAMES[piece.kind] + (active ? " 得分中" : "") : ""}`}
                    disabled={!isOption}
                    onClick={() => tap(i)}
                  >
                    {piece && (
                      <span
                        class={
                          "tide-token" +
                          (active ? " active" : "") +
                          (piece.owner === me ? " own" : "")
                        }
                        style={{ "--owner": color(piece.owner) }}
                      >
                        <PieceArt
                          kind={piece.kind}
                          active={piece.kind === "stone" || active}
                        />
                      </span>
                    )}
                    {!piece &&
                      picked &&
                      (chosen || d.pick) &&
                      (d.pick?.card ?? chosen) !== "net" &&
                      (d.pick?.card ?? chosen) !== "boat" && (
                        <span class="tide-ghost">
                          <PieceArt kind={(d.pick?.card ?? chosen) as "lamp"} />
                        </span>
                      )}
                    {reveal && scored.has(i) && piece && (
                      <em class="tide-plus" key={"p" + last!.turn}>
                        +1
                      </em>
                    )}
                  </button>
                );
              }),
            )}
          </div>
        </div>

        <aside class="tide-panel">
          {reveal && !p.compact && revealCard}
          {finished ? null : d.pick ? (
            <div class="tide-waiting">
              <span class="tide-played">
                <CardBack />
                <span class="tide-played-face">
                  <CardArt card={d.pick.card} />
                </span>
              </span>
              <span class="tide-waiting-text">
                <b>已出{CARD_NAMES[d.pick.card as Card]}</b>
                <span>
                  {d.picked[other] ? "马上揭晓" : "等 " + name(other) + " 出牌"}
                </span>
              </span>
              <button
                class="tide-chip"
                disabled={p.disabled || d.picked[other]}
                onClick={() => void send("retract", { turn: d.turn })}
              >
                收回
              </button>
            </div>
          ) : (
            <>
              <div class="tide-hand" role="listbox" aria-label="手牌">
                {d.hand.map((c: Card, i: number) => (
                  <button
                    role="option"
                    aria-selected={card === i}
                    aria-label={CARD_NAMES[c] + "：" + EFFECT[c]}
                    class={"tide-card" + (card === i ? " selected" : "")}
                    disabled={p.disabled}
                    onClick={() => {
                      setCard(card === i ? null : i);
                      setFrom(null);
                      setTarget(null);
                    }}
                  >
                    <CardArt card={c} />
                    <b>{CARD_NAMES[c]}</b>
                    <small>{EFFECT[c]}</small>
                  </button>
                ))}
                {d.deck > 0 && (
                  <span class="tide-deck" aria-label={`牌堆还有 ${d.deck} 张`}>
                    <CardBack />
                    <b>{d.deck}</b>
                  </span>
                )}
              </div>
              <button
                class={"tide-go" + (busy ? " busy" : "")}
                disabled={p.disabled || !ready || busy}
                onClick={() => void play()}
              >
                {hint}
              </button>
            </>
          )}
          {p.footer}
        </aside>
      </div>
    </section>
  );
}
