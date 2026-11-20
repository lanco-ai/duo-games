// 大厅里的“棋桌”：异步潮汐棋的入口和棋盘浮层。
// 打开棋盘时每 8 秒告诉服务器“我在看”，两人都在看时可以切到实时。
import { useEffect, useState } from "preact/hooks";
import { api } from "../api";
import type { Transport } from "../net/transport";
import type { Profile, Seat } from "../../../shared/protocol";
import { TideBoard } from "../games/Tide";
import { TideMini } from "../art/tide";
import { DecorArt, ItemArt } from "../art/island";
import { DECOR, type Item } from "../../../shared/island/rules";
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
  const load = () =>
    api("rooms/" + p.code + "/tide", "GET", undefined, p.token)
      .then((r) => setM(r.match))
      .catch(() => {});
  /** 发一个操作；失败时说明原因，再拉一次真实状态（不清掉提示） */
  const call = async (body?: object) => {
    if (!body) return void load();
    try {
      const r = await api("rooms/" + p.code + "/tide", "POST", body, p.token);
      setM(r.match);
      return true;
    } catch (e) {
      const msg = (e as Error).message;
      setError(
        e instanceof TypeError || msg.includes("连接")
          ? "连不上服务器，等一下再试"
          : msg,
      );
      void load();
      return false;
    }
  };
  useEffect(() => {
    void call();
  }, [p.code, p.token]);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(""), 2600);
    return () => clearTimeout(t);
  }, [error]);
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
        <span class="tide-entry-icon">
          <TideMini />
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
          <TideBoard
            d={m}
            seat={me}
            profiles={p.profiles}
            now={p.now}
            disabled={m.finished}
            send={(cmd, payload) => call({ cmd, ...payload })}
            runKey={m.id}
            back={() => show(false)}
            note={
              m.turn === 0 && !m.finished && m.brought > 0
                ? `这盘带了 ${m.brought} 张岛上做的牌`
                : null
            }
            extra={
              !m.finished &&
              (m.together || m.deadline > 0) && (
                <button
                  class={"tide-live" + (m.deadline > 0 ? " on" : "")}
                  aria-pressed={m.deadline > 0}
                  onClick={() =>
                    void call({ cmd: "live", on: !(m.deadline > 0) })
                  }
                >
                  {m.deadline > 0 ? "实时中" : "实时"}
                </button>
              )
            }
            footer={
              !m.finished &&
              (ending ? (
                <div class="tide-end-confirm">
                  <button
                    class="tide-chip danger"
                    onClick={() => void call({ cmd: "abandon" })}
                  >
                    确定结束
                  </button>
                  <button class="tide-chip" onClick={() => setEnding(false)}>
                    继续下
                  </button>
                </div>
              ) : (
                <button class="tide-end" onClick={() => setEnding(true)}>
                  结束这局
                </button>
              ))
            }
          />
          {m.finished && (
            <div class="tide-result" role="status">
              <b>
                {m.ended
                  ? "这局结束了"
                  : m.winner === -1
                    ? "平局"
                    : m.winner === me
                      ? "你赢了"
                      : partner + " 赢了"}
              </b>
              <span class="tide-result-score">
                <em>你</em> {m.scores[me]} : {m.scores[other]}{" "}
                <em>{partner}</em>
              </span>
              {m.reward && (
                <div class="tide-reward">
                  {m.reward.kind === "decor" ? (
                    <>
                      <span class="tide-reward-art">
                        <DecorArt id={m.reward.decor} />
                      </span>
                      <span>
                        得到
                        {DECOR.find((d) => d.id === m.reward.decor)?.name}
                        ，摆在你的岸上了
                      </span>
                    </>
                  ) : (
                    <>
                      <span class="tide-reward-items">
                        {(Object.keys(m.reward.items) as Item[]).map((k) => (
                          <span>
                            <ItemArt item={k} />
                            <b>{m.reward.items[k]}</b>
                          </span>
                        ))}
                      </span>
                      <span>得到一包种子，已放进背包</span>
                    </>
                  )}
                </div>
              )}
              <button class="tide-go" onClick={() => void call({ cmd: "new" })}>
                再来一局
              </button>
            </div>
          )}
          {error && (
            <p class="tide-toast" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </>
  );
}
