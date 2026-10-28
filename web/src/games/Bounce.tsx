import { useEffect, useRef, useState } from "preact/hooks";
import * as sim from "../../../shared/games/heart-bounce/sim";
import { useEvents, useFrame, useGame, typing, type GameProps } from "./common";
import { drawCritter, kindOf } from "../art/critter";
import {
  INK,
  chunkyText,
  cloud,
  fitCanvas,
  heart,
  heartPath,
  hills,
  sky,
  star,
} from "../art/paint";
interface Burst {
  x: number;
  y: number;
  at: number;
  text: string;
  color: string;
}
export default function Bounce(p: GameProps) {
  const d = p.view.data,
    canvas = useRef<HTMLCanvasElement>(null),
    local = useRef(180),
    remote = useRef(180),
    shown = useRef(180),
    keys = useRef(0),
    pending = useRef(-1),
    previous = useRef(0),
    lastSend = useRef(0),
    send = useGame(p),
    [flight, setFlight] = useState(d),
    f = useRef(d),
    renderPos = useRef<{ x: number; y: number } | null>(null),
    bursts = useRef<Burst[]>([]),
    lastN = useRef(d.hit.n),
    lastLives = useRef(d.lives),
    spin = useRef(0);
  useEffect(() => {
    f.current = d;
    setFlight(d);
    pending.current = -1;
    previous.current = Math.max(
      0,
      Math.floor((p.transport.now() - d.startAt) * 0.06) - 1,
    );
  }, [d.hit.n, d.epoch, d.startAt, d.wideUntil, d.star?.x, d.star?.y]);
  useEvents(p, (e) => {
    if (e.kind === "flight") {
      f.current = e.data;
      setFlight(e.data);
      pending.current = -1;
    }
    if (e.kind === "paddle" && e.data.seat !== p.seat)
      remote.current = e.data.x;
  });
  useEffect(() => {
    const key = (e: KeyboardEvent, on: boolean) => {
      if (typing(e.target)) return;
      const bit = ["ArrowLeft", "a", "A"].includes(e.key)
        ? 1
        : ["ArrowRight", "d", "D"].includes(e.key)
          ? 2
          : 0;
      if (bit) {
        e.preventDefault();
        keys.current = on ? keys.current | bit : keys.current & ~bit;
      }
    };
    const down = (e: KeyboardEvent) => key(e, true),
      up = (e: KeyboardEvent) => key(e, false),
      blur = () => {
        keys.current = 0;
      };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
  const paddleWidth = (
    at = d.paused ? d.startAt + (d.pausedTick / 60) * 1000 : p.transport.now(),
  ) =>
    at < (f.current.wideUntil || 0)
      ? Math.round(sim.PADDLE_WIDTH * 1.6)
      : sim.PADDLE_WIDTH;
  useFrame((time) => {
    const c = canvas.current,
      ctx = c?.getContext("2d");
    if (!ctx || !c) return;
    const v = f.current,
      tick = p.disabled
        ? d.paused
          ? d.pausedTick
          : previous.current
        : Math.max(0, Math.floor((p.transport.now() - v.startAt) * 0.06));
    if (!p.disabled) {
      local.current = sim.paddleX(
        local.current +
          ((keys.current & 2 ? 1 : 0) - (keys.current & 1 ? 1 : 0)) * 5,
        paddleWidth(),
      );
      if (time - lastSend.current > 50) {
        p.transport.send({
          t: "stream",
          run: p.view.run,
          kind: "cur",
          data: { epoch: v.epoch, x: local.current },
        });
        lastSend.current = time;
      }
      if (v.owner === p.seat && pending.current !== v.hit.n) {
        const crossing = sim.paddleTick(v.hit);
        if (
          crossing > previous.current &&
          crossing <= tick &&
          sim.canHit(
            v.hit,
            crossing,
            local.current,
            paddleWidth(v.startAt + (crossing / 60) * 1000),
          )
        ) {
          pending.current = v.hit.n;
          const next = sim.makeHit(
            v.hit,
            crossing,
            local.current,
            v.combo + 1,
            v.seed,
            paddleWidth(v.startAt + (crossing / 60) * 1000),
          )!;
          f.current = {
            ...v,
            hit: next,
            owner: 1 - p.seat,
            combo: v.combo + 1,
          };
          void send("hit", {
            epoch: v.epoch,
            n: v.hit.n,
            tick: crossing,
            x: local.current,
          }).then((ok) => {
            if (!ok) {
              f.current = v;
              pending.current = -1;
            }
          });
        } else if (tick >= sim.missTick(v.hit)) {
          pending.current = v.hit.n;
          void send("miss", { epoch: v.epoch, n: v.hit.n, tick }).then((ok) => {
            if (!ok) pending.current = -1;
          });
        }
      }
      previous.current = tick;
    }
    shown.current += (remote.current - shown.current) * 0.14;
    const W = sim.WIDTH,
      H = sim.HEIGHT,
      g = fitCanvas(c, W, H);
    sky(g, W, H, "day");
    for (let i = 0; i < 5; i++)
      cloud(
        g,
        ((i * 131 + time * 0.006 * (i % 2 ? 1 : -1)) % (W + 160)) - 100,
        40 + i * 88,
        80 + (i % 3) * 30,
        0.95,
      );
    hills(g, W, 520, 70);
    g.fillStyle = "#A8703F";
    g.fillRect(0, 612, W, 40);
    g.fillStyle = "#6FCB45";
    g.fillRect(0, 604, W, 12);
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 603);
    g.lineTo(W, 603);
    g.stroke();
    const active = f.current.owner,
      positions =
        p.seat === 0
          ? [local.current, shown.current]
          : [shown.current, local.current];
    const fl = f.current;
    if (fl.hit.n !== lastN.current) {
      if (fl.hit.n > lastN.current && fl.combo > 0)
        bursts.current.push({
          x: positions[1 - fl.owner],
          y: sim.PADDLE_Y - 14,
          at: time,
          text: fl.combo + " 连击！",
          color: "#FFD23F",
        });
      lastN.current = fl.hit.n;
    }
    if (fl.lives < lastLives.current)
      bursts.current.push({
        x: W / 2,
        y: 300,
        at: time,
        text: "哎呀，掉了！",
        color: "#FF8FB1",
      });
    lastLives.current = fl.lives;
    positions.forEach((x, i) => {
      const mine = active === i,
        prof = p.room.profiles[i as 0 | 1],
        color = prof?.color || (i ? "#4D9DFF" : "#FF6B6B");
      g.save();
      g.globalAlpha = mine ? 1 : 0.5;
      if (mine) {
        g.fillStyle = "rgba(255,255,255,.55)";
        g.beginPath();
        g.ellipse(x, 606, 44, 9, 0, 0, Math.PI * 2);
        g.fill();
      }
      drawCritter(g, kindOf(prof?.avatar), color, x, 616, 62, {
        mood: mine ? "wow" : "joy",
        pose: "up",
        alpha: mine ? 1 : 0.75,
      });
      g.fillStyle = color;
      g.strokeStyle = INK;
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(x - paddleWidth() / 2, sim.PADDLE_Y, paddleWidth(), 12, 6);
      g.fill();
      g.stroke();
      g.fillStyle = "rgba(255,255,255,.6)";
      g.beginPath();
      g.roundRect(
        x - paddleWidth() / 2 + 6,
        sim.PADDLE_Y + 2.5,
        paddleWidth() - 12,
        3,
        1.5,
      );
      g.fill();
      g.restore();
    });
    if (v.star) star(g, v.star.x, v.star.y, 18);
    const b = sim.ballAt(f.current.hit, tick),
      target = { x: b.x / 256, y: b.y / 256 };
    if (
      active !== p.seat &&
      target.y > 558 &&
      tick < sim.paddleTick(f.current.hit) + 30
    )
      target.y = 558;
    renderPos.current ??= target;
    renderPos.current = {
      x: renderPos.current.x + (target.x - renderPos.current.x) * 0.48,
      y: renderPos.current.y + (target.y - renderPos.current.y) * 0.48,
    };
    const ball = renderPos.current,
      ownerColor =
        p.room.profiles[active as 0 | 1]?.color ||
        (active ? "#4D9DFF" : "#FF6B6B"),
      lift = Math.max(0, Math.min(1, (606 - ball.y) / 520));
    g.fillStyle = "rgba(40,30,20," + (0.25 - lift * 0.15) + ")";
    g.beginPath();
    g.ellipse(ball.x, 607, 16 - lift * 8, 4 - lift * 2, 0, 0, Math.PI * 2);
    g.fill();
    spin.current += (f.current.hit.vx / 256) * 0.012;
    g.save();
    g.translate(ball.x, ball.y);
    g.rotate(Math.sin(spin.current) * 0.35);
    g.shadowColor = ownerColor;
    g.shadowBlur = 18;
    g.fillStyle = "#FF4D6A";
    g.fill(heartPath(0, 2, 15));
    g.shadowBlur = 0;
    heart(g, 0, 2, 15, "#FF4D6A", INK);
    g.restore();
    g.strokeStyle = ownerColor;
    g.lineWidth = 3;
    g.setLineDash([2, 6]);
    g.beginPath();
    g.arc(ball.x, ball.y + 1, 23, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    bursts.current = bursts.current.filter((e) => time - e.at < 900);
    for (const e of bursts.current) {
      const k = (time - e.at) / 900;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        star(
          g,
          e.x + Math.cos(a) * 34 * k,
          e.y + Math.sin(a) * 34 * k,
          6 * (1 - k),
          "#FFE066",
          INK,
        );
      }
      g.globalAlpha = 1 - k;
      chunkyText(g, e.text, e.x, e.y - 30 - k * 40, 22, e.color, "#7A3A0A");
      g.globalAlpha = 1;
    }
    chunkyText(
      g,
      active === p.seat ? "轮到你接！" : "TA 来接～",
      W / 2,
      632,
      16,
      "#FFFFFF",
      "#6B4F3A",
    );
  });
  function move(e: PointerEvent) {
    if (p.disabled) return;
    const r = canvas.current!.getBoundingClientRect();
    local.current = sim.paddleX(
      ((e.clientX - r.left) / r.width) * 360,
      paddleWidth(),
    );
  }
  return (
    <section class="action-game bounce-game">
      <div class="game-mini-stats">
        <span class="heart-pill" aria-label="剩余爱心">
          {"♥".repeat(flight.lives)}
          {"♡".repeat(3 - flight.lives)}
        </span>
        <strong>
          {flight.combo} 连击 ·{" "}
          {"★".repeat(
            flight.best >= 50
              ? 3
              : flight.best >= 25
                ? 2
                : flight.best >= 10
                  ? 1
                  : 0,
          )}
        </strong>
        <span>{flight.score} 分</span>
      </div>
      <p class="muted">
        目标 10 / 25 / 50 连击；每 15 连击出现星星，碰到后托盘变宽 10 秒。
      </p>
      <div class="bounce-stage">
        <canvas
          ref={canvas}
          aria-label="颠爱心画面，左右拖动接球"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            move(e);
          }}
          onPointerMove={move}
        />
      </div>
      <p class="game-status">
        {flight.owner === p.seat
          ? "轮到你，左右拖动接住爱心"
          : "看 TA 接住，然后轮到你 ♥"}
      </p>
      <p class="keyboard-help">拖动画面 / 鼠标移动 / ← →，同一人不能连续接球</p>
    </section>
  );
}
