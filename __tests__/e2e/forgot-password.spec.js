const { test, expect } = require('./fixtures');

// Email-based forgot-password flow.
//
// In the E2E environment SMTP is NOT configured, so:
//   - the "Forgot password?" link is hidden on /login;
//   - POST /api/auth/forgot-password still returns the generic success (no enumeration,
//     no leak of SMTP state), which the request page surfaces as a success message.
// The reset page is exercised with an invalid token, which the server always rejects.

test.describe('Forgot password — request form', () => {
  test('always shows the generic success message after submitting an email', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: 'Forgot your password?' })).toBeVisible();

    await page.locator('#email').fill('nobody-here@example.com');
    await page.getByRole('button', { name: 'Send reset link' }).click();

    // Generic, enumeration-safe success — shown whether or not the account exists.
    await expect(page.getByTestId('forgot-password-success')).toBeVisible();
    await expect(page.getByText(/a password reset link has been sent/i)).toBeVisible();
  });
});

test.describe('Reset password — new password form', () => {
  test('shows an invalid-link message when no token is present', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.getByTestId('reset-password-no-token')).toBeVisible();
    await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
  });

  test('rejects an invalid/expired token on submit', async ({ page }) => {
    await page.goto('/reset-password?token=this-token-does-not-exist');
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();

    await page.locator('#new-password').fill('Str0ng!Passw0rd');
    await page.locator('#confirm-password').fill('Str0ng!Passw0rd');
    await page.getByRole('button', { name: 'Reset password' }).click();

    await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
  });
});

test.describe('Forgot password — login link visibility (unauthenticated)', () => {
  // Run signed-out so /login actually renders (it redirects authenticated users away).
  test.use({ storageState: { cookies: [], origins: [] } });

  test('hides the "Forgot password?" link when SMTP is not configured', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    // SMTP is unconfigured in E2E → password reset disabled → link must be absent.
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toHaveCount(0);
  });
});
