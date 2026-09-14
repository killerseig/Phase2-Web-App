import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Loading the Functions dependencies can exceed Firebase's 10-second default
// on Windows and in OneDrive workspaces.
const result = spawnSync(
  process.execPath,
  [
    fileURLToPath(new URL('../node_modules/firebase-tools/lib/bin/firebase.js', import.meta.url)),
    'deploy',
    ...process.argv.slice(2),
  ],
  {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: {
      ...process.env,
      FUNCTIONS_DISCOVERY_TIMEOUT: process.env.FUNCTIONS_DISCOVERY_TIMEOUT || '120',
    },
    stdio: 'inherit',
  },
)

if (result.error) console.error(result.error.message)
process.exit(result.status ?? 1)
