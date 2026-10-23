import { defineConfig } from '@playwright/test'
import base from './playwright.intranet-review.config'
export default defineConfig({ ...base, testMatch: ['form-matrix-layout.spec.ts'], reporter: [['line'], ['json', { outputFile: 'evidence/matrix-browser-results.json' }]], outputDir: 'evidence/matrix-browser-artifacts' })
