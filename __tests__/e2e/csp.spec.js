const { test, expect } = require('./fixtures');

// Browser verification of the Content-Security-Policy: loads representative pages
// (authenticated app pages + the public login page, which references an external
// gstatic icon) and asserts the CSP blocks nothing the app legitimately needs.
const PAGES = [
  '/dashboard',
  '/customers',
  '/partners',
  '/profile',
  '/admin/users',
  '/admin/settings',
  '/admin/service-catalog',
  '/admin/audit-log',
  '/login',
];

for (const path of PAGES) {
  test(`no CSP violations on ${path}`, async ({ page, cspViolations }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(
      cspViolations,
      `CSP violations on ${path}:\n${cspViolations.join('\n')}`
    ).toHaveLength(0);
  });
}

test('CSP header is present on a document response', async ({ page }) => {
  const response = await page.goto('/dashboard');
  const csp = response.headers()['content-security-policy'];
  expect(csp, 'Content-Security-Policy header missing').toBeTruthy();
  expect(csp).toContain("default-src 'self'");
});
