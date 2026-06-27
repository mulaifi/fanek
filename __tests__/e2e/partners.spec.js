const { test, expect } = require('./fixtures');

const NAME = 'E2E Partner';
const EDITED = 'E2E Partner Edited';

test.describe('Partners', () => {
  test('list page renders search, new button and table', async ({ page }) => {
    await page.goto('/partners');
    await expect(page.getByPlaceholder('Partner name...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Partner' })).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });

  test('full lifecycle: create, flat detail layout, edit, delete', async ({ page }) => {
    // --- Create ---
    await page.goto('/partners/new');
    await page.fill('#name', NAME);
    await page.getByRole('button', { name: 'Create Partner' }).click();
    await expect(page).toHaveURL(/\/partners\/[a-z0-9]+$/i);
    await expect(page.getByRole('heading', { name: NAME })).toBeVisible();

    // --- Flat layout (no tabs), with Details / Notes / Contacts sections ---
    await expect(page.getByRole('tablist')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Details' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Contacts' })).toBeVisible();

    // --- Edit ---
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.fill('#edit-name', EDITED);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByRole('heading', { name: EDITED })).toBeVisible();

    // --- Delete (admin) ---
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page).toHaveURL(/\/partners$/);
  });
});
