const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './__tests__/e2e',
  timeout: 30000,
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
});
