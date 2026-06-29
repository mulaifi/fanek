const { test, expect } = require('./fixtures');

// Verifies the Cache-Control strategy from next.config.ts: un-hashed static media
// in public/ is served immutable+long-lived, while HTML documents are not. These
// are public assets, so no authentication is required.

const IMMUTABLE_ASSETS = ['/Fanek_logo_light.svg', '/Fanek_logo_dark.svg', '/favicon.ico'];

for (const asset of IMMUTABLE_ASSETS) {
  test(`static asset ${asset} is served with immutable long-lived cache`, async ({ page }) => {
    const res = await page.request.get(asset);
    expect(res.status()).toBe(200);
    const cacheControl = res.headers()['cache-control'] || '';
    expect(cacheControl).toContain('immutable');
    expect(cacheControl).toContain('max-age=31536000');
  });
}

test('static asset still carries the shared security headers (merged, not replaced)', async ({
  page,
}) => {
  const res = await page.request.get('/Fanek_logo_light.svg');
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
  expect(res.headers()['content-security-policy']).toBeTruthy();
});

test('HTML documents are NOT given the immutable asset cache', async ({ page }) => {
  const res = await page.request.get('/login');
  expect(res.status()).toBe(200);
  const cacheControl = res.headers()['cache-control'] || '';
  expect(cacheControl).not.toContain('immutable');
});
