import { spawnSync } from 'node:child_process'
const result = spawnSync(process.execPath, [
  'node_modules/@playwright/test/cli.js', 'test', '--config=playwright.dashboard.config.ts',
  ...process.argv.slice(2),
], { env: { ...process.env, PHASE2_VERIFY_HMR: 'true' }, stdio: 'inherit' })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
