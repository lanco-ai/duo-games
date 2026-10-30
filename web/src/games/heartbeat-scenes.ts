// Venues for 心跳节拍: each song plays somewhere different.
import { INK, stars } from "../art/paint";
type G = CanvasRenderingContext2D;
export const venues: Record<string, { name: string; floor: [string, string] }> =
  {
    meet: { name: "黄昏的学校天台", floor: ["#9aa3b5", "#7b8396"] },
    date: { name: "夜晚的游乐园", floor: ["#3d2f5c", "#2a2044"] },
    heart: { name: "两个人的演唱会", floor: ["#2b1830", "#1a0e1e"] },
  };
function fill(g: G, h: number, stops: string[]) {
  const s = g.createLinearGradient(0, 0, 0, h);
  stops.forEach((c, i) => s.addColorStop(i / (stops.length - 1), c));
  g.fillStyle = s;
}
function rooftop(g: G, w: number, h: number, now: number) {
  fill(g, h, ["#6f6fd8", "#ff9cc2", "#ffd59e"]);
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#ff8a5b";
  g.beginPath();
  g.arc(w / 2, 300, 54, Math.PI, 0);
  g.fill();
  // Distant town.
  g.fillStyle = "rgba(90,60,120,.45)";
  for (let i = 0; i < 9; i++) {
    const bw = 30 + ((i * 17) % 20),
      bh = 40 + ((i * 29) % 50);
    g.fillRect(i * 42 - 6, 300 - bh, bw, bh);
  }
  // Railing.
  g.strokeStyle = "rgba(60,50,70,.55)";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, 300);
  g.lineTo(w, 300);
  g.stroke();
  for (let x = 10; x < w; x += 24) {
    g.beginPath();
    g.moveTo(x, 300);
    g.lineTo(x, 330);
    g.stroke();
  }
  // Falling cherry petals.
  for (let i = 0; i < 14; i++) {
    const t = (now / 9000 + i / 14) % 1,
      x = (((i * 53 + Math.sin(now / 900 + i) * 30) % w) + w) % w,
      y = t * h;
    g.fillStyle = "#ffc2d6";
    g.beginPath();
    g.ellipse(x, y, 4, 2.5, now / 500 + i, 0, Math.PI * 2);
    g.fill();
  }
}
function park(g: G, w: number, h: number, now: number, pulse: number) {
  fill(g, h, ["#0f1640", "#2b2a6e", "#5a3a8c"]);
  g.fillRect(0, 0, w, h);
  stars(g, w, 200, now);
  // Ferris wheel turning with lit cabins.
  const cx = 280,
    cy = 170,
    r = 92,
    a0 = now / 6000;
  g.strokeStyle = "rgba(255,255,255,.35)";
  g.lineWidth = 2;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 10; i++) {
    const a = a0 + (i / 10) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    g.stroke();
    g.fillStyle = ["#ff6fb5", "#ffd23f", "#7de2ff", "#b197fc"][i % 4];
    g.globalAlpha = 0.6 + pulse * 0.4;
    g.beginPath();
    g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 7, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }
  g.strokeStyle = "rgba(255,255,255,.4)";
  g.beginPath();
  g.moveTo(cx - 40, 330);
  g.lineTo(cx, cy);
  g.lineTo(cx + 40, 330);
  g.stroke();
  // Neon carousel roof.
  g.fillStyle = "rgba(255,111,181,.35)";
  g.beginPath();
  g.moveTo(20, 300);
  g.lineTo(80, 250);
  g.lineTo(140, 300);
  g.fill();
  for (let i = 0; i < 7; i++) {
    g.fillStyle = (i + Math.floor(now / 250)) % 2 ? "#ffe066" : "#ff8fb1";
    g.beginPath();
    g.arc(24 + i * 19, 302, 3, 0, Math.PI * 2);
    g.fill();
  }
}
function concert(
  g: G,
  w: number,
  h: number,
  now: number,
  pulse: number,
  chorus: boolean,
) {
  fill(g, h, ["#07040f", "#1d0f2e", "#3a1640"]);
  g.fillRect(0, 0, w, h);
  // Sweeping spotlights.
  const colors = chorus
    ? ["rgba(255,210,63,.22)", "rgba(255,111,181,.22)", "rgba(125,226,255,.22)"]
    : [
        "rgba(177,151,252,.16)",
        "rgba(255,111,181,.14)",
        "rgba(125,226,255,.12)",
      ];
  colors.forEach((c, i) => {
    const sx = 40 + i * 140,
      a = Math.sin(now / (1400 + i * 300) + i) * 0.5;
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(sx, 0);
    g.lineTo(sx + Math.sin(a) * 200 - 60, 340);
    g.lineTo(sx + Math.sin(a) * 200 + 60, 340);
    g.fill();
  });
  // Curtains.
  g.fillStyle = "#8a1f3b";
  for (const side of [0, 1]) {
    g.beginPath();
    const x = side ? w : 0,
      dir = side ? -1 : 1;
    g.moveTo(x, 0);
    g.lineTo(x + dir * 34, 0);
    g.quadraticCurveTo(x + dir * 14, 160, x + dir * 26, 340);
    g.lineTo(x, 340);
    g.fill();
  }
  g.fillRect(0, 0, w, 16);
  // Crowd with light sticks bobbing on the beat.
  for (let i = 0; i < 16; i++) {
    const x = 8 + i * 23,
      bob = pulse * (i % 2 ? 4 : 6);
    g.fillStyle = "#120a1a";
    g.beginPath();
    g.arc(x, 352 - bob, 10, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = ["#ff6fb5", "#7de2ff", "#ffd23f"][i % 3];
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x + 6, 346 - bob);
    g.lineTo(x + 12, 328 - bob - pulse * 4);
    g.stroke();
  }
}
export function drawVenue(
  g: G,
  track: string,
  w: number,
  h: number,
  now: number,
  pulse: number,
  chorus: boolean,
) {
  if (track === "date") park(g, w, h, now, pulse);
  else if (track === "heart") concert(g, w, h, now, pulse, chorus);
  else rooftop(g, w, h, now);
  if (chorus) {
    // Confetti rain during the chorus.
    for (let i = 0; i < 26; i++) {
      const t = (now / 2600 + i / 26) % 1;
      g.fillStyle = ["#ffd23f", "#ff6fb5", "#7de2ff", "#8ce99a"][i % 4];
      g.save();
      g.translate((i * 37) % w, t * 360);
      g.rotate(now / 300 + i);
      g.fillRect(-3, -1.5, 6, 3);
      g.restore();
    }
  }
}
export function drawFloor(
  g: G,
  track: string,
  w: number,
  h: number,
  top: number,
) {
  const [a, b] = venues[track]?.floor || venues.meet.floor;
  g.fillStyle = a;
  g.fillRect(0, top, w, h - top);
  g.fillStyle = b;
  for (let i = 0; i < w; i += 30) g.fillRect(i, top, 2, h - top);
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, top);
  g.lineTo(w, top);
  g.stroke();
}
/** A heartbeat trace scrolling across the top, spiking on every beat. */
export function drawPulseLine(
  g: G,
  w: number,
  time: number,
  beat: number,
  synced: boolean,
) {
  g.save();
  g.strokeStyle = synced ? "#ff4d6a" : "rgba(255,255,255,.75)";
  g.lineWidth = 2.5;
  g.shadowColor = synced ? "#ff4d6a" : "#ffffff";
  g.shadowBlur = 8;
  g.beginPath();
  for (let x = 0; x <= w; x += 3) {
    const t = time - (w - x) * 6,
      phase = (((t % beat) + beat) % beat) / beat,
      spike =
        phase < 0.06
          ? -Math.sin((phase / 0.06) * Math.PI) * 16
          : phase < 0.12
            ? Math.sin(((phase - 0.06) / 0.06) * Math.PI) * 8
            : 0;
    if (x === 0) g.moveTo(x, 30 + spike);
    else g.lineTo(x, 30 + spike);
  }
  g.stroke();
  g.restore();
}
