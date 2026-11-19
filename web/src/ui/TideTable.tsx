// 大厅里的“棋桌”：异步潮汐棋的入口和棋盘浮层。
// 打开棋盘时每 8 秒告诉服务器“我在看”，两人都在看时可以切到实时。
import { useEffect, useState } from "preact/hooks";
import { api } from "../api";
import type { Transport } from "../net/transport";
import type { Profile, Seat } from "../../../shared/protocol";
import { TideBoard } from "../games/Tide";
import "../games/tide.css";

export function TideTable(p: {
  code: string;
  token: string;
  seat: Seat;
  profiles: [Profile | null, Profile | null];
  transport?: Transport;
  now: number;
}) {
  const [m, setM] = useState<any>(undefined),
    [open, setOpen] = useState(location.hash === "#tide"),
    [ending, setEnding] = useState(false),
    [error, setError] = useState("");
  const me = p.seat,
    other = (1 - me) as Seat,
    partner = p.profiles[other]?.nickname || "TA";
  const call = async (body?: object) => {
    try {
      const r = await api(
        "rooms/" + p.code + "/tide",
        body ? "POST" : "GET",
        body,
        p.token,
      );
      setM(r.match);
      setError("");
      return true;
    } catch (e) {
      setError((e as Error).message);
      void call();
      return false;
    }
  };
  useEffect(() => {
    void call();
  }, [p.code, p.token]);
  useEffect(
    () =>
      p.transport?.subscribe((msg) => {
        if (msg.t === "extra" && msg.event.kind === "tide") void call();
      }),
    [p.transport],
  );
  useEffect(() => {
    const sync = () => setOpen(location.hash === "#tide");
    addEventListener("hashchange", sync);
    return () => removeEventListener("hashchange", sync);
  }, []);
  // 看着棋盘时的心跳
  useEffect(() => {
    if (!open) return;
    const watch = (on: boolean) =>
      api("rooms/" + p.code + "/tide", "POST", { cmd: "watch", on }, p.token)
        .then((r) => setM(r.match))
        .catch(() => {});
    const beat = () => void watch(!document.hidden);
    beat();
    const timer = setInterval(beat, 8000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
      void watch(false);
    };
  }, [open, p.code, p.token]);

  function show(on: boolean) {
    setOpen(on);
    setEnding(false);
    if (on) history.pushState(null, "", "#tide");
    else if (location.hash === "#tide")
      history.replaceState(null, "", location.pathname + location.search);
  }

  if (m === undefined) return null;
  const mine = m && !m.finished && !m.pick;
  return (
    <>
      <button
        class={"tide-entry" + (mine ? " yours" : "")}
        onClick={() => (m ? show(true) : void call({ cmd: "new" }))}
      >
        <span class="tide-entry-icon" aria-hidden="true">
          🌊
        </span>
        <span class="tide-entry-text">
          <b>潮汐棋</b>
          <small>
            {!m
              ? "开一局慢棋"
              : m.finished
                ? `上一局 ${m.scores[me]} : ${m.scores[other]}`
                : `${m.turn + 1}/12 · ${mine ? "轮到你" : "等 " + partner}`}
          </small>
        </span>
        {m && !m.finished && (
          <span class="tide-entry-score">
            {m.scores[me]} : {m.scores[other]}
          </span>
        )}
      </button>
      {open && m && (
        <div class="tide-overlay" role="dialog" aria-label="潮汐棋">
          <div class="tide-overlay-bar">
            <button
              class="round-small"
              aria-label="收起棋盘"
              onClick={() => show(false)}
            >
              ✕
            </button>
            {error && <span class="tide-error">{error}</span>}
          </div>
          {m.finished && (
            <div class="tide-result">
              <b>
                {m.ended
                  ? "这局结束了"
                  : m.winner === -1
                    ? "平局"
                    : m.winner === me
                      ? "你赢了"
                      : partner + " 赢了"}
              </b>
              <span>
                {m.scores[me]} : {m.scores[other]}
              </span>
              <button class="primary" onClick={() => void call({ cmd: "new" })}>
                再来一局
              </button>
            </div>
          )}
          <TideBoard
            d={m}
            seat={me}
            profiles={p.profiles}
            now={p.now}
            disabled={m.finished}
            send={(cmd, payload) => call({ cmd, ...payload })}
            runKey={m.id}
            extra={
              !m.finished &&
              (m.together || m.deadline > 0) && (
                <button
                  class={"tide-live" + (m.deadline > 0 ? " on" : "")}
                  onClick={() =>
                    void call({ cmd: "live", on: !(m.deadline > 0) })
                  }
                >
                  {m.deadline > 0 ? "实时中" : "实时"}
                </button>
              )
            }
          />
          {!m.finished &&
            (ending ? (
              <div class="tide-actions">
                <button
                  class="secondary"
                  onClick={() => void call({ cmd: "abandon" })}
                >
                  确定结束
                </button>
                <button class="text-button" onClick={() => setEnding(false)}>
                  继续下
                </button>
              </div>
            ) : (
              <button
                class="text-button tide-end"
                onClick={() => setEnding(true)}
              >
                结束这局
              </button>
            ))}
        </div>
      )}
    </>
  );
}
