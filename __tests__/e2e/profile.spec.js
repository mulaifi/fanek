const { test, expect } = require('./fixtures');
const { ADMIN } = require('./constants');

test.describe('Profile', () => {
  test('shows account info, display name and password forms', async ({ page }) => {
    await page.goto('/profile');

    // Account info
    await expect(page.getByText('Account Information')).toBeVisible();
    await expect(page.getByText(ADMIN.email)).toBeVisible();
    await expect(page.getByText('ADMIN', { exact: true })).toBeVisible();

    // Display name form
    await expect(page.locator('#display-name')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Name' })).toBeVisible();

    // Change password form (do NOT submit - would invalidate the shared session)
    await expect(page.getByRole('button', { name: 'Change Password', exact: true })).toBeVisible();
    await expect(page.getByLabel('Current Password', { exact: true })).toBeVisible();
    await expect(page.getByLabel('New Password', { exact: true })).toBeVisible();
  });

  test('password strength indicator reacts to input', async ({ page }) => {
    await page.goto('/profile');
    await page.getByLabel('New Password', { exact: true }).fill('Str0ng!Passw0rd');
    await expect(page.getByText(/Too short|Weak|Fair|Good|Strong/)).toBeVisible();
  });
});
