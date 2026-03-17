export function createRateLimiter({ windowMs, max }) {
  const hits = new Map();
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
    check(key) {
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
