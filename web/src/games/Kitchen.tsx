import { useEffect, useRef, useState } from "preact/hooks";
import {
  useGame,
  useEvents,
  useFrame,
  useLatest,
  typing,
  type GameProps,
} from "./common";
import {
  walkable,
  recipes,
  foodIcons,
} from "../../../shared/games/coop-kitchen/levels";
export default function Kitchen(p: GameProps) {
  const d = p.view.data,
    send = useGame(p),
    latest = useLatest(p),
    positions = useRef(d.players.map((v: any) => ({ x: v.x, y: v.y }))),
    dirs = useRef([
      [0, 0],
      [0, 0],
    ]),
    facing = useRef([
      [0, -1],
      [0, -1],
    ]),
    last = useRef(0),
    sent = useRef(0),
    [, render] = useState(0);
  const localSeats = p.local ? [p.seat, p.local.seat] : [p.seat];
  useEffect(() => {
    positions.current = d.players.map((v: any) => ({ x: v.x, y: v.y }));
  }, [p.view.run, d.level]);
  useEvents(p, (e) => {
    if (e.kind === "kitchen-pos") {
      const { seat, x, y } = e.data;
      if (
        !localSeats.includes(seat) ||
        Math.hypot(
          positions.current[seat].x - x,
          positions.current[seat].y - y,
        ) > 0.6
      )
        positions.current[seat] = { x, y };
    }
  });
  const act = (seat: number, c: string, payload: any = {}) =>
    seat === p.seat
      ? send(c, payload)
      : p.local!.send({ type: "game", run: p.view.run, command: c, payload });
  const nearest = (seat: number) => {
    const pos = positions.current[seat],
      [fx, fy] = facing.current[seat];
    return [...latest.current.view.data.stations]
      .filter(
        (s: any) =>
          Math.hypot(s.x - pos.x, s.y - pos.y) <= 1.2 &&
          (s.x - pos.x) * fx + (s.y - pos.y) * fy >= -0.15,
      )
      .sort(
        (a: any, b: any) =>
          Math.hypot(a.x - pos.x, a.y - pos.y) -
          Math.hypot(b.x - pos.x, b.y - pos.y),
      )[0];
  };
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      const keys: Record<string, number[]> = {
        w: [0, -1],
        s: [0, 1],
        a: [-1, 0],
        d: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      };
      const seat = p.local && e.key.startsWith("Arrow") ? p.local.seat : p.seat;
      if (keys[e.key]) {
        e.preventDefault();
        dirs.current[seat] = keys[e.key];
        facing.current[seat] = keys[e.key];
      }
      if (!e.repeat && [" ", "Enter"].includes(e.key)) {
        e.preventDefault();
        const who = p.local && e.key === "Enter" ? p.local.seat : p.seat;
        const s = nearest(who);
        if (s) void act(who, "interact", { station: s.id });
      }
    };
    const up = (e: KeyboardEvent) => {
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(e.key)
      )
        dirs.current[
          p.local && e.key.startsWith("Arrow") ? p.local.seat : p.seat
        ] = [0, 0];
      if ([" ", "Enter"].includes(e.key))
        void act(
          p.local && e.key === "Enter" ? p.local.seat : p.seat,
          "cancel",
        );
    };
    const blur = () => {
      dirs.current = [
        [0, 0],
        [0, 0],
      ];
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [p.view.run, p.local?.token]);
  useFrame((time) => {
    const dt = Math.min(0.05, (time - (last.current || time)) / 1000);
    last.current = time;
    if (latest.current.disabled) {
      dirs.current = [
        [0, 0],
        [0, 0],
      ];
      return;
    }
    for (const seat of localSeats) {
      const pos = positions.current[seat],
        [dx, dy] = dirs.current[seat];
      const x = pos.x + dx * 4 * dt,
        y = pos.y + dy * 4 * dt;
      if (walkable(x, y, d.stations, d.bar)) {
        pos.x = x;
        pos.y = y;
      }
      if (time - sent.current >= 66 && (dx || dy)) {
        const transport = seat === p.seat ? p.transport : p.local!.transport;
        transport.send({
          t: "stream",
          run: p.view.run,
          kind: "cur",
          data: { x: pos.x, y: pos.y },
        });
      }
    }
    if (time - sent.current >= 66) sent.current = time;
    render(time);
  });
  const label = (item: any) =>
    !item
      ? "空手"
      : item.kind === "plate"
        ? item.dirty
          ? "🫧 脏盘子"
          : "🍽️ " +
            item.foods
              .map((f: any) => foodIcons[f.kind as keyof typeof foodIcons])
              .join("")
        : foodIcons[item.kind as keyof typeof foodIcons] +
          " " +
          (
            {
              raw: "待处理",
              chopped: "已切",
              cooked: "煎好",
              boiled: "煮好",
              burned: "烧焦",
            } as any
          )[item.stage];
  return (
    <section class="couple-new-stage" data-testid="kitchen-stage">
      <header class="couple-bar">
        <b>{d.levelName}</b>
        <b>
          {d.score} 分 · 连击×
          {(1 + Math.max(0, d.combo - 1) * 0.125).toFixed(2)}
        </b>
        <b>
          {d.endless
            ? "无尽"
            : Math.max(0, Math.ceil((d.endsAt - p.now) / 1000)) + "s"}
        </b>
      </header>
      <div class="kitchen-tickets">
        {d.orders.map((o: any) => (
          <div>
            {recipes[o.kind as keyof typeof recipes].name}
            <small>
              {recipes[o.kind as keyof typeof recipes].foods.join(" + ")}
            </small>
            <progress value={Math.max(0, o.deadline - p.now)} max="60000" />
          </div>
        ))}
      </div>
      {d.cakeLabel && !d.cakeDone && (
        <p>
          🎂 大订单 {d.cakeStep}/6：{d.cakeLabel}，两人分别在蛋糕台按住
        </p>
      )}
      <div
        class="kitchen-map"
        style={{
          position: "relative",
          height: "min(70vw,360px)",
          background: "#fff0d1",
          border: "3px solid #9e734e",
          borderRadius: 12,
        }}
      >
        {d.bar && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              height: "100%",
              width: "8%",
              background: "#c18d63",
            }}
          />
        )}
        {d.stations.map((s: any) => (
          <span
            style={{
              position: "absolute",
              left: (s.x / 8) * 100 + "%",
              top: (s.y / 8) * 100 + "%",
              width: "12.5%",
              textAlign: "center",
              fontSize: 24,
            }}
            title={s.id}
          >
            {s.label}
            {s.id.startsWith("board") && d.boards[Number(s.id.at(-1))]
              ? "🥗"
              : ""}
          </span>
        ))}
        {positions.current.map((v: any, i: number) => (
          <span
            data-x={v.x}
            data-y={v.y}
            class={"chef player-" + i}
            style={{
              position: "absolute",
              left: (v.x / 8) * 100 + "%",
              top: (v.y / 8) * 100 + "%",
              fontSize: 26,
            }}
          >
            {i ? "🐻" : "🐰"}
          </span>
        ))}
      </div>
      {localSeats.map((seat) => (
        <div class="kitchen-controls">
          <b>
            玩家{seat + 1} · {label(d.players[seat].held)}
          </b>
          <div
            role="group"
            aria-label={"玩家" + (seat + 1) + "摇杆"}
            style={{ display: "flex", gap: 4 }}
          >
            {[
              [0, -1, "↑"],
              [-1, 0, "←"],
              [1, 0, "→"],
              [0, 1, "↓"],
            ].map(([x, y, t]) => (
              <button
                style={{ minWidth: 44, minHeight: 44, touchAction: "none" }}
                disabled={p.disabled}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  dirs.current[seat] = [Number(x), Number(y)];
                  facing.current[seat] = dirs.current[seat];
                }}
                onPointerUp={() => (dirs.current[seat] = [0, 0])}
                onPointerCancel={() => (dirs.current[seat] = [0, 0])}
                onLostPointerCapture={() => (dirs.current[seat] = [0, 0])}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            class="primary"
            disabled={p.disabled || !nearest(seat)}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const s = nearest(seat);
              if (s) void act(seat, "interact", { station: s.id });
            }}
            onPointerUp={() => void act(seat, "cancel")}
            onPointerCancel={() => void act(seat, "cancel")}
            onLostPointerCapture={() => void act(seat, "cancel")}
          >
            操作{nearest(seat)?.label || " · 面向工作台"}
          </button>
          {d.jobs[seat] && (
            <progress
              value={Math.min(2000, p.now - d.jobs[seat].at)}
              max="2000"
            />
          )}
        </div>
      ))}
      <p>
        按住方向连续走动；面向工作台操作，切菜/洗碗按住两秒。WASD/空格，双人用方向键/回车。
      </p>
    </section>
  );
}
