import { useEffect, useRef, useState } from "preact/hooks";
import { ALPHABET, type Profile } from "../../shared/protocol";
import { games, type GameMeta } from "../../shared/catalog";
import { api, BASE, profile, remember, roomLink, roomStorageKey } from "./api";
import { Catalog, GameInfo } from "./ui/catalog";
import { Modal, ProfileForm, copyText } from "./ui/common";
import { Critter, Logo, Scene, TetheredPair } from "./art/ui";
import { Icon } from "./ui/icons";
export function Home() {
  const [creating, setCreating] = useState(false),
    [randomMode, setRandomMode] = useState(false),
    [ticket, setTicket] = useState<{ token: string; profile: Profile } | null>(
      null,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<GameMeta | null>(null),
    [wantGame, setWantGame] = useState(""),
    [code, setCode] = useState(""),
    [joining, setJoining] = useState(false),
    [privacy, setPrivacy] = useState(false),
    [toast, setToast] = useState("");
  const cancelling = useRef(false);
  const last = localStorage.getItem(roomStorageKey("lastRoom")),
    back = last && localStorage.getItem(roomStorageKey("token." + last)),
    me = profile();
  async function create(p: Profile) {
    setBusy(true);
    setError("");
    try {
      const data = await api("rooms", "POST", { profile: p });
      remember(data, p);
      if (wantGame)
        sessionStorage.setItem(
          roomStorageKey("propose." + data.code),
          wantGame,
        );
      location.assign(roomLink(data.code));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  function enterMatched(data: { code: string; token: string }, p: Profile) {
    remember(data, p);
    location.assign(roomLink(data.code));
  }
  async function startMatching(p: Profile) {
    setBusy(true);
    setError("");
    cancelling.current = false;
    try {
      let clientId = localStorage.getItem(roomStorageKey("matchClient"));
      if (!clientId || !/^[a-f0-9]{32}$/.test(clientId)) {
        clientId = Array.from(
          crypto.getRandomValues(new Uint8Array(16)),
          (byte) => byte.toString(16).padStart(2, "0"),
        ).join("");
        localStorage.setItem(roomStorageKey("matchClient"), clientId);
      }
      const data = await api("matchmaking", "POST", { profile: p, clientId });
      setTicket({ token: data.ticket, profile: p });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!ticket) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const data = await api("matchmaking", "GET", undefined, ticket.token);
        if (!active || cancelling.current) return;
        if (data.status === "matched") {
          enterMatched(data, ticket.profile);
          return;
        }
        setError("");
      } catch (e) {
        const message = (e as Error).message;
        if (active)
          setError(
            message === "房间凭证已失效，请重新加入"
              ? "匹配已过期，请取消后重新开始。"
              : message,
          );
        if (message === "房间凭证已失效，请重新加入") return;
      }
      if (active && !cancelling.current) timer = setTimeout(poll, 2000);
    };
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [ticket]);
  async function cancelMatching() {
    if (!ticket) return;
    cancelling.current = true;
    setBusy(true);
    try {
      const data = await api("matchmaking", "DELETE", undefined, ticket.token);
      if (data.status === "matched") {
        enterMatched(data, ticket.profile);
        return;
      }
      setTicket(null);
      setCreating(false);
      setError("");
    } catch (e) {
      setError((e as Error).message);
      cancelling.current = false;
      setTicket({ ...ticket });
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    const ok = await copyText(location.origin + BASE);
    setToast(ok ? "网址已复制，发给 TA 吧" : "长按地址栏复制网址");
    setTimeout(() => setToast(""), 2600);
  }
  return (
    <>
      <section class="home-hero">
        <Scene ground />
        <header class="home-top">
          {back ? (
            <a class="pill-link" href={roomLink(last!)}>
              <Icon name="home" /> 回到我们的房间
            </a>
          ) : (
            <span class="pill-link quiet">两个人，刚刚好</span>
          )}
        </header>
        <div class="home-title">
          <svg class="rainbow" viewBox="0 0 200 110" aria-hidden="true">
            {[
              "#FF6B6B",
              "#FFA94D",
              "#FFE066",
              "#8CE99A",
              "#74C0FC",
              "#B197FC",
            ].map((c, i) => (
              <path
                d={`M${12 + i * 7},104 A${88 - i * 7},${88 - i * 7} 0 0 1 ${188 - i * 7},104`}
                fill="none"
                stroke={c}
                stroke-width="7.4"
              />
            ))}
          </svg>
          <Critter
            avatar="🐱"
            color="#FFC93C"
            mood="joy"
            size={58}
            class="rainbow-rider"
          />
          <Logo />
          <h1 class="ribbon">和 TA 一起玩的小游戏</h1>
        </div>
        <div class="menu-panel panel">
          <button
            class="go big wide hero-button"
            onClick={() => {
              setWantGame("");
              setRandomMode(false);
              setError("");
              setCreating(true);
            }}
          >
            <Icon name="heart" /> 创建房间，邀请 TA
          </button>
          <button
            class="primary big wide"
            onClick={() => {
              setWantGame("");
              setRandomMode(true);
              setError("");
              setCreating(true);
            }}
          >
            🎲 随机匹配在线玩家
          </button>
          <button
            class="primary big wide join-trigger"
            aria-expanded={joining}
            onClick={() => setJoining(!joining)}
          >
            <Icon name="key" /> 我有房间码
          </button>
          {joining && (
            <form
              class="code-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.length === 6) location.assign(roomLink(code));
              }}
            >
              <label class="sr-only" for="room-code">
                六位房间码
              </label>
              <input
                id="room-code"
                aria-label="六位房间码"
                value={code}
                onInput={(e) =>
                  setCode(
                    e.currentTarget.value
                      .toUpperCase()
                      .split("")
                      .filter((c) => ALPHABET.includes(c))
                      .join("")
                      .slice(0, 6),
                  )
                }
                maxLength={20}
                placeholder="6 位房间码"
                autoCapitalize="characters"
                autoComplete="off"
              />
              <button class="go" disabled={code.length !== 6}>
                加入
              </button>
            </form>
          )}
          <p class="menu-note">不用下载注册 · 发个链接就能一起玩</p>
        </div>
        <nav class="side-buttons" aria-label="快捷入口">
          <a class="round-button" href="#games">
            <Icon name="grid" />
            <span>游戏</span>
            <b class="badge">{games.length}</b>
          </a>
          <button class="round-button" onClick={() => setPrivacy(true)}>
            <Icon name="book" />
            <span>说明</span>
          </button>
          <button class="round-button" onClick={() => void share()}>
            <Icon name="share" />
            <span>分享</span>
          </button>
        </nav>
        <div class="hero-couple" aria-hidden="true">
          <TetheredPair
            size={84}
            left={{ avatar: me?.avatar || "🐰", color: me?.color || "#FF6B6B" }}
            right={{
              avatar: me?.avatar === "🐻" ? "🐰" : "🐻",
              color: me?.color === "#4D9DFF" ? "#FF6B6B" : "#4D9DFF",
            }}
          />
        </div>
      </section>
      <main class="home-main underground" id="games">
        <ol class="steps">
          <li>
            <b>1</b>创建房间
          </li>
          <li>
            <b>2</b>链接发给 TA
          </li>
          <li>
            <b>3</b>一起挑游戏
          </li>
        </ol>
        <Catalog pick={setSelected} />
        <section class="moments">
          <h2 class="wood-sign">什么时候玩？</h2>
          <div class="moment-grid">
            <article>
              <Icon name="video" />
              <h3>异地视频时</h3>
              <p>开着微信视频，一人一部手机，像坐在一起。</p>
            </article>
            <article>
              <Icon name="sofa" />
              <h3>窝在一起时</h3>
              <p>比各刷各的手机更有意思。</p>
            </article>
            <article>
              <Icon name="clock" />
              <h3>等餐排队时</h3>
              <p>一局几分钟，随时可以停。</p>
            </article>
          </div>
        </section>
        <footer>
          <p>不用注册 · 房间只属于你们俩 · 30 天不玩自动清理</p>
          <button class="text-button" onClick={() => setPrivacy(true)}>
            关于与隐私说明
          </button>
        </footer>
      </main>
      {toast && (
        <div class="toast" role="status">
          {toast}
        </div>
      )}
      {selected && (
        <GameInfo
          game={selected}
          close={() => setSelected(null)}
          start={() => {
            setSelected(null);
            setWantGame(selected.id);
            setRandomMode(false);
            setCreating(true);
          }}
        />
      )}
      {creating && (
        <Modal
          title={randomMode ? "随机匹配" : "先认识一下你"}
          close={() => {
            if (!busy) ticket ? void cancelMatching() : setCreating(false);
          }}
        >
          {ticket ? (
            <div class="match-wait" role="status">
              <div class="match-spinner" aria-hidden="true">
                🎲
              </div>
              <h3>正在寻找一起玩的伙伴…</h3>
              <p>匹配成功后会自动进入双人房间，请保持页面打开。</p>
              <button
                class="secondary wide"
                disabled={busy}
                onClick={() => void cancelMatching()}
              >
                取消匹配
              </button>
            </div>
          ) : (
            <>
              <p class="muted center">
                {randomMode
                  ? "将随机配对一位在线玩家。对方可看到你的昵称、形象和在房间中分享的内容。"
                  : "选一个小伙伴，再给 TA 留一个熟悉的名字。"}
              </p>
              <ProfileForm
                initial={profile()}
                submit={randomMode ? startMatching : create}
                busy={busy}
                label={randomMode ? "开始随机匹配" : "创建我们的房间"}
              />
            </>
          )}
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
      {privacy && (
        <Modal title="关于二人世界" close={() => setPrivacy(false)}>
          <p>
            一个专为两个人做的小游戏合集。从慢慢聊天到并肩闯关，总有一种适合今天的你们。
          </p>
          <h3>只属于你们的空间</h3>
          <p>
            无需手机号或邮箱。房间凭证只保存在你的浏览器，请妥善保管设备。拥有邀请链接的人可以占用空座位，请只分享给
            TA。
          </p>
          <p>
            资料、收藏、聊过的卡片和写下的回答保存在服务器。聊天消息仅暂存在运行中的房间；服务器日志不记录聊天和回答内容。
          </p>
          <p>
            连续 30
            天没有活动的房间会自动清理，也可以在房间设置里解散房间。浏览器清除数据后，需使用原设备生成的换设备链接恢复座位。
          </p>
          <p class="muted small-print">
            标题字体：站酷快乐体（SIL Open Font License 1.1）
          </p>
        </Modal>
      )}
    </>
  );
}
