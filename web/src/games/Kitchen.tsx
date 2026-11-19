import { useEffect, useRef, useState } from "preact/hooks";
import {
  useGame,
  useEvents,
  useFrame,
  useLatest,
  typing,
  nickname,
  type GameProps,
} from "./common";
import { Critter } from "../art/ui";
import { sfx } from "./sfx";
import "./kitchen.css";
import {
  walkable,
  recipes,
  foodIcons,
  kitchenReach,
  cookingTimes,
  matchesKitchenOrder,
  type Recipe,
  type Station,
} from "../../../shared/games/coop-kitchen/levels";
const kitchenThemes = [
  { id: "bento", icon: "🍱", sub: "TA 家的小厨房，第一次一起做饭" },
  { id: "pub", icon: "🍸", sub: "吧台隔开两边，只能在 🤝 交接" },
  { id: "hotpot", icon: "🏮", sub: "红灯笼下的火锅夜，锅要盯紧" },
  { id: "truck", icon: "🚚", sub: "餐车会掉头，食材位置会对调" },
  { id: "cake", icon: "🎂", sub: "纪念日，一起做一个大蛋糕" },
];
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
    moving = useRef([false, false]),
    [, render] = useState(0),
    [pops, setPops] = useState<{ id: number; value: number }[]>([]),
    lastScore = useRef(d.score);
  useEffect(() => {
    const gain = d.score - lastScore.current;
    lastScore.current = d.score;
    if (gain <= 0) return;
    sfx.coin();
    const id = Date.now();
    setPops((list) => [...list.slice(-2), { id, value: gain }]);
    setTimeout(() => setPops((list) => list.filter((x) => x.id !== id)), 1200);
  }, [d.score]);
  const localSeats = p.local ? [p.seat, p.local.seat] : [p.seat];
  useEffect(() => {
    positions.current = d.players.map((v: any) => ({ x: v.x, y: v.y }));
  }, [p.view.run, d.level, d.swapped]);
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
  const flush = (seat: number) => {
    const cur = latest.current;
    if (cur.disabled) return;
    const transport = seat === cur.seat ? cur.transport : cur.local!.transport;
    transport.send({
      t: "stream",
      run: cur.view.run,
      kind: "cur",
      data: { ...positions.current[seat] },
    });
  };
  const act = (seat: number, c: string, payload: any = {}) => {
    if (latest.current.disabled) return Promise.resolve(false);
    // Ordered on the same socket: interaction uses the final visible position.
    if (c === "interact") {
      if (interactionHint(seat, nearest(seat))) return Promise.resolve(false);
      flush(seat);
      moving.current[seat] = false;
    }
    return seat === p.seat
      ? send(c, payload)
      : p.local!.send({ type: "game", run: p.view.run, command: c, payload });
  };
  const nearest = (seat: number) => {
    const pos = positions.current[seat],
      [fx, fy] = facing.current[seat];
    return [...latest.current.view.data.stations]
      .filter(
        (s: any) =>
          Math.hypot(s.x - pos.x, s.y - pos.y) <= kitchenReach &&
          (s.x - pos.x) * fx + (s.y - pos.y) * fy >= -0.15,
      )
      .sort(
        (a: any, b: any) =>
          Math.hypot(a.x - pos.x, a.y - pos.y) -
          Math.hypot(b.x - pos.x, b.y - pos.y),
      )[0];
  };
  function interactionHint(seat: number, station?: Station) {
    if (!station) return "走近并面向工作台";
    const { view, now } = latest.current;
    const state = view.data;
    const id = station.id,
      index = Number(id.at(-1));
    const held = state.players[seat].held;
    if (state.jobs[1 - seat]?.station === id) return "队友正在使用这个工作台";
    if (Object.hasOwn(foodIcons, id))
      return held ? "手里有东西，先放下再取食材" : "";
    if (id === "trash") return held ? "" : "手里没有要丢弃的东西";
    if (id.startsWith("handoff")) {
      if (held && state.handoffs[index]) return "传递台已满，等队友取走";
      if (!held && !state.handoffs[index]) return "传递台是空的";
    }
    if (id.startsWith("board")) {
      if (state.boards[index]) return held ? "空手才能切菜或取走食材" : "";
      if (!held || held.kind === "bread" || held.stage !== "raw")
        return "先拿待切的番茄、生菜或肉饼";
    }
    if (id.startsWith("pan") || id === "pot") {
      const pot = id === "pot";
      const cooker = pot ? state.pot : state.pans[index];
      if (!cooker)
        return held?.kind === "meat" && held.stage === "chopped"
          ? ""
          : "先把肉饼切好再下锅";
      if (held) return "空手才能从锅里取出食材";
      const left =
        (pot ? cookingTimes.pot : cookingTimes.pan).ready - (now - cooker.at);
      return left > 0
        ? "还没煮好，约 " + Math.ceil(left / 1000) + " 秒后可取"
        : "";
    }
    if (id.startsWith("plate")) {
      const plate = state.plates[index];
      if (held?.kind === "plate") return plate ? "这里已经有盘子" : "";
      if (!plate) return "这里没有盘子";
      if (held && plate.dirty) return "先把盘子洗干净";
      if (held?.stage === "burned") return "烧焦的食材请丢进垃圾桶";
      if (
        held &&
        plate.foods.some((food: { kind: string }) => food.kind === held.kind)
      )
        return "盘里已经有这种食材";
    }
    if (id === "sink" && (held?.kind !== "plate" || !held.dirty))
      return "拿着脏盘子才能清洗";
    if (id.startsWith("cake") && state.cakeDone) return "蛋糕已经做好了";
    if (id === "serve") {
      if (held?.kind !== "plate") return "请拿着装好菜的盘子来出餐";
      if (held.dirty) return "先把盘子洗干净";
      if (
        !state.orders.some(
          (order: { deadline: number; kind: Recipe }) =>
            now < order.deadline && matchesKitchenOrder(order.kind, held.foods),
        )
      )
        return "盘里的食材或做法与当前订单不符";
    }
    return "";
  }
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
      for (const seat of localSeats) {
        flush(seat);
        void act(seat, "cancel");
      }
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
      if (moving.current[seat] && !dx && !dy) flush(seat);
      moving.current[seat] = !!(dx || dy);
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
  const theme = kitchenThemes[d.level] || kitchenThemes[0],
    mine = nearestIds(),
    left = d.endless ? null : Math.max(0, Math.ceil((d.endsAt - p.now) / 1000)),
    stageMark: Record<string, string> = {
      chopped: "🔪",
      cooked: "🔥",
      boiled: "♨️",
      burned: "💥",
      raw: "",
    };
  function nearestIds() {
    return new Set(localSeats.map((seat) => nearest(seat)?.id).filter(Boolean));
  }
  const content = (s: any): string => {
    const n = Number(s.id.at(-1));
    if (s.id.startsWith("board"))
      return d.boards[n]
        ? foodIcons[d.boards[n].kind as keyof typeof foodIcons]
        : "";
    if (s.id.startsWith("pan"))
      return d.pans[n]
        ? foodIcons[d.pans[n].item.kind as keyof typeof foodIcons]
        : "";
    if (s.id === "pot")
      return d.pot ? foodIcons[d.pot.item.kind as keyof typeof foodIcons] : "";
    if (s.id.startsWith("plate")) {
      const plate = d.plates[n];
      return !plate
        ? ""
        : plate.dirty
          ? "🫧"
          : plate.foods
              .map((f: any) => foodIcons[f.kind as keyof typeof foodIcons])
              .join("");
    }
    if (s.id.startsWith("handoff")) {
      const it = d.handoffs[n];
      return it
        ? it.kind === "plate"
          ? "🍽️"
          : foodIcons[it.kind as keyof typeof foodIcons]
        : "";
    }
    return "";
  };
  const busy = (s: any) =>
    (s.id.startsWith("pan") && d.pans[Number(s.id.at(-1))]) ||
    (s.id === "pot" && d.pot);
  return (
    <section
      class={"couple-new-stage kitchen-stage kitchen-" + theme.id}
      data-testid="kitchen-stage"
    >
      <header class="kitchen-top">
        <div>
          <b>
            {theme.icon} {d.levelName}
          </b>
          <small>{theme.sub}</small>
        </div>
        <div class="kitchen-score">
          <b>{d.score}</b>
          <small>
            分
            {d.combo > 1
              ? ` · 🔥×${(1 + (d.combo - 1) * 0.125).toFixed(2)}`
              : ""}
          </small>
        </div>
        <span
          class={
            "kitchen-clock" + (left !== null && left <= 20 ? " urgent" : "")
          }
        >
          {left === null ? "∞ 无尽" : "⏱ " + left + "s"}
        </span>
      </header>
      <div class="kitchen-rail">
        {d.orders.map((o: any) => {
          const r = recipes[o.kind as keyof typeof recipes],
            k = Math.max(0, Math.min(1, (o.deadline - p.now) / 60000));
          return (
            <div class={"kitchen-ticket" + (k < 0.25 ? " late" : "")}>
              <b>{r.name}</b>
              <span class="ticket-foods">
                {r.foods.map((f) => {
                  const [kind, stage] = f.split(":");
                  return (
                    <i>
                      {foodIcons[kind as keyof typeof foodIcons]}
                      <sub>{stageMark[stage]}</sub>
                    </i>
                  );
                })}
              </span>
              <small>
                {r.foods
                  .map((f) => {
                    const [kind, stage] = f.split(":");
                    return (
                      (
                        {
                          raw: "",
                          chopped: "切",
                          cooked: "煎",
                          boiled: "煮",
                        } as Record<string, string>
                      )[stage] +
                      (
                        {
                          tomato: "番茄",
                          lettuce: "生菜",
                          meat: "肉饼",
                          bread: "面包",
                        } as Record<string, string>
                      )[kind]
                    );
                  })
                  .join(" + ")}
              </small>
              <em style={{ width: k * 100 + "%" }} />
            </div>
          );
        })}
        {!d.orders.length && <p class="muted">订单马上来…</p>}
      </div>
      {d.cakeLabel && !d.cakeDone && (
        <div class="kitchen-cake">
          <span>🎂 纪念日大订单</span>
          <div>
            {Array.from({ length: 6 }, (_, i) => (
              <i
                class={i < d.cakeStep ? "done" : i === d.cakeStep ? "now" : ""}
              />
            ))}
          </div>
          <small>
            {d.cakeStep + 1}/6 {d.cakeLabel} · 两人分别在 🎂 台按住
          </small>
        </div>
      )}
      <div class="kitchen-map">
        {d.bar && <div class="kitchen-bar" />}
        {d.stations.map((s: any) => (
          <div
            class={
              "kitchen-station st-" +
              s.id.replace(/\d$/, "") +
              (mine.has(s.id) ? " near" : "") +
              (busy(s) ? " busy" : "")
            }
            style={{
              left: (s.x / 8) * 100 + "%",
              top: (s.y / 8) * 100 + "%",
            }}
            title={s.id}
          >
            <span class="st-icon">{s.label}</span>
            {content(s) && <span class="st-content">{content(s)}</span>}
          </div>
        ))}
        {positions.current.map((v: any, i: number) => {
          const prof = p.room.profiles[i as 0 | 1],
            held = d.players[i]?.held;
          return (
            <span
              data-x={v.x}
              data-y={v.y}
              class={"chef player-" + i}
              style={{
                left: (v.x / 8) * 100 + "%",
                top: (v.y / 8) * 100 + "%",
              }}
            >
              <span class="chef-hat" aria-hidden="true" />
              <Critter
                avatar={prof?.avatar}
                color={prof?.color || (i ? "#4D9DFF" : "#FF6B6B")}
                mood={d.jobs[i] ? "wow" : "joy"}
                shadow={false}
                size={40}
              />
              {held && (
                <span class="chef-held">{label(held).split(" ")[0]}</span>
              )}
              {d.jobs[i] && (
                <span class="chef-job">
                  <i
                    style={{
                      width:
                        Math.min(100, ((p.now - d.jobs[i].at) / 2000) * 100) +
                        "%",
                    }}
                  />
                </span>
              )}
            </span>
          );
        })}
        {pops.map((x) => (
          <span key={x.id} class="kitchen-pop">
            +{x.value}
          </span>
        ))}
      </div>
      <div class={"kitchen-pads" + (localSeats.length > 1 ? " two" : "")}>
        {localSeats.map((seat) => {
          const station = nearest(seat),
            hint = interactionHint(seat, station);
          return (
            <div class="kitchen-controls">
              <b>
                {nickname(p, seat)} · {label(d.players[seat].held)}
              </b>
              <div class="kitchen-pad-row">
                <div
                  role="group"
                  aria-label={"玩家" + (seat + 1) + "摇杆"}
                  class="kitchen-dpad"
                >
                  {[
                    [0, -1, "↑", "up"],
                    [-1, 0, "←", "left"],
                    [1, 0, "→", "right"],
                    [0, 1, "↓", "down"],
                  ].map(([x, y, t, cls]) => (
                    <button
                      class={"dpad-" + cls}
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
                  class="primary kitchen-act"
                  aria-label={"操作" + (station?.label || " · 面向工作台")}
                  aria-describedby={
                    hint ? "kitchen-action-hint-" + seat : undefined
                  }
                  disabled={p.disabled || !!hint}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    const s = nearest(seat);
                    if (s) void act(seat, "interact", { station: s.id });
                  }}
                  onPointerUp={() => void act(seat, "cancel")}
                  onPointerCancel={() => void act(seat, "cancel")}
                  onLostPointerCapture={() => void act(seat, "cancel")}
                >
                  <span>{station?.label || "🙌"}</span>
                  <small>{station ? "操作" : "走近工作台"}</small>
                </button>
              </div>
              {hint && (
                <small id={"kitchen-action-hint-" + seat} class="kitchen-help">
                  {hint}
                </small>
              )}
            </div>
          );
        })}
      </div>
      <p class="muted kitchen-help">
        按住方向连续走动；面向工作台操作，切菜/洗碗按住两秒。WASD/空格，双人用方向键/回车。
      </p>
    </section>
  );
}
