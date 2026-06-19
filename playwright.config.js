const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/security',
  testMatch: '**/*.spec.js',
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'msedge',
      use: { channel: 'msedge' },
    },
  ],
});
