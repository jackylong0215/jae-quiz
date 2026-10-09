import { defineConfig } from '@playwright/test';
import config from './playwright.config.js';

export default defineConfig({
  ...config,
  testIgnore: [],
  testMatch: '**/pages.spec.js',
  use: { ...config.use, baseURL: 'http://127.0.0.1:5174/jae-quiz/' },
  webServer: {
    env: { VITE_BASE_PATH: '/jae-quiz/' },
    command: 'npm run preview -- --host 127.0.0.1 --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174/jae-quiz/',
    reuseExistingServer: false,
  },
});
