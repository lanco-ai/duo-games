import { localStore } from "../storage";
// Tiny synthesized sound effects; created lazily on the first user gesture.
let ctx: AudioContext | undefined;
function audio() {
  if (localStore.getItem("duo.sound") === "off") return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return;
  }
}
function note(
  hz: number,
  delay: number,
  duration: number,
  type: OscillatorType = "triangle",
  gain = 0.12,
  slide?: number,
) {
  const a = audio();
  if (!a) return;
  const at = a.currentTime + delay,
    o = a.createOscillator(),
    g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(hz, at);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, at + duration);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  o.connect(g).connect(a.destination);
  o.start(at);
  o.stop(at + duration + 0.02);
}
const melody = (notes: number[], step: number, type?: OscillatorType) =>
  notes.forEach((hz, i) => note(hz, i * step, step * 1.6, type));
export const sfx = {
  step: () => note(520, 0, 0.06, "sine", 0.05),
  bump: () => note(180, 0, 0.16, "square", 0.07, 90),
  fall: () => note(600, 0, 0.5, "sawtooth", 0.06, 80),
  spooky: () => {
    note(300, 0, 0.35, "sine", 0.08, 160);
    note(240, 0.12, 0.4, "sine", 0.06, 120);
  },
  key: () => melody([880, 1175], 0.08),
  heart: () => melody([784, 988, 1319], 0.07, "sine"),
  ping: () => note(1046, 0, 0.12, "sine", 0.06),
  win: () => melody([523, 659, 784, 1046, 1319], 0.1),
  tick: () => note(1400, 0, 0.025, "square", 0.025),
  lever: () => note(140, 0, 0.25, "sawtooth", 0.06, 60),
  stop: () => note(330, 0, 0.09, "square", 0.08),
  coin: () => melody([1319, 1760], 0.06, "square"),
  jackpot: () =>
    melody([523, 659, 784, 1046, 784, 1046, 1319, 1568], 0.09, "square"),
  sad: () => melody([392, 330, 262], 0.16, "sine"),
};
