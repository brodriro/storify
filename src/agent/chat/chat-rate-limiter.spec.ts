import { ChatRateLimiter } from './chat-rate-limiter';

describe('ChatRateLimiter', () => {
  it('allows up to the limit within the window, then says how long to wait', () => {
    const limiter = new ChatRateLimiter(3, 60_000);
    expect(limiter.take('ALICE', 0).allowed).toBe(true);
    expect(limiter.take('ALICE', 10_000).allowed).toBe(true);
    expect(limiter.take('ALICE', 20_000).allowed).toBe(true);
    expect(limiter.take('ALICE', 30_000)).toEqual({
      allowed: false,
      retryAfterMs: 30_000,
    });
  });

  it('frees a slot once the oldest request leaves the window', () => {
    const limiter = new ChatRateLimiter(2, 60_000);
    limiter.take('ALICE', 0);
    limiter.take('ALICE', 1_000);
    expect(limiter.take('ALICE', 59_999).allowed).toBe(false);
    expect(limiter.take('ALICE', 60_001).allowed).toBe(true);
  });

  it('does not count rejected requests', () => {
    const limiter = new ChatRateLimiter(1, 60_000);
    limiter.take('ALICE', 0);
    for (let i = 1; i < 10; i++) limiter.take('ALICE', i * 1_000);
    expect(limiter.take('ALICE', 60_001).allowed).toBe(true);
  });

  it('keeps one window per key', () => {
    const limiter = new ChatRateLimiter(1, 60_000);
    expect(limiter.take('ALICE', 0).allowed).toBe(true);
    expect(limiter.take('BOB', 0).allowed).toBe(true);
    expect(limiter.take('ALICE', 1).allowed).toBe(false);
  });
});
