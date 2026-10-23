import { defineConfig } from '@playwright/test'
import base from './playwright.intranet-review.config'
export default defineConfig({ ...base, testMatch: ['builder-consistency.spec.ts'], reporter: [['line'], ['json', { outputFile: 'evidence/builder-alignment-browser-results.json' }]], outputDir: 'evidence/builder-alignment-browser-artifacts' })
