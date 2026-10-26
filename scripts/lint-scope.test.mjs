import assert from 'node:assert/strict'
import test from 'node:test'
import { ESLint } from 'eslint'

test('lint excludes generated output while retaining application, backend and test source', async () => {
  const eslint = new ESLint()
  for (const path of ['.forms-local-data/frontend-verification/employee/assets/example.js', 'functions/index.js', 'functions/websiteFunctions.d.ts', 'functions/lib/index.js', 'evidence/example.ts', 'test-results/example.ts']) {
    assert.equal(await eslint.isPathIgnored(path), true, path)
  }
  for (const path of ['src/views/FormBuilderView.vue', 'src/features/sds/useLibraryQuery.ts', 'src/features/documents/authorizedFetch.spec.ts', 'functions/src/index.ts', 'functions/scripts/test-sds-intake.cjs', 'e2e/website-builder.spec.ts', 'scripts/verify-frontend-build.mjs']) {
    assert.equal(await eslint.isPathIgnored(path), false, path)
  }
})
