const { test, expect } = require('./fixtures');

test.describe('Health endpoint', () => {
  test('GET /api/health returns ok with version', async ({ page }) => {
    const res = await page.request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.version).toBe('string');
    expect(body.timestamp).toBeTruthy();
  });

  test('non-GET /api/health returns 405', async ({ page }) => {
    const res = await page.request.post('/api/health', { failOnStatusCode: false });
    expect(res.status()).toBe(405);
  });
});

test.describe('Auth rate limiting', () => {
  test('blocks credential logins after 10 attempts per IP', async ({ page }) => {
    const url = '/api/auth/callback/credentials';
    // Unique X-Forwarded-For gives this test its own rate-limit bucket, isolated
    // from other login traffic AND from prior runs on a reused (dev) server, where
    // the in-process limiter persists for its 15-minute window.
    const bucket = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const headers = { 'x-forwarded-for': bucket };
    const form = { email: 'nobody@example.com', password: 'wrong-password' };

    for (let i = 0; i < 10; i++) {
      const r = await page.request.post(url, { headers, form, maxRedirects: 0, failOnStatusCode: false });
      expect(r.status(), `attempt ${i + 1} should not be rate limited`).not.toBe(429);
    }

    const blocked = await page.request.post(url, { headers, form, maxRedirects: 0, failOnStatusCode: false });
    expect(blocked.status()).toBe(429);
    const body = await blocked.json();
    expect(body.url).toContain('error=RateLimited');
  });
});
