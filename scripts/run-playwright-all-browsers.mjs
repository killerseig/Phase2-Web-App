#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const playwrightCli = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url))
const extraArgs = process.argv.slice(2)
const child = spawn(
  process.execPath,
  [playwrightCli, 'test', '--project=chromium', '--project=firefox', '--project=webkit', ...extraArgs],
  {
    env: {
      ...process.env,
      PLAYWRIGHT_ALL_BROWSERS: '1',
      PLAYWRIGHT_HEADLESS: process.env.PLAYWRIGHT_HEADLESS ?? '1',
      PLAYWRIGHT_WORKERS: process.env.PLAYWRIGHT_WORKERS ?? '1',
    },
    stdio: 'inherit',
  },
)

child.on('error', (error) => {
  console.error(error)
  process.exit(1)
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
