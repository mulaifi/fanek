const { Pool } = require('pg');
const { test, expect } = require('./fixtures');
const { ADMIN } = require('./constants');

// Reproduction for the documented claim at docs/en/user-guide.md:233 and
// docs/ar/user-guide.md:233: "your language applies on any device you log in from".
//
// The write half works: LocaleSwitcher.tsx:17 PUTs to /api/profile, which persists
// at pages/api/profile.ts:82-83, and lib/auth/options.ts:136 copies the stored
// value into the JWT at sign-in. The read half does not exist. pages/_document.tsx:31
// resolves the locale from the NEXT_LOCALE cookie alone, so a browser that signs in
// fresh renders English no matter what the profile says.
//
// The second device signs in for itself rather than reusing AUTH_STATE. That is what
// the documented claim describes, and it is the only version a fix can satisfy:
// lib/auth/options.ts:140-155 never refreshes token.locale after issuance, so a
// session minted before the language change carries the old value whatever the
// render path reads.
//
// `storageState: undefined` is load-bearing. browser.newContext() inherits the
// project's storageState from playwright.config.js:44, so a context created without
// it silently carries the first device's session — which is the same blindness this
// test exists to remove.

async function storedLocale(email) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query('SELECT locale FROM "User" WHERE email = $1', [email]);
    return rows[0]?.locale ?? null;
  } finally {
    await pool.end();
  }
}

test.describe('Profile locale across devices', () => {
  test.afterEach(async ({ page }) => {
    // Leave the shared account in English; the suite runs serially against one DB.
    await page.goto('/dashboard');
    const en = page.getByRole('button', { name: 'EN', exact: true });
    if (await en.isVisible()) {
      await en.click();
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    }
  });

  test('a fresh sign-in renders the language stored on the profile', async ({ page, browser }) => {
    // 1. Choose Arabic on the first device. LocaleSwitcher reloads the page straight
    //    after the PUT, so the persisted value is read from the database rather than
    //    from the response body, which the reload discards.
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'AR', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');

    expect(await storedLocale(ADMIN.email)).toBe('ar');

    // 2. Second device: a browser with no cookies at all, signing in for itself.
    const secondDevice = await browser.newContext({ storageState: undefined });
    try {
      expect(await secondDevice.cookies('http://localhost:3000')).toHaveLength(0);

      const secondPage = await secondDevice.newPage();
      await secondPage.goto('/login');
      await secondPage.fill('#email', ADMIN.email);
      await secondPage.getByLabel('Password', { exact: true }).fill(ADMIN.password);
      await secondPage.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(secondPage).toHaveURL(/\/dashboard/, { timeout: 15000 });

      // The sign-in carried the stored locale into the session
      // (lib/auth/options.ts:136), so the render has everything it needs.
      await expect(secondPage.locator('html')).toHaveAttribute('lang', 'ar');
      await expect(secondPage.locator('html')).toHaveAttribute('dir', 'rtl');
    } finally {
      await secondDevice.close();
    }
  });

  // The Google path cannot be driven end to end here: signIn('google') at
  // pages/login.tsx:89 navigates to Google, and no client code of ours runs after
  // that. What it leaves behind is reproducible exactly, and it is the state that
  // matters: the browser returns through /api/auth/callback/google to a full page
  // load of /dashboard, holding a session token and no NEXT_LOCALE cookie, with no
  // opportunity for anything on the login page to have set one.
  test('an OAuth-shaped landing renders the stored language (session, no locale cookie)', async ({
    page,
    browser,
  }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'AR', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    expect(await storedLocale(ADMIN.email)).toBe('ar');

    const oauthDevice = await browser.newContext({ storageState: undefined });
    try {
      const oauthPage = await oauthDevice.newPage();
      await oauthPage.goto('/login');
      await oauthPage.fill('#email', ADMIN.email);
      await oauthPage.getByLabel('Password', { exact: true }).fill(ADMIN.password);
      await oauthPage.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(oauthPage).toHaveURL(/\/dashboard/, { timeout: 15000 });

      // Drop only the locale cookie, keeping the session. This is what the browser
      // holds when it arrives back from Google.
      const kept = (await oauthDevice.cookies()).filter((c) => c.name !== 'NEXT_LOCALE');
      await oauthDevice.clearCookies();
      await oauthDevice.addCookies(kept);
      expect((await oauthDevice.cookies()).some((c) => c.name === 'NEXT_LOCALE')).toBe(false);

      await oauthPage.goto('/dashboard');
      await expect(oauthPage.locator('html')).toHaveAttribute('lang', 'ar');
      await expect(oauthPage.locator('html')).toHaveAttribute('dir', 'rtl');
    } finally {
      await oauthDevice.close();
    }
  });
});
