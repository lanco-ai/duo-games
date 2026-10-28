import { useRef, useState, useEffect } from "preact/hooks";
import type { GameProps } from "./common";
import { useGame } from "./common";
import { jumpLevels } from "../../../shared/games/couple-jump/levels";
function Charge({
  label,
  disabled,
  sequence,
  attempt,
  send,
  onPreview,
}: {
  label: string;
  disabled: boolean;
  sequence: number;
  attempt: number;
  send: (c: string, p: any) => Promise<boolean>;
  onPreview: (ms: number) => void;
}) {
  const held = useRef(false),
    at = useRef(0),
    n = useRef(0),
    press = useRef<Promise<boolean>>(),
    [active, setActive] = useState(false);
  const up = () => {
    if (!held.current) return;
    held.current = false;
    setActive(false);
    if (disabled) return;
    const sequence = n.current;
    const heldMs = performance.now() - at.current;
    onPreview(heldMs);
    void Promise.resolve(press.current).then(
      (ok) => ok && send("release", { n: sequence, heldMs }),
    );
  };
  useEffect(() => {
    held.current = false;
    setActive(false);
  }, [disabled, attempt]);
  useEffect(
    () => () => {
      held.current = false;
    },
    [],
  );
  return (
    <button
      class={"charge-button" + (active ? " is-held" : "")}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        if (held.current) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        held.current = true;
        at.current = performance.now();
        n.current = Math.max(n.current + 1, sequence + 1);
        setActive(true);
        press.current = send("press", { n: n.current });
      }}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
    >
      {active ? "蓄力中…" : label}
    </button>
  );
}
type Flight = { distance: number; at: number; platforms: any[] };
export default function Jump(p: GameProps) {
  const d = p.view.data,
    send = useGame(p),
    [flights, setFlights] = useState<(Flight | null)[]>([null, null]),
    [frame, setFrame] = useState(performance.now()),
    clock = useRef(p.transport.now());
  if (!p.disabled) clock.current = p.transport.now();
  useEffect(() => {
    let id: number;
    const draw = () => {
      setFrame(performance.now());
      id = requestAnimationFrame(draw);
    };
    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (p.disabled) setFlights([null, null]);
  }, [p.disabled]);
  useEffect(() => {
    const last = d.last;
    if (!last?.landings || last.attempt !== d.attempt - 1 || p.disabled) return;
    const elapsed = Math.max(0, p.transport.now() - last.at);
    if (elapsed >= 650) return;
    setFlights((old) => {
      const next = [...old];
      (last.seats || [p.seat]).forEach((seat: number, i: number) => {
        const prior = old[seat],
          fresh = prior && performance.now() - prior.at < 550;
        next[seat] = {
          distance: last.landings[i].distance,
          at: fresh ? prior.at : performance.now() - elapsed,
          platforms: last.platforms || d.platforms,
        };
      });
      return next;
    });
  }, [d.attempt]);
  const active = (f: Flight | null) => (f && frame - f.at < 650 ? f : null),
    flight = flights.map(active).find(Boolean),
    platforms = flight
      ? flight.platforms
      : d.platforms.map((t: any) => ({
          ...t,
          x:
            t.baseX +
            Math.sin((clock.current - d.startAt) / 1300 + t.phase) *
              t.amplitude,
        })),
    animals = [0, 1].map((seat) => {
      const f = d.mode === "sync" ? active(flights[seat]) : flight,
        k = f ? Math.max(0, Math.min(1, (frame - f.at) / 650)) : 0,
        target = platforms[d.mode === "sync" ? seat : 0],
        offset = (seat ? 16 : -16) * (d.mode === "sync" ? 1 - k : 1);
      return {
        x: 70 + offset + (f ? f.distance * k : 0),
        y:
          225 +
          ((target?.y || 225) - 225) * k -
          Math.sin(k * Math.PI) * (seat ? 90 : 100),
      };
    });
  return (
    <section class="couple-new-stage jump-stage" data-testid="jump-stage">
      <header class="couple-bar">
        <b>
          {d.levelName} {d.step}/{d.total ?? "∞"}
        </b>
        <b>
          {"❤️".repeat(d.lives)} · {d.points}分
        </b>
      </header>
      <svg
        viewBox="0 0 500 290"
        role="img"
        aria-label="根据平台距离蓄力跳跃"
        style={{
          background: jumpLevels[d.level].sky,
          borderRadius: 24,
          width: "100%",
        }}
      >
        <text x="28" y="40" font-size="24">
          ☁️　　✨　　☁️
        </text>
        <path d="M0 280Q100 240 200 280T500 280" fill="#92c783" />
        <rect x="35" y="225" width="70" height="30" rx="12" fill="#b87953" />
        {platforms
          .slice(0, d.mode === "sync" ? 2 : 1)
          .map((t: any, i: number) => (
            <g>
              <rect
                data-testid={"jump-platform-" + i}
                data-distance={t.x}
                x={70 + t.x - t.width / 2}
                y={t.y}
                width={t.width}
                height="20"
                rx="8"
                fill={i ? "#ff9bb5" : "#8cccf0"}
              />
              <circle cx={70 + t.x} cy={t.y} r="5" fill="#fff" />
              <text x={65 + t.x} y={t.y - 12}>
                {t.heart ? "❤️" : i ? "🐻" : "🐰"}
              </text>
            </g>
          ))}
        <path
          d={`M${animals[0].x},${animals[0].y - 12} Q${(animals[0].x + animals[1].x) / 2},${Math.max(animals[0].y, animals[1].y) + 8} ${animals[1].x},${animals[1].y - 12}`}
          fill="none"
          stroke="#ed6684"
          stroke-width="3"
        />
        {animals.map((a, seat) => (
          <text
            data-testid={"jump-animal-" + seat}
            x={a.x - 12}
            y={a.y}
            font-size="28"
          >
            {seat ? "🐻" : "🐰"}
          </text>
        ))}
      </svg>
      <p>
        {d.mode === "sync"
          ? "各自瞄准对应平台，听口令一起松手"
          : "轮到玩家 " + ((d.step % 2) + 1) + "，看距离蓄力"}
      </p>
      {d.iceDeadline && <p>❄️ 冰面即将融化，快跳！</p>}
      <p aria-live="polite">
        {d.last
          ? d.last.perfect
            ? "💖 心有灵犀！"
            : d.last.landed
              ? "稳稳落地"
              : "再试一次，我们还有机会"
          : "不看秒表，靠眼睛和默契"}
      </p>
      {[p.seat, ...(p.local ? [p.local.seat] : [])].map((s) => (
        <Charge
          key={s}
          sequence={d.inputN?.[s] ?? -1}
          attempt={d.attempt}
          label={
            p.local
              ? s
                ? "🟥 玩家二：按住蓄力"
                : "🟦 玩家一：按住蓄力"
              : "按住蓄力 · 松开起跳"
          }
          disabled={
            p.disabled ||
            (d.last?.landings &&
              d.last.attempt === d.attempt - 1 &&
              clock.current < d.last.at + 650) ||
            (d.mode === "sync" ? !!active(flights[s]) : !!flight) ||
            (d.mode === "relay" && s !== d.step % 2) ||
            d.released[s]
          }
          send={(c, payload) =>
            s === p.seat
              ? send(c, payload)
              : p.local!.send({
                  type: "game",
                  run: p.view.run,
                  command: c,
                  payload,
                })
          }
          onPreview={(ms) =>
            setFlights((old) => {
              const next = [...old];
              next[s] = {
                distance: Math.min(ms, 2200) * 0.25,
                at: performance.now(),
                platforms,
              };
              return next;
            })
          }
        />
      ))}
    </section>
  );
}
