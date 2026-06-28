const { test, expect } = require('./fixtures');
const { ADMIN } = require('./constants');

// Runs first (project "setup") against a freshly-truncated DB. Drives the real
// first-run wizard, which creates the admin account every later spec depends on.
test.describe('Setup wizard', () => {
  test('redirects to /setup on first visit', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/setup/);
    await expect(page.getByRole('heading', { name: 'Setup Wizard' })).toBeVisible();
  });

  test('completes the full setup flow and creates the admin', async ({ page, cspViolations }) => {
    await page.goto('/setup');

    // Step 1 - Admin account
    await page.fill('#admin-name', ADMIN.name);
    await page.fill('#admin-email', ADMIN.email);
    await page.getByLabel('Password', { exact: true }).fill(ADMIN.password);
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // Step 2 - Organization
    await page.fill('#org-name', 'E2E Test Org');
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // Step 3 - Starter template
    await page.getByText('Cloud Provider', { exact: true }).click();
    await page.getByRole('button', { name: 'Finish Setup' }).click();

    // Step 4 - Completion confirmation screen (the step indicator now activates).
    await expect(page.getByText('Setup Complete!')).toBeVisible();

    // A "Go to Login" button lets the user proceed immediately.
    const goToLogin = page.getByTestId('go-to-login');
    await expect(goToLogin).toBeVisible();
    await goToLogin.click();

    // Clicking the button lands on /login (same end state as the auto-redirect).
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    expect(cspViolations, `CSP violations: ${cspViolations.join('\n')}`).toHaveLength(0);
  });
});
