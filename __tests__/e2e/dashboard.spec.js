const { test, expect } = require('./fixtures');

test.describe('Dashboard', () => {
  test('renders stat cards, section headings and recent customers table', async ({ page }) => {
    await page.goto('/dashboard');

    // Three stat cards (customers, services, partners).
    await expect(page.getByTestId('stat-card')).toHaveCount(3);

    // Chart/section headings.
    await expect(page.getByText('Customers by Status')).toBeVisible();
    await expect(page.getByText('Services by Type')).toBeVisible();

    // Recent customers section with a table.
    await expect(page.getByText('Recently Updated Customers')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });

  test('sidebar navigation works', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Customers', exact: true }).click();
    await expect(page).toHaveURL(/\/customers/);
    await page.getByRole('button', { name: 'Partners', exact: true }).click();
    await expect(page).toHaveURL(/\/partners/);
  });
});
