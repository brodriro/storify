/**
 * Per-user sliding window for assistant requests: every message and every
 * confirmation reaches the LLM, so one user (or a stuck script) must not be
 * able to run up the provider bill or starve the others. Keyed by username,
 * so opening more sockets or tabs does not raise the limit.
 */
export class ChatRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs = 60_000,
  ) {}

  /** Records a request; returns how long to wait when over the limit. */
  take(
    key: string,
    now = Date.now(),
  ): { allowed: boolean; retryAfterMs: number } {
    const since = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > since);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return { allowed: false, retryAfterMs: recent[0] + this.windowMs - now };
    }
    recent.push(now);
    this.hits.set(key, recent);
    return { allowed: true, retryAfterMs: 0 };
  }
}
