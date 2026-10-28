import { localStore } from "../storage";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  chart,
  grade,
  type TrackId,
  type RhythmDifficulty,
} from "../../../shared/games/heartbeat/chart";
import {
  useGame,
  useEvents,
  useFrame,
  useLatest,
  typing,
  type GameProps,
} from "./common";
import { audioContext, unlockMusic, scheduleBeat } from "./audio";
import { drawCritter, kindOf } from "../art/critter";
import { INK, chunkyText, fitCanvas, heart, stars } from "../art/paint";
const LANE_COLORS = [
  ["#FF8FB1", "#FF4D7E"],
  ["#8FD3FF", "#3FA9F5"],
];
export default function Heartbeat(p: GameProps) {
  const d = p.view.data,
    song = useMemo(
      () => chart(d.track as TrackId, d.difficulty as RhythmDifficulty),
      [d.track, d.difficulty],
    ),
    send = useGame(p),
    latest = useLatest(p),
    canvas = useRef<HTMLCanvasElement>(null),
    flashes = useRef([0, 0]),
    pops = useRef<{ lane: number; text: string; at: number }[]>([]),
    judged = useRef(new Map<number, number>(d.own)),
    pending = useRef<[number, number][]>([]),
    held = useRef(new Map<number, { id: number; grade: number }>()),
    pointers = useRef(new Map<number, number>()),
    anchor = useRef<number | null>(null),
    nextSound = useRef(0),
    [feedback, setFeedback] = useState(""),
    [sync, setSync] = useState(false),
    [score, setScore] = useState(
      (d.own as [number, number][]).reduce((n, x) => n + x[1], 0),
    ),
    [muted, setMuted] = useState(localStore.getItem("duo.sound") === "off");
  const elapsed = () => {
    const ctx = audioContext();
    return ctx?.state === "running" && anchor.current !== null
      ? (ctx.currentTime - anchor.current) * 1000
      : latest.current.transport.now() - d.startAt;
  };
  useEffect(() => {
    const ctx = audioContext();
    if (ctx) {
      anchor.current = ctx.currentTime + (d.startAt - p.transport.now()) / 1000;
      const align = () => {
        if (ctx.state === "running")
          anchor.current =
            ctx.currentTime + (d.startAt - p.transport.now()) / 1000;
      };
      ctx.addEventListener("statechange", align);
      return () => ctx.removeEventListener("statechange", align);
    }
  }, [d.startAt]);
  useEffect(() => {
    const interval = setInterval(() => {
      if (latest.current.disabled) return;
      const ctx = audioContext();
      if (ctx?.state === "running") {
        const now = elapsed(),
          half = song.beat / 2;
        nextSound.current = Math.max(nextSound.current, Math.floor(now / half));
        while (
          nextSound.current * half < now + 100 &&
          nextSound.current * half < song.duration - 1000
        ) {
          const ms = nextSound.current * half;
          if (ms >= now - 10)
            scheduleBeat(
              ctx,
              Math.max(ctx.currentTime, ctx.currentTime + (ms - now) / 1000),
              nextSound.current,
              song.bpm,
            );
          nextSound.current++;
        }
      }
    }, 25);
    return () => clearInterval(interval);
  }, [p.view.run]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (pending.current.length && !latest.current.disabled) {
        const entries = pending.current.splice(0, 32);
        void send("results", { entries }).then((ok) => {
          if (!ok) pending.current.unshift(...entries);
        });
      }
    }, 250);
    return () => clearInterval(timer);
  }, [p.view.run]);
  useEvents(p, (e) => {
    if (e.kind === "sync") {
      setSync(true);
      setTimeout(() => setSync(false), 450);
    }
  });
  function judge(id: number, g: number) {
    if (judged.current.has(id)) return;
    judged.current.set(id, g);
    pending.current.push([id, g]);
    setScore((v) => v + g);
  }
  function release(lane: number, eventTime = performance.now()) {
    const holding = held.current.get(lane);
    if (!holding || latest.current.disabled) return;
    held.current.delete(lane);
    const n = song.notes[holding.id],
      time = elapsed() - (Number(localStore.getItem("duo.inputOffset")) || 0);
    judge(
      n.id,
      time >= n.ms + (n.duration || 0) - 135
        ? Math.min(holding.grade, grade(time - n.ms - (n.duration || 0)))
        : 0,
    );
  }
  function hit(lane: number, eventTime = performance.now()) {
    if (held.current.has(lane)) return;
    if (latest.current.disabled || document.hidden) return;
    const ctx = audioContext();
    if (!ctx || ctx.state !== "running") {
      unlockMusic();
      if (ctx)
        anchor.current =
          ctx.currentTime + (d.startAt - p.transport.now()) / 1000;
      return;
    }
    const offset = Number(localStore.getItem("duo.inputOffset")) || 0,
      ts =
        Math.abs(eventTime - performance.now()) < 10000
          ? eventTime
          : performance.now(),
      time = elapsed() - (performance.now() - ts) - offset;
    const candidate = song.notes
      .filter(
        (n) =>
          n.seats.includes(p.seat) &&
          n.lane === lane &&
          !judged.current.has(n.id) &&
          Math.abs(n.ms - time) <= 135,
      )
      .sort((a, b) => Math.abs(a.ms - time) - Math.abs(b.ms - time))[0];
    flashes.current[lane] = performance.now();
    if (candidate) {
      const g = grade(time - candidate.ms);
      if (candidate.kind === "hold")
        held.current.set(lane, { id: candidate.id, grade: g });
      else judge(candidate.id, g);
      const label = ["Miss", "Good", "Great", "Perfect"][g];
      setFeedback(label);
      pops.current.push({ lane, text: label, at: performance.now() });
    } else setFeedback("Miss");
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (typing(e.target) || e.repeat) return;
      if (["f", "F", "j", "J"].includes(e.key)) {
        e.preventDefault();
        hit(e.key.toLowerCase() === "f" ? 0 : 1, e.timeStamp);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (["f", "F", "j", "J"].includes(e.key))
        release(e.key.toLowerCase() === "f" ? 0 : 1, e.timeStamp);
    };
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", up);
    };
  }, [p.view.run]);
  useFrame(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    if (latest.current.disabled) return;
    const time = elapsed();
    for (const [lane, h] of held.current) {
      const n = song.notes[h.id];
      if (time >= n.ms + (n.duration || 0)) {
        judge(n.id, h.grade);
        held.current.delete(lane);
      }
    }
    for (const n of song.notes)
      if (
        n.seats.includes(p.seat) &&
        !judged.current.has(n.id) &&
        ![...held.current.values()].some((h) => h.id === n.id) &&
        time - (Number(localStore.getItem("duo.inputOffset")) || 0) > n.ms + 135
      )
        judge(n.id, 0);
    const w = 360,
      h = 440,
      line = 352,
      g = fitCanvas(canvas.current!, w, h),
      now = performance.now(),
      beatPhase = (((time % song.beat) + song.beat) % song.beat) / song.beat,
      pulse = time > 0 ? Math.max(0, 1 - beatPhase * 3) : 0;
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#141B45");
    bg.addColorStop(0.7, "#2B3479");
    bg.addColorStop(1, "#4D4FA3");
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    stars(g, w, h * 0.7, now, 0);
    for (let lane = 0; lane < 2; lane++) {
      const cx = lane * 180 + 90,
        [light, deep] = LANE_COLORS[lane],
        flash = Math.max(0, 1 - (now - flashes.current[lane]) / 220);
      const lg = g.createLinearGradient(0, 0, 0, line);
      lg.addColorStop(0, "rgba(255,255,255,0)");
      lg.addColorStop(1, light + "66");
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(cx - 26, 0);
      g.lineTo(cx + 26, 0);
      g.lineTo(cx + 62, line);
      g.lineTo(cx - 62, line);
      g.closePath();
      g.fill();
      if (flash) {
        g.fillStyle = "rgba(255,255,255," + flash * 0.35 + ")";
        g.fill();
      }
      g.strokeStyle = light + "AA";
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = "#FFFFFF";
      g.strokeStyle = INK;
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(cx, line, 46 + flash * 6, 16 + flash * 3, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = deep;
      g.beginPath();
      g.ellipse(cx, line, 36 + flash * 6, 10 + flash * 3, 0, 0, Math.PI * 2);
      g.fill();
    }
    const rainbow = [
      "#FF6B6B",
      "#FFA94D",
      "#FFE066",
      "#8CE99A",
      "#74C0FC",
      "#B197FC",
    ];
    rainbow.forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect(0, line - 7.5 + i * 2.5, w, 2.5);
    });
    for (const note of song.notes) {
      if (!note.seats.includes(p.seat) || judged.current.has(note.id)) continue;
      const y =
        held.current.get(note.lane)?.id === note.id
          ? line
          : line - (note.ms - time) * 0.16;
      if (y < -30 || y > h) continue;
      const k = Math.max(0.55, Math.min(1, 0.55 + (y / line) * 0.45)),
        x = note.lane * 180 + 90;
      if (note.kind === "hold") {
        g.strokeStyle = "#fbd777";
        g.lineWidth = 16 * k;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, line - (note.ms + (note.duration || 0) - time) * 0.16);
        g.stroke();
      }
      if (note.kind.startsWith("relay")) {
        g.fillStyle = "#99ffdd";
        g.font = "22px sans-serif";
        g.fillText(note.kind === "relay-head" ? "↗" : "↘", x, y - 18);
      }
      if (note.sync) {
        heart(g, x, y, 17 * k, "#FF4D6A", INK);
      } else {
        const [light, deep] = LANE_COLORS[note.lane];
        g.fillStyle = deep;
        g.strokeStyle = INK;
        g.lineWidth = 2.5;
        g.beginPath();
        g.roundRect(x - 26 * k, y - 11 * k, 52 * k, 22 * k, 11 * k);
        g.fill();
        g.stroke();
        g.fillStyle = light;
        g.beginPath();
        g.roundRect(x - 20 * k, y - 8 * k, 40 * k, 7 * k, 4 * k);
        g.fill();
      }
    }
    g.fillStyle = "#6B4423";
    g.fillRect(0, 388, w, h - 388);
    g.fillStyle = "#8A5A31";
    for (let i = 0; i < w; i += 40) g.fillRect(i, 388, 2, h - 388);
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 388);
    g.lineTo(w, 388);
    g.stroke();
    [p.seat, 1 - p.seat].forEach((seat, i) => {
      const prof = p.room.profiles[seat as 0 | 1],
        hop = pulse * (i ? 6 : 9);
      drawCritter(
        g,
        kindOf(prof?.avatar),
        prof?.color || (seat ? "#4D9DFF" : "#FF6B6B"),
        i ? 312 : 48,
        434 - hop,
        i ? 56 : 66,
        {
          mood: sync ? "joy" : "normal",
          pose: pulse > 0.5 ? "up" : "stand",
          facing: i ? -1 : 1,
          sx: 1 + pulse * 0.05,
          sy: 1 - pulse * 0.05,
        },
      );
    });
    pops.current = pops.current.filter((e) => now - e.at < 600);
    for (const e of pops.current) {
      const k = (now - e.at) / 600;
      g.globalAlpha = 1 - k;
      chunkyText(
        g,
        e.text,
        e.lane * 180 + 90,
        line - 46 - k * 30,
        e.text === "Perfect" ? 22 : 18,
        e.text === "Miss"
          ? "#C9C3D6"
          : e.text === "Perfect"
            ? "#FFE066"
            : "#FFFFFF",
        "#3A2618",
      );
      g.globalAlpha = 1;
    }
    if (sync) {
      heart(g, w / 2, 210, 38 + pulse * 6, "#FF4D6A", INK);
      chunkyText(g, "心跳同步！", w / 2, 270, 26, "#FFE066", "#7A1E2E");
    }
    g.fillStyle = "rgba(255,255,255,.75)";
    g.font = '13px "DuoLatin", "DuoDisplay", sans-serif';
    g.textAlign = "center";
    g.fillText("F · 左", 90, 380);
    g.fillText("J · 右", 270, 380);
  });
  return (
    <section class="extra-stage heartbeat-stage" data-testid="heartbeat-stage">
      <div class="stage-score">
        <span>
          {song.name} · {song.bpm} BPM ·{" "}
          {
            (
              { easy: "简单", normal: "普通", hard: "困难" } as Record<
                string,
                string
              >
            )[d.difficulty]
          }
        </span>
        <b>{score} 分</b>
      </div>
      <div class={"rhythm-field " + (sync ? "in-sync" : "")}>
        <canvas
          width={360}
          height={440}
          ref={canvas}
          aria-label="心跳节拍双轨道"
          onPointerDown={(e) => {
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect(),
              lane = e.clientX - rect.left < rect.width / 2 ? 0 : 1;
            pointers.current.set(e.pointerId, lane);
            e.currentTarget.setPointerCapture(e.pointerId);
            hit(lane, e.timeStamp);
          }}
          onPointerUp={(e) => {
            const lane = pointers.current.get(e.pointerId);
            if (lane !== undefined) release(lane, e.timeStamp);
            pointers.current.delete(e.pointerId);
          }}
          onPointerCancel={(e) => {
            const lane = pointers.current.get(e.pointerId);
            if (lane !== undefined) release(lane, e.timeStamp);
            pointers.current.delete(e.pointerId);
          }}
        />
        <div class="rhythm-feedback sr-only" aria-live="polite">
          {sync ? "♥ 心跳同步！" : feedback}
        </div>
      </div>
      <p class="game-status">
        {p.now >= d.startAt + song.duration
          ? "曲子结束啦，正在汇总两个人的节拍…"
          : "点左右轨道；金色尾巴按住到结束，箭头音符交给 TA 接力。"}
      </p>
      <button
        class="text-button light"
        onClick={() => {
          setMuted(!muted);
          localStore.setItem("duo.sound", muted ? "on" : "off");
          unlockMusic();
        }}
      >
        {muted ? "开启音乐" : "静音，只看画面"}
      </button>
      {audioContext()?.state !== "running" && (
        <button
          class="secondary"
          onClick={() => {
            const ctx = unlockMusic();
            anchor.current =
              ctx.currentTime + (d.startAt - p.transport.now()) / 1000;
          }}
        >
          点一下开启声音
        </button>
      )}
    </section>
  );
}
