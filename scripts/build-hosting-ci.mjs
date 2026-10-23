import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, renameSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

// This endpoint exposes public browser configuration, not deployment credentials.
const response = await fetch('https://phase2-website.web.app/__/firebase/init.json', {
  redirect: 'error', signal: AbortSignal.timeout(30000),
})
assert(response.ok, `Public SDK configuration HTTP ${response.status}`)
const sdk = await response.json()
assert.equal(sdk.projectId, 'phase2-website')
assert.equal(sdk.appId, '1:792793988588:web:4f3a132eb263f7f65ad4c9')
mkdirSync('.forms-local-data', { recursive: true })
writeFileSync('.forms-local-data/hosting-sdk.json', JSON.stringify(sdk))
const env = { ...process.env, VITE_FORM_EMULATORS: 'false' }
for (const [name, key] of Object.entries({ API_KEY: 'apiKey', AUTH_DOMAIN: 'authDomain', PROJECT_ID: 'projectId', STORAGE_BUCKET: 'storageBucket', MESSAGING_SENDER_ID: 'messagingSenderId', APP_ID: 'appId' })) {
  assert(sdk[key], `Missing public SDK field ${key}`)
  env[`VITE_FIREBASE_${name}`] = sdk[key]
}
for (const args of [
  ['node_modules/vue-tsc/bin/vue-tsc.js', '--build', '--force'],
  ['node_modules/vite/bin/vite.js', 'build'],
  ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.public.config.ts'],
  ['scripts/verify-public-startup.mjs'],
  ['scripts/build-public-templates.mjs'],
  ['functions/node_modules/typescript/bin/tsc', '-p', 'functions/tsconfig.json'],
  ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.public-ssr.config.ts'],
  ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.hosting.config.ts'],
]) {
  console.log(`Build: ${args.join(' ')}`)
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' })
  if (result.error) throw result.error
  assert.equal(result.status, 0, `Build failed: ${args[0]}`)
}
renameSync('hosting-dist/index.html', 'hosting-dist/employee-app.html')
console.log('Validated production employee build; no deployment performed.')
