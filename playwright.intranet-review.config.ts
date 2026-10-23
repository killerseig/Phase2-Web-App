import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', testMatch: ['intranet-integration.spec.ts'], workers: 2, retries: 0,
  timeout: 30000, forbidOnly: true,
  reporter: [['line'], ['json', { outputFile: 'evidence/browser-results.json' }]],
  outputDir: 'evidence/browser-artifacts',
  use: { baseURL: 'http://127.0.0.1:5202', headless: true, trace: 'retain-on-failure',
    launchOptions: { args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost'] } },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'node node_modules/vite/bin/vite.js --config vite.intranet-review.config.ts --configLoader runner --host 127.0.0.1 --port 5202 --strictPort',
    url: 'http://127.0.0.1:5202', reuseExistingServer: false, timeout: 60000 },
})
