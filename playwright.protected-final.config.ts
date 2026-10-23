import { defineConfig } from '@playwright/test'
import gate from './playwright.config.shop-orders'
export default defineConfig({
  ...gate,
  reporter: [['line'], ['json', { outputFile: 'evidence/shop-orders-final-results.json' }]],
  outputDir: 'evidence/shop-orders-final-artifacts',
  use: { ...gate.use, launchOptions: { args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost'] } },
  webServer: { command: 'node node_modules/vite/bin/vite.js --config vite.intranet-review.config.ts --configLoader runner --host 127.0.0.1 --port 5187 --strictPort', url: 'http://127.0.0.1:5187', reuseExistingServer: false, timeout: 60000 },
})
