/** Q8 arithmetic. Products are numbers, never truncated to 32 bits. */
export const Q = 256;
export const fixed = (pixels: number) => Math.round(pixels * Q);
export const pixels = (value: number) => value / Q;
export const mul = (a: number, b: number) => Math.floor((a * b) / Q);
export const div = (a: number, b: number) => Math.trunc((a * Q) / b);
export function isqrt(n: number): number {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new RangeError("isqrt requires a nonnegative safe integer");
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r--;
  while ((r + 1) * (r + 1) <= n) r++;
  return r;
}
export function hashInts(values: Int32Array): number {
  let h = 2166136261;
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    for (let byte = 0; byte < 4; byte++) {
      h = Math.imul(h ^ ((value >>> (byte * 8)) & 255), 16777619);
    }
  }
  return h >>> 0;
}
