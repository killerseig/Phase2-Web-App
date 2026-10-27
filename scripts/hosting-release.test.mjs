import test from 'node:test'
import assert from 'node:assert/strict'
import { gzipSync } from 'node:zlib'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, sep } from 'node:path'
import { createRequire } from 'node:module'
import { analyticsHostingConfig, deployCombinedHosting, deployEmployeeHosting, publicFiles, sha256, documentPreviewHostingConfig } from './hosting-release.mjs'

const prefix = 'projects/phase2-website/sites/phase2-website'
const previous = `${prefix}/versions/old`, next = `${prefix}/versions/new`
const commit = 'a'.repeat(40)
const raw = Buffer.from('synthetic employee build')
const compressed = gzipSync(raw)
const files = new Map([['/employee-app.html', { raw, compressed }]])
function fixture(options = {}) {
  const writes = [], records = []
  const before = { '/employee-app.html': 'old-hash', '/public-boot.js': 'preserved-hash', '/assets/public.js': 'public-hash' }
  const config = { rewrites: [{ source: '/sds-file', function: { functionId: 'downloadSdsFile' } }, { source: '/', function: { functionId: 'getPublishedWebsite' } }], headers: [{ source: '**', headers: [] }] }
  if (options.analytics) config.headers = [
    { glob: '**', headers: { 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; img-src 'self' data:; connect-src 'self'; object-src 'none'", 'X-Frame-Options': 'DENY' } },
    { glob: '/website-runtime.html', headers: { 'Content-Security-Policy': "sandbox allow-scripts; connect-src 'none'" } },
  ]
  let live = previous, inventory, channelReads = 0, stagedConfig = config
  async function api(method, path, body) {
    if (method !== 'GET') writes.push({ method, path, body })
    if (path.endsWith('/channels/live') && method === 'GET') {
      channelReads++
      return { release: { name: 'release-old', version: { name: options.race && channelReads === 2 ? 'unexpected-version' : live } } }
    }
    if (path === '/' + previous) return { status: 'FINALIZED', config, ...(options.alreadyReleased ? { labels: { 'phase2-commit': commit } } : {}) }
    if (path === '/' + previous + '/files') return { files: Object.entries(before).map(([path, hash]) => ({ path, hash })) }
    if (path.endsWith('/versions') && method === 'POST') { assert.deepEqual(body.config, options.analytics ? analyticsHostingConfig(config) : config); stagedConfig = body.config; return { name: next } }
    if (path.endsWith(':populateFiles')) {
      inventory = body.files
      return { uploadUrl: 'https://upload-firebasehosting.googleapis.com/upload/sites/phase2-website/versions/new/files', uploadRequiredHashes: [options.unknownHash ? 'unknown-live-hash' : sha256(compressed)] }
    }
    if (method === 'UPLOAD') { if (options.uploadFailure) throw Error('synthetic upload failure'); return {} }
    if (path === '/' + next && method === 'PATCH') return {}
    if (path === '/' + next && method === 'GET') return { status: 'FINALIZED', config: stagedConfig }
    if (path === '/' + next + '/files') return { files: Object.entries(inventory).map(([path, hash]) => ({ path, hash: options.badInventory ? 'wrong' : hash })) }
    if (path.endsWith('/releases')) { live = next; return { name: 'release-new' } }
    throw Error(`Unexpected synthetic API: ${method} ${path}`)
  }
  return { api, writes, records, before, config, record: data => records.push(data) }
}

const asset = value => { const raw = Buffer.from(value); return { raw, compressed: gzipSync(raw, { level: 9 }) } }
const publicArtifact = () => new Map(['/public-boot.js', '/public-style.css', '/website-runtime.html', '/public-assets/public-1234.js'].map(name => [name, asset('synthetic ' + name)]))
test('combined release updates selected public/employee artifacts and only approved policy, retaining rollback and other files', async () => {
  const f = fixture({ analytics: true }), original = structuredClone(f.config)
  const result = await deployCombinedHosting({ ...f, employee: files, public: publicArtifact(), commit })
  assert.equal(result.state, 'RELEASED')
  assert.equal(result.previousVersion, previous)
  assert.equal(result.publicAssetsUpdated, true)
  assert.equal(result.analyticsCspApplied, true)
  assert.equal(result.publicAssetsPreserved, false)
  const created = f.writes.find(write => write.path.endsWith('/versions'))
  assert.deepEqual(created.body.config.rewrites, original.rewrites)
  assert.deepEqual(created.body.config.headers[1], original.headers[1])
  assert.deepEqual(f.config, original)
  const published = f.writes.find(write => write.path.endsWith(':populateFiles')).body.files
  assert.equal(published['/public-boot.js'], sha256(publicArtifact().get('/public-boot.js').compressed))
  assert.equal(published['/assets/public.js'], f.before['/assets/public.js'])
  assert.equal(f.writes.filter(write => write.path.endsWith('/releases')).length, 1)
})
test('approved policy transformation is idempotent and rejects ambiguous/missing policy without guessing', () => {
  const f = fixture({ analytics: true })
  const updated = analyticsHostingConfig(f.config)
  assert.deepEqual(analyticsHostingConfig(updated), updated)
  assert.throws(() => analyticsHostingConfig({ headers: [] }), /default Hosting header/)
  const bad = structuredClone(f.config)
  bad.headers[0].headers['Content-Security-Policy'] += "; script-src-elem 'self'"
  assert.throws(() => analyticsHostingConfig(bad), /separate review/)
  bad.headers[0].headers['Content-Security-Policy'] = "script-src 'none'; img-src 'self'; connect-src 'self'"
  assert.throws(() => analyticsHostingConfig(bad), /deny-all/)
})
for (const [name, options, message] of [
  ['upload fails', { uploadFailure: true }, /upload failure/],
  ['live changes', { race: true }, /Live changed/],
  ['inventory differs', { badInventory: true }, /inventory differs/],
  ['same commit has another policy', { alreadyReleased: true }, /different intended policy/],
]) test(`combined release stops when ${name}`, async () => {
  const f = fixture({ analytics: true, ...options })
  await assert.rejects(deployCombinedHosting({ ...f, employee: files, public: publicArtifact(), commit }), message)
  assert(!f.writes.some(write => write.path.endsWith('/releases')))
})
test('combined release rejects incomplete or out-of-scope artifacts before network requests', () => {
  const f = fixture({ analytics: true }), publicAssets = publicArtifact()
  publicAssets.set('/sds-file', asset('not an authorized artifact'))
  assert.throws(() => deployCombinedHosting({ ...f, employee: files, public: publicAssets, commit }), /Unexpected public/)
  assert.throws(() => deployCombinedHosting({ ...f, employee: files, public: new Map(), commit }), /incomplete/)
  assert.equal(f.writes.length, 0)
})
test('public artifact selection reads only intended output and verifies boot/runtime dependency presence', t => {
  const directory = mkdtempSync(resolve(tmpdir(), 'phase2-public-artifact-'))
  t.after(() => { assert(directory.startsWith(resolve(tmpdir()) + sep)); rmSync(directory, { recursive: true, force: true }) })
  mkdirSync(resolve(directory, 'public-assets'))
  writeFileSync(resolve(directory, 'public-assets/public-1234.js'), 'export {}')
  writeFileSync(resolve(directory, 'public-boot.js'), 'import "/public-assets/public-1234.js";')
  writeFileSync(resolve(directory, 'public-style.css'), 'body{}')
  writeFileSync(resolve(directory, 'website-runtime.html'), '<script type="module" src="/public-assets/public-1234.js"></script>')
  writeFileSync(resolve(directory, 'unrelated-private.json'), 'offline-fixture-only')
  assert.deepEqual([...publicFiles(directory).keys()].sort(), ['/public-assets/public-1234.js', '/public-boot.js', '/public-style.css', '/website-runtime.html'])
  writeFileSync(resolve(directory, 'public-boot.js'), 'import "/public-assets/missing.js";')
  assert.throws(() => publicFiles(directory), /entry is missing/)
})

test('releases only employee assets, preserving public assets/config and rollback reference', async () => {
  const f = fixture()
  const result = await deployEmployeeHosting({ ...f, files, commit })
  assert.equal(result.state, 'RELEASED')
  assert.equal(result.previousVersion, previous)
  assert.equal(result.version, next)
  assert.equal(f.writes.filter(write => write.path.endsWith('/releases')).length, 1)
  const population = f.writes.find(write => write.path.endsWith(':populateFiles')).body.files
  assert.equal(population['/public-boot.js'], f.before['/public-boot.js'])
  assert.equal(population['/assets/public.js'], f.before['/assets/public.js'])
  assert.equal(population['/employee-app.html'], sha256(compressed))
  assert.equal(f.records.at(-1).state, 'RELEASED')
})
for (const [name, options, message] of [
  ['live changes while preparing', { race: true }, /Live changed/],
  ['upload fails', { uploadFailure: true }, /upload failure/],
  ['server requests missing preserved asset', { unknownHash: true }, /preserved live file/],
  ['staged inventory differs', { badInventory: true }, /inventory differs/],
]) test(`does not release when ${name}`, async () => {
  const f = fixture(options)
  await assert.rejects(deployEmployeeHosting({ ...f, files, commit }), message)
  assert(!f.writes.some(write => write.path.endsWith('/releases')))
})
test('public shared asset collision stops before any mutation', async () => {
  const f = fixture(), collision = new Map(files)
  collision.set('/assets/public.js', { raw, compressed })
  await assert.rejects(deployEmployeeHosting({ ...f, files: collision, commit }), /asset collision/)
  assert.equal(f.writes.length, 0)
})
test('wrong commit is rejected before network access', async () => {
  const f = fixture()
  await assert.rejects(deployEmployeeHosting({ ...f, files, commit: 'not-a-commit' }))
  assert.equal(f.writes.length, 0)
})
test('superseded main stops before creating a version', async () => {
  const f = fixture()
  await assert.rejects(deployEmployeeHosting({ ...f, files, commit, assertCurrentMain: async () => { throw Error('newer main') } }), /newer main/)
  assert.equal(f.writes.length, 0)
})
test('workflow validates both branches and gates cloud authentication behind main and approval', () => {
  const require = createRequire(import.meta.url)
  const workflow = require('yaml').parse(readFileSync(new URL('../.github/workflows/phase2.yml', import.meta.url), 'utf8'))
  assert.deepEqual(workflow.on.push.branches, ['main', 'test'])
  assert.deepEqual(workflow.on.pull_request.branches, ['main', 'test'])
  assert.equal(workflow.jobs.deploy.if, "github.event_name == 'push' && github.ref == 'refs/heads/main'")
  assert.equal(workflow.jobs.deploy.needs, 'validate')
  assert.equal(workflow.jobs.deploy.concurrency['cancel-in-progress'], false)
  assert(!workflow.jobs.validate.steps.some(step => step.uses?.startsWith('google-github-actions/auth')))
  assert.match(workflow.jobs.deploy.steps[0].run, /exit 1/)
  assert.equal(workflow.jobs.deploy.steps[0].env.APPROVED, '${{ vars.PHASE2_DEPLOY_AUTH_APPROVED }}')
  assert(!JSON.stringify(workflow).includes('credentials_json'))
})
test('source Hosting configuration routes private previews before the application fallback', () => {
  const config = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8')).hosting
  const rules = config.rewrites.filter(rule => rule.source === '/sds-file')
  assert.equal(rules.length, 1)
  assert.equal(rules[0].function.functionId, 'downloadSdsFile')
  assert.deepEqual(documentPreviewHostingConfig(config), config)
})
test('live Gen2 ServingConfig repair removes only the document route collision', () => {
  const config = { headers: [{ glob: '**', headers: { 'X-Frame-Options': 'DENY' } }], rewrites: [
    { glob: '/sds-file', path: '/employee-app.html' },
    { glob: '/sds-file', run: { serviceId: 'downloadsdsfile', region: 'us-central1' } },
    { glob: '/', run: { serviceId: 'getpublishedwebsite', region: 'us-central1' } },
    { glob: '**', path: '/employee-app.html' },
  ] }
  const original = structuredClone(config)
  const fixed = documentPreviewHostingConfig(config)
  assert.deepEqual(config, original)
  assert.deepEqual(fixed, { ...config, rewrites: config.rewrites.slice(1) })
  assert.deepEqual(documentPreviewHostingConfig(fixed), fixed)
})
test('missing private file handler fails closed', () => {
  assert.throws(() => documentPreviewHostingConfig({ rewrites: [{ glob: '/sds-file', path: '/employee-app.html' }] }), /handler rewrite is missing/)
})

test('analytics CSP adds only the approved origins and keeps the script iframe isolated', () => {
  const config = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8')).hosting
  const readPolicy = source => config.headers.find(rule => rule.source === source).headers.find(header => header.key === 'Content-Security-Policy').value
  const policy = Object.fromEntries(readPolicy('**').split(';').map(directive => directive.trim().split(/\s+/)).filter(([name]) => name).map(([name, ...values]) => [name, values]))
  const approved = ['https://www.googletagmanager.com', 'https://www.google-analytics.com', 'https://region1.google-analytics.com']
  assert.deepEqual(policy['script-src'], ["'self'", "'wasm-unsafe-eval'", approved[0]])
  assert.deepEqual(policy['img-src'], ["'self'", 'data:', 'blob:', 'https://firebasestorage.googleapis.com', 'https://storage.googleapis.com', ...approved])
  assert.deepEqual(policy['connect-src'], ["'self'", 'https://*.googleapis.com', 'https://*.cloudfunctions.net', 'https://*.run.app', 'https://*.firebaseio.com', 'wss://*.firebaseio.com', ...approved])
  const { 'script-src': script, 'img-src': images, 'connect-src': connections, ...other } = policy
  assert(script && images && connections)
  assert.deepEqual(other, {
    'default-src': ["'self'"], 'style-src': ["'self'", "'unsafe-inline'"], 'font-src': ["'self'", 'data:'],
    'frame-src': ["'self'", 'https://*.firebaseapp.com', 'https://www.youtube-nocookie.com', 'https://player.vimeo.com'],
    'media-src': ["'self'", 'https:'], 'worker-src': ["'self'", 'blob:'], 'object-src': ["'none'"],
    'base-uri': ["'self'"], 'frame-ancestors': ["'none'"], 'form-action': ["'self'"], 'upgrade-insecure-requests': [],
  })
  assert.equal(readPolicy('/website-runtime.html'), "sandbox allow-scripts allow-forms allow-top-navigation-by-user-activation; default-src 'none'; script-src 'self' https://phase2-website.web.app https://phase2-website.firebaseapp.com 'unsafe-inline'; style-src 'self' https://phase2-website.web.app https://phase2-website.firebaseapp.com 'unsafe-inline'; img-src 'self' https://phase2-website.web.app https://phase2-website.firebaseapp.com data: blob:; font-src 'self' https://phase2-website.web.app https://phase2-website.firebaseapp.com data:; connect-src 'none'; frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com; media-src https:; form-action 'none'; base-uri 'none'; frame-ancestors 'self'")
})
