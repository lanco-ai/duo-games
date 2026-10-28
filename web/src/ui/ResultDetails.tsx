export default function ResultDetails({
  game,
  stats,
}: {
  game: string;
  stats: Record<string, number>;
}) {
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
