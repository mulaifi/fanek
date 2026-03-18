const { test, expect } = require('@playwright/test');

test.describe('Setup Wizard', () => {
  test('redirects to /setup on first visit', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/setup/);
  });

  test('completes full setup flow', async ({ page }) => {
    await page.goto('/setup');
    // Step 1: Admin account
    await page.fill('[name="name"]', 'Admin User');
    await page.fill('[name="email"]', 'admin@example.com');
    await page.fill('[name="password"]', 'MyStr0ng!Pass');
    await page.click('text=Next');
    // Step 2: Organization
    await page.fill('[name="orgName"]', 'Test Corp');
    await page.click('text=Next');
    // Step 3: Template
    await page.click('text=Cloud Provider');
    await page.click('text=Next');
    // Step 4: Complete
    await expect(page.locator('text=Setup Complete')).toBeVisible();
  });
});
