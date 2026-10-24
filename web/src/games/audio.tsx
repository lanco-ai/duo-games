import { useEffect, useRef, useState } from "preact/hooks";
let context: AudioContext | undefined;
export function audioContext() {
  return context;
}
export function unlockMusic() {
  if (!context) context = new AudioContext();
  void context.resume();
  return context;
}
window.addEventListener("duo-audio-unlock", unlockMusic);
function tone(
  ctx: AudioContext,
  at: number,
  hz: number,
  duration: number,
  type: OscillatorType,
  gain: number,
  end?: number,
) {
  const o = ctx.createOscillator(),
    g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(hz, at);
  if (end) o.frequency.exponentialRampToValueAtTime(end, at + duration);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  o.connect(g).connect(ctx.destination);
  o.start(at);
  o.stop(at + duration + 0.02);
}
function noise(
  ctx: AudioContext,
  at: number,
  duration: number,
  type: BiquadFilterType,
  freq: number,
  gain: number,
) {
  const buffer = ctx.createBuffer(
      1,
      Math.ceil(ctx.sampleRate * duration),
      ctx.sampleRate,
    ),
    a = buffer.getChannelData(0);
  let seed = 12345;
  for (let i = 0; i < a.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    a[i] = seed / 2147483648 - 1;
  }
  const source = ctx.createBufferSource(),
    filter = ctx.createBiquadFilter(),
    g = ctx.createGain();
  source.buffer = buffer;
  filter.type = type;
  filter.frequency.value = freq;
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(filter).connect(g).connect(ctx.destination);
  source.start(at);
  source.stop(at + duration);
}
export function scheduleBeat(
  ctx: AudioContext,
  at: number,
  halfBeat: number,
  bpm: number,
) {
  if (localStorage.getItem("duo.sound") === "off") return;
  const beat = halfBeat / 2,
    unit = 60 / bpm,
    chord = [130.81, 174.61, 146.83, 196][Math.floor(beat / 16) % 4];
  noise(ctx, at, 0.045, "highpass", 7000, 0.035);
  if (halfBeat % 2 === 0) {
    if (beat % 2 === 0) tone(ctx, at, 130, 0.16, "sine", 0.22, 42);
    else noise(ctx, at, 0.12, "bandpass", 1700, 0.13);
    tone(ctx, at, chord / 2, unit * 0.65, "triangle", 0.075);
  }
  if (halfBeat % 8 === 0) {
    for (const ratio of [1, 1.25, 1.5])
      tone(ctx, at, chord * ratio, unit * 3.7, "sine", 0.025);
  }
  if (halfBeat % 2 === 1) {
    const melody = [2, 2.5, 3, 2.5, 2, 1.5, 1.25, 1.5][
      Math.floor(halfBeat / 2) % 8
    ];
    tone(ctx, at, chord * melody, unit * 0.3, "square", 0.018);
  }
}
export function clickBeat(ctx: AudioContext, at: number) {
  tone(ctx, at, 880, 0.05, "sine", 0.2);
}
export function Calibration() {
  const [running, setRunning] = useState(false),
    [count, setCount] = useState(0),
    [pulse, setPulse] = useState(0),
    [offset, setOffset] = useState(localStorage.getItem("duo.inputOffset")),
    start = useRef(0),
    deltas = useRef(new Map<number, number>()),
    timer = useRef<ReturnType<typeof setInterval>>();
  useEffect(() => () => clearInterval(timer.current), []);
  function begin() {
    const ctx = unlockMusic();
    deltas.current.clear();
    setCount(0);
    setRunning(true);
    start.current = ctx.currentTime + 1;
    for (let i = 0; i < 8; i++) clickBeat(ctx, start.current + i);
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      setPulse(
        Math.max(
          0,
          Math.min(8, Math.floor(ctx.currentTime - start.current) + 1),
        ),
      );
      if (ctx.currentTime > start.current + 8.3) {
        clearInterval(timer.current);
        setRunning(false);
      }
    }, 35);
  }
  function tap() {
    const ctx = audioContext();
    if (!ctx || !running) return;
    const elapsed = ctx.currentTime - start.current,
      index = Math.round(elapsed);
    if (
      index < 0 ||
      index > 7 ||
      Math.abs(elapsed - index) > 0.45 ||
      deltas.current.has(index)
    )
      return;
    deltas.current.set(index, (elapsed - index) * 1000);
    setCount(deltas.current.size);
    if (deltas.current.size === 8) {
      const values = [...deltas.current.values()].sort((a, b) => a - b),
        result = String(
          Math.round(
            Math.max(-200, Math.min(200, (values[3] + values[4]) / 2)),
          ),
        );
      localStorage.setItem("duo.inputOffset", result);
      setOffset(result);
      setRunning(false);
      clearInterval(timer.current);
    }
  }
  return (
    <div class="calibration">
      <h3>找到你的节拍</h3>
      <p class="muted">跟着提示音点 8 下，约 10 秒。每台设备只需校准一次。</p>
      {running ? (
        <button
          class={"calibration-pad pulse-" + (pulse % 2)}
          onPointerDown={tap}
          onKeyDown={(e) => {
            if ([" ", "Enter"].includes(e.key)) {
              e.preventDefault();
              tap();
            }
          }}
        >
          ♡<span>跟着声音点 · {count}/8</span>
        </button>
      ) : (
        <button class="secondary" onClick={begin}>
          {offset === null ? "开始 8 次节拍校准" : "✓ 已校准 · 再校准一次"}
        </button>
      )}
      {offset !== null && <small>输入补偿 {offset}ms · 已保存在这台设备</small>}
    </div>
  );
}
