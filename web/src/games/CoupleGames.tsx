import Ludo from "./Ludo";
import Spot from "./Difference";
import Survival from "./Survival";
import Kitchen from "./Kitchen";
import { useEffect, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import Jump from "./Jump";
import { useGame, typing, type GameProps } from "./common";
import { Critter, TetheredPair } from "../art/ui";

function VirtualStick({
  move,
  label,
}: {
  move: (dx: number, dy: number) => void;
  label: string;
}) {
  const timer = useRef<ReturnType<typeof setInterval>>(),
    dir = useRef<[number, number]>([0, 0]),
    [dot, setDot] = useState<[number, number]>([0, 0]);
  const stop = () => {
    clearInterval(timer.current);
    timer.current = undefined;
    dir.current = [0, 0];
    setDot([0, 0]);
  };
  useEffect(() => stop, []);
  const update = (e: JSX.TargetedPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect(),
      x = (e.clientX - r.left - r.width / 2) / (r.width / 2),
      y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const len = Math.max(1, Math.hypot(x, y));
    setDot([(x / len) * 30, (y / len) * 30]);
    dir.current =
      Math.hypot(x, y) < 0.2
        ? [0, 0]
        : Math.abs(x) > Math.abs(y)
          ? [x > 0 ? 1 : -1, 0]
          : [0, y > 0 ? 1 : -1];
  };
  return (
    <div
      class="virtual-stick"
      role="group"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
        if (!timer.current)
          timer.current = setInterval(() => {
            const [x, y] = dir.current;
            if (x || y) move(x, y);
          }, 200);
      }}
      onPointerMove={(e) => {
        if (timer.current) update(e);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
    >
      <span style={{ transform: `translate(${dot[0]}px,${dot[1]}px)` }} />
    </div>
  );
}

const rooms = ["卧室", "客厅", "浴室", "厨房"];
const objects = ["🪴", "💡", "🧸"];
function HideView(p: GameProps) {
  const d = p.view.data,
    send = useGame(p),
    [choice, setChoice] = useState<number | null>(null),
    [decoys, setDecoys] = useState<number[]>([]),
    [prop, setProp] = useState("🪴");
  const choosing = d.phase === "hide" && p.seat === 1,
    hidden = d.phase === "hide" && p.seat === 0;
  const move = (dx: number, dy: number) => {
    if (d.phase !== "seek" || d.mode !== "realtime") return;
    if (p.seat === 0) {
      const room = d.seeker,
        row = Math.floor(room / 2),
        col = room % 2;
      const r = Math.max(0, Math.min(1, row + dy)),
        c = Math.max(0, Math.min(1, col + dx));
      if (r * 2 + c !== room) void send("light", { room: r * 2 + c });
    } else {
      const old = d.ownHide;
      if (old === null) return;
      const next = Math.max(0, Math.min(11, old + dx + dy * 3));
      if (next !== old) void send("move", { id: next });
    }
  };
  const searchCurrent = () => {
    const id = [0, 1, 2]
      .map((x) => d.seeker * 3 + x)
      .find((x) => !d.searches.includes(x));
    if (id !== undefined) void send("search", { id });
  };
  useEffect(() => {
    if (d.mode !== "realtime" || d.phase !== "seek") return;
    const down = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      const dirs: Record<string, [number, number]> =
        p.seat === 0
          ? { w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }
          : {
              ArrowUp: [0, -1],
              ArrowDown: [0, 1],
              ArrowLeft: [-1, 0],
              ArrowRight: [1, 0],
            };
      if (dirs[e.key]) {
        e.preventDefault();
        move(...dirs[e.key]);
      } else if (p.seat === 0 && e.key === " ") {
        e.preventDefault();
        searchCurrent();
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [
    p.view.run,
    p.seat,
    d.phase,
    d.mode,
    d.seeker,
    d.ownHide,
    d.searches.length,
  ]);
  const select = (id: number) => {
    if (choosing) {
      if (choice === null) {
        setChoice(id);
        return;
      }
      if (id === choice) {
        setChoice(null);
        return;
      }
      setDecoys(
        decoys.includes(id)
          ? decoys.filter((x) => x !== id)
          : decoys.length < 2
            ? [...decoys, id]
            : decoys,
      );
      return;
    }
    if (d.phase === "seek") void send(p.seat === 0 ? "search" : "move", { id });
  };
  return (
    <section class="couple-new-stage" data-testid="hide-stage">
      <header class="couple-bar">
        <b>👁️ 抓捕者 vs 🎭 躲藏者</b>
        <b>⏱ {Math.max(0, Math.ceil((d.deadline - p.now) / 1000))}s</b>
      </header>
      <p>
        {hidden
          ? "请把设备交给躲藏者，等待 TA 选好。"
          : choosing
            ? "先选藏身处，再选两个诱饵。"
            : p.seat === 0
              ? `还可寻找 ${d.attempts - d.searches.length} 次`
              : `找到 3 把钥匙逃脱：${d.collected}/3`}
      </p>
      {d.hint && p.seat === 0 && <p aria-live="polite">🔎 {d.hint}</p>}
      {!hidden && (
        <div class="hide-map">
          {rooms.map((room, r) => (
            <div
              class={
                "hide-room " +
                (d.mode === "realtime" &&
                d.phase === "seek" &&
                p.seat === 0 &&
                d.seeker !== r
                  ? "fog"
                  : "")
              }
            >
              <strong>🚪 {room}</strong>
              {d.mode === "realtime" && d.phase === "seek" && p.seat === 0 && (
                <button onClick={() => void send("light", { room: r })}>
                  🔦 照这里
                </button>
              )}
              <div>
                {[0, 1, 2].map((i) => {
                  const id = r * 3 + i;
                  return (
                    <button
                      disabled={
                        d.phase === "seek" &&
                        p.seat === 0 &&
                        (d.mode === "turn"
                          ? d.searches.includes(id)
                          : d.seeker !== r)
                      }
                      class={
                        ((choosing && choice === id) || d.ownHide === id
                          ? "chosen "
                          : "") +
                        ((choosing || p.seat === 1) && decoys.includes(id)
                          ? "decoy "
                          : "")
                      }
                      onClick={() => select(id)}
                    >
                      {d.mode === "realtime" ? d.furniture[id] : objects[i]}
                      {d.keys.includes(id) ? "🔑" : ""}
                      {d.searches.includes(id) ? "❌" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {choosing && (
        <>
          {d.mode === "realtime" && (
            <label>
              伪装为{" "}
              <select
                value={prop}
                onChange={(e) => setProp(e.currentTarget.value)}
              >
                {objects.map((x) => (
                  <option>{x}</option>
                ))}
              </select>
            </label>
          )}
          <button
            class="primary"
            disabled={
              choice === null || (d.mode === "turn" && decoys.length !== 2)
            }
            onClick={() => void send("hide", { id: choice, decoys, prop })}
          >
            藏好了
          </button>
        </>
      )}
      {d.phase === "seek" && d.mode === "realtime" && (
        <div class="hide-controls">
          <VirtualStick
            label={p.seat === 0 ? "抓捕者摇杆" : "躲藏者摇杆"}
            move={move}
          />
          {p.seat === 0 && (
            <button onClick={searchCurrent}>🔍 搜索照亮区域</button>
          )}
        </div>
      )}
      {d.phase === "seek" && d.mode === "turn" && p.seat === 1 && (
        <p>请将手机交给抓捕者，别让 TA 看见你的屏幕。</p>
      )}
    </section>
  );
}

function Hide(p: GameProps) {
  const [handed, setHanded] = useState(false),
    [localViewer, setLocalViewer] = useState<0 | 1>(0),
    local = p.local;
  if (!local || !local.view) return <HideView {...p} />;
  if (p.view.data.phase === "hide")
    return (
      <HideView
        {...p}
        seat={1}
        view={local.view}
        send={local.send}
        transport={local.transport}
        token={local.token}
        local={undefined}
      />
    );
  if (p.view.data.mode === "realtime")
    return (
      <div class="dual-hide">
        <HideView {...p} local={undefined} />
        <HideView
          {...p}
          seat={1}
          view={local.view}
          send={local.send}
          transport={local.transport}
          token={local.token}
          local={undefined}
        />
      </div>
    );
  if (!handed)
    return (
      <section class="couple-new-stage">
        <h2>请交给抓捕者</h2>
        <p>遮住屏幕，准备好后点击继续。</p>
        <button onClick={() => setHanded(true)}>开始寻找</button>
      </section>
    );
  const selected =
    localViewer === 1
      ? {
          ...p,
          seat: 1 as const,
          view: local.view,
          send: local.send,
          transport: local.transport,
          token: local.token,
          local: undefined,
        }
      : p;
  return (
    <>
      <div class="hide-local-switch">
        <button onClick={() => setLocalViewer(0)}>👁️ 抓捕者</button>
        <button onClick={() => setLocalViewer(1)}>🎭 躲藏者</button>
      </div>
      <HideView {...selected} />
    </>
  );
}

export default function CoupleGames(p: GameProps) {
  switch (p.view.kind) {
    case "survival":
      return <Survival {...p} />;
    case "spot-difference":
      return <Spot {...p} />;
    case "coop-kitchen":
      return <Kitchen {...p} />;
    case "couple-ludo":
      return <Ludo {...p} />;
    case "hide-seek":
      return <Hide {...p} />;
    case "couple-jump":
      return <Jump {...p} />;
    default:
      return null;
  }
}
