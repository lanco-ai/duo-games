/** randomUUID is unavailable on plain HTTP; getRandomValues is still supported. */
export function randomId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
}
