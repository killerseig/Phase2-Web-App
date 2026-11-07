import { defineConfig } from '@playwright/test'
import base from './playwright.intranet-review.config'
export default defineConfig({
  ...base,
  testMatch: [
    'website-builder.spec.ts',
    'website-draft-sync.spec.ts',
    'website-preview-parity.spec.ts',
  ],
  grep: /device screens have fixed heights|Fit starts active|Fit keeps text controls|manual zoom preserves|publishing comparison and change history|templates, copies and local history|website autosave saves idle|offline website edits recover|autosave conflicts preserve|floating widget actions|precise keyboard transforms|inline design editing protects|contextual inspector|shared draft|Content and Design previews match public layout|brand presets, font previews|editor modes and site settings remain|interactive widgets can be added/,
  reporter: [['line'], ['json', { outputFile: 'evidence/builder-existing-browser-results.json' }]],
  outputDir: 'evidence/builder-existing-browser-artifacts',
})
