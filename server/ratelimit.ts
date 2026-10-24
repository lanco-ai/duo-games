export class Bucket {
  private tokens: number;
  private last: number;
  constructor(
    private rate: number,
    private capacity = rate,
    now = Date.now(),
  ) {
    this.tokens = capacity;
    this.last = now;
  }
  take(now = Date.now()) {
    this.tokens = Math.min(
      this.capacity,
      this.tokens + ((now - this.last) * this.rate) / 1000,
    );
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens--;
    return true;
  }
}
