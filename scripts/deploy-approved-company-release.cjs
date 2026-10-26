const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict')
const { Client } = require('firebase-tools/lib/apiv2.js')
const project = 'phase2-website', region = 'us-central1'
const identity = '792793988588-compute@developer.gserviceaccount.com'
const selected = ['formTemplates', 'formWorkspace', 'formSubmissionViewer', 'sdsWorkspace', 'formEmail', 'formEntries', 'deliverFormEmail']
const secrets = ['GRAPH_CLIENT_ID', 'GRAPH_TENANT_ID', 'GRAPH_CLIENT_SECRET', 'OUTLOOK_SENDER_EMAIL']
const directory = '.forms-local-data/oct13-release'
const before = JSON.parse(fs.readFileSync(directory + (process.argv.includes('--worker-only') ? '/after-region-stop.json' : '/before.json')))
const targets = process.argv.includes('--worker-only') ? ['deliverFormEmail'] : selected
assert.equal(before.project, project)
assert.ok(selected.every(name => ['formEntries', 'deliverFormEmail'].includes(name) || before.functions.some(f => f.name === name && f.state === 'ACTIVE')))
assert.equal(before.deliveryCounts.queued, 0, 'Reinspect queued-delivery effects before activating the worker')
for (const api of ['eventarc.googleapis.com', 'pubsub.googleapis.com', 'secretmanager.googleapis.com', 'run.googleapis.com', 'cloudfunctions.googleapis.com']) assert.equal(before.apiStates[api], 'ENABLED')
const canonical = value => JSON.stringify((value || []).map(b => ({ role: b.role, members: [...(b.members || [])].sort(), ...(b.condition ? { condition: b.condition } : {}) })).sort((a, b) => a.role.localeCompare(b.role)))
const request = Client.prototype.request, audit = []
function stop(message, method, requestPath) {
  fs.writeFileSync(directory + '/additional-approval-required.json', JSON.stringify({ message, method, path: requestPath, requestNotSent: true }, null, 2))
  throw new Error(message + ': ' + requestPath)
}
Client.prototype.request = function(options) {
  const method = String(options.method || 'GET').toUpperCase(), requestPath = String(options.path || '').split('?')[0], host = String(this.opts?.urlPrefix || '')
  if (!['GET', 'HEAD'].includes(method)) {
    if (/:enable$|:batchEnable$|:addIamPolicyBinding$/.test(requestPath)) stop('Additional API/IAM provisioning is not approved', method, requestPath)
    if (/setIamPolicy/.test(requestPath)) {
      const service = requestPath.match(/\/services\/([^/:]+):setIamPolicy$/)?.[1]
      if (!host.includes('run.googleapis.com') || !service) stop('Additional project/service-account IAM change is not approved', method, requestPath)
      const binding = options.body?.policy?.bindings
      if (service === 'formentries') assert.equal(canonical(binding), canonical([{ role: 'roles/run.invoker', members: ['allUsers'] }]))
      else if (service === 'deliverformemail') assert.equal(canonical(binding), canonical([{ role: 'roles/run.invoker', members: ['serviceAccount:' + identity] }]))
      else {
        const existing = before.functions.find(f => selected.includes(f.name) && f.service?.endsWith('/services/' + service))
        if (!existing || canonical(binding) !== canonical(before.selectedIam[existing.name]?.bindings)) stop('Existing service IAM would change', method, requestPath)
      }
    }
    if (/generateServiceIdentity/.test(requestPath)) {
      const name = requestPath.match(/services\/(pubsub|eventarc)\.googleapis\.com/)?.[1]
      if (!name || !before.existingServiceAgents?.some(x => x.name === name && x.roles.length)) stop('Additional service identity provisioning is not approved', method, requestPath)
    }
    if (host.includes('cloudfunctions.googleapis.com')) {
      const name = requestPath.match(/\/functions\/([^/:]+)$/)?.[1] || options.queryParams?.functionId || options.body?.name?.split('/').at(-1)
      if (method === 'DELETE') stop('Function deletion is not approved', method, requestPath)
      if (['PATCH', 'PUT'].includes(method) || (method === 'POST' && /\/functions$/.test(requestPath))) {
        const allowedRegion = before.functions.find(f => f.name === name)?.region || region
        if (!targets.includes(name) || !requestPath.includes(`projects/${project}/locations/${allowedRegion}/`)) stop('Unselected function mutation is not approved', method, requestPath)
        const account = options.body?.serviceConfig?.serviceAccountEmail
        if (account && account !== identity) stop('Runtime identity change is not approved', method, requestPath)
        const mounted = options.body?.serviceConfig?.secretEnvironmentVariables
        if (mounted && canonical(mounted.map(x => ({ role: x.key, members: [x.secret] }))) !== canonical((['formEmail', 'deliverFormEmail'].includes(name) ? secrets : []).map(key => ({ role: key, members: [key] })))) stop('Secret binding expansion is not approved', method, requestPath)
      }
    }
    if (/secretmanager|firestore/.test(host)) stop('Deployment data/secret mutation is not approved', method, requestPath)
    audit.push({ method, host, path: requestPath })
    fs.writeFileSync(directory + '/deployment-request-audit.json', JSON.stringify(audit, null, 2))
  }
  return request.call(this, options)
}
const packagePath = path.resolve('functions/package.json'), entryPath = path.resolve('functions/approvedCompanyReleaseEntry.js')
const packageBefore = fs.readFileSync(packagePath)
assert.ok(!fs.existsSync(entryPath))
let restored = false
function restore() {
  if (restored) return
  fs.writeFileSync(packagePath, packageBefore)
  if (fs.existsSync(entryPath)) fs.unlinkSync(entryPath)
  restored = true
  fs.writeFileSync(directory + '/packaging-restored.json', JSON.stringify({ packageBytesMatch: fs.readFileSync(packagePath).equals(packageBefore), temporaryEntryRemoved: !fs.existsSync(entryPath) }))
}
process.on('exit', restore)
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { restore(); process.exit(130) })
fs.writeFileSync(entryPath, "'use strict';const forms=require('./lib/formFunctions');exports.formTemplates=forms.formTemplates;exports.formWorkspace=forms.formWorkspace;exports.formSubmissionViewer=require('./lib/formSubmissionViewer').formSubmissionViewer;exports.sdsWorkspace=require('./lib/sdsFunctions').sdsWorkspace;const email=require('./lib/formDelivery');exports.formEmail=email.formEmail;exports.deliverFormEmail=email.deliverFormEmail;exports.formEntries=require('./lib/formEntries').formEntries;\n")
const pkg = JSON.parse(packageBefore); pkg.main = 'approvedCompanyReleaseEntry.js'; fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n')
process.env.GCLOUD_PROJECT = project
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: project, storageBucket: project + '.firebasestorage.app' })
async function main() {
  const loader = require(path.resolve('functions/node_modules/firebase-functions/lib/runtime/loader.js'))
  const manifest = await loader.loadStack(path.resolve('functions'))
  assert.deepEqual(Object.keys(manifest.endpoints).sort(), [...selected].sort())
  assert.deepEqual((manifest.params || []).filter(x => x.type === 'secret').map(x => x.name).sort(), [...secrets].sort())
  assert.ok(!Object.keys(require.cache).some(x => /[/\\](formTranslationService|integrationApi|operationsFunctions)\.js$/.test(x)))
  fs.writeFileSync(directory + '/selected-manifest.json', JSON.stringify(manifest, null, 2))
  if (process.argv.includes('--verify-only')) { console.log(JSON.stringify({ passed: true, endpoints: selected, secretNames: secrets, noDeferredModules: true, deployment: false })); restore(); return }
  process.env.FUNCTIONS_DISCOVERY_TIMEOUT = '120'
  process.argv = [process.execPath, 'firebase', 'deploy', '--project', project, '--only', targets.map(x => 'functions:' + x).join(','), '--non-interactive', '--json']
  require('firebase-tools/lib/bin/firebase.js')
}
main().catch(error => { restore(); console.error(error.message); process.exitCode = 1 })
