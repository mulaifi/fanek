import { createRateLimiter } from '@/lib/rateLimit';
describe('rateLimit', () => {
  test('allows requests within limit', () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 3 });
    expect(limiter.check('ip1')).toEqual({ allowed: true, remaining: 2 });
    expect(limiter.check('ip1')).toEqual({ allowed: true, remaining: 1 });
    expect(limiter.check('ip1')).toEqual({ allowed: true, remaining: 0 });
  });
  test('blocks requests over limit', () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 2 });
    limiter.check('ip2');
    limiter.check('ip2');
    expect(limiter.check('ip2')).toEqual(expect.objectContaining({ allowed: false }));
  });
  test('different keys are independent', () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 1 });
    limiter.check('a');
    expect(limiter.check('b')).toEqual(expect.objectContaining({ allowed: true }));
  });
});
