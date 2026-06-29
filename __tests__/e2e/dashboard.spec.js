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

  // Reliability (#73): the dashboard stats fetch uses fetchWithRetry, so a
  // transient 5xx on the first attempt must be retried and the page must still
  // render its data once a later attempt succeeds.
  test('recovers from a transient 503 on the stats endpoint via retry', async ({ page }) => {
    let calls = 0;
    await page.route('**/api/dashboard/stats', async (route) => {
      calls += 1;
      if (calls === 1) {
        // First attempt fails with a retryable server error.
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'temporarily unavailable' }),
        });
        return;
      }
      // Subsequent (retried) attempts hit the real backend.
      await route.continue();
    });

    await page.goto('/dashboard');

    // Stat cards only render when the stats fetch ultimately succeeds — proving
    // the retry recovered from the initial 503.
    await expect(page.getByTestId('stat-card')).toHaveCount(3, { timeout: 15000 });
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  test('sidebar navigation works', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Customers', exact: true }).click();
    await expect(page).toHaveURL(/\/customers/);
    await page.getByRole('button', { name: 'Partners', exact: true }).click();
    await expect(page).toHaveURL(/\/partners/);
  });
});
