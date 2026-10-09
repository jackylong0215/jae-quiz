import { defineConfig } from '@playwright/test';

if (!process.env.LIVE_SITE_URL) throw new Error('LIVE_SITE_URL is required.');
export default defineConfig({
  testDir: './tests',
  testMatch: '**/deployed.spec.js',
  retries: 2,
  timeout: 90000,
  use: {
    baseURL: process.env.LIVE_SITE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
