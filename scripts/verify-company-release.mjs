import { createRequire } from 'node:module'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const require = createRequire(import.meta.url), auth = require('firebase-tools/lib/auth.js')
const { requireAuth } = require('firebase-tools/lib/requireAuth.js'), { Client } = require('firebase-tools/lib/apiv2.js')
const project = 'phase2-website', host = `https://${project}.web.app`, hash = bytes => createHash('sha256').update(bytes).digest('hex')
const result = { checkedAt: new Date().toISOString(), site: host, assets: [], routes: [], accessChecks: [], release: null, sourceCommit: '66df2417a07e398d2bb8a82995370deaa0a63678' }
const html = readFileSync('dist/index.html'), entry = html.toString().match(/src="(\/assets\/[^\"]+\.js)"/)?.[1]
if (!entry) throw new Error('Missing app entry')
const assets = readdirSync('dist/assets').filter(x => /^(FormBuilderView|FormSubmissionView|ReportsView|CompanyLibraryView|SdsExplorerModule)-.*\.js$/.test(x))
for (const name of ['/index.html', entry, ...assets.map(x => '/assets/' + x)]) {
  const response = await fetch(host + name + '?release=66df241'), remote = Buffer.from(await response.arrayBuffer()), local = readFileSync('dist' + name)
  result.assets.push({ path: name, status: response.status, localSha256: hash(local), remoteSha256: hash(remote), matches: response.ok && hash(local) === hash(remote) })
}
for (const name of ['/reports', '/company-library', '/admin/forms']) {
  const response = await fetch(host + name + '?release=66df241')
  result.routes.push({ path: name, status: response.status, matchingAppHtml: response.ok && hash(Buffer.from(await response.arrayBuffer())) === hash(html) })
}
for (const [endpoint, data] of [['formEntries', { action: 'list', templateId: 'release-test-template-oct13' }], ['formSubmissionViewer', { action: 'get', id: 'release-test-20261013-8c0e16c' }]]) {
  const response = await fetch(`https://us-central1-${project}.cloudfunctions.net/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }) })
  result.accessChecks.push({ endpoint, status: response.status, unauthenticatedRejected: [401, 403].includes(response.status) })
}
const options = { project, projectRoot: process.cwd(), nonInteractive: true }
auth.setActiveAccount(options, auth.getProjectDefaultAccount(process.cwd())); await requireAuth(options, true)
const hosting = new Client({ urlPrefix: 'https://firebasehosting.googleapis.com', apiVersion: 'v1beta1' })
const { body } = await hosting.get(`projects/-/sites/${project}/releases`, { queryParams: { pageSize: 1 } })
const release = body.releases?.[0]
result.release = release ? { name: release.name, type: release.type, releaseTime: release.releaseTime, version: release.version?.name, status: release.version?.status, fileCount: release.version?.fileCount } : null
writeFileSync('.forms-local-data/oct13-release/live-hosting-verification.json', JSON.stringify(result, null, 2))
console.log(JSON.stringify(result))
if (result.assets.some(x => !x.matches) || result.routes.some(x => !x.matchingAppHtml) || result.accessChecks.some(x => !x.unauthenticatedRejected) || !result.release) process.exitCode = 1
