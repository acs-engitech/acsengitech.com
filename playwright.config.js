const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 30000,
  reporter: [['list']],
  use: {
    baseURL: process.env.ACS_TEST_URL || 'http://localhost:3000',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node local-dev-server.js',
    url: process.env.ACS_TEST_URL || 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 10000,
  },
});
