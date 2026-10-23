import { defineConfig } from '@playwright/test'
import base from './playwright.intranet-review.config'
export default defineConfig({ ...base,
  testMatch: ['daily-log-draft.spec.ts', 'daily-log-mobile-fields.spec.ts', 'daily-log-submit.spec.ts', 'timecard-workbook.spec.ts', 'admin-management.spec.ts', 'access-control.spec.ts', 'builder-consistency.spec.ts', 'intranet-integration.spec.ts'],
  reporter: [['line'], ['json', { outputFile: 'evidence/remaining-qa-browser-results.json' }]],
  outputDir: 'evidence/remaining-qa-browser-artifacts',
})
