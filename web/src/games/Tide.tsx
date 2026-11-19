import { useEffect, useMemo, useState } from "preact/hooks";
import { useGame, nickname, type GameProps } from "./common";
import { Critter } from "../art/ui";
import {
  CARD_NAMES,
  COLS,
  ROWS,
  TURNS,
  boatTargets,
  flooded,
  netTargets,
  placeTargets,
  type Card,
  type Outcome,
  type Piece,
  type Play,
  type TideState,
  type TurnRecord,
} from "../../../shared/games/tide/rules";
import type { Seat } from "../../../shared/protocol";
import "./tide.css";

const EFFECT: Record<Card, string> = {
  lamp: "没被淹的灯，每回合 1 分",
  coral: "在水下的珊瑚，每回合 1 分",
  stone: "挡住同一列身后的水",
  boat: "把你的一枚棋子挪最多 2 格",
  net: "收走相邻格里对方的棋子",
  wave: "这一回合对方那边潮位 +1",
};
const OUTCOME: Record<Outcome, string> = {
  ok: "",
  clash: "撞格落空",
  blocked: "格子被占",
  missed: "没网到",
  timeout: "超时",
};

function PieceIcon({ kind, color }: { kind: Card; color?: string }) {
  const c = color || "#3a2618";
  return (
    <svg viewBox="0 0 32 32" class={"tide-piece " + kind} aria-hidden="true">
      {kind === "lamp" && (
        <>
          <circle cx="16" cy="15" r="11" fill="#FFE27A" opacity=".45" />
          <rect
            x="10"
            y="9"
            width="12"
            height="15"
            rx="5"
            fill="#FFD23F"
            stroke={c}
            stroke-width="2.4"
          />
          <path
            d="M13 9V6h6v3M12 24h8"
            stroke={c}
            stroke-width="2.4"
            fill="none"
            stroke-linecap="round"
          />
        </>
      )}
      {kind === "coral" && (
        <path
          d="M16 28V16M16 18l-6-6M10 12V7M16 16l6-7M22 9l3-2M16 22l-5-3"
          stroke={c}
          stroke-width="4"
          fill="none"
          stroke-linecap="round"
        />
      )}
      {kind === "stone" && (
        <path
          d="M5 23c0-8 5-14 11-14s11 6 11 14c0 2-2 3-4 3H9c-2 0-4-1-4-3z"
          fill="#B9B3A8"
          stroke={c}
          stroke-width="2.4"
        />
      )}
      {kind === "boat" && (
        <>
          <path
            d="M5 19h22l-4 7H9z"
            fill="#D9A066"
            stroke={c}
            stroke-width="2.4"
            stroke-linejoin="round"
          />
          <path
            d="M16 19V5l8 10h-8"
            fill="#FFF"
            stroke={c}
            stroke-width="2.2"
            stroke-linejoin="round"
          />
        </>
      )}
      {kind === "net" && (
        <path
          d="M6 8l20 0M5 14h22M6 20h20M9 26h14M9 6l4 22M16 5v23M23 6l-4 22"
          stroke={c}
          stroke-width="2"
          fill="none"
          stroke-linecap="round"
        />
      )}
      {kind === "wave" && (
        <path
          d="M3 20c4-6 8-6 12 0s8 6 14 0M3 12c4-6 8-6 12 0s8 6 14 0"
          stroke="#2F8FCF"
          stroke-width="3.4"
          fill="none"
          stroke-linecap="round"
        />
      )}
    </svg>
  );
}

export default function Tide(p: GameProps) {
  const d = p.view.data,
    send = useGame(p),
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
  }, [d.turn, p.view.run]);

  const board: (Piece | null)[] = d.board;
  const last: TurnRecord | null = d.last;
  const color = (seat: Seat) => p.room.profiles[seat]?.color || "#FF6B6B";
  const chosen: Card | null = card !== null ? d.hand[card] : null;
  const state = {
    board,
    hands: [d.hand, d.hand],
    turn: d.turn,
  } as unknown as TideState;

  // 当前选中的牌可以点哪些格子
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

  const level = d.tides[Math.min(d.turn, TURNS - 1)];
  const water = (i: number) => flooded(board, i, [level, level]);
  const rows = me === 0 ? [6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6];
  const left = Math.max(0, Math.ceil((d.deadline - p.now) / 1000));
  const ready =
    chosen === "wave" ||
    (chosen === "boat" ? from !== null && target !== null : target !== null);

  async function play() {
    if (!chosen || !ready || busy) return;
    const payload: Play & { turn: number } = { turn: d.turn, card: chosen };
    if (chosen === "boat") Object.assign(payload, { at: from, to: target });
    else if (chosen !== "wave") payload.at = target!;
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
    else setTarget(i);
  }
  const mark = (i: number) => {
    if (d.pick && (d.pick.at === i || d.pick.to === i)) return "mine";
    if (i === target || i === from) return "mine";
    if (!last || d.pick || chosen) return "";
    const hit = [0, 1].find(
      (s) => last.plays[s]?.at === i || last.plays[s]?.to === i,
    );
    return hit === undefined ? "" : hit === me ? "mine-last" : "theirs-last";
  };

  return (
    <section class="extra-stage tide-stage" data-testid="tide-stage">
      <header class="tide-top">
        {([me, other] as Seat[]).map((seat) => (
          <div class={"tide-player" + (seat === me ? " me" : "")}>
            <Critter
              avatar={p.room.profiles[seat]?.avatar}
              color={color(seat)}
              mood={d.picked[seat] ? "joy" : "normal"}
              size={40}
            />
            <span>{seat === me ? "你" : nickname(p, seat)}</span>
            <b>{d.scores[seat]}</b>
            {seat !== me && (
              <i class={"tide-ready" + (d.picked[seat] ? " on" : "")}>
                {d.picked[seat] ? "已出" : "在想"}
              </i>
            )}
          </div>
        ))}
        <div class="tide-clock">
          <b>
            {Math.min(d.turn + 1, TURNS)}/{TURNS}
          </b>
          <span class={left <= 5 ? "urgent" : ""}>{left}s</span>
        </div>
      </header>

      <ol class="tide-table" aria-label="潮汐表">
        {d.tides.map((t: number, i: number) => (
          <li
            class={i === d.turn ? "now" : i < d.turn ? "past" : ""}
            aria-label={`第 ${i + 1} 回合 潮位 ${t}`}
          >
            <i style={{ height: `${25 + t * 25}%` }} />
          </li>
        ))}
      </ol>

      <div
        class="tide-board"
        role="grid"
        aria-label="潮汐棋盘"
        style={{ "--cols": COLS, "--rows": ROWS }}
      >
        {rows.flatMap((r) =>
          Array.from({ length: COLS }, (_, c) => {
            const i = r * COLS + c,
              piece = board[i],
              m = mark(i),
              caught = !!last?.captured.includes(i) && !chosen && !d.pick;
            return (
              <button
                key={i}
                data-cell={i}
                class={[
                  "tide-cell",
                  water(i) ? "wet" : "dry",
                  r === 3 ? "flat" : "",
                  options.has(i) ? "option" : "",
                  m,
                  caught ? "caught" : "",
                ].join(" ")}
                aria-label={`${r + 1}行${c + 1}列${piece ? " " + (piece.owner === me ? "你的" : "TA的") + CARD_NAMES[piece.kind] : ""}`}
                disabled={!options.has(i)}
                onClick={() => tap(i)}
              >
                {piece && (
                  <span
                    class={"tide-owner" + (piece.owner === me ? " me" : "")}
                    style={{ "--owner": color(piece.owner) }}
                  >
                    <PieceIcon
                      kind={piece.kind}
                      color={piece.owner === me ? "#3a2618" : "#2a2a4a"}
                    />
                  </span>
                )}
                {!piece &&
                  (i === target || d.pick?.at === i || d.pick?.to === i) &&
                  chosen !== "net" &&
                  d.pick?.card !== "net" && (
                    <span class="tide-ghost">
                      <PieceIcon kind={(d.pick?.card || chosen) as Card} />
                    </span>
                  )}
              </button>
            );
          }),
        )}
      </div>

      {last && !chosen && !d.pick && (
        <p class="tide-reveal" role="status">
          {([me, other] as Seat[]).map((s) => {
            const play = last.plays[s];
            return (
              <span class={s === me ? "me" : ""}>
                {s === me ? "你" : nickname(p, s)}{" "}
                {play ? CARD_NAMES[play.card] : "—"}
                {OUTCOME[last.outcomes[s]] && (
                  <em> {OUTCOME[last.outcomes[s]]}</em>
                )}
                <b> +{last.gained[s]}</b>
              </span>
            );
          })}
        </p>
      )}
      {chosen && !d.pick && <p class="tide-effect">{EFFECT[chosen]}</p>}

      {d.pick ? (
        <div class="tide-actions">
          <span class="tide-picked">
            <PieceIcon kind={d.pick.card} /> 已出
            {CARD_NAMES[d.pick.card as Card]}
          </span>
          <button
            class="secondary"
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
                class={"tide-card" + (card === i ? " selected" : "")}
                disabled={p.disabled}
                onClick={() => {
                  setCard(card === i ? null : i);
                  setFrom(null);
                  setTarget(null);
                }}
              >
                <PieceIcon kind={c} />
                <span>{CARD_NAMES[c]}</span>
              </button>
            ))}
            {d.deck > 0 && <span class="tide-deck">{d.deck}</span>}
          </div>
          <div class="tide-actions">
            <button
              class="primary wide"
              disabled={p.disabled || !ready || busy}
              onClick={() => void play()}
            >
              出牌
            </button>
          </div>
        </>
      )}
    </section>
  );
}
