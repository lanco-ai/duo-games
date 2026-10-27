/** Anonymous, approximate count of active browser profiles, not registered users. */
export class Presence {
  private clients = new Map<string, number>();
  expire(now = Date.now()) {
    for (const [id, seen] of this.clients)
      if (now - seen > 60_000) this.clients.delete(id);
  }
  heartbeat(id: unknown, now = Date.now()) {
    if (typeof id !== "string" || !/^[a-f0-9]{32}$/.test(id))
      throw new Error("INVALID");
    this.expire(now);
    if (!this.clients.has(id) && this.clients.size >= 10_000)
      throw new Error("RATE_LIMITED");
    this.clients.set(id, now);
    return this.clients.size;
  }
}
