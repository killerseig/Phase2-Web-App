import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { emulatorRun, openEmulatorState } from './emulator-state.mjs'

if (process.argv.includes('--smoke')) process.env.FORMS_LOCAL_SMOKE = 'true'
const root = fileURLToPath(new URL('..', import.meta.url)), node = process.execPath
const state = openEmulatorState(root)
let status = 1
try {
  const previous = state.prepare()
  const build = spawnSync(node, [join(root, 'functions/node_modules/typescript/bin/tsc')], {
    cwd: join(root, 'functions'), stdio: 'inherit', windowsHide: true,
  })
  if (build.status !== 0) status = build.status || 1
  else {
    // The CLI receives Ctrl+C and exports before exiting. Keep this wrapper alive.
    process.on('SIGINT', () => {})
    const run = emulatorRun(root, node, state, previous)
    const result = spawnSync(node, run.args, { cwd: run.cwd, stdio: 'inherit', windowsHide: true })
    const saved = state.finish()
    if (saved) console.log('Local demo state saved. Only current and previous emulator generations are retained.')
    else console.error('Local emulator export was not confirmed. Managed recovery files and previous state are preserved.')
    status = result.status || (saved ? 0 : 1)
  }
} finally { state.close() }
process.exit(status)
