const { test, expect } = require('./fixtures');

// Spotlight search: seed entities via the API, then exercise the UI search.
// The server already filters results; the cmdk <Command> must NOT re-filter them
// client-side (shouldFilter=false), or async-loaded matches get dropped (#81).
test.describe('Spotlight search', () => {
  async function openSearch(page) {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Search customers, partners...' }).click();
    const input = page.getByPlaceholder('Search customers, partners...');
    await expect(input).toBeVisible();
    return input;
  }

  // Scope assertions to actual search-result items: customer/service names can
  // also render elsewhere on the page (e.g. the dashboard "recent customers"
  // table), and only cmdk items are real results.
  const resultItem = (page, text) => page.locator('[cmdk-item]', { hasText: text });

  test('opens and returns matching results (prefix query)', async ({ page }) => {
    const res = await page.request.post('/api/customers', {
      data: { name: 'Searchable Widget Co', status: 'Active' },
    });
    expect(res.ok()).toBeTruthy();

    const input = await openSearch(page);
    await input.fill('Searchable');

    await expect(resultItem(page, 'Searchable Widget Co')).toBeVisible({ timeout: 10000 });
  });

  // Regression for #81: a query that is not a leading-word prefix (here a middle
  // word of the name) must still surface. With client-side cmdk filtering left on,
  // async-loaded results are dropped; with shouldFilter=false they show verbatim.
  test('returns customers matched by a middle word, not just a prefix', async ({ page }) => {
    for (let i = 1; i <= 6; i++) {
      const res = await page.request.post('/api/customers', {
        data: { name: `Globex Initech Unit ${i}`, status: 'Active' },
      });
      expect(res.ok()).toBeTruthy();
    }

    const input = await openSearch(page);
    await input.fill('Initech'); // middle word, not a prefix

    await expect(resultItem(page, 'Globex Initech Unit 1')).toBeVisible({ timeout: 10000 });
  });

  // Regression for #81 (services half): services have no standalone page, so a
  // matched service must be findable by its service-type name and must navigate
  // to the parent customer when selected.
  test('returns a service by its type name and navigates to the parent customer', async ({ page }) => {
    const typeRes = await page.request.post('/api/service-types', {
      data: { name: 'ZenithByTypeSvc', fieldSchema: [] },
    });
    expect(typeRes.ok()).toBeTruthy();
    const serviceType = await typeRes.json();

    const custRes = await page.request.post('/api/customers', {
      data: { name: 'Svc Type Parent Co', status: 'Active' },
    });
    expect(custRes.ok()).toBeTruthy();
    const customer = await custRes.json();

    const svcRes = await page.request.post('/api/services', {
      data: { customerId: customer.id, serviceTypeId: serviceType.id, fieldValues: {} },
    });
    expect(svcRes.ok()).toBeTruthy();

    const input = await openSearch(page);
    await input.fill('ZenithByTypeSvc');

    const result = resultItem(page, 'ZenithByTypeSvc');
    await expect(result).toBeVisible({ timeout: 10000 });
    await result.click();

    await expect(page).toHaveURL(new RegExp(`/customers/${customer.id}`), { timeout: 10000 });
  });

  // Deterministic guard for the shouldFilter=false fix: a service matched only on
  // its free-text notes (a token absent from the rendered label/description) is
  // dropped outright by cmdk's client-side scorer unless filtering is disabled.
  test('returns a service matched by its notes token', async ({ page }) => {
    const typeRes = await page.request.post('/api/service-types', {
      data: { name: 'ZenithByNotesSvc', fieldSchema: [] },
    });
    expect(typeRes.ok()).toBeTruthy();
    const serviceType = await typeRes.json();

    const custRes = await page.request.post('/api/customers', {
      data: { name: 'Svc Notes Parent Co', status: 'Active' },
    });
    expect(custRes.ok()).toBeTruthy();
    const customer = await custRes.json();

    const svcRes = await page.request.post('/api/services', {
      data: {
        customerId: customer.id,
        serviceTypeId: serviceType.id,
        fieldValues: {},
        notes: 'uniquenotetoken123',
      },
    });
    expect(svcRes.ok()).toBeTruthy();

    const input = await openSearch(page);
    await input.fill('uniquenotetoken123');

    // The result is labelled by its service-type name, not the notes token.
    await expect(resultItem(page, 'ZenithByNotesSvc')).toBeVisible({ timeout: 10000 });
  });

  // With shouldFilter=false, cmdk no longer hides non-matching items live, so the
  // previous query's results must not linger while the next query is loading.
  test('does not show stale results from the previous query while loading the next', async ({ page }) => {
    await page.request.post('/api/customers', { data: { name: 'AlphaUnique Co', status: 'Active' } });
    await page.request.post('/api/customers', { data: { name: 'BetaUnique Co', status: 'Active' } });

    const input = await openSearch(page);
    await input.fill('AlphaUnique');
    await expect(resultItem(page, 'AlphaUnique Co')).toBeVisible({ timeout: 10000 });

    // Delay subsequent search responses so the loading window is observable.
    await page.route('**/api/search**', async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.continue();
    });

    await input.fill('BetaUnique');

    // During the load window the stale Alpha result must be gone (timeout < the
    // 3s response delay so Beta cannot have loaded yet), and a loading state shows.
    await expect(resultItem(page, 'AlphaUnique Co')).not.toBeVisible({ timeout: 1000 });
    await expect(page.getByText(/searching/i)).toBeVisible({ timeout: 1000 });

    // Once the delayed response resolves, the new query's result appears.
    await expect(resultItem(page, 'BetaUnique Co')).toBeVisible({ timeout: 10000 });
  });

  // An older in-flight request must not clobber a newer one: if the response for
  // a previous query resolves last, it must be ignored, not overwrite the current
  // results (which would otherwise leave the box stuck on "Searching...").
  test('ignores an out-of-order response from a superseded query', async ({ page }) => {
    await page.request.post('/api/customers', { data: { name: 'RaceAlpha Co', status: 'Active' } });
    await page.request.post('/api/customers', { data: { name: 'RaceBeta Co', status: 'Active' } });

    // The earlier query (RaceAlpha) resolves AFTER the later one (RaceBeta).
    await page.route('**/api/search**', async (route) => {
      const delay = /RaceAlpha/.test(route.request().url()) ? 2500 : 200;
      await new Promise((r) => setTimeout(r, delay));
      await route.continue();
    });

    const input = await openSearch(page);
    await input.fill('RaceAlpha');
    await page.waitForTimeout(450); // let the RaceAlpha request start
    await input.fill('RaceBeta');

    // After the stale RaceAlpha response has long since resolved, the current
    // RaceBeta result stands and the box is not stuck loading.
    await page.waitForTimeout(3200);
    await expect(resultItem(page, 'RaceBeta Co')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/searching/i)).toBeHidden();
  });
});
