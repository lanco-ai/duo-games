import { localStore, sessionStore } from "./storage";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Profile } from "../../shared/protocol";
import { games, type GameMeta } from "../../shared/catalog";
import {
  api,
  BASE,
  bindDevice,
  normalizeRoomCode,
  transferPath,
  profile,
  remember,
  roomAppearances,
  roomLink,
  roomStorageKey,
} from "./api";
import { Catalog, GameInfo } from "./ui/catalog";
import { Modal, ProfileForm, copyText } from "./ui/common";
import { Logo, Scene, TetheredPair } from "./art/ui";
import { IslandMini } from "./art/island";
import { TideMini } from "./art/tide";
import { Icon } from "./ui/icons";
export function Home({ online }: { online: number | null }) {
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
    [deviceLast, setDeviceLast] = useState<string | null>(null),
    [privacy, setPrivacy] = useState(false),
    [allGames, setAllGames] = useState(location.hash === "#games"),
    [toast, setToast] = useState("");
  const cancelling = useRef(false),
    codeInput = useRef<HTMLInputElement>(null);
  const cachedLast = localStore.getItem(roomStorageKey("lastRoom")),
    cachedToken =
      cachedLast && localStore.getItem(roomStorageKey("token." + cachedLast)),
    last = (cachedToken ? cachedLast : null) || deviceLast,
    back = !!last,
    me = profile(),
    appearances = roomAppearances(last);
  useEffect(() => {
    let active = true;
    void (async () => {
      if (cachedLast && cachedToken)
        await bindDevice(cachedLast, cachedToken).catch(() => {});
      const lastDevice = await api("device/last").catch(() => null);
      if (active && lastDevice?.code) setDeviceLast(lastDevice.code);
    })();
    return () => {
      active = false;
    };
  }, []);
  async function create(p: Profile) {
    setBusy(true);
    setError("");
    try {
      const data = await api("rooms", "POST", { profile: p });
      remember(data, p);
      await bindDevice(data.code, data.token).catch(() => {});
      if (wantGame)
        sessionStore.setItem(roomStorageKey("propose." + data.code), wantGame);
      location.assign(roomLink(data.code));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function enterMatched(
    data: { code: string; token: string },
    p: Profile,
  ) {
    remember(data, p);
    await bindDevice(data.code, data.token).catch(() => {});
    location.assign(roomLink(data.code));
  }
  async function startMatching(p: Profile) {
    setBusy(true);
    setError("");
    cancelling.current = false;
    try {
      let clientId = localStore.getItem(roomStorageKey("matchClient"));
      if (!clientId || !/^[a-f0-9]{32}$/.test(clientId)) {
        clientId = Array.from(
          crypto.getRandomValues(new Uint8Array(16)),
          (byte) => byte.toString(16).padStart(2, "0"),
        ).join("");
        localStore.setItem(roomStorageKey("matchClient"), clientId);
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
          void enterMatched(data, ticket.profile);
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
        await enterMatched(data, ticket.profile);
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
  function startCreate(random: boolean) {
    setWantGame("");
    setRandomMode(random);
    setError("");
    setCreating(true);
  }
  async function share() {
    const ok = await copyText(location.origin + BASE);
    setToast(ok ? "网址已复制，发给 TA 吧" : "长按地址栏复制网址");
    setTimeout(() => setToast(""), 2600);
  }
  const go = (hash: string) =>
    back ? location.assign(roomLink(last!) + hash) : startCreate(false);
  return (
    <div class="home-page">
      <Scene ground />
      <main class="home-shell" id="games">
        <section class="home-lead">
          <div class="home-title">
            <Logo />
            <h1 class="sr-only">二人世界</h1>
          </div>
          <div class={"home-panel" + (back ? " with-pair" : "")}>
            {back && (
              <div class="home-pair" aria-hidden="true">
                <TetheredPair
                  size={64}
                  left={appearances[0] || me || null}
                  right={appearances[1]}
                />
              </div>
            )}
            {back ? (
              <a class="home-go" href={roomLink(last!) + "#island"}>
                <Icon name="home" /> 回到我们的岛
              </a>
            ) : (
              <button class="home-go" onClick={() => startCreate(false)}>
                <Icon name="heart" /> 创建房间，邀请 TA
              </button>
            )}
            <button
              class="home-alt join-trigger"
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
                  ref={codeInput}
                  onInput={(e) => {
                    const target = transferPath(e.currentTarget.value);
                    if (target) return location.assign(target);
                    const normalized = normalizeRoomCode(e.currentTarget.value);
                    e.currentTarget.value = normalized;
                    setCode(normalized);
                  }}
                  onPaste={(e) => {
                    if (!e.clipboardData) return;
                    e.preventDefault();
                    const text = e.clipboardData.getData("text");
                    const target = transferPath(text);
                    if (target) location.assign(target);
                    else setCode(normalizeRoomCode(text));
                  }}
                  maxLength={2048}
                  placeholder="6 位房间码"
                  autoCapitalize="characters"
                  autoComplete="off"
                />
                <button
                  type="button"
                  aria-label="粘贴房间号"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      const target = transferPath(text);
                      if (target) location.assign(target);
                      else setCode(normalizeRoomCode(text));
                    } catch {
                      codeInput.current?.focus();
                      setToast("请长按输入框粘贴房间号");
                      setTimeout(() => setToast(""), 2600);
                    }
                  }}
                >
                  粘贴
                </button>
                <button class="go" disabled={code.length !== 6}>
                  加入
                </button>
              </form>
            )}
            <div class="home-links">
              {back && (
                <button class="text-button" onClick={() => startCreate(false)}>
                  新建房间
                </button>
              )}
              <button class="text-button" onClick={() => startCreate(true)}>
                随机匹配在线玩家
              </button>
              <span
                class="online-count"
                role="status"
                title="按最近活跃的浏览器估算，同一浏览器的多个窗口计为一人"
              >
                <span aria-hidden="true">●</span>{" "}
                {online === null ? "在线人数暂不可用" : `当前在线 ${online} 人`}
              </span>
            </div>
          </div>
        </section>
        <section class="home-features" aria-label="主角玩法">
          <button class="feature feature-island" onClick={() => go("#island")}>
            <span class="feature-art">
              <IslandMini />
            </span>
            <b>半途岛</b>
            <span>一起种地、做东西、寄纸船，把岛养大</span>
          </button>
          <button class="feature feature-tide" onClick={() => go("#tide")}>
            <span class="feature-art">
              <TideMini />
            </span>
            <b>潮汐棋</b>
            <span>同时出牌，在涨落的潮水里抢分</span>
          </button>
        </section>
        <div class="home-more">
          <button
            class="more-games"
            aria-expanded={allGames}
            onClick={() => setAllGames(!allGames)}
          >
            全部小游戏 · {games.length}
          </button>
          {allGames && <Catalog pick={setSelected} />}
        </div>
        <footer class="home-foot">
          <p>不用注册 · 房间只属于你们俩 · 30 天不玩自动清理</p>
          <div>
            <button class="home-chip" onClick={() => setPrivacy(true)}>
              <Icon name="book" /> 关于与隐私说明
            </button>
            <button class="home-chip" onClick={() => void share()}>
              <Icon name="share" /> 分享网址
            </button>
          </div>
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
              {randomMode && (
                <p class="muted center">
                  将随机配对一位在线玩家。对方可看到你的昵称、形象和在房间中分享的内容。
                </p>
              )}
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
            一座两个人一起养的小岛，一盘可以慢慢下的棋，还有一些两个人玩的小游戏。
          </p>
          <h3>只属于你们的空间</h3>
          <p>
            无需手机号或邮箱。房间凭证只保存在你的浏览器，请妥善保管设备。拥有邀请链接的人可以占用空座位，请只分享给
            TA。
          </p>
          <p>
            为了在同一浏览器重新进入房间，设备会话会保存最多 90
            天。清除浏览器数据后，需要原设备的换设备链接恢复。
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
    </div>
  );
}
