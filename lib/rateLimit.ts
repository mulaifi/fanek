interface RateLimiterConfig {
  windowMs: number;
  max: number;
}

interface RateLimiterResult {
  allowed: boolean;
  remaining: number;
}

interface RateLimiter {
  check: (key: string) => RateLimiterResult;
}

export function createRateLimiter({ windowMs, max }: RateLimiterConfig): RateLimiter {
  const hits = new Map<string, number[]>();
  function cleanup() {
    const now = Date.now();
    for (const [key, records] of hits) {
      const valid = records.filter((t) => now - t < windowMs);
      if (valid.length === 0) hits.delete(key);
      else hits.set(key, valid);
    }
  }
  if (typeof setInterval !== 'undefined') {
    const timer = setInterval(cleanup, 60000);
    if (timer.unref) timer.unref();
  }
  return {
    check(key: string): RateLimiterResult {
      const now = Date.now();
      const records = (hits.get(key) || []).filter((t) => now - t < windowMs);
      if (records.length >= max) {
        hits.set(key, records);
        return { allowed: false, remaining: 0 };
      }
      records.push(now);
      hits.set(key, records);
      return { allowed: true, remaining: max - records.length };
    },
  };
}
