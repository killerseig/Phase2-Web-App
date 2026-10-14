import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'
import base from './playwright.config'

const requiredSuites = [
  'shop-order-catalog-layout.spec.ts',
  'shop-order-responsive.spec.ts',
  'shop-order-workspace.spec.ts',
]
for (const suite of requiredSuites) {
  if (!existsSync(new URL(`./e2e/${suite}`, import.meta.url))) {
    throw new Error(`Required Shop Orders regression suite is missing: ${suite}`)
  }
}

// Use this checkout, an isolated port and synthetic fixtures even when a
// developer already has a production-configured Vite server running.
export default defineConfig({
  ...base,
  testMatch: requiredSuites,
  workers: 2,
  retries: 0,
  reporter: 'line',
  use: { ...base.use, baseURL: 'http://127.0.0.1:5187', headless: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5187 --strictPort',
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    url: 'http://127.0.0.1:5187',
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      VITE_FIREBASE_API_KEY: '',
      VITE_FIREBASE_AUTH_DOMAIN: '',
      VITE_FIREBASE_PROJECT_ID: '',
      VITE_FIREBASE_STORAGE_BUCKET: '',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '',
      VITE_FIREBASE_APP_ID: '',
      VITE_FIREBASE_MEASUREMENT_ID: '',
    },
  },
})
