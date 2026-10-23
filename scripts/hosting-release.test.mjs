import test from 'node:test'
import assert from 'node:assert/strict'
import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { deployEmployeeHosting, sha256 } from './hosting-release.mjs'

const prefix = 'projects/phase2-website/sites/phase2-website'
const previous = `${prefix}/versions/old`, next = `${prefix}/versions/new`
const commit = 'a'.repeat(40)
const raw = Buffer.from('synthetic employee build')
const compressed = gzipSync(raw)
const files = new Map([['/employee-app.html', { raw, compressed }]])
function fixture(options = {}) {
  const writes = [], records = []
  const before = { '/employee-app.html': 'old-hash', '/public-boot.js': 'preserved-hash', '/assets/public.js': 'public-hash' }
  const config = { rewrites: [{ source: '/', function: { functionId: 'getPublishedWebsite' } }], headers: [{ source: '**', headers: [] }] }
  let live = previous, inventory, channelReads = 0
  async function api(method, path, body) {
    if (method !== 'GET') writes.push({ method, path, body })
    if (path.endsWith('/channels/live') && method === 'GET') {
      channelReads++
      return { release: { name: 'release-old', version: { name: options.race && channelReads === 2 ? 'unexpected-version' : live } } }
    }
    if (path === '/' + previous) return { status: 'FINALIZED', config }
    if (path === '/' + previous + '/files') return { files: Object.entries(before).map(([path, hash]) => ({ path, hash })) }
    if (path.endsWith('/versions') && method === 'POST') { assert.deepEqual(body.config, config); return { name: next } }
    if (path.endsWith(':populateFiles')) {
      inventory = body.files
      return { uploadUrl: 'https://upload-firebasehosting.googleapis.com/upload/sites/phase2-website/versions/new/files', uploadRequiredHashes: [options.unknownHash ? 'unknown-live-hash' : sha256(compressed)] }
    }
    if (method === 'UPLOAD') { if (options.uploadFailure) throw Error('synthetic upload failure'); return {} }
    if (path === '/' + next && method === 'PATCH') return {}
    if (path === '/' + next && method === 'GET') return { status: 'FINALIZED', config }
    if (path === '/' + next + '/files') return { files: Object.entries(inventory).map(([path, hash]) => ({ path, hash: options.badInventory ? 'wrong' : hash })) }
    if (path.endsWith('/releases')) { live = next; return { name: 'release-new' } }
    throw Error(`Unexpected synthetic API: ${method} ${path}`)
  }
  return { api, writes, records, before, record: data => records.push(data) }
}

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
