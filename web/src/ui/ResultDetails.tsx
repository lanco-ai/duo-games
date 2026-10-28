import { radarAxes } from "../../../shared/games/radar";
export default function ResultDetails({
  game,
  stats,
}: {
  game: string;
  stats: Record<string, number>;
}) {
  if (game === "know-me" || game === "mind-meld")
    return <Radar stats={stats} />;
  if (game !== "gomoku" || stats.win0 === undefined) return null;
  const cells = Array.from({ length: 5 }, (_, i) => stats["win" + i]),
    point = (c: number) =>
      `${20 + (c % 15) * 20},${20 + Math.floor(c / 15) * 20}`;
  return (
    <figure class="result-board">
      <figcaption>最后的五子连心</figcaption>
      <svg viewBox="0 0 320 320" role="img" aria-label="获胜的五枚棋子连线">
        <rect width="320" height="320" rx="16" fill="#fff2d9" />
        {Array.from({ length: 15 }, (_, i) => (
          <path
            d={`M20 ${20 + i * 20}H300 M${20 + i * 20} 20V300`}
            fill="none"
            stroke="#dfc8a1"
          />
        ))}
        {cells.map((c) => (
          <circle
            cx={20 + (c % 15) * 20}
            cy={20 + Math.floor(c / 15) * 20}
            r="8"
            fill={stats.winner === stats.blackSeat ? "#3c3542" : "#fff"}
            stroke="#51445a"
          />
        ))}
        <polyline
          points={cells.map(point).join(" ")}
          fill="none"
          stroke="#ff6b6b"
          stroke-width="4"
          pathLength="1"
          stroke-dasharray="1"
          style={{ animation: "winning-line 1s ease-out both" }}
        />
      </svg>
      <style>{`@keyframes winning-line{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}.result-board{max-width:280px;margin:16px auto}.result-board svg{width:100%}@media(prefers-reduced-motion:reduce){.result-board polyline{animation:none!important}}`}</style>
    </figure>
  );
}

function Radar({ stats }: { stats: Record<string, number> }) {
  const point = (i: number, value: number) => {
      const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
      return [150 + Math.cos(angle) * value, 150 + Math.sin(angle) * value];
    },
    points = (radius: number) =>
      radarAxes.map((_, i) => point(i, radius).join(",")).join(" "),
    covered = radarAxes.map(([key]) => (stats[`radar_${key}_count`] || 0) > 0);
  return (
    <figure
      class="compatibility-radar"
      style={{ maxWidth: 340, margin: "16px auto" }}
    >
      <figcaption>默契雷达图</figcaption>
      <svg
        viewBox="0 0 300 300"
        role="img"
        aria-label="本局五维默契统计；未覆盖维度留空"
      >
        {[25, 50, 75, 100].map((r) => (
          <polygon points={points(r)} fill="none" stroke="#e0d7eb" />
        ))}
        {radarAxes.map(([key, label], i) => {
          const end = point(i, 100),
            text = point(i, 126),
            value = point(i, stats[`radar_${key}`] || 0);
          return (
            <g>
              <path d={`M150 150L${end.join(" ")}`} stroke="#e0d7eb" />
              <text
                x={text[0]}
                y={text[1]}
                text-anchor="middle"
                dominant-baseline="middle"
                font-size="14"
                fill="#51445a"
              >
                {label}
              </text>
              {covered[i] && (
                <>
                  <path
                    d={`M150 150L${value.join(" ")}`}
                    stroke="#9670dc"
                    stroke-width="4"
                  />
                  <circle cx={value[0]} cy={value[1]} r="5" fill="#ff6b6b" />
                </>
              )}
            </g>
          );
        })}
        {covered.every(Boolean) && (
          <polygon
            points={radarAxes
              .map(([key], i) => point(i, stats[`radar_${key}`]).join(","))
              .join(" ")}
            fill="#9670dc33"
            stroke="#9670dc"
            stroke-width="2"
          />
        )}
      </svg>
      <div class="radar-values">
        {radarAxes.map(([key, label]) => (
          <span style={{ display: "inline-block", margin: "4px 8px" }}>
            {label}：
            {stats[`radar_${key}_count`]
              ? `${stats[`radar_${key}`]}%（${stats[`radar_${key}_count`]}题/轮）`
              : "未覆盖"}
          </span>
        ))}
      </div>
      <p class="muted">只统计本局已揭晓的题目或主题词轮次，未覆盖不计分。</p>
    </figure>
  );
}
