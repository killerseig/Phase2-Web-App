import { defineConfig } from '@playwright/test'
import gate from './playwright.config.shop-orders'

// Maintained, portable synthetic harness. Never connects to production Firebase.
export default defineConfig({
  ...gate,
  testMatch: ['shared-dashboards.spec.ts', 'dashboard-widgets.spec.ts', 'form-dashboard-presentations.spec.ts', 'document-previews.spec.ts', 'sds-workspace.spec.ts'],
  reporter: [['line'], ['json', { outputFile: 'test-results/dashboard-results.json' }]],
  outputDir: 'test-results/dashboard-artifacts',
  use: {
    ...gate.use,
    baseURL: 'http://127.0.0.1:5196',
    launchOptions: { args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost'] },
  },
  webServer: {
    ...gate.webServer,
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5196 --strictPort',
    url: 'http://127.0.0.1:5196',
    env: {
      VITE_FIREBASE_API_KEY: 'synthetic-dashboard-test-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-phase2-dashboard-audit.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'demo-phase2-dashboard-audit',
      VITE_FIREBASE_STORAGE_BUCKET: 'demo-phase2-dashboard-audit.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
      VITE_FIREBASE_APP_ID: '1:000000000000:web:synthetic',
      VITE_FORM_EMULATORS: 'false',
    },
  },
})
