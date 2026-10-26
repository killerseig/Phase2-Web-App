import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { basename, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { emulatorRun, openEmulatorState } from './emulator-state.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const project = mkdtempSync(join(tmpdir(), 'phase2-emulator-integration-'))
const ports = new Set()
async function freePort() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const server = createServer()
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const port = server.address().port
    await new Promise((resolve) => server.close(resolve))
    if (!ports.has(port)) {
      ports.add(port)
      return port
    }
  }
  throw new Error('Could not reserve distinct fixture ports.')
}
const configuration = { emulators: { singleProjectMode: true, ui: { enabled: false } } }
for (const name of ['auth', 'firestore', 'storage', 'hub', 'logging'])
  configuration.emulators[name] = { host: '127.0.0.1', port: await freePort() }
writeFileSync(
  join(project, 'firestore.rules'),
  "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if true; } } }",
)
writeFileSync(
  join(project, 'storage.rules'),
  "rules_version = '2'; service firebase.storage { match /b/{bucket}/o { match /{path=**} { allow read, write: if true; } } }",
)
configuration.firestore = { rules: join(project, 'firestore.rules') }
configuration.storage = { rules: join(project, 'storage.rules') }
writeFileSync(join(project, 'firebase.json'), JSON.stringify(configuration))
writeFileSync(
  join(project, 'fixture.mjs'),
  `
import assert from 'node:assert/strict';
const project='demo-phase2-security', marker='synthetic-persisted-fixture';
for(const name of ['FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST']) assert.match(process.env[name]||'', /^127\\.0\\.0\\.1:\\d+$/);
const auth='http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com/v1/accounts:';
const firestore='http://'+process.env.FIRESTORE_EMULATOR_HOST+'/v1/projects/'+project+'/databases/(default)/documents/lifecycle/synthetic';
const storage='http://'+process.env.FIREBASE_STORAGE_EMULATOR_HOST+'/v0/b/'+project+'.appspot.com/o';
async function json(url,options={}) { const r=await fetch(url,options); assert.ok(r.ok, 'Fixture request failed: '+r.status); return r.json(); }
const account={email:'lifecycle@synthetic.invalid',password:'Synthetic-local-only-123!',returnSecureToken:true};
if(process.argv[2]==='seed') {
 await json(auth+'signUp?key=synthetic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(account)});
 await json(firestore,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields:{marker:{stringValue:marker}}})});
 const uploaded=await fetch(storage+'?name=fixture.txt',{method:'POST',headers:{'Content-Type':'text/plain'},body:marker}); assert.ok(uploaded.ok,'Fixture storage upload failed: '+uploaded.status);
}
await json(auth+'signInWithPassword?key=synthetic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(account)});
assert.equal((await json(firestore)).fields.marker.stringValue,marker);
const file=await fetch(storage+'/fixture.txt?alt=media'); assert.ok(file.ok); assert.equal(await file.text(),marker);
console.log('Synthetic Auth, Firestore and Storage records verified.');
`,
)

let success = false
try {
  for (const phase of ['seed', 'verify']) {
    const state = openEmulatorState(project)
    try {
      const previous = state.prepare(),
        invocation = emulatorRun(project, process.execPath, state, previous)
      assert.equal(!!previous, phase === 'verify')
      invocation.args[0] = join(root, 'node_modules/firebase-tools/lib/bin/firebase.js')
      invocation.args[invocation.args.length - 1] =
        `"${process.execPath}" "${join(project, 'fixture.mjs')}" ${phase}`
      const result = spawnSync(process.execPath, invocation.args, {
        cwd: invocation.cwd,
        windowsHide: true,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        env: {
          ...process.env,
          GCLOUD_PROJECT: 'demo-phase2-security',
          FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true',
        },
      })
      writeFileSync(join(project, phase + '.log'), (result.stdout || '') + (result.stderr || ''))
      if (result.status !== 0)
        throw new Error(
          `Emulator ${phase} failed: ${(result.stderr || result.stdout || result.error?.message || '').slice(-4500)}`,
        )
      assert.equal(state.finish(), true)
      assert.equal(
        readdirSync(project).some((name) => name.startsWith('firebase-export-')),
        false,
      )
      assert.deepEqual(readdirSync(state.run), [])
      if (phase === 'verify') assert.ok(existsSync(state.previous))
      console.log(`Real emulator ${phase}/export completed with bounded staging.`)
    } finally {
      state.close()
    }
  }
  success = true
  console.log(
    'Two real emulator cycles passed, including imported Auth, Firestore and Storage data.',
  )
} finally {
  const local = relative(resolve(tmpdir()), resolve(project))
  assert.ok(
    local &&
      !local.startsWith('..') &&
      basename(project).startsWith('phase2-emulator-integration-'),
  )
  if (!success) {
    const evidence = join(root, '.forms-local-data')
    mkdirSync(evidence, { recursive: true })
    const logs = ['seed.log', 'verify.log'].filter(name => existsSync(join(project, name)))
      .map(name => name + '\n' + readFileSync(join(project, name), 'utf8')).join('\n')
    writeFileSync(join(evidence, 'emulator-integration-last-failure.log'), logs)
    console.error('Synthetic test failure log saved in the fixed local evidence location.')
  }
  // These fixtures contain only generated synthetic data, never review records.
  rmSync(project, { recursive: true, force: true })
}
