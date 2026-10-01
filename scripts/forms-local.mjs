import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, cpSync } from 'node:fs'
import { join } from 'node:path'
if (process.argv.includes('--smoke')) process.env.FORMS_LOCAL_SMOKE = 'true'
const root = fileURLToPath(new URL('..', import.meta.url)),
  node = process.execPath
const data = join(root, '.forms-local-data'),
  started = Date.now(),
  snapshot = join(data, 'snapshot-' + started)
mkdirSync(data, { recursive: true })
function complete(path) {
  try {
    const metadata = JSON.parse(readFileSync(join(path, 'firebase-export-metadata.json'), 'utf8'))
    return ['auth', 'firestore', 'storage'].every(
      (key) => metadata[key]?.path && existsSync(join(path, metadata[key].path)),
    )
  } catch {
    return false
  }
}
// Copy a complete interrupted Windows export without deleting any previous snapshot.
function recover(after) {
  const candidates = readdirSync(root)
    .filter(
      (name) =>
        /^firebase-export-\d+/.test(name) &&
        Number(name.match(/\d+/)[0]) >= after &&
        complete(join(root, name)),
    )
    .sort()
    .reverse()
  if (!candidates.length) return false
  cpSync(join(root, candidates[0]), snapshot, { recursive: true })
  if (!complete(snapshot))
    throw new Error('Local emulator export is incomplete; previous snapshots are preserved.')
  console.log('Recovered complete local emulator export by copying after Windows rename failure.')
  return true
}
let previous
try {
  const name = JSON.parse(readFileSync(join(data, 'latest.json'), 'utf8')).snapshot
  if (/^snapshot-\d+$/.test(name) && complete(join(data, name))) previous = join(data, name)
} catch {}
if (!previous && recover(0)) {
  writeFileSync(join(data, 'latest.json'), JSON.stringify({ snapshot: 'snapshot-' + started }))
  previous = snapshot
}
const target = previous === snapshot ? join(data, 'snapshot-' + (started + 1)) : snapshot
const build = spawnSync(node, [join(root, 'functions/node_modules/typescript/bin/tsc')], {
  cwd: join(root, 'functions'),
  stdio: 'inherit',
  windowsHide: true,
})
if (build.status !== 0) process.exit(build.status || 1)
// The CLI also receives console Ctrl+C and exports before exiting. Keep this wrapper alive.
process.on('SIGINT', () => {})
const result = spawnSync(
  node,
  [
    join(root, 'node_modules/firebase-tools/lib/bin/firebase.js'),
    'emulators:exec',
    '--project',
    'demo-phase2-security',
    '--only',
    'auth,firestore,storage',
    ...(previous ? ['--import', previous] : []),
    '--export-on-exit',
    target,
    'node scripts/forms-local-runner.mjs',
  ],
  { cwd: root, stdio: 'inherit', windowsHide: true },
)
let saved = complete(target)
if (!saved) {
  const candidates = readdirSync(root)
    .filter(
      (name) =>
        /^firebase-export-\d+/.test(name) &&
        Number(name.match(/\d+/)[0]) >= started &&
        complete(join(root, name)),
    )
    .sort()
    .reverse()
  if (candidates.length) {
    cpSync(join(root, candidates[0]), target, { recursive: true })
    saved = complete(target)
  }
}
if (saved) {
  writeFileSync(
    join(data, 'latest.json'),
    JSON.stringify({ snapshot: target.split(/[\\/]/).at(-1) }),
  )
  console.log('Local demo records saved to ' + target)
} else
  console.error(
    'Local emulator export was not confirmed. Previous snapshots are preserved; inspect firebase-export-* before restarting.',
  )
process.exit(result.status || (saved ? 0 : 1))
