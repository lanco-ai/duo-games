import { isExtra, type ExtraView } from "../../shared/games/types";
import { lazy, Suspense } from "preact/compat";
import { useEffect, useRef, useState } from "preact/hooks";
import { games, type GameMeta } from "../../shared/catalog";
import {
  COLORS,
  DECKS,
  errors,
  type Action,
  type Card,
  type JournalEntry,
  type Profile,
  type RoomView,
  type Seat,
  type TalkView,
  type Settings,
} from "../../shared/protocol";
import { api, BASE, profile, remember, roomLink, roomStorageKey } from "./api";
import { Transport } from "./net/transport";
import { Catalog, GameInfo } from "./ui/catalog";
import { Couple, Modal, ProfileForm, copyText, unlockSound } from "./ui/common";
import { Critter, GameIcon, Scene, TetheredPair } from "./art/ui";
import { Icon } from "./ui/icons";
import { drawCritter, kindOf } from "./art/critter";
import { chunkyText, cloud, rope, sky as paintSky } from "./art/paint";
const ExtraStage = lazy(() => import("./games/ExtraStage"));
const Setup = lazy(() => import("./games/Setup"));
const Keepsakes = lazy(() => import("./ui/Keepsakes"));
const Talk = lazy(() => import("./games/Talk"));
type PublicRoom = {
  exists: boolean;
  full: boolean;
  host: { nickname: string; avatar: string };
  hostOnline: boolean;
  availableColors: string[];
};
export function Room({ code }: { code: string }) {
  const [token, setToken] = useState(
      localStorage.getItem(roomStorageKey("token." + code)) || "",
    ),
    [localToken, setLocalToken] = useState(
      localStorage.getItem(roomStorageKey("localPeer." + code)) || "",
    ),
    [localGame, setLocalGame] = useState<ExtraView | null>(null),
    [localConnected, setLocalConnected] = useState(false),
    [localSequence, setLocalSequence] = useState(0),
    [publicRoom, setPublicRoom] = useState<PublicRoom | null>(null),
    [room, setRoom] = useState<RoomView | null>(null),
    [game, setGame] = useState<TalkView | ExtraView | null>(null),
    [seat, setSeat] = useState<Seat>(0),
    [status, setStatus] = useState("正在连接…"),
    [error, setError] = useState(""),
    [fatal, setFatal] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<GameMeta | null>(null),
    [panel, setPanel] = useState(""),
    [clockTick, setClockTick] = useState(0),
    [copyFallback, setCopyFallback] = useState(""),
    [toast, setToast] = useState(""),
    [chat, setChat] = useState(""),
    [reaction, setReaction] = useState(""),
    [sound, setSound] = useState(localStorage.getItem("duo.sound") !== "off"),
    [deleteConfirm, setDeleteConfirm] = useState(false),
    [transfer, setTransfer] = useState(""),
    [resultImage, setResultImage] = useState(""),
    [writing, setWriting] = useState<Card | null>(null),
    [answer, setAnswer] = useState("");
  const transport = useRef<Transport>(),
    localTransport = useRef<Transport>(),
    localRoom = useRef<RoomView | null>(null),
    current = useRef<RoomView | null>(null),
    busyCount = useRef(0),
    reactionTimer = useRef<ReturnType<typeof setTimeout>>();
  const transferSecret = useRef(
    new URLSearchParams(location.hash.slice(1)).get("rebind"),
  );
  useEffect(() => {
    let cancelled = false;
    async function begin() {
      try {
        if (transferSecret.current) {
          const secret = transferSecret.current;
          transferSecret.current = null;
          history.replaceState(null, "", location.pathname + location.search);
          const data = await api("rooms/" + code + "/rebind", "POST", {
            secret,
          });
          remember(data);
          if (!cancelled) setToken(data.token);
          return;
        }
        if (!token) {
          const data = await api("rooms/" + code);
          if (!cancelled) setPublicRoom(data);
        }
      } catch (e) {
        if (!cancelled) setFatal((e as Error).message);
      }
    }
    void begin();
    return () => {
      cancelled = true;
    };
  }, [code, token]);
  useEffect(() => {
    if (!token) return;
    const url = new URL(BASE + "ws", location.origin);
    url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const t = new Transport(
      url.href,
      code,
      token,
      (m) => {
        if (m.t === "welcome") {
          setSeat(m.seat);
          setRoom(m.room);
          current.current = m.room;
          setGame(m.game);
          localStorage.setItem(roomStorageKey("lastRoom"), code);
        }
        if (m.t === "room") {
          setRoom(m.room);
          current.current = m.room;
        }
        if (m.t === "game") setGame(m.view);
        if (m.t === "err") {
          if (
            ["REPLACED", "BAD_TOKEN", "ROOM_NOT_FOUND", "VERSION"].includes(
              m.code,
            )
          )
            setFatal(m.msg);
          else setError(m.msg);
        }
        if (m.t === "evt") {
          if (m.e.type === "deleted") {
            localStorage.removeItem(roomStorageKey("token." + code));
            localStorage.removeItem(roomStorageKey("localPeer." + code));
            setLocalToken("");
            setFatal("房间已解散，愿下次相见还有新的故事。");
          } else if (m.e.type === "react") {
            setReaction(m.e.emoji);
            clearTimeout(reactionTimer.current);
            reactionTimer.current = setTimeout(() => setReaction(""), 2200);
          }
        }
      },
      setStatus,
    );
    transport.current = t;
    const visibility = () => t.send({ t: "vis", hidden: document.hidden });
    document.addEventListener("visibilitychange", visibility);
    return () => {
      t.stop();
      document.removeEventListener("visibilitychange", visibility);
      clearTimeout(reactionTimer.current);
    };
  }, [token, code]);
  useEffect(() => {
    if (!localToken || !token) return;
    const url = new URL(BASE + "ws", location.origin);
    url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const t = new Transport(
      url.href,
      code,
      localToken,
      (m) => {
        if (m.t === "welcome") {
          localRoom.current = m.room;
          setLocalSequence(m.room.seq);
          setLocalGame(m.game && "kind" in m.game ? m.game : null);
        }
        if (m.t === "room") {
          localRoom.current = m.room;
          setLocalSequence(m.room.seq);
        }
        if (m.t === "game")
          setLocalGame(m.view && "kind" in m.view ? m.view : null);
        if (
          m.t === "err" &&
          ["BAD_TOKEN", "ROOM_NOT_FOUND", "REPLACED"].includes(m.code)
        ) {
          localStorage.removeItem(roomStorageKey("localPeer." + code));
          setLocalToken("");
        }
      },
      (s) => setLocalConnected(s === "已连接"),
    );
    localTransport.current = t;
    return () => {
      t.stop();
      localTransport.current = undefined;
      localRoom.current = null;
      setLocalConnected(false);
    };
  }, [localToken, token, code]);
  useEffect(() => {
    const t = localTransport.current,
      r = localRoom.current;
    if (!localToken || !localConnected || !t || !r || !room) return;
    let action: Action | null = null;
    if (room.phase === "proposed" && room.proposal?.by === 0)
      action = { type: "accept" };
    else if (room.phase === "intro" && room.ready[0] && !room.ready[1])
      action = { type: "ready" };
    else if (room.phase === "result" && room.rematch[0] && !room.rematch[1])
      action = { type: "rematch" };
    if (action) void t.action(action, r.seq).catch(() => {});
  }, [
    localToken,
    localConnected,
    localSequence,
    room?.phase,
    room?.proposal?.by,
    room?.ready[0],
    room?.ready[1],
    room?.rematch[0],
    room?.rematch[1],
  ]);
  useEffect(() => {
    const timer = setInterval(() => setClockTick((v) => v + 1), 100);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 6000);
    return () => clearTimeout(timer);
  }, [error]);
  useEffect(() => {
    if (
      room &&
      ["lobby", "waiting"].includes(room.phase) &&
      sessionStorage.getItem(roomStorageKey("propose." + code))
    ) {
      const wanted = sessionStorage.getItem(roomStorageKey("propose." + code))!;
      sessionStorage.removeItem(roomStorageKey("propose." + code));
      void send({ type: "propose", gameId: wanted });
    }
  }, [room?.phase]);
  useEffect(() => {
    if (room?.phase !== "playing") return;
    let lock: any,
      cancelled = false;
    async function acquire() {
      try {
        if (document.visibilityState === "visible") {
          const item = await (navigator as any).wakeLock?.request("screen");
          if (cancelled) void item?.release();
          else lock = item;
        }
      } catch {}
    }
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      void lock?.release();
      document.removeEventListener("visibilitychange", acquire);
    };
  }, [room?.phase]);
  const viewKey = room
    ? room.phase === "result"
      ? "result"
      : ["playing", "countdown", "paused"].includes(room.phase)
        ? "play"
        : "lobby"
    : "";
  useEffect(() => {
    if (viewKey === "play" || viewKey === "result") window.scrollTo(0, 0);
  }, [viewKey]);
  async function send(a: Action) {
    if (!transport.current || !current.current) return false;
    busyCount.current++;
    setBusy(true);
    try {
      await transport.current.action(a, current.current.seq);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      busyCount.current--;
      setBusy(busyCount.current > 0);
    }
  }
  async function sendLocal(a: Action) {
    const t = localTransport.current,
      r = localRoom.current;
    if (!t || !r) return false;
    try {
      await t.action(a, r.seq);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  async function joinLocal() {
    if (!room || room.profiles[1] || seat !== 0) return;
    try {
      setBusy(true);
      const color = COLORS.find((c) => c !== room.profiles[0]?.color)!;
      const data = await api("rooms/" + code + "/join", "POST", {
        profile: { nickname: "同屏玩家", avatar: "🐻", color },
      });
      localStorage.setItem(roomStorageKey("localPeer." + code), data.token);
      setLocalToken(data.token);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function join(p: Profile) {
    setBusy(true);
    try {
      const data = await api("rooms/" + code + "/join", "POST", { profile: p });
      remember(data, p);
      setToken(data.token);
    } catch (e) {
      setError((e as Error).message);
      if ((e as Error).message === errors.ROOM_FULL)
        setPublicRoom((v) => (v ? { ...v, full: true } : v));
    } finally {
      setBusy(false);
    }
  }
  async function copyInvite() {
    const link = location.origin + BASE + "r/" + code;
    if (await copyText(link)) setToast("邀请链接已复制，发给 TA 吧");
    else setCopyFallback(link);
  }
  const activeGame =
    games.find((g) => g.id === room?.proposal?.gameId) || games[0];
  const now = transport.current?.now() || Date.now(),
    other = (1 - seat) as Seat,
    pair = transport.current?.pair || 0;
  const displayCode = code.slice(0, 3) + "·" + code.slice(3),
    isPlaying = room && ["playing", "countdown", "paused"].includes(room.phase);
  const p0 = room?.profiles[0],
    p1 = room?.profiles[1] || null,
    night = !!isPlaying && ["talk-cards", "heartbeat"].includes(activeGame.id),
    proposer = room?.proposal?.by;
  function saveResult() {
    if (!room?.result) return;
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 900;
    const c = canvas.getContext("2d")!;
    paintSky(c, 720, 900, "day");
    cloud(c, 40, 70, 180);
    cloud(c, 500, 140, 160);
    c.fillStyle = "#79CC50";
    c.fillRect(0, 760, 720, 140);
    c.fillStyle = "#A8703F";
    c.fillRect(0, 800, 720, 100);
    c.fillStyle = "#6FCB45";
    c.fillRect(0, 760, 720, 40);
    chunkyText(c, "二人世界", 360, 90, 64, "#FFD23F", "#8A3F0A");
    chunkyText(c, activeGame.name, 360, 168, 40, "#FFFFFF", "#C2410C");
    c.fillStyle = "#FFF8E1";
    c.strokeStyle = "#E3A64A";
    c.lineWidth = 8;
    c.beginPath();
    c.roundRect(90, 230, 540, 330, 40);
    c.fill();
    c.stroke();
    c.fillStyle = "#8C6A4F";
    c.font = '30px "DuoLatin", "DuoDisplay", sans-serif';
    c.textAlign = "center";
    c.fillText(room.result.primary.label, 360, 300);
    chunkyText(
      c,
      room.result.primary.value,
      360,
      400,
      92,
      "#FF6B6B",
      "#7A1E2E",
    );
    c.fillStyle = "#6B4F3A";
    c.font = "28px sans-serif";
    c.fillText(room.profiles.map((p) => p?.nickname).join("  ♥  "), 360, 505);
    room.profiles.forEach((p, i) => {
      if (p)
        drawCritter(c, kindOf(p.avatar), p.color, 210 + i * 300, 790, 190, {
          mood: "joy",
          pose: "up",
        });
    });
    rope(c, 260, 712, 460, 712, 260, 0);
    c.fillStyle = "#FFF8E1";
    c.font = "24px sans-serif";
    c.fillText(new Date().toLocaleDateString("zh-CN"), 360, 870);
    setResultImage(canvas.toDataURL("image/png"));
  }
  if (fatal)
    return (
      <div class="status-page">
        <Scene ground />
        <div class="panel status-panel">
          <Couple mood="sad" size={84} />
          <h1>{fatal}</h1>
          <p>属于你们的快乐，随时可以重新开始。</p>
          <a class="go big" href={BASE}>
            回到首页
          </a>
        </div>
      </div>
    );
  if (!token)
    return (
      <div class="join-page">
        <Scene ground />
        <header class="home-top">
          <a class="pill-link" href={BASE}>
            <Icon name="home" /> 二人世界
          </a>
        </header>
        <main class="join-main">
          {!publicRoom ? (
            <div class="panel status-panel">
              <Couple size={72} />
              <p>正在打开邀请…</p>
            </div>
          ) : publicRoom.full ? (
            <div class="panel status-panel">
              <Couple size={84} />
              <h1>这个房间已经有两个人啦</h1>
              <a class="go big" href={BASE}>
                自己建一个
              </a>
            </div>
          ) : (
            <div class="panel join-card">
              <div class="invite-head">
                <Critter
                  avatar={publicRoom.host.avatar}
                  color={
                    COLORS.find(
                      (c) => !publicRoom.availableColors.includes(c),
                    ) || "#FF6B6B"
                  }
                  mood="joy"
                  pose="up"
                  size={76}
                />
                <div>
                  <span class="eyebrow">给你的专属邀请</span>
                  <h1>
                    「{publicRoom.host.nickname}」邀请你
                    <br />
                    进入 TA 的二人世界
                  </h1>
                  <p class="room-code">
                    房间 <b>{displayCode}</b>
                  </p>
                </div>
              </div>
              <ProfileForm
                initial={profile()}
                blocked={COLORS.filter(
                  (c) => !publicRoom.availableColors.includes(c),
                )}
                submit={join}
                busy={busy}
              />
              <p class="muted center">
                {publicRoom.hostOnline
                  ? "● " + publicRoom.host.nickname + "在线，正在等你"
                  : "TA 留了一个位置给你"}
              </p>
            </div>
          )}
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
        </main>
      </div>
    );
  if (!room)
    return (
      <div class="status-page">
        <Scene ground />
        <div class="panel status-panel">
          <Couple size={72} />
          <h2>{status}</h2>
          <a class="text-button" href={BASE}>
            回首页
          </a>
        </div>
      </div>
    );
  const partnerOnline = room.online[other] && !room.away[other],
    countdown = Math.max(1, Math.ceil(((room.startAt || now) - now) / 1000));
  return (
    <div
      class={
        "room-page " +
        (isPlaying
          ? "playing game-" + activeGame.id
          : room.phase === "result"
            ? "resulting"
            : "lobby")
      }
    >
      <Scene variant={night ? "night" : "day"} />
      {!isPlaying && (
        <header class="room-topbar">
          <a href={BASE} class="round-small room-back" aria-label="回首页">
            <Icon name="home" />
          </a>
          <button class="room-code-button" onClick={copyInvite}>
            房间 <b>{displayCode}</b> <Icon name="copy" size={18} />
          </button>
          <button
            class="round-small"
            aria-label="房间设置"
            onClick={() => setPanel("settings")}
          >
            <Icon name="gear" />
          </button>
        </header>
      )}
      {room.restartNotice && (
        <div class="notice">
          服务器刚刚重启，这局没保存。房间和问答本仍然在。
        </div>
      )}
      {!isPlaying && room.phase !== "result" && (
        <main class="lobby-layout">
          <section class="couple-stage">
            <div class="island">
              <div class="island-couple">
                <TetheredPair
                  left={p0!}
                  right={p1}
                  size={96}
                  mood={p1 ? "joy" : "normal"}
                  leftOnline={room.online[0]}
                  rightOnline={room.online[1]}
                />
                <span
                  class={"rope-heart" + (p1 && partnerOnline ? " beat" : "")}
                >
                  ♥
                </span>
              </div>
              <div class="couple-names">
                <span class="name-tag" style={{ "--player": p0!.color }}>
                  {p0!.nickname}
                </span>
                <span
                  class="name-tag"
                  style={{ "--player": p1?.color || "#B9A89A" }}
                >
                  {p1?.nickname || "等 TA 来"}
                </span>
              </div>
            </div>
            <button class="network-detail" onClick={() => setPanel("net")}>
              <i
                class={
                  pair > 250 || status !== "已连接"
                    ? "red"
                    : !room.online[other]
                      ? "away"
                      : pair >= 120
                        ? "yellow"
                        : ""
                }
              />
              {status !== "已连接"
                ? status
                : room.online[other]
                  ? room.away[other]
                    ? "TA 暂时离开了"
                    : "TA 在线"
                  : "等 TA 上线"}{" "}
              · {pair}ms
            </button>
            {!p1 && (
              <div class="invite-box panel">
                <h3>等 TA 加入…</h3>
                <p>把链接发给 TA，TA 打开就会出现在这里。</p>
                <button class="go wide" onClick={copyInvite}>
                  复制邀请链接 ↗
                </button>
                {seat === 0 && (
                  <button
                    class="secondary wide"
                    disabled={busy}
                    onClick={() => void joinLocal()}
                  >
                    在这台设备上双人玩
                  </button>
                )}
              </div>
            )}
            {room.phase === "proposed" && room.proposal && (
              <div
                class={
                  "proposal bubble " +
                  (proposer === 0 ? "from-left" : "from-right")
                }
                role="status"
              >
                <GameIcon id={activeGame.id} />
                <span>
                  {proposer === seat
                    ? "你"
                    : room.profiles[room.proposal.by]?.nickname}
                  想玩「{activeGame.name}」{!p1 ? "，等 TA 来一起玩" : ""}
                </span>
                <div class="proposal-buttons">
                  {proposer !== seat && (
                    <button
                      class="go"
                      disabled={busy}
                      onClick={() => void send({ type: "accept" })}
                    >
                      好呀
                    </button>
                  )}
                  <button
                    class="secondary"
                    disabled={busy}
                    onClick={() => void send({ type: "decline" })}
                  >
                    {proposer === seat ? "取消提议" : "换一个"}
                  </button>
                </div>
              </div>
            )}
            <nav class="keepsake-row" aria-label="我们的小屋">
              <button
                class="round-button"
                aria-label="我们的问答本"
                onClick={() => setPanel("journal")}
              >
                <Icon name="book" />
                <span>问答本</span>
                {room.journalCount > 0 && (
                  <b class="badge">{room.journalCount}</b>
                )}
              </button>
              <button
                class="round-button"
                aria-label="我们的画廊"
                onClick={() => setPanel("gallery")}
              >
                <Icon name="photo" />
                <span>画廊</span>
              </button>
              <button
                class="round-button"
                aria-label="一起玩过的游戏"
                onClick={() => setPanel("history")}
              >
                <Icon name="trophy" />
                <span>战绩</span>
              </button>
              <button
                class="round-button"
                aria-label="我们的词、题与小约定"
                onClick={() => setPanel("library")}
              >
                <Icon name="pinky" />
                <span>约定</span>
              </button>
              <button
                class="round-button"
                aria-label="收藏的卡"
                onClick={() => setPanel("favorites")}
              >
                <Icon name="star" />
                <span>收藏</span>
                {room.favorites[seat].length > 0 && (
                  <b class="badge">{room.favorites[seat].length}</b>
                )}
              </button>
            </nav>
          </section>
          <div class="lobby-games underground">
            <Catalog
              pick={setSelected}
              pair={pair}
              wanted={
                room.phase === "proposed" && proposer !== seat
                  ? room.proposal?.gameId
                  : undefined
              }
            />
          </div>
        </main>
      )}
      {isPlaying && (
        <main class="play-layout">
          <div class="hud">
            <button
              class="round-small"
              aria-label="退出本局"
              onClick={() => setPanel("exit")}
            >
              <Icon name="close" />
            </button>
            <div class="hud-title">
              <b>{activeGame.name}</b>
              <small>{activeGame.tagline}</small>
            </div>
            <button class="hud-net" onClick={() => setPanel("net")}>
              <i class={pair > 250 ? "red" : pair >= 120 ? "yellow" : ""} />
              {pair}ms
            </button>
            <button
              class="round-small"
              aria-label="查看规则"
              onClick={() => setPanel("rules")}
            >
              <Icon name="help" />
            </button>
          </div>
          {game && !("kind" in game) && (
            <Suspense fallback={<p class="stage-loading">正在准备卡片…</p>}>
              <Talk
                onWrite={(card) => {
                  setAnswer("");
                  setWriting(card);
                }}
                view={game}
                seat={seat}
                profiles={room.profiles}
                now={now}
                send={send}
                busy={busy || status !== "已连接" || room.phase !== "playing"}
                sendLocal={localToken && localConnected ? sendLocal : undefined}
              />
            </Suspense>
          )}
          {game && "kind" in game && transport.current && (
            <Suspense fallback={<p class="stage-loading">正在打开游戏…</p>}>
              <ExtraStage
                view={game}
                seat={seat}
                room={room}
                now={now}
                transport={transport.current}
                send={send}
                disabled={status !== "已连接" || room.phase !== "playing"}
                code={code}
                token={token}
                local={
                  localToken && localConnected && localTransport.current
                    ? {
                        seat: 1,
                        view: localGame,
                        send: sendLocal,
                        transport: localTransport.current,
                        token: localToken,
                      }
                    : undefined
                }
              />
            </Suspense>
          )}
          {room.phase === "countdown" && (
            <div class="game-overlay countdown">
              <Couple left={p0!} right={p1} size={78} />
              <strong
                class="count-number"
                key={countdown > 3 ? "ready" : countdown}
              >
                {countdown > 3 ? "准备" : countdown}
              </strong>
              <p>两个人的时间，就要开始。</p>
            </div>
          )}
          {room.phase === "paused" && (
            <div class="game-overlay">
              <div class="panel overlay-panel">
                <Critter
                  avatar={room.profiles[other]?.avatar}
                  color={room.profiles[other]?.color || "#B9A89A"}
                  mood="sad"
                  size={92}
                />
                <h2>
                  {room.online[other]
                    ? "正在恢复连接…"
                    : "TA 掉线了，等 TA 回来…"}
                </h2>
                <strong class="pause-timer">
                  0:
                  {String(
                    Math.max(
                      0,
                      Math.ceil(((room.pauseDeadline || now) - now) / 1000),
                    ),
                  ).padStart(2, "0")}
                </strong>
                <p>这一局已暂停，等你们回来接着玩。</p>
                <button
                  class="secondary"
                  onClick={() => void send({ type: "lobby" })}
                >
                  回大厅
                </button>
              </div>
            </div>
          )}
        </main>
      )}
      {room.phase === "result" && room.result && (
        <main class="result-page">
          <div class="result-card panel">
            <div class="result-stars" aria-hidden="true">
              <span>★</span>
              <span>★</span>
              <span>★</span>
            </div>
            <div class="result-couple">
              {room.profiles.map(
                (p) =>
                  p && (
                    <Critter
                      avatar={p.avatar}
                      color={p.color}
                      mood="joy"
                      pose="up"
                      size={92}
                      class="hop"
                    />
                  ),
              )}
            </div>
            <h2 class="ribbon">{room.result.primary.label}</h2>
            <h1>{room.result.primary.value}</h1>
            {activeGame.id === "talk-cards" && (
              <p>收藏了 {room.result.stats.favorites || 0} 张卡片</p>
            )}
            <div class="result-highlight">
              {room.result.highlights.map((h) => (
                <p>
                  {h.replaceAll("{name}", "TA")}{" "}
                  {activeGame.id === "know-me" && (
                    <button
                      class="text-button"
                      onClick={() => {
                        transport.current?.send({
                          t: "chat",
                          text: ("聊聊这题：" + h).slice(0, 200),
                        });
                        setPanel("chat");
                      }}
                    >
                      聊聊这题
                    </button>
                  )}
                </p>
              ))}
            </div>
            <div class="result-buttons">
              <button
                class="primary big"
                disabled={busy || room.rematch[seat]}
                onClick={() => void send({ type: "rematch" })}
              >
                {room.rematch[seat] ? "等 TA 确认…" : "再来一局"}
              </button>
              <button
                class="secondary"
                onClick={() => void send({ type: "lobby" })}
              >
                换个游戏
              </button>
            </div>
            {room.rematch[other] && (
              <p class="rematch-note">TA 已经准备好再来一局啦</p>
            )}
            <div class="result-links">
              <button class="text-button" onClick={saveResult}>
                保存图片 ↗
              </button>
              <button class="text-button" onClick={() => setPanel("journal")}>
                📖 看看写下的回答
              </button>
            </div>
          </div>
        </main>
      )}
      <div class="social-bar">
        <div class="reactions">
          {["❤️", "😂", "😘", "👏", "🥺"].map((e) => (
            <button
              aria-label={"发送" + e}
              disabled={status !== "已连接"}
              onClick={() => transport.current?.send({ t: "react", e })}
            >
              {e}
            </button>
          ))}
        </div>
        <button class="chat-toggle" onClick={() => setPanel("chat")}>
          💬 聊天
        </button>
      </div>
      {reaction && (
        <div class="floating-reaction" aria-live="polite">
          {reaction}
        </div>
      )}
      {toast && (
        <div class="toast" role="status">
          {toast}
        </div>
      )}
      {error && (
        <div class="toast error" role="alert" onClick={() => setError("")}>
          {error}
        </div>
      )}
      {new URLSearchParams(location.search).has("debug") && (
        <pre class="debug">
          RTT {Math.round(transport.current?.clock.rtt || 0)}ms / pair {pair}ms
          <br />
          offset {Math.round(transport.current?.clock.offset || 0)}ms
          <br />
          seq {room.seq} / {room.phase}
          <br />
          lag {transport.current?.lag} ± {transport.current?.jitter}ms
          <br />
          回滚 {transport.current?.debug.rollbacks} / 最大{" "}
          {transport.current?.debug.maxDepth} 帧
          <br />
          停顿 {transport.current?.debug.freezes} / 输入延迟{" "}
          {transport.current?.debug.inputDelay} 帧 / 校验异常{" "}
          {transport.current?.debug.desyncs}
        </pre>
      )}
      {selected && (
        <GameInfo
          game={selected}
          close={() => setSelected(null)}
          start={() => {
            const gameId = selected.id;
            setSelected(null);
            void send({ type: "propose", gameId });
          }}
        />
      )}
      {room.phase === "intro" && (
        <Modal
          title={activeGame.name}
          close={() => void send({ type: "cancel" })}
        >
          <div class="intro-art">
            <GameIcon id={activeGame.id} />
            <div>
              <p class="intro-tagline">{activeGame.tagline}</p>
              <p class="intro-meta">
                {activeGame.tags.join(" · ")} · {activeGame.duration} ·{" "}
                {activeGame.net}
              </p>
            </div>
          </div>
          <p class="intro-text">{activeGame.intro}</p>
          <ol class="rules">
            {activeGame.rules.map((r) => (
              <li>{r}</li>
            ))}
          </ol>
          {activeGame.id === "talk-cards" ? (
            <>
              <p class="muted">
                轻点卡堆抽卡 · 点按钮收藏或写下回答 · 延迟友好
              </p>
              <fieldset disabled={room.proposal?.by !== seat || busy}>
                <label>
                  玩法{" "}
                  <select
                    aria-label="聊天玩法"
                    value={room.settings.talkMode || "classic"}
                    onChange={(e) =>
                      void send({
                        type: "settings",
                        settings: {
                          ...room.settings,
                          talkMode: e.currentTarget.value as "classic" | "pro",
                        },
                      })
                    }
                  >
                    <option value="classic">深夜聊天卡</option>
                    <option value="pro">真心话大冒险 Pro</option>
                  </select>
                </label>
                <legend>今晚想聊点什么？</legend>
                <div class="deck-options">
                  {DECKS.map((deck) => (
                    <label>
                      <input
                        type="checkbox"
                        checked={room.settings.decks.includes(deck)}
                        onChange={(e) => {
                          const decks = e.currentTarget.checked
                            ? [...room.settings.decks, deck]
                            : room.settings.decks.filter((d) => d !== deck);
                          if (decks.length)
                            void send({
                              type: "settings",
                              settings: { ...room.settings, decks },
                            });
                        }}
                      />
                      {deck}
                    </label>
                  ))}
                </div>
                <label class="limit-label">
                  本局张数{" "}
                  <select
                    aria-label="本局张数"
                    value={room.settings.limit}
                    onChange={(e) =>
                      void send({
                        type: "settings",
                        settings: {
                          ...room.settings,
                          limit: Number(
                            e.currentTarget.value,
                          ) as Settings["limit"],
                        },
                      })
                    }
                  >
                    <option value="10">10 张</option>
                    <option value="20">20 张</option>
                    <option value="0">不限</option>
                  </select>
                </label>
              </fieldset>
            </>
          ) : isExtra(activeGame.id) ? (
            <Suspense fallback={<p>正在准备设置…</p>}>
              <Setup
                id={activeGame.id}
                room={room}
                seat={seat}
                send={send}
                code={code}
                token={token}
                onLibrary={() => setPanel("library")}
              />
            </Suspense>
          ) : null}
          <div class="ready-row">
            {room.profiles.map(
              (p, i) =>
                p && (
                  <div
                    class={"ready-status" + (room.ready[i] ? " is-ready" : "")}
                  >
                    <Critter
                      avatar={p.avatar}
                      color={p.color}
                      mood={room.ready[i] ? "joy" : "normal"}
                      size={58}
                    />
                    <b>{p.nickname}</b>
                    <small>{room.ready[i] ? "✓ 已准备" : "… 还在看规则"}</small>
                  </div>
                ),
            )}
          </div>
          <button
            class="primary big wide"
            disabled={busy || room.ready[seat] || !room.online.every(Boolean)}
            onClick={() => {
              unlockSound();
              if (activeGame.id === "heartbeat") {
                if (localStorage.getItem("duo.inputOffset") === null) {
                  setError("先跟着节拍完成 8 次校准，再开始吧。");
                  return;
                }
                window.dispatchEvent(new Event("duo-audio-unlock"));
              }
              void send({ type: "ready" });
            }}
          >
            {room.ready[seat] ? "等 TA 准备好…" : "我准备好了"}
          </button>
        </Modal>
      )}
      {["gallery", "history", "library"].includes(panel) && (
        <Suspense fallback={<p>正在打开…</p>}>
          <Keepsakes
            panel={panel}
            code={code}
            token={token}
            seat={seat}
            profiles={room.profiles}
            transport={transport.current!}
            close={() => setPanel("")}
          />
        </Suspense>
      )}
      {panel === "chat" && (
        <Modal title="说给 TA 听" close={() => setPanel("")}>
          <div class="chat-log" aria-live="polite">
            {room.chat.length === 0 ? (
              <p class="muted">给 TA 留一句话吧。</p>
            ) : (
              room.chat.map((c) => (
                <div class={"chat-message " + (c.seat === seat ? "mine" : "")}>
                  <small>{room.profiles[c.seat]?.nickname}</small>
                  <p>{c.text}</p>
                </div>
              ))
            )}
          </div>
          <form
            class="chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (chat.trim() && status === "已连接") {
                transport.current?.send({ t: "chat", text: chat });
                setChat("");
              }
            }}
          >
            <input
              aria-label="聊天内容"
              placeholder="想对 TA 说什么…"
              value={chat}
              maxLength={200}
              onInput={(e) => setChat(e.currentTarget.value)}
            />
            <button
              class="primary"
              disabled={!chat.trim() || status !== "已连接"}
            >
              发送
            </button>
          </form>
        </Modal>
      )}
      {panel === "journal" && (
        <Journal
          code={code}
          token={token}
          room={room}
          close={() => setPanel("")}
        />
      )}
      {panel === "favorites" && (
        <Favorites
          code={code}
          token={token}
          seat={seat}
          close={() => setPanel("")}
        />
      )}
      {panel === "rules" && (
        <Modal title="怎么玩" close={() => setPanel("")}>
          <ol class="rules">
            {activeGame.rules.map((r) => (
              <li>{r}</li>
            ))}
          </ol>
          <p>{activeGame.intro}</p>
        </Modal>
      )}
      {panel === "net" && (
        <Modal title="我们的连接" close={() => setPanel("")}>
          <p>两人之间约 {pair}ms</p>
          <p>
            我的往返延迟：{Math.round(transport.current?.rtts[seat] || 0)}ms
          </p>
          <p>
            TA 的往返延迟：{Math.round(transport.current?.rtts[other] || 0)}ms
          </p>
          <p class="muted">
            {status}。{activeGame.net}；实时动作游戏在较高延迟时可能短暂停顿。
          </p>
        </Modal>
      )}
      {panel === "exit" && (
        <Modal title="现在结束这局吗？" close={() => setPanel("")}>
          <p>退出后这局就结束了，TA 也会看到结算。已经写下的回答会保留。</p>
          <button
            class="primary wide"
            onClick={() => {
              setPanel("");
              void send({ type: "exit" });
            }}
          >
            结束本局
          </button>
          <button class="text-button wide" onClick={() => setPanel("")}>
            继续玩
          </button>
        </Modal>
      )}
      {panel === "settings" && (
        <Modal
          title="我们的房间"
          close={() => {
            setPanel("");
            setDeleteConfirm(false);
          }}
        >
          <ProfileForm
            initial={room.profiles[seat]!}
            blocked={room.profiles[other] ? [room.profiles[other]!.color] : []}
            submit={async (p) => {
              if (await send({ type: "profile", profile: p })) {
                localStorage.setItem("duo.profile", JSON.stringify(p));
                setToast("资料已更新");
              }
            }}
            busy={busy}
            label="保存资料"
          />
          <div class="settings-row">
            <span>轻轻的提示音</span>
            <button
              class="secondary"
              onClick={() => {
                setSound(!sound);
                localStorage.setItem("duo.sound", sound ? "off" : "on");
                if (!sound) unlockSound();
              }}
            >
              {sound ? "已开启" : "已关闭"}
            </button>
          </div>
          <div class="settings-row">
            <span>在新设备继续玩</span>
            <button
              class="secondary"
              onClick={async () => {
                try {
                  const r = await api(
                    "rooms/" + code + "/rebind-link",
                    "POST",
                    undefined,
                    token,
                  );
                  setTransfer(
                    location.origin +
                      BASE +
                      "r/" +
                      code +
                      "#rebind=" +
                      r.secret,
                  );
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              生成换设备链接
            </button>
          </div>
          {transfer && (
            <div class="notice">
              <p>
                仅用一次，10
                分钟内有效。请只在自己的新设备上打开；新设备接管后，旧凭证失效。
              </p>
              <input
                aria-label="换设备链接"
                readOnly
                value={transfer}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                class="text-button"
                onClick={async () =>
                  setToast(
                    (await copyText(transfer))
                      ? "换设备链接已复制"
                      : "请选中上面的链接复制",
                  )
                }
              >
                复制链接
              </button>
            </div>
          )}
          <div class="danger-zone">
            {!deleteConfirm ? (
              <button
                class="text-button danger"
                onClick={() => setDeleteConfirm(true)}
              >
                解散房间…
              </button>
            ) : (
              <>
                <p>
                  确定解散吗？双方的资料、收藏和问答本都会永久删除，无法恢复。
                </p>
                <button
                  class="danger-button"
                  onClick={async () => {
                    try {
                      await api("rooms/" + code, "DELETE", undefined, token);
                      localStorage.removeItem(roomStorageKey("token." + code));
                      localStorage.removeItem(
                        roomStorageKey("localPeer." + code),
                      );
                      setLocalToken("");
                      setFatal("房间已解散");
                      setPanel("");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  确认永久解散
                </button>
                <button
                  class="text-button"
                  onClick={() => setDeleteConfirm(false)}
                >
                  保留房间
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
      {writing && (
        <Modal title="把这一刻写下来" close={() => setWriting(null)}>
          <p>{writing.text}</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await send({ type: "answer", cardId: writing.id, text: answer })
              )
                setWriting(null);
            }}
          >
            <textarea
              aria-label="你的回答"
              placeholder="这一刻，我想说……"
              value={answer}
              maxLength={300}
              rows={5}
              onInput={(e) => setAnswer(e.currentTarget.value)}
            />
            <p class="muted">
              {[...answer].length}/300 · TA 也能在问答本里看到
            </p>
            <button class="primary wide" disabled={busy || !answer.trim()}>
              存进我们的问答本
            </button>
          </form>
        </Modal>
      )}
      {copyFallback && (
        <Modal title="把这个链接发给 TA" close={() => setCopyFallback("")}>
          <p>长按选中并复制下面的邀请链接。</p>
          <input
            aria-label="邀请链接"
            readOnly
            value={copyFallback}
            onFocus={(e) => e.currentTarget.select()}
          />
        </Modal>
      )}
      {resultImage && (
        <Modal title="留住这一刻" close={() => setResultImage("")}>
          <p class="muted">长按图片保存；电脑上可以右键另存为。</p>
          <img
            class="result-image"
            src={resultImage}
            alt={
              activeGame.id === "talk-cards"
                ? "本局聊天纪念卡，不含房间码"
                : "本局纪念卡，不含房间码"
            }
          />
        </Modal>
      )}
    </div>
  );
}
function Favorites({
  code,
  token,
  seat,
  close,
}: {
  code: string;
  token: string;
  seat: Seat;
  close: () => void;
}) {
  const [items, setItems] = useState<{ text: string; deck: string }[] | null>(
      null,
    ),
    [error, setError] = useState("");
  useEffect(() => {
    api("rooms/" + code + "/favorites", "GET", undefined, token)
      .then((r) => setItems(r.cards[seat]))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <Modal title="收藏的卡" close={close}>
      {error ? (
        <p class="error">{error}</p>
      ) : !items ? (
        <p>正在翻开收藏…</p>
      ) : items.length ? (
        items.map((c) => (
          <article class="journal-entry">
            <small>{c.deck}</small>
            <p>{c.text}</p>
          </article>
        ))
      ) : (
        <div class="empty-state">
          ☆<p>把喜欢的卡收藏起来，下次还想聊。</p>
        </div>
      )}
    </Modal>
  );
}

function Journal({
  code,
  token,
  room,
  close,
}: {
  code: string;
  token: string;
  room: RoomView;
  close: () => void;
}) {
  const [entries, setEntries] = useState<JournalEntry[]>([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  async function more(offset: number) {
    setLoading(true);
    setError("");
    try {
      const data = await api(
        "rooms/" + code + "/journal?offset=" + offset,
        "GET",
        undefined,
        token,
      );
      setEntries((old) => (offset ? [...old, ...data.entries] : data.entries));
      setTotal(data.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void more(0);
  }, [room.journalCount]);
  return (
    <Modal title="我们的问答本" close={close}>
      <p class="muted">把想留住的话，慢慢写成我们的故事。</p>
      {error && <p class="error">{error}</p>}
      {!loading && !entries.length && !error ? (
        <div class="empty-state">
          ✎<p>这里还空着。抽到喜欢的卡，点「写下来」吧。</p>
        </div>
      ) : (
        entries.map((e) => (
          <article class="journal-entry">
            <h3>{e.question}</h3>
            <p>{e.text}</p>
            <small>
              {room.profiles[e.seat]?.nickname} ·{" "}
              {new Date(e.at).toLocaleDateString("zh-CN")}
            </small>
          </article>
        ))
      )}
      {loading ? (
        <p class="muted">正在翻开我们的故事…</p>
      ) : entries.length < total ? (
        <button
          class="secondary wide"
          onClick={() => void more(entries.length)}
        >
          再往前翻一页
        </button>
      ) : null}
    </Modal>
  );
}
