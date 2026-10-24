export interface Stroke {
  id: string;
  color: string;
  size: number;
  points: number[];
  at: number;
  times: number[];
}
export function paint(
  c: CanvasRenderingContext2D,
  strokes: Stroke[],
  cutoff = Infinity,
) {
  c.save();
  c.fillStyle = "#fff";
  c.fillRect(0, 0, 1000, 1000);
  c.lineCap = "round";
  c.lineJoin = "round";
  for (const s of strokes) {
    let count = s.points.length / 2;
    if (cutoff !== Infinity && s.times?.length)
      count = s.times.filter((t) => t <= cutoff).length;
    if (!count) continue;
    c.strokeStyle = s.color;
    c.fillStyle = s.color;
    c.lineWidth = s.size;
    c.beginPath();
    c.moveTo(s.points[0], s.points[1]);
    if (count === 1) {
      c.arc(s.points[0], s.points[1], s.size / 2, 0, Math.PI * 2);
      c.fill();
      continue;
    }
    for (let i = 1; i < count - 1; i++)
      c.quadraticCurveTo(
        s.points[i * 2],
        s.points[i * 2 + 1],
        (s.points[i * 2] + s.points[(i + 1) * 2]) / 2,
        (s.points[i * 2 + 1] + s.points[(i + 1) * 2 + 1]) / 2,
      );
    c.lineTo(s.points[(count - 1) * 2], s.points[(count - 1) * 2 + 1]);
    c.stroke();
  }
  c.restore();
}
