import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  outputDir: 'test-results',
  reporter: 'list',
  use: { baseURL: 'http://localhost:5173' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 810 } } },
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
