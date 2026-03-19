const { test } = require('@playwright/test');

test.describe('Admin Settings', () => {
  test('updates organization name', async ({ page }) => {
    await page.goto('/admin/settings');
    await page.fill('[name="orgName"]', 'Updated Corp');
    await page.click('text=Save');
  });
});
