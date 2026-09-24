import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Loading the Functions dependencies can exceed Firebase's 10-second default
// on Windows and in OneDrive workspaces.
const configuredTimeout = Number(process.env.FUNCTIONS_DISCOVERY_TIMEOUT)
const discoveryTimeout = Number.isFinite(configuredTimeout) && configuredTimeout > 0
  ? configuredTimeout
  : 120
console.log(`Firebase Functions discovery timeout: ${discoveryTimeout} seconds.`)
if (discoveryTimeout < 120) {
  console.warn('The current FUNCTIONS_DISCOVERY_TIMEOUT overrides the 120-second project default.')
}
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
      FUNCTIONS_DISCOVERY_TIMEOUT: String(discoveryTimeout),
    },
    stdio: 'inherit',
  },
)

if (result.error) console.error(result.error.message)
process.exit(result.status ?? 1)
