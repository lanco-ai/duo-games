// Scenery for 颠颠爱心: the backdrop travels with the combo, from an afternoon
// park to a sunset beach, a windy rooftop with fireworks and the aurora.
import { INK, cloud, hills, stars, star, heart } from "../art/paint";
export const bounceStages = [
  { from: 0, name: "午后公园", tip: "轻轻颠，慢慢来" },
  { from: 10, name: "黄昏海边", tip: "太阳落山了，别让爱心掉进海里" },
  { from: 30, name: "起风的天台", tip: "起风了！爱心会被吹偏" },
  { from: 50, name: "极光之夜", tip: "你们已经是传说了" },
];
export function stageFor(combo: number) {
  let i = 0;
  bounceStages.forEach((s, k) => {
    if (combo >= s.from) i = k;
  });
  return i;
}
type G = CanvasRenderingContext2D;
function gradient(g: G, h: number, stops: string[]) {
  const s = g.createLinearGradient(0, 0, 0, h);
  stops.forEach((c, i) => s.addColorStop(i / (stops.length - 1), c));
  return s;
}
function tree(g: G, x: number, y: number, s: number) {
  g.fillStyle = "#8A5A31";
  g.fillRect(x - 4 * s, y - 26 * s, 8 * s, 26 * s);
  g.fillStyle = "#5DBB4A";
  g.strokeStyle = INK;
  g.lineWidth = 2.5;
  for (const [dx, dy, r] of [
    [0, -44, 20],
    [-14, -32, 15],
    [14, -32, 15],
  ]) {
    g.beginPath();
    g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
}
function park(g: G, W: number, time: number) {
  g.fillStyle = gradient(g, 640, ["#56B6FF", "#9FD9FF", "#DDF4FF"]);
  g.fillRect(0, 0, W, 640);
  g.fillStyle = "#FFE680";
  g.beginPath();
  g.arc(300, 80, 30, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 4; i++)
    cloud(
      g,
      ((i * 131 + time * 0.006) % (W + 160)) - 100,
      50 + i * 90,
      90,
      0.95,
    );
  hills(g, W, 500, 70);
  tree(g, 40, 560, 1.1);
  tree(g, 320, 556, 0.9);
  ground(g, W, "#6FCB45", "#A8703F");
}
function beach(g: G, W: number, time: number) {
  g.fillStyle = gradient(g, 640, ["#7D7BFF", "#FF9CC2", "#FFD59E"]);
  g.fillRect(0, 0, W, 640);
  g.fillStyle = "#FF8A5B";
  g.beginPath();
  g.arc(W / 2, 470, 60, Math.PI, 0);
  g.fill();
  for (let i = 0; i < 3; i++)
    cloud(g, ((i * 151 - time * 0.004) % (W + 160)) + 40, 70 + i * 70, 70, 0.6);
  g.fillStyle = "#3D7DD8";
  g.fillRect(0, 470, W, 134);
  g.strokeStyle = "rgba(255,255,255,.55)";
  g.lineWidth = 2;
  for (let row = 0; row < 5; row++) {
    g.beginPath();
    for (let x = 0; x <= W; x += 8)
      g.lineTo(x, 490 + row * 24 + Math.sin(x / 22 + time / 500 + row) * 3);
    g.stroke();
  }
  g.fillStyle = "rgba(255,200,120,.45)";
  g.fillRect(W / 2 - 40, 475, 80, 4);
  g.fillRect(W / 2 - 25, 490, 50, 3);
  // A palm tree on the shore.
  g.strokeStyle = "#7A4A22";
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(330, 604);
  g.quadraticCurveTo(316, 540, 330, 500);
  g.stroke();
  g.fillStyle = "#3E9E4A";
  for (const a of [-2.6, -2, -1.2, -0.5]) {
    g.save();
    g.translate(330, 500);
    g.rotate(a);
    g.beginPath();
    g.ellipse(22, 0, 26, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  ground(g, W, "#F7DFA3", "#E2BE77");
}
function rooftop(g: G, W: number, time: number, wind: number) {
  g.fillStyle = gradient(g, 640, ["#0E1238", "#2A2D6E", "#5B3E8C"]);
  g.fillRect(0, 0, W, 640);
  stars(g, W, 360, time);
  // Fireworks bloom every couple of seconds at seeded spots.
  for (let k = 0; k < 2; k++) {
    const cycle = (time + k * 1100) / 2200,
      n = Math.floor(cycle),
      t = cycle - n,
      x = 60 + ((n * 97 + k * 131) % 240),
      y = 90 + ((n * 53 + k * 41) % 140),
      color = ["#FFD23F", "#FF6FB5", "#7DE2FF", "#B197FC"][(n + k) % 4];
    g.globalAlpha = Math.max(0, 1 - t);
    g.strokeStyle = color;
    g.lineWidth = 2.5;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(x + Math.cos(a) * 40 * t * 0.4, y + Math.sin(a) * 40 * t * 0.4);
      g.lineTo(x + Math.cos(a) * 46 * t, y + Math.sin(a) * 46 * t + t * t * 10);
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  // City skyline with lit windows.
  const towers = [
    [0, 420, 50],
    [46, 380, 44],
    [86, 440, 60],
    [140, 360, 40],
    [176, 410, 56],
    [228, 390, 48],
    [272, 430, 40],
    [308, 370, 52],
  ];
  for (const [x, top, w] of towers) {
    g.fillStyle = "#1B1A3F";
    g.fillRect(x, top, w, 604 - top);
    g.fillStyle = "#FFD97A";
    for (let wy = top + 12; wy < 590; wy += 18)
      for (let wx = x + 7; wx < x + w - 8; wx += 12)
        if ((wx * 7 + wy * 3) % 5 < 2) g.fillRect(wx, wy, 5, 7);
  }
  // Wind streaks show which way the heart will drift.
  if (wind) {
    g.strokeStyle = "rgba(255,255,255,.35)";
    g.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const y = 140 + i * 60,
        x =
          ((((time * 0.25 * Math.sign(wind) + i * 80) % (W + 80)) + W + 80) %
            (W + 80)) -
          40;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 30 * Math.sign(wind), y);
      g.stroke();
    }
  }
  ground(g, W, "#8A8FA8", "#5B607A");
}
function aurora(g: G, W: number, time: number) {
  g.fillStyle = gradient(g, 640, ["#061428", "#0E2A4A", "#1C3E5E"]);
  g.fillRect(0, 0, W, 640);
  stars(g, W, 400, time);
  for (let band = 0; band < 3; band++) {
    g.fillStyle = [
      "rgba(90,255,180,.22)",
      "rgba(120,200,255,.18)",
      "rgba(200,120,255,.16)",
    ][band];
    g.beginPath();
    g.moveTo(0, 140 + band * 40);
    for (let x = 0; x <= W; x += 10)
      g.lineTo(x, 120 + band * 40 + Math.sin(x / 50 + time / 900 + band) * 30);
    for (let x = W; x >= 0; x -= 10)
      g.lineTo(x, 200 + band * 40 + Math.sin(x / 40 + time / 700 + band) * 20);
    g.fill();
  }
  // Snowy mountains.
  g.fillStyle = "#2B4A6E";
  g.beginPath();
  g.moveTo(0, 520);
  g.lineTo(80, 420);
  g.lineTo(160, 510);
  g.lineTo(250, 400);
  g.lineTo(360, 500);
  g.lineTo(360, 604);
  g.lineTo(0, 604);
  g.fill();
  g.fillStyle = "#EAF4FF";
  for (const [x, y] of [
    [80, 420],
    [250, 400],
  ]) {
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - 22, y + 26);
    g.lineTo(x + 22, y + 26);
    g.fill();
  }
  ground(g, W, "#F4FAFF", "#C9DCEE");
}
function ground(g: G, W: number, top: string, body: string) {
  g.fillStyle = body;
  g.fillRect(0, 612, W, 40);
  g.fillStyle = top;
  g.fillRect(0, 603, W, 12);
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, 603);
  g.lineTo(W, 603);
  g.stroke();
}
export function drawBounceScene(
  g: G,
  W: number,
  stage: number,
  time: number,
  wind: number,
) {
  [park, beach, (g: G, W: number, t: number) => rooftop(g, W, t, wind), aurora][
    stage
  ](g, W, time);
}
/** Top HUD: big combo and the milestone track toward 10 / 25 / 50. */
export function drawBounceHud(
  g: G,
  W: number,
  combo: number,
  best: number,
  bump: number,
) {
  const night = combo >= 30;
  g.textAlign = "center";
  g.font = `${44 + bump * 14}px "DuoDisplay", sans-serif`;
  g.lineWidth = 6;
  g.strokeStyle = night ? "#1B1A3F" : "#FFFFFF";
  g.strokeText(String(combo), W / 2, 62);
  g.fillStyle = combo >= 10 ? "#FF4D6A" : "#3A2618";
  g.fillText(String(combo), W / 2, 62);
  g.font = '13px "DuoDisplay", sans-serif';
  g.fillStyle = night ? "#FFFFFF" : "#6B4F3A";
  g.fillText("连击", W / 2, 80);
  // Milestone track.
  const x0 = 40,
    x1 = W - 40,
    y = 98,
    goal = 50,
    k = Math.min(1, Math.max(combo, 0) / goal);
  g.fillStyle = "rgba(255,255,255,.55)";
  g.beginPath();
  g.roundRect(x0, y - 4, x1 - x0, 8, 4);
  g.fill();
  g.fillStyle = "#FF8FB1";
  g.beginPath();
  g.roundRect(x0, y - 4, (x1 - x0) * k, 8, 4);
  g.fill();
  for (const m of [10, 25, 50]) {
    const mx = x0 + ((x1 - x0) * m) / goal;
    star(g, mx, y, 9, best >= m ? "#FFD23F" : "#FFFFFF", INK);
  }
}
