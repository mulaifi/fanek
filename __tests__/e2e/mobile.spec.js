const { test, expect } = require('./fixtures');

// iPhone-ish viewport: the layout should switch to bottom-tab navigation.
test.use({ viewport: { width: 390, height: 844 } });

test.describe('Mobile layout', () => {
  test('shows bottom tabs, hides desktop sidebar, and navigates', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('stat-card').first()).toBeVisible();

    // Bottom tabs render an "Admin" entry (desktop sidebar never does).
    await expect(page.getByRole('button', { name: 'Admin', exact: true })).toBeVisible();

    // Desktop-only collapse control is absent.
    await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toHaveCount(0);

    // Tapping a bottom tab navigates.
    await page.getByRole('button', { name: 'Customers', exact: true }).click();
    await expect(page).toHaveURL(/\/customers/);
  });
});
