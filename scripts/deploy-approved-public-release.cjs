'use strict'
// Deploy only the reviewed public website services or Hosting, preserving existing IAM.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const { Client } = require('firebase-tools/lib/apiv2.js')
const directory = '.forms-local-data/public-release'
const before = JSON.parse(fs.readFileSync(directory + '/before.json'))
const selected = ['websiteBuilder', 'getPublishedWebsite', 'websiteImage']
const project = 'phase2-website'
const hosting = process.argv.includes('--hosting')
const canonical = bindings => JSON.stringify((bindings || []).map(b => ({ ...b, members: [...(b.members || [])].sort() })).sort((a,b) => a.role.localeCompare(b.role)))
const originalRequest = Client.prototype.request, audit = []
function stop(message, method, host, requestPath) {
  fs.writeFileSync(directory + '/blocked-request.json', JSON.stringify({ message, method, host, path: requestPath, requestNotSent: true }, null, 2))
  throw Error(message + ': ' + requestPath)
}
Client.prototype.request = function(options) {
  const method = String(options.method || 'GET').toUpperCase(), requestPath = '/' + String(options.path || '').split('?')[0].replace(/^\/+/, ''), host = String(this.opts?.urlPrefix || '')
  if (method === 'POST' && /:testIamPermissions$|:getIamPolicy$/.test(requestPath)) return originalRequest.call(this, options)
  if (method === 'POST' && /:generateServiceIdentity$/.test(requestPath)) {
    const service = requestPath.match(/services\/([^/:]+):generateServiceIdentity$/)?.[1]
    const existing = before.existingServiceAgents?.[service]
    if (!existing || !requestPath.includes('projects/792793988588/')) stop('Existing service identity is unverified', method, host, requestPath)
    audit.push({ method, host, path: requestPath, suppressedExistingIdentity: true })
    fs.writeFileSync(directory + '/audit-functions.json', JSON.stringify(audit, null, 2))
    return Promise.resolve({ status: 200, body: { done: true, response: { email: existing.email } }, headers: {} })
  }
  if (!['GET','HEAD'].includes(method)) {
    if (/:enable$|:batchEnable$|generateServiceIdentity|:addIamPolicyBinding$/.test(requestPath)) stop('API or identity provisioning is outside this release', method, host, requestPath)
    if (/setIamPolicy/.test(requestPath)) {
      const service = requestPath.match(/\/services\/([^/:]+):setIamPolicy$/)?.[1]
      const existing = before.functions.find(f => selected.some(n => f.name.endsWith('/'+n)) && f.serviceConfig.service.endsWith('/'+service))
      const name = existing?.name.split('/').at(-1)
      if (!host.includes('run.googleapis.com') || !name || canonical(options.body?.policy?.bindings) !== canonical(before.selectedIam[name].bindings)) stop('IAM changes are outside this release', method, host, requestPath)
      // The CLI may request an identical public invoker policy. Return the existing
      // policy without sending an IAM mutation to production.
      audit.push({ method, host, path: requestPath, suppressedIdenticalIam: true })
      fs.writeFileSync(directory + '/audit-' + (hosting ? 'hosting' : 'functions') + '.json', JSON.stringify(audit, null, 2))
      return Promise.resolve({ status: 200, body: before.selectedIam[name], headers: {} })
    }
    if (/secretmanager|firestore|iam.googleapis.com|serviceusage.googleapis.com/.test(host)) stop('Data, secrets, and permissions are outside this release', method, host, requestPath)
    if (host.includes('cloudfunctions.googleapis.com')) {
      if (hosting || method === 'DELETE') stop('Unselected function mutation', method, host, requestPath)
      if (['PATCH','PUT'].includes(method) || (method === 'POST' && /\/functions$/.test(requestPath))) {
        const name = requestPath.match(/\/functions\/([^/:]+)$/)?.[1] || options.queryParams?.functionId || options.body?.name?.split('/').at(-1)
        const prior = before.functions.find(f => f.name.endsWith('/'+name))
        if (!selected.includes(name) || requestPath !== '/projects/'+project+'/locations/us-central1/functions/'+name || !prior) stop('Only the three existing website services are approved', method, host, requestPath)
        const config = options.body?.serviceConfig || {}
        if (config.serviceAccountEmail && config.serviceAccountEmail !== prior.serviceConfig.serviceAccountEmail) stop('Runtime identity change', method, host, requestPath)
        if (config.secretEnvironmentVariables?.length || config.secretVolumes?.length) stop('Secret binding change', method, host, requestPath)
        if (options.body?.buildConfig?.runtime && options.body.buildConfig.runtime !== prior.buildConfig.runtime) stop('Runtime version change', method, host, requestPath)
      } else if (!(method === 'POST' && requestPath === '/projects/'+project+'/locations/us-central1/functions:generateUploadUrl')) stop('Unexpected function operation', method, host, requestPath)
    } else if (host.includes('upload-firebasehosting.googleapis.com')) {
      if (!hosting || !/^https:\/\/upload-firebasehosting\.googleapis\.com\/upload\/sites\/phase2-website\/versions\/[a-z0-9]+\/files$/.test(host) || !/^\/[a-f0-9]{64}$/.test(requestPath) || method !== 'POST') stop('Unselected Hosting file upload', method, host, requestPath)
    } else if (host.includes('firebasehosting.googleapis.com')) {
      if (!hosting || !/^\/projects\/(?:-|phase2-website|792793988588)\/sites\/phase2-website\/(?:versions|channels\/live\/releases)(?:\/|:|$)/.test(requestPath)) stop('Unselected Hosting mutation', method, host, requestPath)
      if (method === 'DELETE') stop('Hosting deletion', method, host, requestPath)
    } else if (!host.includes('storage.googleapis.com') && !host.includes('upload-firebasehosting.googleapis.com')) stop('Unexpected deployment mutation', method, host, requestPath)
    audit.push({ method, host, path: requestPath })
    fs.writeFileSync(directory + '/audit-' + (hosting ? 'hosting' : 'functions') + '.json', JSON.stringify(audit, null, 2))
  }
  return originalRequest.call(this, options)
}
const packagePath = path.resolve('functions/package.json'), entryPath = path.resolve('functions/approvedPublicReleaseEntry.js')
const packageBefore = fs.readFileSync(packagePath)
let restored = false
function restore() {
  if (restored) return
  if (!hosting) { fs.writeFileSync(packagePath, packageBefore); if (fs.existsSync(entryPath)) fs.unlinkSync(entryPath) }
  restored = true
}
process.on('exit', restore)
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => { restore(); process.exit(130) })
async function main() {
  if (!hosting) {
    assert.ok(!fs.existsSync(entryPath))
    fs.writeFileSync(entryPath, "'use strict';const website=require('./websiteFunctions');exports.websiteBuilder=website.websiteBuilder;exports.getPublishedWebsite=website.getPublishedWebsite;exports.websiteImage=website.websiteImage;\n")
    const pkg = JSON.parse(packageBefore); pkg.main = 'approvedPublicReleaseEntry.js'; fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2)+'\n')
    process.env.GCLOUD_PROJECT = project
    process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: project, storageBucket: project+'.firebasestorage.app' })
    const loader = require(path.resolve('functions/node_modules/firebase-functions/lib/runtime/loader.js'))
    const manifest = await loader.loadStack(path.resolve('functions'))
    assert.deepEqual(Object.keys(manifest.endpoints).sort(), [...selected].sort())
    assert.equal((manifest.params || []).filter(p => p.type === 'secret').length, 0)
    assert.ok(manifest.endpoints.getPublishedWebsite.callableTrigger, 'Keep the existing callable endpoint declaration')
    fs.writeFileSync(directory + '/selected-manifest.json', JSON.stringify(manifest,null,2))
  }
  if (process.argv.includes('--verify-only')) { console.log('Verified public release selection; no deployment performed.'); restore(); return }
  process.env.FUNCTIONS_DISCOVERY_TIMEOUT = '120'
  process.argv = [process.execPath, 'firebase', 'deploy', '--project', project, '--only', hosting ? 'hosting' : selected.map(n=>'functions:'+n).join(','), '--non-interactive', '--json']
  require('firebase-tools/lib/bin/firebase.js')
}
main().catch(error => { restore(); console.error(error.message); process.exitCode = 1 })
