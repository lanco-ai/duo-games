import type { Profile } from "../../shared/protocol";
export const BASE = import.meta.env.BASE_URL;
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
    return (
      JSON.parse(localStorage.getItem("duo.profile") || "null") || undefined
    );
  } catch {
    return undefined;
  }
}
export function remember(data: { code: string; token: string }, p?: Profile) {
  localStorage.setItem("duo.token." + data.code, data.token);
  localStorage.setItem("duo.lastRoom", data.code);
  if (p) localStorage.setItem("duo.profile", JSON.stringify(p));
}
export function roomLink(code: string) {
  return BASE + "r/" + code + location.search;
}
