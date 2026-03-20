import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { seedE2eData } from './seed-e2e-data.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const repoRoot = resolve(__dirname, '..', '..')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

async function main() {
  await seedE2eData()

  const child = spawn(
    npmCommand,
    ['run', 'dev:e2e', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'],
    {
      cwd: repoRoot,
      stdio: 'inherit',
      env: process.env,
    }
  )

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal)
    }
  }

  process.on('SIGINT', () => forwardSignal('SIGINT'))
  process.on('SIGTERM', () => forwardSignal('SIGTERM'))

  child.on('exit', (code) => {
    process.exit(code ?? 0)
  })
}

main().catch((error) => {
  console.error('[run-e2e-stack] Failed to start seeded E2E stack')
  console.error(error)
  process.exit(1)
})
