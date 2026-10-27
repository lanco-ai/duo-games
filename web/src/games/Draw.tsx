import { useEffect, useRef, useState } from "preact/hooks";
import {
  useGame,
  useEvents,
  useLatest,
  useFrame,
  nickname,
  type GameProps,
} from "./common";
import { api } from "../api";
import { paint, type Stroke } from "./drawing";
import { Critter } from "../art/ui";
import { canvasPoint } from "./canvas-point";
import { randomId } from "../random";
const palette = [
  "#292B3D",
  "#F05267",
  "#F5B83D",
  "#46A77C",
  "#4099DD",
  "#9270C4",
  "#F18B48",
  "#FFFFFF",
];
export default function Draw(p: GameProps) {
  const d = p.view.data,
    send = useGame(p),
    canvas = useRef<HTMLCanvasElement>(null),
    strokes = useRef<Stroke[]>([]),
    active = useRef<{ id: string; points: number[]; offset: number } | null>(
      null,
    ),
    events = useRef<any[]>([]),
    ready = useRef(false),
    latest = useLatest(p),
    [color, setColor] = useState(palette[0]),
    [size, setSize] = useState(10),
    [guess, setGuess] = useState(""),
    [clear, setClear] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  function apply(e: any) {
    if (e.round !== latest.current.view.data.round) return;
    if (e.op === "start") {
      if (!strokes.current.some((s) => s.id === e.stroke.id))
        strokes.current.push(e.stroke);
    } else if (e.op === "points") {
      const s = strokes.current.find((s) => s.id === e.id);
      if (s && s.points.length === e.offset) {
        s.points.push(...e.points);
        s.times.push(...Array(e.points.length / 2).fill(e.at));
      }
    } else if (e.op === "clear") strokes.current = [];
    else if (e.op === "undo") strokes.current.pop();
  }
  useEffect(
    () =>
      p.transport.subscribe((m) => {
        if (m.t === "welcome") setRevision((v) => v + 1);
      }),
    [p.transport],
  );
  useEvents(p, (e) => {
    if (e.kind === "ink") {
      if (ready.current) apply(e.data);
      else events.current.push(e.data);
    }
  });
  useEffect(() => {
    let cancelled = false;
    ready.current = false;
    setLoading(true);
    active.current = null;
    events.current = [];
    strokes.current = [];
    api(
      "rooms/" + p.code + "/game-data?run=" + p.view.run + "&kind=drawing",
      "GET",
      undefined,
      p.token,
    )
      .then((data) => {
        if (cancelled) return;
        strokes.current = data.strokes;
        for (const e of events.current)
          if (e.revision > data.revision) apply(e);
        events.current = [];
        ready.current = true;
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [p.view.run, d.round, revision]);
  const stream = (data: any) =>
    p.transport.send({
      t: "stream",
      run: p.view.run,
      kind: "ink",
      data: { round: d.round, ...data },
    });
  function flush() {
    const a = active.current;
    if (a && a.points.length) {
      stream({
        op: "points",
        id: a.id,
        offset: a.offset,
        points: a.points.splice(0),
      });
      a.offset =
        strokes.current.find((s) => s.id === a.id)?.points.length || a.offset;
    }
  }
  useEffect(() => {
    const timer = setInterval(flush, 40);
    return () => clearInterval(timer);
  }, [p.view.run, d.round]);
  useFrame(() => {
    const c = canvas.current?.getContext("2d");
    if (c)
      paint(
        c,
        strokes.current,
        p.seat === d.drawer ? Infinity : p.transport.now() - 120,
      );
  });
  function point(e: PointerEvent) {
    const point = canvasPoint(canvas.current!, e, 1000, 1000);
    return [
      Math.round(Math.max(0, Math.min(1000, point.x))),
      Math.round(Math.max(0, Math.min(1000, point.y))),
    ];
  }
  function add(e: PointerEvent) {
    const a = active.current;
    if (!a) return;
    const s = strokes.current.find((s) => s.id === a.id)!;
    const [x, y] = point(e),
      len = s.points.length;
    if (len && Math.hypot(x - s.points[len - 2], y - s.points[len - 1]) < 3)
      return;
    s.points.push(x, y);
    s.times.push(p.transport.now());
    a.points.push(x, y);
    if (a.points.length >= 120) flush();
  }
  const mine = d.drawer === p.seat;
  return (
    <section class="extra-stage drawing-stage" data-testid="draw-stage">
      <div class="stage-score">
        <span>
          第 {d.round + 1}/{d.total} 轮 · {nickname(p, d.drawer)}画
        </span>
        <b>{d.score} 分</b>
      </div>
      {d.phase === "choosing" ? (
        <div class="word-choices">
          <Critter
            avatar={p.room.profiles[d.drawer as 0 | 1]?.avatar}
            color={p.room.profiles[d.drawer as 0 | 1]?.color || "#FF6B6B"}
            mood={mine ? "joy" : "normal"}
            pose={mine ? "up" : "stand"}
            size={84}
            class="hop"
          />
          <h2>{mine ? "选一个词，画给 TA 猜" : "TA 正在挑一个词…"}</h2>
          <p class="muted">
            {Math.max(0, Math.ceil((d.deadline - p.now) / 1000))} 秒后自动选词
          </p>
          {mine &&
            d.choices?.map((word: any, i: number) => (
              <button
                class="choice"
                disabled={p.disabled}
                onClick={() =>
                  void send("choose", { round: d.round, index: i })
                }
              >
                <strong>{word.w}</strong>
                <small>
                  <span class="stars">{"★".repeat(i + 1)}</span>{" "}
                  {["简单", "中等", "挑战"][i]} · {word.lvl} 分
                </small>
              </button>
            ))}
        </div>
      ) : (
        <>
          <div class="draw-prompt">
            <strong>
              {d.phase === "reveal"
                ? "答案：" + d.answer
                : mine
                  ? "请画：" + d.answer
                  : d.letters
                    ? d.letters +
                      " 个字" +
                      (d.category ? " · " + d.category : "")
                    : "看 TA 的画，猜一个词"}
            </strong>
            <span>
              {d.phase === "reveal"
                ? "+" + d.roundPoints + " 分"
                : Math.max(0, Math.ceil((d.deadline - p.now) / 1000)) + " 秒"}
            </span>
          </div>
          <canvas
            ref={canvas}
            width={1000}
            height={1000}
            class="drawing-canvas"
            aria-label="双人画板"
            onPointerDown={(e) => {
              if (!mine || p.disabled || d.phase !== "drawing" || loading)
                return;
              e.currentTarget.setPointerCapture(e.pointerId);
              const id = randomId();
              const stroke: Stroke = {
                id,
                color,
                size,
                points: [],
                times: [],
                at: p.transport.now(),
              };
              strokes.current.push(stroke);
              active.current = { id, points: [], offset: 0 };
              stream({ op: "start", id, color, size });
              add(e);
            }}
            onPointerMove={(e) => add(e)}
            onPointerUp={() => {
              if (active.current) {
                flush();
                stream({ op: "end", id: active.current.id });
                active.current = null;
              }
            }}
            onPointerCancel={() => {
              flush();
              active.current = null;
            }}
          />
          {mine && d.phase === "drawing" && (
            <div class="draw-tools">
              <div class="ink-palette">
                {palette.map((c) => (
                  <button
                    aria-label={c === "#FFFFFF" ? "橡皮" : "画笔颜色" + c}
                    aria-pressed={color === c}
                    style={{ background: c }}
                    onClick={() => {
                      setColor(c);
                      if (c === "#FFFFFF") setSize(22);
                    }}
                    class={color === c ? "active" : ""}
                  />
                ))}
              </div>
              <div class="game-actions">
                {[4, 10, 22].map((n, i) => (
                  <button
                    class={size === n ? "chip active" : "chip"}
                    onClick={() => setSize(n)}
                  >
                    {["细", "中", "粗"][i]}
                  </button>
                ))}
                <button
                  class="secondary small"
                  onClick={() => void send("undo", { round: d.round })}
                >
                  撤销
                </button>
                <button class="secondary small" onClick={() => setClear(true)}>
                  清空
                </button>
              </div>
              {clear && (
                <div class="agreement">
                  <span>清空这张画布？</span>
                  <button
                    class="secondary"
                    onClick={() => {
                      setClear(false);
                      void send("clear", { round: d.round });
                    }}
                  >
                    确认清空
                  </button>
                  <button class="text-button" onClick={() => setClear(false)}>
                    保留
                  </button>
                </div>
              )}
            </div>
          )}
          {!mine && d.phase === "drawing" && (
            <form
              class="guess-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  guess.trim() &&
                  (await send("guess", { round: d.round, text: guess }))
                )
                  setGuess("");
              }}
            >
              <input
                aria-label="猜一个词"
                maxLength={30}
                value={guess}
                onInput={(e) => setGuess(e.currentTarget.value)}
                placeholder="我猜是…"
              />
              <button class="primary" disabled={p.disabled || !guess.trim()}>
                猜一猜
              </button>
            </form>
          )}
          <div class="guesses" aria-live="polite">
            {d.guesses.map((g: any) => (
              <p>
                {mine ? "TA 猜：" : ""}
                {g.text} {g.correct ? "✓ 猜中了！" : g.near ? "很接近了！" : ""}
              </p>
            ))}
          </div>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
