import type { EngineContext } from "./types";
export function levelProgress(seen: string[]) {
  const out: Record<string, number> = {};
  for (const key of seen) {
    const match = /^level:([a-z-]+):([1-6])$/.exec(key);
    if (match) out[match[1]] = Math.max(out[match[1]] || 1, Number(match[2]));
  }
  return out;
}
export function unlockedLevel(ctx: EngineContext, id: string, max: number) {
  return Math.min(max, levelProgress(ctx.seen)[id] || 1);
}
export function unlockNext(
  ctx: EngineContext,
  id: string,
  level: number,
  max: number,
) {
  ctx.seenQuestion(`level:${id}:${Math.min(max, level + 1)}`);
}
