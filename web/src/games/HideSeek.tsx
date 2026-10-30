import { useEffect, useRef, useState } from "preact/hooks";
import { useGame, nickname, type GameProps } from "./common";
import { Critter } from "../art/ui";
import { hideScenes } from "../../../shared/games/hide-seek/scenes";
import { sfx } from "./sfx";
import "./hide-seek.css";
const hintTone = (hint: string) =>
  hint.includes("呼吸")
    ? "hot"
    : hint.includes("隔壁")
      ? "warm"
      : hint.includes("陷阱")
        ? "trap"
        : "cold";
function HideView(p: GameProps) {
  const d = p.view.data,
    send = useGame(p),
    scene = hideScenes[d.level],
    [chosen, setChosen] = useState<number | null>(null),
    [decoys, setDecoys] = useState<number[]>([]),
    [placing, setPlacing] = useState(false),
    [aim, setAim] = useState<"" | "fake" | "tool">(""),
    [light, setLight] = useState({ x: 50, y: 50 }),
    house = useRef<HTMLDivElement>(null),
    lastSound = useRef(0);
  useEffect(() => {
    setChosen(null);
    setDecoys([]);
    setPlacing(false);
    setAim("");
  }, [p.view.run, d.round]);
  useEffect(() => {
    if (d.sound && d.sound.at !== lastSound.current) {
      lastSound.current = d.sound.at;
      sfx.spooky();
    }
  }, [d.sound?.at]);
  useEffect(() => {
    if (d.phase === "round-end")
      d.lastRound?.winner === p.seat ? sfx.win() : sfx.sad();
  }, [d.phase, d.round]);
  const hiding = p.seat === d.hider,
    seeking = d.phase === "seek" && !hiding,
    hider = d.hider as 0 | 1,
    act = (c: string, payload: any = {}) =>
      send(c, { round: d.round, ...payload }),
    left = Math.max(0, Math.ceil((d.deadline - p.now) / 1000)),
    total = d.phase === "hide" ? 30 : d.phase === "seek" ? 60 : 12,
    traps = d.phase === "hide" ? decoys : d.ownDecoys || [],
    revealed: number[] =
      d.tool && hideScenes[d.level].tool.id === "lamp" ? d.tool.spots : [],
    cleared: number[] =
      d.tool && hideScenes[d.level].tool.id === "crystal" ? d.tool.spots : [],
    me = d.ownHide ?? chosen;
  const click = (id: number) => {
    if (d.phase === "hide" && hiding) {
      sfx.step();
      if (chosen === null) {
        setChosen(id);
        setDecoys((old) => old.filter((x) => x !== id));
      } else if (id === chosen) setChosen(null);
      else
        setDecoys((old) =>
          old.includes(id)
            ? old.filter((x) => x !== id)
            : old.length < 2
              ? [...old, id]
              : old,
        );
      return;
    }
    if (d.phase === "seek") {
      if (hiding && placing) {
        void act("move", { id });
        setPlacing(false);
      } else if (!hiding) {
        sfx.stop();
        void act("search", { id });
      }
    }
  };
  const pickRoom = (room: number) => {
    if (aim === "fake") void act("fake", { room });
    if (aim === "tool") {
      sfx.key();
      void act("tool", { room });
    }
    setAim("");
  };
  const trailAt = (id: number) =>
    [...d.trail].reverse().find((t: any) => t.id === id);
  const moveTo = (e: PointerEvent) => {
    const r = house.current?.getBoundingClientRect();
    if (r)
      setLight({
        x: ((e.clientX - r.left) / r.width) * 100,
        y: ((e.clientY - r.top) / r.height) * 100,
      });
  };
  return (
    <section
      class={"couple-new-stage hide-stage theme-" + scene.theme}
      data-testid="hide-stage"
      data-hider={d.hider}
      data-phase={d.phase}
      data-round={d.round}
    >
      <header class="hide-top">
        <div class="hide-score">
          <Critter
            avatar={p.room.profiles[0]?.avatar}
            color={p.room.profiles[0]?.color || "#FF6B6B"}
            mood="joy"
            shadow={false}
            size={30}
          />
          <b>{d.scores[0]}</b>
          <span>:</span>
          <b>{d.scores[1]}</b>
          <Critter
            avatar={p.room.profiles[1]?.avatar}
            color={p.room.profiles[1]?.color || "#4D9DFF"}
            mood="joy"
            shadow={false}
            size={30}
          />
        </div>
        <div class="hide-title">
          <b>{d.mapName}</b>
          <span>
            {[0, 1, 2].map((r) => (
              <i class={r < d.round ? "done" : r === d.round ? "now" : ""} />
            ))}
            第 {d.round + 1}/3 轮
          </span>
        </div>
        <div
          class={
            "hide-clock" +
            (left <= 10 && d.phase !== "round-end" ? " urgent" : "")
          }
          style={{ "--p": Math.min(1, left / total) }}
        >
          {left}s
        </div>
      </header>
      <div class={"hide-role " + (hiding ? "hider" : "seeker")}>
        <span>{hiding ? "🙈 你是躲藏者" : "🔦 你是寻找者"}</span>
        <small>
          {d.phase === "hide"
            ? hiding
              ? "先选藏身点，再选两个干扰"
              : "TA 正在布置房间，闭上眼睛数到 30…"
            : d.phase === "seek"
              ? "还可搜查 " + (6 - d.searches.length) + " 次"
              : "本轮已结束"}
        </small>
      </div>
      <div
        ref={house}
        class={
          "hide-apartment hide-house" +
          (seeking ? " seeking" : "") +
          (aim ? " aiming" : "")
        }
        style={{ aspectRatio: String(scene.aspect) }}
        onPointerMove={seeking ? moveTo : undefined}
        onPointerDown={seeking ? moveTo : undefined}
      >
        <div class="house-backdrop" aria-hidden="true">
          {scene.theme === "cabin" && (
            <>
              <i class="roof" />
              <i class="rain" />
              <span class="tree t1">🌲</span>
              <span class="tree t2">🌲</span>
            </>
          )}
          {scene.theme === "haunted" && (
            <>
              <span class="moon">🌕</span>
              <span class="bat b1">🦇</span>
              <span class="bat b2">🦇</span>
              <i class="fog" />
              <span class="hall">👻</span>
            </>
          )}
          {scene.theme === "apartment" && <i class="window-glow" />}
        </div>
        {scene.doors
          .filter((door) => door[2] && door[3])
          .map(([x, y, w, h]) => (
            <i
              class="house-door"
              aria-hidden="true"
              style={{
                left: x + "%",
                top: y + "%",
                width: w + "%",
                height: h + "%",
              }}
            />
          ))}
        {d.rooms.map((room: any, i: number) => {
          const r = scene.rooms[i],
            sound = d.sound?.room === i,
            tool = d.tool?.room === i;
          return (
            <section
              class={
                "house-room" +
                (sound ? " creak" : "") +
                (tool ? " tooled" : "") +
                (aim ? " pickable" : "")
              }
              style={{
                left: r.x + "%",
                top: r.y + "%",
                width: r.w + "%",
                height: r.h + "%",
                "--floor": r.floor,
                "--wall": r.wall,
              }}
              onClick={aim ? () => pickRoom(i) : undefined}
            >
              <h3>{room.name}</h3>
              <span class="room-deco" aria-hidden="true">
                {r.deco.join(" ")}
              </span>
              {sound && <em class="creak-text">吱呀……</em>}
              {d.spots
                .filter((s: any) => s.room === i)
                .map((s: any) => {
                  const at = scene.spots[s.id],
                    found = trailAt(s.id),
                    reveal =
                      d.phase === "round-end" && d.lastRound?.id === s.id,
                    mine = me === s.id && (hiding || reveal);
                  return (
                    <button
                      class={
                        "house-spot" +
                        (chosen === s.id || d.ownHide === s.id
                          ? " chosen"
                          : "") +
                        (traps.includes(s.id) ? " trap" : "") +
                        (d.suspicious.includes(s.id) ? " sus" : "") +
                        (found ? " searched " + hintTone(found.hint) : "") +
                        (cleared.includes(s.id) ? " cleared" : "") +
                        (reveal ? " reveal" : "") +
                        (placing &&
                        d.spots[d.ownHide]?.neighbors.includes(s.id) &&
                        !d.ownDecoys.includes(s.id)
                          ? " hop"
                          : "")
                      }
                      style={{ left: at.x + "%", top: at.y + "%" }}
                      aria-label={
                        (d.phase === "hide" ? "布置" : "搜查") +
                        s.name +
                        " " +
                        s.id
                      }
                      disabled={
                        p.disabled ||
                        !!aim ||
                        d.phase === "round-end" ||
                        (d.phase === "hide" && !hiding) ||
                        (d.phase === "seek" &&
                          hiding &&
                          (!placing ||
                            !d.spots[d.ownHide]?.neighbors.includes(s.id) ||
                            d.ownDecoys.includes(s.id)))
                      }
                      onClick={() => click(s.id)}
                    >
                      <span class="spot-icon">{at.icon}</span>
                      <small>{s.name}</small>
                      {(mine || reveal) && (
                        <span class="spot-critter">
                          <Critter
                            avatar={p.room.profiles[hider]?.avatar}
                            color={p.room.profiles[hider]?.color || "#FF6B6B"}
                            mood={
                              reveal
                                ? d.lastRound.winner === hider
                                  ? "joy"
                                  : "wow"
                                : "joy"
                            }
                            shadow={false}
                            size={34}
                          />
                        </span>
                      )}
                      {(traps.includes(s.id) || revealed.includes(s.id)) && (
                        <span class="spot-badge">🪤</span>
                      )}
                      {seeking && d.suspicious.includes(s.id) && !found && (
                        <span class="spot-badge glint">❔</span>
                      )}
                      {found && <span class="spot-badge">👣</span>}
                      {cleared.includes(s.id) && !found && (
                        <span class="spot-badge">✖</span>
                      )}
                    </button>
                  );
                })}
            </section>
          );
        })}
        {seeking && (
          <div
            class="flashlight"
            aria-hidden="true"
            style={{
              "--x": light.x + "%",
              "--y": light.y + "%",
              "--dark": scene.dark,
            }}
          />
        )}
        {d.phase === "round-end" && d.lastRound && (
          <div class="hide-reveal" role="status">
            <b>{d.lastRound.winner === d.seeker ? "找到你啦！" : "没找到～"}</b>
            <span>
              {nickname(p, d.lastRound.winner)} +{d.lastRound.points} 分
            </span>
          </div>
        )}
      </div>
      {d.hint && d.phase === "seek" && (
        <p class={"hide-hint " + hintTone(d.hint)} aria-live="polite">
          {d.hint}
        </p>
      )}
      {d.tool && d.phase === "seek" && (
        <p class="hide-hint tool">
          {scene.tool.icon} {d.tool.text}
        </p>
      )}
      {aim && (
        <p class="hide-aim">
          {aim === "fake" ? "点一个房间，让那里发出吱呀声" : scene.tool.tip}
          <button class="chip" onClick={() => setAim("")}>
            取消
          </button>
        </p>
      )}
      {d.phase === "hide" && hiding && (
        <div class="hide-panel">
          <div class="hide-steps">
            <span class={chosen !== null ? "ok" : ""}>
              ① 藏身点 {chosen !== null ? "✓" : ""}
            </span>
            <span class={decoys.length === 2 ? "ok" : ""}>
              ② 陷阱 🪤 {decoys.length}/2
            </span>
          </div>
          <p>
            已选 {chosen === null ? "0" : "1"} 个藏身点、{decoys.length}/2
            个干扰
          </p>
          <button
            class="primary"
            disabled={chosen === null || decoys.length !== 2 || p.disabled}
            onClick={() => void act("hide", { id: chosen, decoys })}
          >
            藏好了
          </button>
        </div>
      )}
      {d.phase === "hide" && !hiding && (
        <div class="hide-panel waiting">
          <span class="peek">🙈</span>
          <p>
            {nickname(p, d.hider)} 在偷偷找地方，还有 {left} 秒
          </p>
        </div>
      )}
      {d.phase === "seek" && hiding && (
        <div class="hide-panel">
          <div class="game-actions">
            <button
              disabled={!d.movesLeft || p.disabled}
              onClick={() => setPlacing(!placing)}
            >
              换位 · 剩余 {d.movesLeft} 次
            </button>
            <button
              disabled={!d.canPlayDead || p.disabled}
              onClick={() => void act("dead")}
            >
              装死 · 一次
            </button>
            <button
              disabled={!d.canFake || p.disabled}
              onClick={() => setAim(aim === "fake" ? "" : "fake")}
            >
              声东击西 · 一次
            </button>
          </div>
          {placing && <p>选择同一房间内相邻的藏身点</p>}
          <p class="muted">
            TA 已经搜了 {d.searches.length}/6
            次。换位会在房间里发出吱呀声，声东击西可以在别的房间假装有动静。
          </p>
        </div>
      )}
      {seeking && (
        <div class="hide-panel">
          <div
            class="search-left"
            aria-label={"剩余搜查次数 " + (6 - d.searches.length)}
          >
            {Array.from({ length: 6 }, (_, i) => (
              <i class={i < d.searches.length ? "used" : ""}>🔦</i>
            ))}
          </div>
          <button
            class="tool-button"
            disabled={d.toolUsed || p.disabled}
            onClick={() => setAim(aim === "tool" ? "" : "tool")}
          >
            {scene.tool.icon} {scene.tool.name}
            {d.toolUsed ? " · 已用" : " · 一次"}
          </button>
          <p class="muted">
            ❔ 是可疑的地方，其中有真有假，还有 TA 布下的陷阱。
          </p>
        </div>
      )}
      {d.trail.length > 0 && d.phase !== "hide" && (
        <ol class="hide-trail">
          {d.trail.map((t: any) => (
            <li class={hintTone(t.hint)}>
              <span>
                {scene.spots[t.id].icon} {d.spots[t.id].name}
              </span>
              <b>{t.hint}</b>
            </li>
          ))}
        </ol>
      )}
      {d.phase === "round-end" && (
        <div class="hide-panel">
          <p>
            藏在：{d.lastRound.spot} · 玩家{d.lastRound.winner + 1}获得
            {d.lastRound.points}分
          </p>
          <button class="primary" onClick={() => void act("next")}>
            {d.round === 2 ? "查看结算" : "交换身份，下一轮"}
          </button>
        </div>
      )}
    </section>
  );
}
export default function HideSeek(p: GameProps) {
  const local = p.local,
    d = p.view.data,
    [viewer, setViewer] = useState<number | null>(null),
    [target, setTarget] = useState(0);
  useEffect(() => {
    if (local) {
      setTarget(d.phase === "hide" ? d.hider : d.seeker);
      setViewer(null);
    }
  }, [p.view.run, d.round, d.phase]);
  if (!local) return <HideView {...p} />;
  if (viewer === null)
    return (
      <section class="couple-new-stage hide-handoff">
        <span class="peek" aria-hidden="true">
          🙈
        </span>
        <h2>请交给玩家 {target + 1}</h2>
        <p>遮挡屏幕，准备好再打开自己的视图</p>
        <button class="primary" onClick={() => setViewer(target)}>
          准备好了，打开我的视图
        </button>
      </section>
    );
  const own = viewer === p.seat;
  const props = own
    ? p
    : {
        ...p,
        seat: local.seat,
        view: local.view!,
        send: local.send,
        transport: local.transport,
        token: local.token,
      };
  if (!props.view) return <p>正在同步…</p>;
  return (
    <>
      <HideView {...props} local={undefined} />
      <button
        class="hide-pass"
        onClick={() => {
          setTarget(1 - viewer);
          setViewer(null);
        }}
      >
        遮挡屏幕，交给玩家 {2 - viewer}
      </button>
    </>
  );
}
