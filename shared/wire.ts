/** Keep every WebSocket frame below 16KiB, including escaped Unicode text. */
export function frames(message: unknown, id: string): string[] {
  const json = JSON.stringify(message);
  if (new TextEncoder().encode(json).length <= 14000) return [json];
  const total = Math.ceil(json.length / 2048);
  if (total > 256) throw new Error("Message too large");
  return Array.from({ length: total }, (_, index) =>
    JSON.stringify({
      t: "part",
      id,
      index,
      total,
      text: json.slice(index * 2048, (index + 1) * 2048),
    }),
  );
}
export class Assembler {
  private pending = new Map<
    string,
    { at: number; total: number; pieces: Map<number, string> }
  >();
  accept(frame: any, now = Date.now()): any | null {
    if (frame?.t !== "part") return frame;
    if (
      typeof frame.id !== "string" ||
      frame.id.length > 100 ||
      !Number.isInteger(frame.total) ||
      frame.total < 1 ||
      frame.total > 256 ||
      !Number.isInteger(frame.index) ||
      frame.index < 0 ||
      frame.index >= frame.total ||
      typeof frame.text !== "string" ||
      frame.text.length > 2048
    )
      throw new Error("Invalid part");
    for (const [id, item] of this.pending)
      if (now - item.at > 10000) this.pending.delete(id);
    let item = this.pending.get(frame.id);
    if (!item) {
      if (this.pending.size >= 4) throw new Error("Too many partial messages");
      item = { at: now, total: frame.total, pieces: new Map() };
      this.pending.set(frame.id, item);
    }
    if (item.total !== frame.total) throw new Error("Invalid part count");
    item.pieces.set(frame.index, frame.text);
    if (item.pieces.size !== item.total) return null;
    this.pending.delete(frame.id);
    return JSON.parse(
      Array.from({ length: item.total }, (_, i) => item!.pieces.get(i)).join(
        "",
      ),
    );
  }
  clear() {
    this.pending.clear();
  }
}
