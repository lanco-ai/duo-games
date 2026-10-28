import { useGame, type GameProps } from "./common";
export default function Difference(p: GameProps) {
  const d = p.view.data,
    send = useGame(p);
  function panel(objects: any[], label: string) {
    return (
      <div class="spot-panel">
        <b>{label}</b>
        <svg
          viewBox="0 0 100 100"
          aria-label={d.scene + label}
          role="img"
          style={{
            background: d.background,
            width: "100%",
            touchAction: "manipulation",
          }}
          onPointerDown={(e) => {
            if (p.disabled) return;
            const rect = e.currentTarget.getBoundingClientRect();
            void send("tap", {
              x: ((e.clientX - rect.left) / rect.width) * 100,
              y: ((e.clientY - rect.top) / rect.height) * 100,
            });
          }}
        >
          <rect
            x="2"
            y="12"
            width="96"
            height="85"
            fill="none"
            stroke="#b5886b"
            rx="5"
          />
          <path
            d={
              d.level === 4
                ? "M0 16 Q20 8 40 16T80 16T120 16"
                : "M0 14H100 M4 18H96"
            }
            fill="none"
            stroke={d.level === 4 ? "#4faada" : "#d0a979"}
            stroke-width="3"
            class={d.level === 4 ? "spot-waves" : ""}
          />
          {objects.map((o) => (
            <g
              data-id={o.id}
              data-found={
                d.found.some((f: any) => f.id === o.id) ? "yes" : "no"
              }
            >
              <rect
                x={o.x - 5}
                y={o.y - 7}
                width="10"
                height="12"
                rx="2"
                fill={o.color}
              />
              {o.pattern === "striped" &&
                [0, 1, 2].map((n) => (
                  <path
                    d={"M" + (o.x - 4 + n * 3) + "," + (o.y - 6) + "v10"}
                    stroke="#83378b"
                    stroke-width="2"
                  />
                ))}
              <text
                x={o.x}
                y={o.y}
                text-anchor="middle"
                dominant-baseline="middle"
                font-size={o.size}
              >
                {o.icon.repeat(o.count)}
              </text>
              <text x={o.x} y={o.y + 9} font-size="2.5" text-anchor="middle">
                {o.name}
                {o.direction < 0 ? " ◀" : " ▶"}
              </text>
            </g>
          ))}
          {d.found.map((f: any) => (
            <circle
              cx={f.x}
              cy={f.y}
              r="7"
              fill="none"
              stroke="#ef4c78"
              stroke-width="1"
            />
          ))}
          {d.lastMiss && (
            <circle
              cx={d.lastMiss.x}
              cy={d.lastMiss.y}
              r="6"
              fill="#f66"
              opacity=".45"
            />
          )}
        </svg>
      </div>
    );
  }
  return (
    <section class="couple-new-stage" data-testid="spot-stage">
      <header class="couple-bar">
        <b>
          {d.scene} · 找到 {d.found.length} / {d.total}
        </b>
        <b>{Math.max(0, Math.ceil((d.deadline - p.now) / 1000))}s</b>
      </header>
      <p>
        {d.mode === "easy"
          ? "教学：比较两幅图，点出不同"
          : "你只能看" + d.side + "，说给 TA 听，一起找不同"}
      </p>
      {d.images ? (
        <div>
          {panel(d.images[0], "原图")}
          {panel(d.images[1], "修改图")}
        </div>
      ) : (
        panel(d.objects, d.side)
      )}
      <div class="button-row">
        {["左上角", "桌子上", "有几个", "右边", "下面"].map((text) => (
          <button
            style={{ minHeight: 44 }}
            disabled={p.disabled}
            onClick={() => void send("signal", { text })}
          >
            {text}
          </button>
        ))}
      </div>
      {d.signal && <p aria-live="polite">TA：{d.signal.text}</p>}
    </section>
  );
}
