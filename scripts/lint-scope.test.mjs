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

test('intentional CommonJS scripts use CommonJS rules without relaxing TypeScript source', async () => {
  const eslint = new ESLint()
  for (const filePath of ['scripts/lint-probe.cjs', 'functions/scripts/lint-probe.cjs']) {
    const config = await eslint.calculateConfigForFile(filePath)
    assert.equal(config.languageOptions.sourceType, 'commonjs', filePath)
    const [valid] = await eslint.lintText(
      "const fs = require('node:fs'); module.exports = { fs, directory: __dirname, runtime: process.version };\n",
      { filePath },
    )
    assert.equal(valid.errorCount, 0, JSON.stringify(valid.messages))
    assert.equal(valid.warningCount, 0, JSON.stringify(valid.messages))
    const [invalid] = await eslint.lintText('const = 1;\n', { filePath })
    assert.equal(invalid.fatalErrorCount, 1, 'CommonJS files must still be parsed and checked')
  }
  const [typescript] = await eslint.lintText(
    "const fs = require('node:fs'); export { fs };\n",
    { filePath: 'functions/src/lint-probe.ts' },
  )
  assert.ok(typescript.messages.some(message => message.ruleId === '@typescript-eslint/no-require-imports'))
})
