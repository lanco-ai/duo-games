/** Track physical input sources separately: releasing one must not release another. */
export class HeldControls {
  private keys = new Map<string, number>();
  private pointers = new Map<number, number>();
  get bits() {
    let bits = 0;
    for (const value of this.keys.values()) bits |= value;
    for (const value of this.pointers.values()) bits |= value;
    return bits;
  }
  key(code: string, bit: number, down: boolean) {
    if (down) this.keys.set(code, bit);
    else this.keys.delete(code);
  }
  pointer(id: number, bit: number, down: boolean) {
    if (down) this.pointers.set(id, bit);
    else this.pointers.delete(id);
  }
  clear() {
    this.keys.clear();
    this.pointers.clear();
  }
}
