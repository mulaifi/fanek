const { test, expect } = require('@playwright/test');

test.describe('Customer CRUD', () => {
  test('creates a new customer', async ({ page }) => {
    await page.goto('/customers/new');
    await page.fill('[name="name"]', 'Acme Corp');
    await page.fill('[name="clientCode"]', 'ACME-001');
    await page.click('text=Save');
    await expect(page).toHaveURL(/\/customers\//);
  });

  test('views customer list', async ({ page }) => {
    await page.goto('/customers');
    await expect(page.locator('table')).toBeVisible();
  });
});
