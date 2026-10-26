import { closeSync, cpSync, existsSync, lstatSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'

export function completeEmulatorState(directory) {
  try {
    const metadata = JSON.parse(readFileSync(join(directory, 'firebase-export-metadata.json'), 'utf8'))
    return ['auth', 'firestore', 'storage'].every(key => {
      const name = metadata[key]?.path
      if (typeof name !== 'string' || isAbsolute(name)) return false
      const child = resolve(directory, name), local = relative(resolve(directory), child)
      return local && !local.startsWith('..') && existsSync(child) && !lstatSync(child).isSymbolicLink()
    })
  } catch { return false }
}

/** Rotates only runner-owned local emulator generations, never legacy exports or cloud backups. */
export function openEmulatorState(root) {
  const data = resolve(root, '.forms-local-data'), base = join(data, 'emulator-state')
  const current = join(base, 'current'), previous = join(base, 'previous')
  const pending = join(base, 'pending'), next = join(base, 'next'), run = join(base, 'run')
  for (const path of [data, base]) {
    if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error('Refusing emulator state through a symbolic link.')
    mkdirSync(path, { recursive: true })
  }
  const marker = join(base, 'manager.json')
  if (!existsSync(marker)) {
    if (readdirSync(base).length) throw new Error('Unrecognized emulator-state folder preserved; review it before starting.')
    writeFileSync(marker, JSON.stringify({ schema: 1 }))
  } else if (JSON.parse(readFileSync(marker, 'utf8')).schema !== 1) {
    throw new Error('Unknown emulator-state format preserved; review it before starting.')
  }
  const lock = join(base, 'runner.lock')
  if (existsSync(lock)) {
    const owner = JSON.parse(readFileSync(lock, 'utf8')).pid
    if (!Number.isSafeInteger(owner) || owner < 1) throw new Error('Unrecognized emulator runner lock preserved.')
    let active = true
    try { process.kill(owner, 0) }
    catch (error) {
      if (error.code !== 'ESRCH') throw new Error('An emulator runner may still be active; its state was preserved.')
      active = false
    }
    if (active) throw new Error('Another local emulator runner is active; its state was preserved.')
    rmSync(lock)
  }
  const descriptor = openSync(lock, 'wx')
  writeFileSync(descriptor, JSON.stringify({ pid: process.pid }))
  closeSync(descriptor)
  let closed = false
  function controlled(path) {
    const absolute = resolve(path), inside = relative(base, absolute)
    if (!inside || inside.startsWith('..') || isAbsolute(inside)) throw new Error('Refusing cleanup outside managed emulator state.')
    if (existsSync(absolute) && lstatSync(absolute).isSymbolicLink()) throw new Error('Refusing cleanup through a symbolic link.')
    return absolute
  }
  function remove(path) { rmSync(controlled(path), { recursive: true, force: true }) }
  function candidate() {
    if (completeEmulatorState(pending)) return pending
    if (completeEmulatorState(next)) return next
    if (!existsSync(run)) return undefined
    return readdirSync(run).filter(name => /^firebase-export-\d+/.test(name)).sort().reverse()
      .map(name => join(run, name)).find(completeEmulatorState)
  }
  function promote(source) {
    if (source !== next) { remove(next); cpSync(source, next, { recursive: true }) }
    if (!completeEmulatorState(next)) throw new Error('Emulator export is incomplete; current and previous states are preserved.')
    if (completeEmulatorState(current)) { remove(previous); renameSync(current, previous) }
    else remove(current)
    renameSync(next, current)
    remove(pending); remove(run)
    mkdirSync(run, { recursive: true })
    writeFileSync(join(data, 'latest.json'), JSON.stringify({ snapshot: 'emulator-state/current' }))
  }
  return {
    current, previous, pending, run,
    prepare() {
      const recovered = candidate()
      if (recovered) promote(recovered)
      if (!completeEmulatorState(current) && completeEmulatorState(previous)) {
        remove(current); cpSync(previous, current, { recursive: true })
      }
      if (!completeEmulatorState(current)) {
        let legacy
        try {
          const name = JSON.parse(readFileSync(join(data, 'latest.json'), 'utf8')).snapshot
          if (/^snapshot-\d+$/.test(name) && completeEmulatorState(join(data, name))) legacy = join(data, name)
        } catch { /* Never guess a seed from arbitrary root export folders. */ }
        if (legacy) { remove(current); cpSync(legacy, current, { recursive: true }) }
      }
      if (!completeEmulatorState(current) && (existsSync(pending) || (existsSync(run) && readdirSync(run).length))) {
        throw new Error('An incomplete first emulator export is preserved for review; no new run was started.')
      }
      remove(pending); remove(run); mkdirSync(run, { recursive: true })
      return completeEmulatorState(current) ? current : undefined
    },
    finish() {
      const exported = candidate()
      if (!exported) return false
      promote(exported)
      return true
    },
    close() { if (!closed) { closed = true; rmSync(lock) } },
  }
}

export function emulatorRun(root, node, state, previous) {
  return {
    cwd: state.run,
    args: [
      join(root, 'node_modules/firebase-tools/lib/bin/firebase.js'), 'emulators:exec',
      '--config', join(root, 'firebase.json'), '--project', 'demo-phase2-security',
      '--only', 'auth,firestore,storage', ...(previous ? ['--import', previous] : []),
      '--export-on-exit', state.pending,
      `"${node}" "${join(root, 'scripts/forms-local-runner.mjs')}"`,
    ],
  }
}
