const { defineConfig, devices } = require('@playwright/test');

const AUTH_STATE = 'playwright/.auth/admin.json';

module.exports = defineConfig({
  testDir: './__tests__/e2e',
  timeout: 30000,
  // Shared database state across specs -> run serially for determinism.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  globalSetup: require.resolve('./__tests__/e2e/global-setup.js'),

  webServer: {
    // CI runs the production server (faster, deterministic, exercises the prod CSP);
    // locally we use the dev server so the suite can run against live changes.
    command: process.env.CI ? 'npm run start:e2e' : 'npm run dev',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
    // TRUST_PROXY lets the auth rate limiter key on X-Forwarded-For, which the
    // rate-limit spec uses to isolate its own bucket (simulating a reverse proxy).
    env: { NEXTAUTH_URL: 'http://localhost:3000', TRUST_PROXY: 'true' },
  },

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // 1. Drive the setup wizard against a freshly-truncated DB (creates the admin).
    { name: 'setup', testMatch: /00-setup-wizard\.spec\.js/ },

    // 2. Log in once with the admin created above and persist the session.
    { name: 'auth', testMatch: /auth\.setup\.js/, dependencies: ['setup'] },

    // 3. Everything else runs authenticated via the saved storage state.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: AUTH_STATE },
      dependencies: ['auth'],
      testIgnore: [/00-setup-wizard\.spec\.js/, /auth\.setup\.js/],
    },
  ],
});
