import { defineConfig } from '@playwright/test'
import base from './playwright.intranet-review.config'

export default defineConfig({
  ...base,
  testMatch: ['timecard-pending-edits.spec.ts', 'legacy-pending-edits.spec.ts', 'admin-confirmations.spec.ts',
    'timecard-workbook.spec.ts', 'daily-log-draft.spec.ts', 'daily-log-submit.spec.ts',
    'shop-order-workspace.spec.ts', 'admin-management.spec.ts', 'admin-pages.spec.ts',
    'form-field-commands.spec.ts', 'form-authoring.spec.ts', 'form-canvas-controls.spec.ts',
    'builder-consistency.spec.ts', 'library-preview-loading.spec.ts', 'library-loading.spec.ts'],
  reporter: [['line'], ['json', { outputFile: 'evidence/module-reliability-browser-results.json' }]],
  outputDir: 'evidence/module-reliability-browser-artifacts',
})
