import assert from 'node:assert/strict'
import { existsSync, lstatSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const output = resolve(root, '.forms-local-data', 'frontend-verification')
const configuration = {
  VITE_FIREBASE_API_KEY: 'synthetic-verification-only',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo-phase2-verification.invalid',
  VITE_FIREBASE_PROJECT_ID: 'demo-phase2-verification',
  VITE_FIREBASE_STORAGE_BUCKET: 'demo-phase2-verification.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  VITE_FIREBASE_APP_ID: '1:000000000000:web:synthetic',
  VITE_FORM_EMULATORS: 'false',
}
const entries = [
  ['employee', 'vite.config.ts'],
  ['public', 'vite.public.config.ts'],
  ['ssr', 'vite.public-ssr.config.ts'],
]
const counts = {}
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)],
  )
}
for (const [name, configFile] of entries) {
  const outDir = resolve(output, name),
    local = relative(output, outDir)
  assert.ok(local && !local.startsWith('..') && !isAbsolute(local))
  for (const directory of [resolve(root, '.forms-local-data'), output, outDir])
    assert.ok(
      !existsSync(directory) || !lstatSync(directory).isSymbolicLink(),
      'Refusing generated output through a symbolic link.',
    )
  await build({
    configFile: join(root, configFile),
    envDir: false,
    mode: 'production',
    logLevel: 'error',
    define: Object.fromEntries(
      Object.entries(configuration).map(([key, value]) => [
        `import.meta.env.${key}`,
        JSON.stringify(value),
      ]),
    ),
    build: { outDir, emptyOutDir: true },
  })
  const scripts = files(outDir).filter((file) => /\.(?:js|mjs|cjs)$/.test(file))
  assert.ok(scripts.length, `${name} emitted no JavaScript`)
  if (name === 'employee')
    assert.ok(
      scripts.some((file) => file.includes('WebsiteBuilderView')),
      'Website Builder must be included, avoiding a vacuous iframe-bridge check.',
    )
  for (const file of scripts) {
    const source = readFileSync(file, 'utf8')
    for (const forbidden of [
      '__PHASE2_E2E__',
      'forms-local-admin',
      'Local-Forms-Only-123!',
      'vite:afterUpdate',
    ])
      assert.ok(!source.includes(forbidden), `${forbidden} leaked into ${relative(output, file)}`)
  }
  counts[name] = scripts.length
  console.log(
    `${name}: production-mode build and fixture/HMR exclusion passed (${scripts.length} JS files).`,
  )
}
writeFileSync(
  join(output, 'verification.json'),
  JSON.stringify(
    { synthetic: true, releaseArtifact: false, envFilesRead: false, outputs: counts },
    null,
    2,
  ),
)
console.log(
  'Synthetic verification only. Use the reviewed release workflow for deployable artifacts.',
)
