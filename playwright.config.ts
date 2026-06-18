import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './',
  timeout: 300000,
  retries: 0,
  workers: 1, // run tests one at a time to avoid session conflicts

  use: {
    baseURL: 'https://app.voipbusiness.com',
    storageState: 'session.json', // all tests reuse saved session
    permissions: ['microphone', 'camera'],
    headless: false, // set to true if you don't need to watch
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});