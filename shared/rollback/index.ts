import { hashInts } from "../fixed";
export type Seat = 0 | 1;
export type InputPair = [number, number];
export type Frame = [tick: number, bits: number];
export interface RollbackOptions {
  seat: Seat;
  inputDelay?: number;
  maxRollback?: number;
  tickIndex?: number;
  send?: (frame: Frame) => void;
}
export interface RollbackStats {
  rollbacks: number;
  maxDepth: number;
  freezes: number;
}
/**
 * State at tick k means "before input k". Call advance(targetTick, sample) each
 * render frame, and receive(remoteSeat, tick, bits) on reliable rt delivery.
 * sample is invoked once per simulation tick; its bits are scheduled k+D.
 * D initial neutral frames are confirmed on both sides before the game starts.
 * The caller owns timeline/epoch validation, network delivery and render smoothing.
 */
export class RollbackSession {
  state: Int32Array;
  readonly seat: Seat;
  readonly inputDelay: number;
  readonly maxRollback: number;
  readonly tickIndex: number;
  readonly inputs: [Map<number, number>, Map<number, number>] = [
    new Map(),
    new Map(),
  ];
  readonly confirmed: [number, number] = [-1, -1];
  readonly snapshots = new Map<number, Int32Array>();
  readonly stats: RollbackStats = { rollbacks: 0, maxDepth: 0, freezes: 0 };
  frozen = false;
  needsResync = false;
  private used = new Map<number, InputPair>();
  private send?: (frame: Frame) => void;
  private initial: Int32Array;
  constructor(
    initial: Int32Array,
    private simulate: (
      state: Int32Array,
      inputs: InputPair,
    ) => Int32Array | void,
    options: RollbackOptions,
  ) {
    this.state = initial.slice();
    this.initial = initial.slice();
    this.seat = options.seat;
    this.inputDelay = Math.max(1, Math.min(4, options.inputDelay ?? 2));
    this.maxRollback = Math.max(2, Math.min(120, options.maxRollback ?? 16));
    this.tickIndex = options.tickIndex ?? 0;
    this.send = options.send;
    for (let t = 0; t < this.inputDelay; t++) {
      this.inputs[0].set(t, 0);
      this.inputs[1].set(t, 0);
    }
    this.confirmed[0] = this.confirmed[1] = this.inputDelay - 1;
    this.snapshots.set(this.tick, this.state.slice());
  }
  get tick() {
    return this.state[this.tickIndex];
  }
  get confirmedTick() {
    return Math.min(this.tick, this.confirmed[0] + 1, this.confirmed[1] + 1);
  }
  private track(seat: Seat) {
    while (this.inputs[seat].has(this.confirmed[seat] + 1))
      this.confirmed[seat]++;
  }
  private predicted(seat: Seat, tick: number) {
    const exact = this.inputs[seat].get(tick);
    if (exact !== undefined) return exact;
    // Search backward by tick: a future out-of-order packet cannot predict the past.
    for (let t = tick - 1; t >= 0; t--) {
      const previous = this.inputs[seat].get(t);
      if (previous !== undefined) return previous;
    }
    return 0;
  }
  receive(seat: Seat, tick: number, bits: number): boolean {
    if (
      (seat !== 0 && seat !== 1) ||
      !Number.isSafeInteger(tick) ||
      tick < 0 ||
      !Number.isInteger(bits) ||
      bits < 0 ||
      bits > 31
    )
      throw new Error("Invalid realtime frame");
    const old = this.inputs[seat].get(tick);
    if (old !== undefined) {
      if (old !== bits) throw new Error("Confirmed input cannot change");
      return false;
    }
    this.inputs[seat].set(tick, bits);
    this.track(seat);
    const used = this.used.get(tick);
    if (tick < this.tick && used && used[seat] !== bits) this.correct(tick);
    else if (tick < this.tick && !used && tick >= this.initial[this.tickIndex])
      this.needsResync = true;
    if (this.tick - this.confirmed[(1 - this.seat) as Seat] <= this.maxRollback)
      this.frozen = false;
    return true;
  }
  /** Schedule the current tick's sampled local input; repeated calls do not rewrite it. */
  sample(bits: number): Frame {
    if (!Number.isInteger(bits) || bits < 0 || bits > 31)
      throw new Error("Invalid local input");
    const tick = this.tick + this.inputDelay,
      old = this.inputs[this.seat].get(tick);
    if (old !== undefined) return [tick, old];
    this.inputs[this.seat].set(tick, bits);
    this.track(this.seat);
    const frame: Frame = [tick, bits];
    this.send?.(frame);
    return frame;
  }
  private one() {
    const tick = this.tick;
    this.snapshots.set(tick, this.state.slice());
    const pair: InputPair = [this.predicted(0, tick), this.predicted(1, tick)];
    this.used.set(tick, pair);
    const next = this.simulate(this.state, pair);
    if (next) this.state = next;
    if (this.tick === tick) this.state[this.tickIndex] = tick + 1;
    if (this.tick !== tick + 1)
      throw new Error("Simulation must advance exactly one tick");
    this.snapshots.set(this.tick, this.state.slice());
    const oldest = this.tick - this.maxRollback - 2;
    for (const key of this.snapshots.keys())
      if (key < oldest) this.snapshots.delete(key);
    for (const key of this.used.keys()) if (key < oldest) this.used.delete(key);
    if (this.tick % 600 === 0)
      for (const input of this.inputs)
        for (const key of input.keys())
          if (key < this.tick - 3600) input.delete(key);
  }
  /** Returns number of simulated ticks; frozen means wait for remote frames. */
  advance(
    targetTick: number,
    sample: number | ((tick: number) => number) = 0,
  ): number {
    let count = 0;
    while (this.tick < targetTick && !this.needsResync) {
      this.sample(typeof sample === "function" ? sample(this.tick) : sample);
      if (
        this.tick - this.confirmed[(1 - this.seat) as Seat] >
        this.maxRollback
      ) {
        if (!this.frozen) this.stats.freezes++;
        this.frozen = true;
        break;
      }
      this.frozen = false;
      this.one();
      count++;
    }
    return count;
  }
  private correct(tick: number) {
    const snapshot = this.snapshots.get(tick);
    if (!snapshot) {
      this.needsResync = true;
      this.frozen = true;
      return;
    }
    const end = this.tick;
    this.state = snapshot.slice();
    this.stats.rollbacks++;
    this.stats.maxDepth = Math.max(this.stats.maxDepth, end - tick);
    while (this.tick < end) this.one();
  }
  stateAt(tick: number): Int32Array | null {
    return this.snapshots.get(tick)?.slice() ?? null;
  }
  confirmedState(): { tick: number; state: Int32Array; hash: number } | null {
    const tick = this.confirmedTick,
      state = this.stateAt(tick);
    return state ? { tick, state, hash: hashInts(state) } : null;
  }
  /** Pause rolls back to the shared boundary and forgets every speculative future input. */
  pause(atTick: number): Int32Array {
    const snapshot = this.stateAt(atTick);
    if (!snapshot)
      throw new Error("Pause snapshot unavailable; request input replay");
    this.state = snapshot;
    for (const seat of [0, 1] as Seat[]) {
      for (const tick of this.inputs[seat].keys())
        if (tick >= atTick) this.inputs[seat].delete(tick);
      // Resume seeds a neutral input-delay prefix to prevent missing-frame deadlock.
      for (let tick = atTick; tick < atTick + this.inputDelay; tick++)
        this.inputs[seat].set(tick, 0);
      this.confirmed[seat] = atTick + this.inputDelay - 1;
    }
    this.snapshots.clear();
    this.used.clear();
    this.snapshots.set(atTick, snapshot.slice());
    this.frozen = false;
    this.needsResync = false;
    return snapshot.slice();
  }
  /** Reconnect/resync: provide a trusted boundary snapshot and the server's input logs. */
  reset(
    snapshot: Int32Array,
    history: [Frame[], Frame[]] = [[], []],
    seedNeutral = true,
  ) {
    this.state = snapshot.slice();
    this.initial = snapshot.slice();
    this.snapshots.clear();
    this.used.clear();
    this.snapshots.set(this.tick, this.state.slice());
    for (const seat of [0, 1] as Seat[]) {
      this.inputs[seat].clear();
      this.confirmed[seat] = this.tick - 1;
      for (const [tick, bits] of history[seat])
        this.inputs[seat].set(tick, bits);
      if (seedNeutral)
        for (let t = this.tick; t < this.tick + this.inputDelay; t++)
          if (!this.inputs[seat].has(t)) this.inputs[seat].set(t, 0);
      this.track(seat);
    }
    this.frozen = false;
    this.needsResync = false;
  }
  /** Deterministic replay only; never samples or emits fresh input packets. */
  replay(targetTick: number) {
    while (this.tick < targetTick) {
      if (!this.inputs[0].has(this.tick) || !this.inputs[1].has(this.tick))
        throw new Error("Incomplete replay input history");
      this.one();
    }
  }
  history(): [Frame[], Frame[]] {
    return [0, 1].map((seat) =>
      [...this.inputs[seat].entries()].sort((a, b) => a[0] - b[0]),
    ) as [Frame[], Frame[]];
  }
}
export function parameters(pairMs: number) {
  const frames = (pairMs * 60) / 1000;
  return {
    inputDelay: Math.max(1, Math.min(4, Math.round(frames / 4))),
    maxRollback: Math.max(8, Math.min(20, Math.ceil(frames) + 4)),
  };
}
