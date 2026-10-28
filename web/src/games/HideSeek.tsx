import { useEffect, useState } from "preact/hooks";
import { useGame, type GameProps } from "./common";
function HideView(p: GameProps) {
  const d = p.view.data,
    send = useGame(p),
    [chosen, setChosen] = useState<number | null>(null),
    [decoys, setDecoys] = useState<number[]>([]),
    [placing, setPlacing] = useState(false);
  useEffect(() => {
    setChosen(null);
    setDecoys([]);
  }, [p.view.run, d.round]);
  const hiding = p.seat === d.hider,
    act = (c: string, payload: any = {}) =>
      send(c, { round: d.round, ...payload });
  const click = (id: number) => {
    if (d.phase === "hide" && hiding) {
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
      } else if (!hiding) void act("search", { id });
    }
  };
  return (
    <section
      class="couple-new-stage"
      data-testid="hide-stage"
      data-hider={d.hider}
      data-phase={d.phase}
      data-round={d.round}
    >
      <header class="couple-bar">
        <b>
          {d.mapName} {d.round + 1}/3 轮
        </b>
        <b>{Math.max(0, Math.ceil((d.deadline - p.now) / 1000))}s</b>
        <b>
          {d.scores[0]} : {d.scores[1]}
        </b>
      </header>
      <p>
        {hiding ? "你是躲藏者" : "你是寻找者"} ·{" "}
        {d.phase === "hide"
          ? hiding
            ? "先选藏身点，再选两个干扰"
            : "TA 正在布置房间，请稍候"
          : d.phase === "seek"
            ? "还可搜查 " + (6 - d.searches.length) + " 次"
            : "本轮已结束"}
      </p>
      <div
        class="hide-apartment"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}
      >
        {d.rooms.map((room: any, i: number) => (
          <section
            style={{
              border: "2px solid #bb927b",
              borderRadius: 12,
              background: ["#fff0d5", "#f0e9ff", "#e6f5e0", "#e2f2ff"][i],
              padding: 4,
            }}
          >
            <h3 style={{ fontSize: 14, margin: 4 }}>{room.name}</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,minmax(0,1fr))",
                gap: 2,
              }}
            >
              {d.spots
                .filter((s: any) => s.room === i)
                .map((s: any) => (
                  <button
                    style={{ minHeight: 44, fontSize: 12, padding: 2 }}
                    aria-label={
                      (d.phase === "hide" ? "布置" : "搜查") +
                      s.name +
                      " " +
                      s.id
                    }
                    class={
                      chosen === s.id || d.ownHide === s.id ? "chosen" : ""
                    }
                    disabled={
                      p.disabled ||
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
                    {d.ownHide === s.id || chosen === s.id
                      ? "🐰"
                      : d.suspicious.includes(s.id)
                        ? "❔"
                        : d.searches.includes(s.id)
                          ? "👣"
                          : "🪑"}
                    <br />
                    {s.name}
                    {decoys.includes(s.id) && d.phase === "hide" ? "⚑" : ""}
                  </button>
                ))}
            </div>
          </section>
        ))}
      </div>
      {d.phase === "hide" && hiding && (
        <>
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
        </>
      )}
      {d.phase === "seek" && hiding && (
        <div>
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
          {placing && <p>选择同一房间内相邻的藏身点</p>}
        </div>
      )}
      <p aria-live="polite">{d.hint}</p>
      {d.sound && <p>吱呀……{d.rooms[d.sound.room].name} 有动静</p>}
      {d.phase === "round-end" && (
        <>
          <p>
            藏在：{d.lastRound.spot} · 玩家{d.lastRound.winner + 1}获得
            {d.lastRound.points}分
          </p>
          <button class="primary" onClick={() => void act("next")}>
            {d.round === 2 ? "查看结算" : "交换身份，下一轮"}
          </button>
        </>
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
