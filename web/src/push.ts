import { api, BASE } from "./api";

// 手机提醒的几种状态：
// unsupported 这台设备或浏览器收不到；install 要先添加到主屏幕（iPhone）；
// blocked 系统里关掉了通知；off 可以开启；on 已开启。
export type PushState = "unsupported" | "install" | "blocked" | "off" | "on";

const ios = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () =>
  matchMedia("(display-mode: standalone)").matches ||
  (navigator as { standalone?: boolean }).standalone === true;

let key: Promise<string | null> | undefined;
const serverKey = () =>
  (key ??= api("push/key")
    .then((r) => r.key as string | null)
    .catch(() => {
      key = undefined;
      return null;
    }));

export function registerWorker() {
  if ("serviceWorker" in navigator && isSecureContext)
    navigator.serviceWorker
      .register(BASE + "sw.js", { scope: BASE })
      .catch(() => {});
}

async function subscription() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function pushState(): Promise<PushState> {
  if (!isSecureContext || !("serviceWorker" in navigator)) return "unsupported";
  if (ios() && !standalone()) return "install";
  if (!("PushManager" in window) || !(await serverKey())) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "off";
  return (await subscription()) ? "on" : "off";
}

const toKey = (s: string) => {
  const raw = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

// 必须由点击触发：iPhone 只在用户手势里弹授权框。
export async function enablePush(code: string, token: string) {
  if ((await Notification.requestPermission()) !== "granted")
    return pushState();
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toKey((await serverKey())!),
    }));
  await api("rooms/" + code + "/push", "POST", sub.toJSON(), token);
  await api("rooms/" + code + "/push/test", "POST", undefined, token).catch(
    () => {},
  );
  return "on" as const;
}

export async function disablePush(code: string, token: string) {
  const sub = await subscription();
  if (sub) {
    await api(
      "rooms/" + code + "/push",
      "DELETE",
      { endpoint: sub.endpoint },
      token,
    ).catch(() => {});
    await sub.unsubscribe();
  }
  return "off" as const;
}

// 每次进房都把本机订阅再报一次：换设备、凭证轮换后服务器会清掉旧订阅。
export async function resyncPush(code: string, token: string) {
  if ((await pushState()) !== "on") return;
  const sub = await subscription();
  if (sub) await api("rooms/" + code + "/push", "POST", sub.toJSON(), token);
}
