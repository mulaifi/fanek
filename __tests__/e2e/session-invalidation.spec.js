const { test, expect } = require('./fixtures');

// Issue #90 — changing a password must invalidate every JWT session issued before
// the change, so a stolen/lingering token can no longer authenticate.
//
// We use a dedicated throwaway user (never the shared admin) so the invalidation does
// not disturb the authenticated storage state the rest of the suite relies on.
//
// `page`/`page.request` are authenticated as the admin (chromium storageState); the
// throwaway user gets its own clean browser context.

test.describe('JWT session invalidation on password change', () => {
  test('a previously valid session is rejected after the user changes their password', async ({
    page,
    browser,
  }) => {
    const email = `e2e-sessioninv-${Date.now()}@example.com`;

    // 1. Admin creates the dedicated user and we capture its generated temp password.
    const createRes = await page.request.post('/api/admin/users', {
      data: { name: 'Session Invalidation User', email, role: 'VIEWER' },
    });
    expect(createRes.status()).toBe(201);
    const { tempPassword } = await createRes.json();
    expect(tempPassword).toBeTruthy();

    // 2. Sign that user in through the UI in a fresh, unauthenticated context.
    const userContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const userPage = await userContext.newPage();
      await userPage.goto('/login');
      await userPage.locator('#email').fill(email);
      await userPage.getByLabel('Password', { exact: true }).fill(tempPassword);
      await userPage.getByRole('button', { name: 'Sign in' }).click();

      // Session cookie is established once a protected endpoint accepts the context's cookie.
      await expect
        .poll(async () => (await userContext.request.get('/api/customers')).status(), {
          timeout: 15000,
        })
        .toBe(200);

      // 3. Change the password using the SAME (still-valid) session. The request that
      //    performs the change is authenticated; it stamps sessionsValidAfter = now.
      const changeRes = await userContext.request.put('/api/profile', {
        data: { currentPassword: tempPassword, newPassword: 'N3w!Str0ngPass' },
      });
      expect(changeRes.status()).toBe(200);

      // 4. The token issued at sign-in predates the change → the session is now rejected.
      await expect
        .poll(async () => (await userContext.request.get('/api/customers')).status(), {
          timeout: 15000,
        })
        .toBe(401);
    } finally {
      await userContext.close();
    }
  });

  test('login page shows a notice after a password change redirect', async ({ browser }) => {
    const userContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const userPage = await userContext.newPage();
      await userPage.goto('/login?passwordChanged=1');
      await expect(
        userPage.getByText(/sign in with your new password/i)
      ).toBeVisible();
    } finally {
      await userContext.close();
    }
  });
});
