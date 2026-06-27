const { test, expect } = require('./fixtures');

test.describe('Theme', () => {
  test('toggles between light and dark', async ({ page }) => {
    await page.goto('/dashboard');
    const html = page.locator('html');
    await expect(html).toHaveClass(/light/);

    await page.getByRole('button', { name: 'Toggle theme' }).click();
    await expect(html).toHaveClass(/dark/);

    // Toggle back to light for a clean state.
    await page.getByRole('button', { name: 'Toggle theme' }).click();
    await expect(html).toHaveClass(/light/);
  });
});

test.describe('Internationalization', () => {
  test('switches to Arabic (RTL) and back to English (LTR)', async ({ page }) => {
    await page.goto('/dashboard');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('dir', 'ltr');

    await page.getByRole('button', { name: 'AR', exact: true }).click();
    await expect(html).toHaveAttribute('dir', 'rtl');
    await expect(html).toHaveAttribute('lang', 'ar');

    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(html).toHaveAttribute('dir', 'ltr');
  });
});
