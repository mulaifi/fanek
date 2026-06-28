const { test, expect } = require('./fixtures');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Write a temp file and return its absolute path.
 * Uses a timestamp in the name so concurrent runs don't collide.
 * Tracks the path so afterEach can remove it.
 */
const tmpFiles = [];
function writeTmp(name, content) {
  const p = path.join(os.tmpdir(), `fanek-${Date.now()}-${name}`);
  fs.writeFileSync(p, content);
  tmpFiles.push(p);
  return p;
}

test.afterEach(() => {
  tmpFiles.splice(0).forEach((p) => fs.rmSync(p, { force: true }));
});

test.describe('Data import', () => {
  // ---------------------------------------------------------------------------
  // Customers — happy path
  // ---------------------------------------------------------------------------
  test('customers: upload valid CSV, auto-map, preview, commit', async ({ page }) => {
    const suffix = Date.now();
    const csv = `Name,Client Code,Status\nImportCo ${suffix},IMP-${suffix},Active\n`;
    const file = writeTmp('customers.csv', csv);

    await page.goto('/import');

    // Upload the CSV — the file input is on the Customers tab by default
    await page.setInputFiles('[data-testid="import-file"]', file);

    // ColumnMapper renders one row per CSV column
    await expect(page.locator('[data-testid="map-row"]').first()).toBeVisible();

    // Click Preview (dry-run)
    await page.click('[data-testid="preview-btn"]');
    await expect(page.locator('[data-testid="import-preview"]')).toBeVisible();

    // Commit button should be enabled (all rows valid)
    const commit = page.locator('[data-testid="commit-btn"]');
    await expect(commit).toBeEnabled();

    // Commit — expect Sonner toast "Imported 1 rows" (explicit timeout for slow CI commits)
    await commit.click();
    await expect(page.getByText(/Imported 1 rows/i)).toBeVisible({ timeout: 15000 });
  });

  // ---------------------------------------------------------------------------
  // Customers — error path
  // ---------------------------------------------------------------------------
  test('customers: row missing Name keeps commit disabled', async ({ page }) => {
    const suffix = Date.now();
    // Name column is empty → row fails customerSchema required check
    const csv = `Name,Client Code,Status\n,IMP-BAD-${suffix},Active\n`;
    const file = writeTmp('bad-customers.csv', csv);

    await page.goto('/import');
    await page.setInputFiles('[data-testid="import-file"]', file);

    // Wait for the mapping UI before clicking Preview
    await expect(page.locator('[data-testid="map-row"]').first()).toBeVisible();
    await page.click('[data-testid="preview-btn"]');

    await expect(page.locator('[data-testid="import-preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-row"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="commit-btn"]')).toBeDisabled();
  });

  // ---------------------------------------------------------------------------
  // Services — pick type, resolve customer, preview
  // ---------------------------------------------------------------------------
  test('services: pick type, upload CSV referencing a known customer, preview succeeds', async ({ page }) => {
    const suffix = Date.now();

    // --- Prerequisites: create a service type (no required type-specific fields) ---
    // The test owns these prerequisites, so a failed POST is a real failure — assert, don't skip.
    const stRes = await page.request.post('/api/service-types', {
      data: { name: `E2E Import ST ${suffix}`, fieldSchema: [] },
    });
    expect(stRes.ok()).toBeTruthy();
    const serviceType = await stRes.json();

    // --- Prerequisites: create a customer whose name the CSV will reference ---
    const custRes = await page.request.post('/api/customers', {
      data: {
        name: `E2E Import Cust ${suffix}`,
        clientCode: `IMP-SVC-${suffix}`,
        status: 'Active',
      },
    });
    expect(custRes.ok()).toBeTruthy();

    // --- CSV: only "Customer" column needed (no required type-specific fields) ---
    // The auto-mapper maps "Customer" → customerRef via the label on SERVICE_BASE_FIELDS.
    const csv = `Customer\nE2E Import Cust ${suffix}\n`;
    const file = writeTmp('services.csv', csv);

    await page.goto('/import');

    // Switch to the Services tab
    await page.getByRole('tab', { name: /services/i }).click();

    const select = page.locator('[data-testid="service-type-select"]');
    await expect(select).toBeVisible();

    // Wait for the useEffect fetch to populate the dropdown with our service type.
    // Options inside a closed <select> are "hidden" to Playwright — use state:'attached'.
    await page.waitForSelector(
      `[data-testid="service-type-select"] option[value="${serviceType.id}"]`,
      { state: 'attached', timeout: 10000 }
    );
    await select.selectOption(serviceType.id);

    // The file input is re-keyed when serviceTypeId changes, so interact after selection
    await page.setInputFiles('[data-testid="import-file"]', file);
    await expect(page.locator('[data-testid="map-row"]').first()).toBeVisible();

    await page.click('[data-testid="preview-btn"]');
    await expect(page.locator('[data-testid="import-preview"]')).toBeVisible();

    // All rows should be valid → commit button enabled
    await expect(page.locator('[data-testid="commit-btn"]')).toBeEnabled();
  });
});
