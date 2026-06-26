const { test, expect } = require('./fixtures');

test.describe('Admin - Users', () => {
  test('lists users and invites a new one', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.locator('table')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Invite User' })).toBeVisible();

    await page.getByRole('button', { name: 'Invite User' }).click();
    await page.fill('#invite-name', 'E2E Invitee');
    await page.fill('#invite-email', 'e2e-invitee@example.com');
    await page.getByRole('button', { name: 'Send Invite' }).click();

    await expect(page.getByText('User Created')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'E2E Invitee' })).toBeVisible();
  });

  test('row actions are present', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByRole('button', { name: 'Edit Role' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset Password' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Revoke Sessions' }).first()).toBeVisible();
  });
});

test.describe('Admin - Service Catalog', () => {
  test('lists service types and opens the create form', async ({ page }) => {
    await page.goto('/admin/service-catalog');
    await expect(page.locator('table')).toBeVisible();
    await page.getByRole('button', { name: 'New Service Type' }).click();
    await expect(page.locator('#st-name')).toBeVisible();
    await expect(page.getByText('Field Schema')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
  });
});

test.describe('Admin - Settings', () => {
  test('edits organization name and switches tabs', async ({ page }) => {
    await page.goto('/admin/settings');
    await expect(page.locator('#org-name')).toBeVisible();
    await page.fill('#org-name', 'E2E Renamed Org');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Organization settings saved.')).toBeVisible();

    await page.getByRole('tab', { name: 'Authentication' }).click();
    await expect(page.getByText('Authentication Providers')).toBeVisible();

    await page.getByRole('tab', { name: 'Data' }).click();
    await expect(page.getByRole('button', { name: 'Export All Data (JSON)' })).toBeVisible();
  });
});

test.describe('Admin - Audit Log', () => {
  test('renders audit entries and expands a row for details', async ({ page }) => {
    // Seed an audited action in-spec so this test doesn't depend on other specs'
    // ordering (creating a customer writes a CREATE audit entry).
    const res = await page.request.post('/api/customers', {
      data: { name: 'Audit Seed Co', status: 'Active' },
    });
    expect(res.ok()).toBeTruthy();

    await page.goto('/admin/audit-log');
    await expect(page.locator('table')).toBeVisible();
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();
    await expect(
      page.locator('pre').first().or(page.getByText('No details available.'))
    ).toBeVisible();
  });
});
