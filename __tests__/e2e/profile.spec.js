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

  test('danger zone shows export and delete controls', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByText('Danger Zone')).toBeVisible();
    await expect(page.getByTestId('export-data-link')).toBeVisible();
    await expect(page.getByTestId('delete-account-button')).toBeVisible();
  });

  test('delete dialog shows password input for credential users', async ({ page }) => {
    await page.goto('/profile');
    await page.getByTestId('delete-account-button').click();
    await expect(page.getByTestId('delete-account-password')).toBeVisible();
  });

  test('exports my data as a downloadable JSON file', async ({ page }) => {
    await page.goto('/profile');
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-data-link').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('fanek-my-data.json');
  });

  test('blocks deleting the last remaining admin after password reconfirm', async ({ page }) => {
    await page.goto('/profile');
    await page.getByTestId('delete-account-button').click();
    // Re-confirm with the correct password so we exercise the password check AND the
    // last-admin guard (the shared E2E admin is the only administrator).
    await page.getByTestId('delete-account-password').fill(ADMIN.password);
    await page.getByTestId('delete-account-confirm').click();
    await expect(page.getByText(/only administrator/i)).toBeVisible();
    // Session is intact: still on the profile page, not signed out.
    await expect(page.getByText('Account Information')).toBeVisible();
  });

  test('rejects account deletion when the password is wrong', async ({ page }) => {
    await page.goto('/profile');
    await page.getByTestId('delete-account-button').click();
    await page.getByTestId('delete-account-password').fill('definitely-wrong-password');
    await page.getByTestId('delete-account-confirm').click();
    await expect(page.getByText(/password is incorrect/i)).toBeVisible();
  });
});
