const { test, expect } = require('./fixtures');

// Spotlight search: seed a customer via the API, then exercise the UI search.
test.describe('Spotlight search', () => {
  test('opens and returns matching results', async ({ page }) => {
    const res = await page.request.post('/api/customers', {
      data: { name: 'Searchable Widget Co', status: 'Active' },
    });
    expect(res.ok()).toBeTruthy();

    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Search customers, partners...' }).click();

    const input = page.getByPlaceholder('Search customers, partners...');
    await expect(input).toBeVisible();
    await input.fill('Searchable');

    await expect(page.getByText('Searchable Widget Co')).toBeVisible({ timeout: 10000 });
  });
});
