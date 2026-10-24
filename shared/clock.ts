export class Clock {
  private samples: { rtt: number; offset: number }[] = [];
  offset = 0;
  rtt = 0;
  sample(sent: number, server: number, received: number) {
    const rtt = received - sent;
    if (!Number.isFinite(rtt) || rtt < 0 || rtt > 30000) return;
    this.rtt = rtt;
    this.samples.push({ rtt, offset: server + rtt / 2 - received });
    if (this.samples.length > 8) this.samples.shift();
    this.offset = this.samples.reduce((a, b) => (a.rtt < b.rtt ? a : b)).offset;
  }
  now(local: number) {
    return local + this.offset;
  }
}
