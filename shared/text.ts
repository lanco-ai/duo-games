export function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\p{P}\p{S}\s]/gu, "");
}
export function text(value: unknown, max: number): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    [...value].length > max ||
    /[\u0000-\u001f]/.test(value)
  )
    throw new Error("INVALID");
  return value.trim();
}
export function integer(v: unknown, min: number, max: number): number {
  if (!Number.isSafeInteger(v) || Number(v) < min || Number(v) > max)
    throw new Error("INVALID");
  return Number(v);
}
export function near(a: string, b: string): boolean {
  if (a.length > 30 || b.length > 30) return false;
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        row[j] + 1,
        row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    row = next;
  }
  return (
    row[b.length] === 1 ||
    (b.length >= 2 &&
      [...new Set(a)].filter((c) => b.includes(c)).length >= b.length / 2)
  );
}
