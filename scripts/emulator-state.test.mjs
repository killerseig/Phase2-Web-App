import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, relative, resolve } from 'node:path'
import { completeEmulatorState, emulatorRun, openEmulatorState } from './emulator-state.mjs'

const roots = []
function root() { const path = mkdtempSync(join(tmpdir(), 'phase2-emulator-state-test-')); roots.push(path); return path }
afterEach(() => {
  for (const path of roots.splice(0)) {
    const absolute = resolve(path)
    assert.ok(relative(resolve(tmpdir()), absolute) && !relative(resolve(tmpdir()), absolute).startsWith('..'))
    assert.ok(basename(absolute).startsWith('phase2-emulator-state-test-'))
    rmSync(absolute, { recursive: true, force: true })
  }
})
function snapshot(path, stamp) {
  mkdirSync(path, { recursive: true })
  const metadata = {}
  for (const key of ['auth', 'firestore', 'storage']) {
    mkdirSync(join(path, key + '_export'), { recursive: true })
    writeFileSync(join(path, key + '_export', 'synthetic.txt'), String(stamp).padStart(4, '0'))
    metadata[key] = { path: key + '_export' }
  }
  writeFileSync(join(path, 'firebase-export-metadata.json'), JSON.stringify(metadata))
}
const stamp = path => readFileSync(join(path, 'auth_export', 'synthetic.txt'), 'utf8')
function bytes(path) { return readdirSync(path).reduce((total, name) => { const file = join(path, name); return total + (statSync(file).isDirectory() ? bytes(file) : statSync(file).size) }, 0) }

test('100 simulated export runs retain two generations and constant fixture disk use', () => {
  const project = root()
  let size
  for (let run = 1; run <= 100; run++) {
    const state = openEmulatorState(project)
    const previous = state.prepare()
    assert.equal(!!previous, run > 1)
    snapshot(state.pending, run)
    assert.equal(state.finish(), true)
    assert.equal(stamp(state.current), String(run).padStart(4, '0'))
    if (run > 1) assert.equal(stamp(state.previous), String(run - 1).padStart(4, '0'))
    state.close()
    const base = join(project, '.forms-local-data', 'emulator-state')
    assert.deepEqual(readdirSync(base).sort(), run === 1 ? ['current', 'manager.json', 'run'] : ['current', 'manager.json', 'previous', 'run'])
    assert.equal(readdirSync(project).some(name => name.startsWith('firebase-export-')), false)
    if (run === 2) size = bytes(base)
    if (run > 2) assert.equal(bytes(base), size)
  }
})
test('recovers a completed pending export after an interrupted run', () => {
  const project = root(), first = openEmulatorState(project)
  first.prepare(); snapshot(first.pending, 1); first.finish()
  snapshot(first.pending, 2); first.close()
  const next = openEmulatorState(project)
  try { assert.equal(next.prepare(), next.current); assert.equal(stamp(next.current), '0002'); assert.equal(stamp(next.previous), '0001') }
  finally { next.close() }
})
test('recovers Firebase CLI staging from the bounded working directory', () => {
  const state = openEmulatorState(root())
  try {
    state.prepare()
    snapshot(join(state.run, 'firebase-export-123456orphan'), 7)
    assert.equal(state.finish(), true)
    assert.equal(stamp(state.current), '0007')
    assert.deepEqual(readdirSync(state.run), [])
  } finally { state.close() }
})
test('recovers an interrupted promotion without discarding the prior recovery state', () => {
  const project = root(), state = openEmulatorState(project)
  state.prepare()
  snapshot(state.previous, 1)
  snapshot(join(project, '.forms-local-data', 'emulator-state', 'next'), 2)
  state.close()
  const resumed = openEmulatorState(project)
  try { resumed.prepare(); assert.equal(stamp(resumed.current), '0002'); assert.equal(stamp(resumed.previous), '0001') }
  finally { resumed.close() }
})
test('preserves designated legacy seeds and unrelated root backups', () => {
  const project = root(), legacy = join(project, '.forms-local-data', 'snapshot-12345'), backup = join(project, 'firebase-export-unknown-backup')
  snapshot(legacy, 9); snapshot(backup, 8)
  writeFileSync(join(project, '.forms-local-data', 'latest.json'), JSON.stringify({ snapshot: 'snapshot-12345' }))
  const state = openEmulatorState(project)
  try { state.prepare(); assert.equal(stamp(state.current), '0009'); assert.equal(stamp(legacy), '0009'); assert.equal(stamp(backup), '0008') }
  finally { state.close() }
})
test('incomplete exports never replace a complete review state', () => {
  const state = openEmulatorState(root())
  try {
    state.prepare(); snapshot(state.pending, 1); state.finish()
    mkdirSync(state.pending); writeFileSync(join(state.pending, 'unfinished.txt'), 'not a complete export')
    assert.equal(state.finish(), false)
    assert.equal(stamp(state.current), '0001')
    assert.equal(state.prepare(), state.current)
    assert.equal(existsSync(state.pending), false)
  } finally { state.close() }
})
test('an incomplete first export stops the next run instead of accumulating or discarding it', () => {
  const project = root(), first = openEmulatorState(project)
  first.prepare(); mkdirSync(first.pending); writeFileSync(join(first.pending, 'unfinished.txt'), 'preserve'); first.close()
  const next = openEmulatorState(project)
  try { assert.throws(() => next.prepare(), /incomplete first emulator export/); assert.equal(readFileSync(join(next.pending, 'unfinished.txt'), 'utf8'), 'preserve') }
  finally { next.close() }
})
test('rejects export metadata paths escaping the snapshot', () => {
  const project = root(), path = join(project, 'export')
  snapshot(path, 1)
  const metadata = JSON.parse(readFileSync(join(path, 'firebase-export-metadata.json'), 'utf8'))
  metadata.auth.path = '..'
  writeFileSync(join(path, 'firebase-export-metadata.json'), JSON.stringify(metadata))
  assert.equal(completeEmulatorState(path), false)
})
test('a second runner cannot share or clear active fixed state', () => {
  const project = root(), state = openEmulatorState(project)
  try { assert.throws(() => openEmulatorState(project), /runner is active/); assert.equal(existsSync(join(project, '.forms-local-data', 'emulator-state', 'runner.lock')), true) }
  finally { state.close() }
})
test('runner uses only demo emulators, explicit config, and an isolated staging cwd', () => {
  const project = root(), state = openEmulatorState(project)
  try {
    state.prepare()
    const invocation = emulatorRun(project, process.execPath, state, state.current)
    assert.equal(invocation.cwd, state.run)
    assert.equal(invocation.args[invocation.args.indexOf('--project') + 1], 'demo-phase2-security')
    assert.equal(invocation.args[invocation.args.indexOf('--config') + 1], join(project, 'firebase.json'))
    assert.equal(invocation.args[invocation.args.indexOf('--export-on-exit') + 1], state.pending)
    assert.equal(invocation.args[invocation.args.indexOf('--import') + 1], state.current)
    assert.ok(invocation.args.at(-1).includes(join(project, 'scripts/forms-local-runner.mjs')))
  } finally { state.close() }
})
