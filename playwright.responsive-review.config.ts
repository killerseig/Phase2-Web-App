import { defineConfig } from '@playwright/test'
import base from './playwright.intranet-review.config'

// Synthetic fixtures only. The saved local preview on 5173 is never reused.
export default defineConfig({
  ...base,
  testMatch: [
    'dashboard-access.spec.ts',
    'legacy-responsive-review.spec.ts',
    'admin-responsive-review.spec.ts',
    'workspace-responsive-review.spec.ts',
  ],
  reporter: [['line'], ['json', { outputFile: 'evidence/responsive-review-results.json' }]],
  outputDir: 'evidence/responsive-review-artifacts',
  use: { ...base.use, baseURL: 'http://127.0.0.1:5196' },
  webServer:
    process.env.PHASE2_REVIEW_EXTERNAL_SERVER === 'true'
      ? undefined
      : {
          ...base.webServer,
          command:
            'node node_modules/vite/bin/vite.js --config vite.intranet-review.config.ts --configLoader runner --host 127.0.0.1 --port 5196 --strictPort',
          url: 'http://127.0.0.1:5196',
          reuseExistingServer: false,
        },
})
