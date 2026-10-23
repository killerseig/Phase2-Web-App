import { defineConfig } from '@playwright/test'
import base from './playwright.intranet-review.config'
export default defineConfig({ ...base, testMatch: ['public-recipient-local-backend.spec.ts'], workers: 1, reporter: [['line'], ['json', { outputFile: 'evidence/recipient-browser-results.json' }]], outputDir: 'evidence/recipient-browser-artifacts' })
