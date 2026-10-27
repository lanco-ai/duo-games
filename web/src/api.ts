import { localStore } from "./storage";
import type { Profile } from "../../shared/protocol";
import { ALPHABET } from "../../shared/protocol";
export const BASE = import.meta.env.BASE_URL;
export const IS_PREVIEW = BASE === "/duo-preview/";
export const roomStorageKey = (suffix: string) =>
  (IS_PREVIEW ? "duo.preview." : "duo.") + suffix;
export async function api(
  path: string,
  method = "GET",
  value?: unknown,
  token?: string,
) {
  const response = await fetch(BASE + "api/" + path, {
    method,
    headers: {
      ...(value ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: value ? JSON.stringify(value) : undefined,
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("暂时连接不上服务器，请稍后重试");
  }
  if (!response.ok) throw new Error(data.message || "操作失败，请重试");
  return data;
}
export function profile(): Profile | undefined {
  try {
    return JSON.parse(localStore.getItem("duo.profile") || "null") || undefined;
  } catch {
    return undefined;
  }
}
export function remember(data: { code: string; token: string }, p?: Profile) {
  localStore.setItem(roomStorageKey("token." + data.code), data.token);
  localStore.setItem(roomStorageKey("lastRoom"), data.code);
  if (p) localStore.setItem("duo.profile", JSON.stringify(p));
}
export function roomLink(code: string) {
  return BASE + "r/" + code + location.search;
}
let deviceQueue: Promise<unknown> = Promise.resolve();
export function bindDevice(
  code: string,
  token: string,
  slot: "primary" | "local" = "primary",
) {
  const task = deviceQueue
    .catch(() => {})
    .then(() => api("device/bind", "POST", { code, slot }, token));
  deviceQueue = task.catch(() => {});
  return task;
}
export function normalizeRoomCode(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.origin !== location.origin) return "";
      const match = url.pathname.match(
        /\/r\/([23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6})\/?$/i,
      );
      return match ? match[1].toUpperCase() : "";
    } catch {
      return "";
    }
  }
  return trimmed
    .toUpperCase()
    .replace(/[\s.·•\-]/g, "")
    .split("")
    .filter((c) => ALPHABET.includes(c))
    .join("")
    .slice(0, 6);
}
