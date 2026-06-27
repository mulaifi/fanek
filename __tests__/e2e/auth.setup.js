const { test, expect } = require('@playwright/test');
const { ADMIN, AUTH_STATE } = require('./constants');

// Logs in with the admin created by the setup wizard and persists the session
// so the main project can run authenticated without repeating the login flow.
test('authenticate as admin', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#email', ADMIN.email);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  await page.context().storageState({ path: AUTH_STATE });
});
