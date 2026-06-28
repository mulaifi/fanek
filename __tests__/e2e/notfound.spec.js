const { test, expect } = require('./fixtures');

test.describe('Branded 404', () => {
  test('renders the branded page for an unknown route', async ({ page }) => {
    const res = await page.goto('/this-route-does-not-exist');
    expect(res?.status()).toBe(404);

    // Branding: the Fanek logo and the 404 marker are present.
    await expect(page.getByRole('img', { name: 'Fanek' })).toBeVisible();
    await expect(page.getByText('404')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('back link returns an authenticated user to the dashboard', async ({ page }) => {
    await page.goto('/another-missing-page');

    const backLink = page.getByRole('link', { name: 'Back to dashboard' });
    await expect(backLink).toHaveAttribute('href', '/dashboard');

    await backLink.click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
