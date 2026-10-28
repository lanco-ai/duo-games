import { useRef, useState, useEffect } from "preact/hooks";
import type { GameProps } from "./common";
import { useGame } from "./common";
import { jumpLevels } from "../../../shared/games/couple-jump/levels";
function Charge({
  label,
  disabled,
  send,
  onPreview,
}: {
  label: string;
  disabled: boolean;
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
    const heldMs = performance.now() - at.current;
    onPreview(heldMs);
    void Promise.resolve(press.current).then(
      (ok) => ok && send("release", { n: n.current, heldMs }),
    );
  };
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
        n.current++;
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
export default function Jump(p: GameProps) {
  const d = p.view.data,
    send = useGame(p),
    [preview, setPreview] = useState<{ distance: number; at: number } | null>(
      null,
    ),
    [frame, setFrame] = useState(0);
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
    if (d.last?.landings && preview && performance.now() - preview.at < 550) {
      const landing = d.last.landings[d.mode === "sync" ? p.seat : 0];
      setPreview({ ...preview, distance: landing.distance });
    }
  }, [d.attempt]);
  const elapsed = preview ? Math.min(1, (frame - preview.at) / 650) : 1,
    animalX = preview ? 70 + preview.distance * elapsed : 70,
    animalY = preview ? -Math.sin(elapsed * Math.PI) * 100 : 0;
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
        {d.platforms
          .map((t: any) => ({
            ...t,
            x:
              t.baseX +
              Math.sin((p.transport.now() - d.startAt) / 1300 + t.phase) *
                t.amplitude,
          }))
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
          d={"M" + animalX + "," + (210 + animalY) + " Q90,180 90,215"}
          fill="none"
          stroke="#ed6684"
          stroke-width="3"
        />
        <text x={animalX - 12} y={215 + animalY} font-size="30">
          {p.seat ? "🐻" : "🐰"}
        </text>
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
          label={
            p.local
              ? s
                ? "🟥 玩家二：按住蓄力"
                : "🟦 玩家一：按住蓄力"
              : "按住蓄力 · 松开起跳"
          }
          disabled={
            p.disabled ||
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
            setPreview({
              distance: Math.min(ms, 2200) * 0.25,
              at: performance.now(),
            })
          }
        />
      ))}
    </section>
  );
}
