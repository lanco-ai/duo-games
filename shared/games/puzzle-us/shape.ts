import { mulberry32 } from "../../rng";
export function dimensions(count: number, ratio: number) {
  let [cols, rows] = (
    { 24: [4, 6], 48: [6, 8], 96: [8, 12], 150: [10, 15] } as Record<
      number,
      number[]
    >
  )[count];
  if (ratio >= 1) [cols, rows] = [rows, cols];
  const width = 720,
    height = width / ratio;
  return { cols, rows, width, height, pw: width / cols, ph: height / rows };
}
export function edges(cols: number, rows: number, seed: number) {
  const rng = mulberry32(seed),
    horizontal = Array.from({ length: (rows - 1) * cols }, () => ({
      sign: rng() < 0.5 ? -1 : 1,
      jitter: (rng() - 0.5) * 0.06,
    })),
    vertical = Array.from({ length: rows * (cols - 1) }, () => ({
      sign: rng() < 0.5 ? -1 : 1,
      jitter: (rng() - 0.5) * 0.06,
    }));
  return { horizontal, vertical };
}
/** Neighboring pieces share the same cubic contour with opposite traversal. */
export function outline(
  id: number,
  cols: number,
  rows: number,
  pw: number,
  ph: number,
  seed: number,
) {
  const e = edges(cols, rows, seed),
    x = id % cols,
    y = Math.floor(id / cols),
    p = new Path2D();
  p.moveTo(0, 0);
  const side = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    edge: { sign: number; jitter: number } | undefined,
    normal: number,
  ) => {
    if (!edge) {
      p.lineTo(x1, y1);
      return;
    }
    const dx = x1 - x0,
      dy = y1 - y0,
      len = Math.hypot(dx, dy),
      nx = (-dy / len) * normal * edge.sign,
      ny = (dx / len) * normal * edge.sign,
      tab = Math.min(pw, ph) * 0.19,
      c = 0.5 + edge.jitter;
    const point = (t: number, n: number) => [
      x0 + dx * t + nx * n,
      y0 + dy * t + ny * n,
    ];
    const line = point(c - 0.19, 0);
    p.lineTo(line[0], line[1]);
    for (const [a, b, end] of [
      [
        [c - 0.12, 0],
        [c - 0.18, tab],
        [c - 0.07, tab],
      ],
      [
        [c, tab * 1.15],
        [c + 0.18, tab],
        [c + 0.14, tab * 0.35],
      ],
      [
        [c + 0.1, 0],
        [c + 0.16, 0],
        [c + 0.19, 0],
      ],
    ] as number[][][]) {
      const c1 = point(a[0], a[1]),
        c2 = point(b[0], b[1]),
        q = point(end[0], end[1]);
      p.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], q[0], q[1]);
    }
    p.lineTo(x1, y1);
  };
  // Build canonical edges in forward direction and reverse the control sequence
  // on bottom/left by using a translated, mirrored path below.
  const canonical = (
    x0: number,
    y0: number,
    dx: number,
    dy: number,
    edge: { sign: number; jitter: number } | undefined,
    reverse: boolean,
  ) => {
    if (!edge) {
      p.lineTo(x0 + dx, y0 + dy);
      return;
    }
    const n = Math.min(pw, ph) * 0.19 * edge.sign,
      c = 0.5 + edge.jitter,
      ux = dy === 0 ? 0 : 1,
      uy = dx === 0 ? 0 : 1;
    const pts = [
      [0, 0],
      [c - 0.19, 0],
      [c - 0.12, 0],
      [c - 0.18, n],
      [c - 0.07, n],
      [c, n * 1.15],
      [c + 0.18, n],
      [c + 0.14, n * 0.35],
      [c + 0.1, 0],
      [c + 0.16, 0],
      [c + 0.19, 0],
      [1, 0],
    ];
    const map = ([t, v]: number[]) => [
      x0 + dx * t + ux * v,
      y0 + dy * t + uy * v,
    ];
    if (!reverse) {
      let q = map(pts[1]);
      p.lineTo(q[0], q[1]);
      for (let i = 2; i <= 8; i += 3) {
        const a = map(pts[i]),
          b = map(pts[i + 1]),
          c = map(pts[i + 2]);
        p.bezierCurveTo(a[0], a[1], b[0], b[1], c[0], c[1]);
      }
      const q2 = map(pts[11]);
      p.lineTo(q2[0], q2[1]);
    } else {
      let q = map(pts[10]);
      p.lineTo(q[0], q[1]);
      for (let i = 9; i >= 3; i -= 3) {
        const a = map(pts[i]),
          b = map(pts[i - 1]),
          c = map(pts[i - 2]);
        p.bezierCurveTo(a[0], a[1], b[0], b[1], c[0], c[1]);
      }
      const q2 = map(pts[0]);
      p.lineTo(q2[0], q2[1]);
    }
  };
  canonical(
    0,
    0,
    pw,
    0,
    y ? e.horizontal[(y - 1) * cols + x] : undefined,
    false,
  );
  canonical(
    pw,
    0,
    0,
    ph,
    x < cols - 1 ? e.vertical[y * (cols - 1) + x] : undefined,
    false,
  );
  if (y < rows - 1) canonical(0, ph, pw, 0, e.horizontal[y * cols + x], true);
  else p.lineTo(0, ph);
  if (x) canonical(0, 0, 0, ph, e.vertical[y * (cols - 1) + x - 1], true);
  else p.lineTo(0, 0);
  p.closePath();
  return p;
}
