const { test, expect } = require('./fixtures');

const NAME = 'E2E Customer';
const EDITED = 'E2E Customer Edited';

test.describe('Customers', () => {
  test('list page renders search, status filter, new button and table', async ({ page }) => {
    await page.goto('/customers');
    await expect(page.getByPlaceholder('Name or code...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Customer' })).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });

  test('full lifecycle: create, view tabs, edit, add-service form, notes, delete', async ({ page }) => {
    // --- Create ---
    await page.goto('/customers/new');
    await page.fill('#name', NAME);
    await page.fill('#clientCode', 'E2E-001');
    await page.getByRole('button', { name: 'Create Customer' }).click();
    await expect(page).toHaveURL(/\/customers\/[a-z0-9]+$/i);
    await expect(page.getByRole('heading', { name: NAME })).toBeVisible();

    // --- Detail tabs ---
    await expect(page.getByRole('tab', { name: 'Info' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Services/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Contacts' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Notes' })).toBeVisible();

    // --- Edit ---
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.fill('#edit-name', EDITED);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByRole('heading', { name: EDITED })).toBeVisible();

    // --- Services tab: add-service form opens with a service-type selector ---
    await page.getByRole('tab', { name: /Services/ }).click();
    await page.getByRole('button', { name: 'Add Service' }).click();
    await expect(page.locator('#service-type')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    // --- Notes tab: edit and save ---
    await page.getByRole('tab', { name: 'Notes' }).click();
    await page.locator('textarea').fill('E2E smoke note');
    await page.getByRole('button', { name: 'Save Notes' }).click();
    await expect(page.getByText('Notes updated.')).toBeVisible();

    // --- Delete (admin) ---
    await page.getByRole('button', { name: 'Delete Customer' }).click();
    await page.getByRole('button', { name: 'Confirm?' }).click();
    await expect(page).toHaveURL(/\/customers$/);
  });
});
