import { useEffect, useRef, useState } from "preact/hooks";
import type { Seat } from "../../../shared/protocol";
import {
  symbols,
  strip,
  stripAt,
  symbolNames,
  reactions,
  STOP1,
  STOP2,
  SPEED,
} from "../../../shared/games/love-slots/rules";
import {
  useGame,
  useEvents,
  useFrame,
  nickname,
  type GameProps,
} from "./common";
import { sfx } from "./sfx";
export default function Slots(p: GameProps) {
  const d = p.view.data,
    send = useGame(p),
    [, setFrame] = useState(0),
    [bet, setBet] = useState(1),
    [floats, setFloats] = useState<{ id: number; emoji: string; x: number }[]>(
      [],
    ),
    [flash, setFlash] = useState(""),
    floatId = useRef(0),
    lastSymbol = useRef("");
  const puller = d.turn as Seat,
    partner = (1 - puller) as Seat,
    controls = (seat: Seat) => seat === p.seat || !!p.local,
    act = (cmd: string, payload: any, seat: Seat) =>
      seat === p.seat
        ? send(cmd, payload)
        : p.local!.send({
            type: "game",
            run: p.view.run,
            command: cmd,
            payload,
          }),
    now = p.transport.now(),
    elapsed = now - d.spinAt,
    spinning = d.phase === "spinning";
  useFrame(() => {
    if (spinning) setFrame((f) => f + 1);
  });
  useEffect(() => {
    if (bet > d.coins) setBet(Math.max(1, Math.min(3, d.coins)));
  }, [d.coins]);
  const third = spinning ? stripAt(d.offset, elapsed) : d.reels[2];
  useEffect(() => {
    if (spinning && third !== lastSymbol.current && elapsed > STOP2) sfx.tick();
    lastSymbol.current = third;
  });
  useEvents(p, (e) => {
    if (e.kind === "stopped") {
      if (e.data.jackpot) sfx.jackpot();
      else if (e.data.delta > 0) sfx.coin();
      else if (e.data.delta < 0 || e.data.reels.includes("💔")) sfx.sad();
      else sfx.stop();
      setFlash(e.data.jackpot ? "jackpot" : e.data.delta > 0 ? "win" : "");
      setTimeout(() => setFlash(""), 1600);
    }
    if (e.kind === "react") {
      const id = ++floatId.current;
      setFloats((list) => [
        ...list.slice(-8),
        { id, emoji: e.data.emoji, x: e.data.seat ? 70 : 20 },
      ]);
      setTimeout(
        () => setFloats((list) => list.filter((x) => x.id !== id)),
        1800,
      );
    }
  });
  const reel = (i: number) => {
    if (i < 2) {
      const shown = d.reels[i];
      if (shown || !spinning) return shown || "❔";
      return symbols[Math.floor((elapsed + i * 37) / 70) % symbols.length];
    }
    return third || "❔";
  };
  const turning = (i: number) =>
    spinning && (i === 2 || elapsed < (i ? STOP2 : STOP1));
  const neighbour = (step: number) =>
    spinning ? stripAt(d.offset, elapsed + step * SPEED) : "";
  const o = d.outcome,
    doer =
      o?.card.target === "puller"
        ? puller
        : o?.card.target === "partner"
          ? partner
          : null,
    verifier = doer === null ? null : ((1 - doer) as Seat),
    who = (seat: Seat | null) =>
      seat === null
        ? "两个人一起"
        : seat === p.seat && !p.local
          ? "你"
          : nickname(p, seat);
  return (
    <section class="couple-new-stage slots-stage" data-testid="slots-stage">
      <header class="couple-bar">
        <b>
          第 {Math.min(d.pull + 1, d.maxPulls)}/{d.maxPulls} 次
        </b>
        <b class="slots-coins">🪙 {d.coins}</b>
        <span>
          🎫 {d.wishes[p.seat]}
          {p.local ? " / " + d.wishes[1 - p.seat] : ""}
        </span>
      </header>
      <div class={"slot-machine " + flash}>
        <div class="slot-marquee" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <i style={{ "--i": i }} />
          ))}
        </div>
        <h2 class="slot-title">月老老虎机</h2>
        <div class="slot-window">
          {[0, 1, 2].map((i) => (
            <div
              class={
                "slot-reel" +
                (turning(i) ? " turning" : "") +
                (i === 2 ? " fate" : "")
              }
              aria-label={"转轮" + (i + 1)}
            >
              {i === 2 && spinning && (
                <small class="slot-peek">{neighbour(1)}</small>
              )}
              <span class="slot-symbol">{reel(i)}</span>
              {i === 2 && spinning && (
                <small class="slot-peek">{neighbour(-1)}</small>
              )}
            </div>
          ))}
        </div>
        <p class="slot-strip" aria-label="第三个转轮的顺序">
          第三轮顺序：{strip.join(" → ")} → …
        </p>
        <div class="slot-floats" aria-hidden="true">
          {floats.map((f) => (
            <span key={f.id} style={{ left: f.x + "%" }}>
              {f.emoji}
            </span>
          ))}
        </div>
      </div>
      {d.phase === "bet" &&
        (controls(puller) ? (
          <div class="slot-controls">
            <p>
              {p.local ? nickname(p, puller) + "，" : ""}
              轮到你拉杆！押几枚爱心币？
            </p>
            <div class="game-actions">
              {[1, 2, 3].map((n) => (
                <button
                  class={"chip" + (bet === n ? " selected" : "")}
                  aria-pressed={bet === n}
                  disabled={n > d.coins}
                  onClick={() => setBet(n)}
                >
                  押 {n}
                </button>
              ))}
            </div>
            <button
              class="primary slot-lever"
              disabled={p.disabled || bet > d.coins}
              onClick={() => {
                sfx.lever();
                void act("spin", { pull: d.pull, bet }, puller);
              }}
            >
              拉下拉杆 🎰
            </button>
          </div>
        ) : (
          <p class="slot-wait">
            等 {nickname(p, puller)} 拉杆…你等下要负责喊停哦
          </p>
        ))}
      {spinning &&
        (controls(partner) ? (
          <div class="slot-controls">
            <p>
              {p.local ? nickname(p, partner) + "：" : ""}
              {elapsed < STOP2
                ? "看前两个转轮停在什么…"
                : `看准时机！想帮 TA 凑三连，还是…故意的？`}
            </p>
            <button
              class="primary slot-stop"
              disabled={p.disabled || elapsed < STOP2}
              onClick={() => {
                sfx.stop();
                void act(
                  "stop",
                  { pull: d.pull, at: p.transport.now() },
                  partner,
                );
              }}
            >
              停！
            </button>
          </div>
        ) : (
          <p class="slot-wait">
            第三个转轮的命运在 {nickname(p, partner)} 手里…🙏
          </p>
        ))}
      {d.phase === "task" && o && (
        <div class={"slot-result" + (o.jackpot ? " jackpot" : "")}>
          <h3>
            {o.name}{" "}
            <span class={o.delta > 0 ? "plus" : o.delta < 0 ? "minus" : ""}>
              {o.delta > 0 ? "+" : ""}
              {o.delta} 🪙
            </span>
          </h3>
          <div class="fate-card">
            <small>命运卡 · {who(doer)}</small>
            <p>{o.card.text}</p>
          </div>
          <div class="game-actions">
            {(verifier === null ? true : controls(verifier)) && (
              <button
                class="primary"
                disabled={p.disabled}
                onClick={() =>
                  void act("done", { pull: d.pull }, verifier ?? p.seat)
                }
              >
                {verifier === null ? "我们做到啦 +1🪙" : "TA 做到了 +1🪙"}
              </button>
            )}
            {(doer === null || controls(doer)) && (
              <button
                class="secondary"
                disabled={p.disabled}
                onClick={() =>
                  void act("skip", { pull: d.pull }, doer ?? p.seat)
                }
              >
                耍赖跳过 -2🪙
              </button>
            )}
          </div>
          {verifier !== null && !controls(verifier) && (
            <p class="muted">做完后由 {nickname(p, verifier)} 来确认</p>
          )}
        </div>
      )}
      <div class="slot-reactions" aria-label="表情">
        {reactions.map((emoji) => (
          <button
            class="chip"
            disabled={p.disabled}
            onClick={() => void send("react", { emoji })}
          >
            {emoji}
          </button>
        ))}
      </div>
      {d.log.length > 0 && (
        <ol class="slot-log" aria-label="最近的转动">
          {[...d.log].reverse().map((x: any) => (
            <li>
              <span>{nickname(p, x.seat)}</span>
              <b>{x.reels.join("")}</b>
              <span>
                {x.name} {x.delta > 0 ? "+" : ""}
                {x.delta}
              </span>
            </li>
          ))}
        </ol>
      )}
      <p class="muted slot-legend">
        {symbols.map((s) => s + symbolNames[s]).join(" · ")}
      </p>
    </section>
  );
}
