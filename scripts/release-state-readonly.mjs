import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const auth = require('firebase-tools/lib/auth.js')
const { requireAuth } = require('firebase-tools/lib/requireAuth.js')
const { Client } = require('firebase-tools/lib/apiv2.js')
const project = 'phase2-website', projectNumber = '792793988588', region = 'us-central1'
const runtimeIdentity = `${projectNumber}-compute@developer.gserviceaccount.com`
const options = { project, projectRoot: process.cwd(), nonInteractive: true }
const account = auth.getProjectDefaultAccount(process.cwd())
if (!account) throw new Error('Existing Firebase account unavailable')
auth.setActiveAccount(options, account)
await requireAuth(options, true)
const cloud = new Client({ urlPrefix: 'https://cloudfunctions.googleapis.com', apiVersion: 'v2' })
const run = new Client({ urlPrefix: 'https://run.googleapis.com', apiVersion: 'v2' })
const usage = new Client({ urlPrefix: 'https://serviceusage.googleapis.com', apiVersion: 'v1' })
const resource = new Client({ urlPrefix: 'https://cloudresourcemanager.googleapis.com', apiVersion: 'v1' })
const firestore = new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1' })
const result = { checkedAt: new Date().toISOString(), project, region, mutations: false, functions: [], selectedIam: {}, apiStates: {}, runtimeRoleNames: [], deliveryCounts: {}, testAccount: null }
const selected = new Set(['formTemplates', 'formWorkspace', 'formSubmissionViewer', 'formEntries', 'formEmail', 'deliverFormEmail', 'sdsWorkspace'])
let pageToken
do {
  const { body } = await cloud.get(`projects/${project}/locations/-/functions`, { queryParams: { pageSize: 100, ...(pageToken ? { pageToken } : {}) } })
  for (const f of body.functions || []) {
    const name = f.name.split('/').at(-1), service = f.serviceConfig || {}
    result.functions.push({ name, region: f.name.split('/')[3], state: f.state, updateTime: f.updateTime, sourceGeneration: f.buildConfig?.source?.storageSource?.generation, runtime: f.buildConfig?.runtime, revision: service.revision, service: service.service, serviceAccount: service.serviceAccountEmail, secrets: (service.secretEnvironmentVariables || []).map(x => ({ key: x.key, secret: x.secret, version: x.version })), event: f.eventTrigger ? { type: f.eventTrigger.eventType, filters: f.eventTrigger.eventFilters, serviceAccount: f.eventTrigger.serviceAccountEmail, trigger: f.eventTrigger.trigger } : null, config: Object.fromEntries(Object.entries(service.environmentVariables || {}).filter(([key]) => ['EMAIL_ENABLED', 'APP_BASE_URL', 'FORM_TRANSLATION_ENABLED', 'FORM_TRANSLATION_PROCESSING_APPROVED'].includes(key))) })
    if (selected.has(name) && service.service) {
      try { result.selectedIam[name] = (await run.get(service.service + ':getIamPolicy')).body }
      catch (error) { result.selectedIam[name] = { unavailable: error.status || null } }
    }
  }
  pageToken = body.nextPageToken
} while (pageToken)
for (const name of ['eventarc.googleapis.com', 'pubsub.googleapis.com', 'secretmanager.googleapis.com', 'run.googleapis.com', 'cloudfunctions.googleapis.com']) {
  try { result.apiStates[name] = (await usage.get(`projects/${projectNumber}/services/${name}`)).body.state }
  catch (error) { result.apiStates[name] = { unavailable: error.status || null } }
}
try {
  const { body: policy } = await resource.post(`projects/${project}:getIamPolicy`, {})
  result.runtimeRoleNames = (policy.bindings || []).filter(x => x.members?.includes('serviceAccount:' + runtimeIdentity)).map(x => x.role)
  result.existingServiceAgents = ['eventarc', 'pubsub', 'gcf'].map(name => {
    const email = `service-${projectNumber}@gcp-sa-${name}.iam.gserviceaccount.com`
    return { name, email, roles: (policy.bindings || []).filter(x => x.members?.includes('serviceAccount:' + email)).map(x => x.role) }
  })
} catch (error) { result.runtimeRoleReadUnavailable = error.status || null }
for (const status of ['queued', 'sending', 'uncertain', 'sent']) {
  const { body } = await firestore.post(`projects/${project}/databases/(default)/documents:runAggregationQuery`, { structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: 'formDeliveries' }], where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: status } } } }, aggregations: [{ count: {}, alias: 'count' }] } })
  result.deliveryCounts[status] = Number(body?.[0]?.result?.aggregateFields?.count?.integerValue || 0)
}
const { body: users } = await firestore.post(`projects/${project}/databases/(default)/documents:runQuery`, { structuredQuery: { from: [{ collectionId: 'users' }], select: { fields: [{ fieldPath: 'email' }, { fieldPath: 'active' }, { fieldPath: 'role' }] }, where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: 'cjlarsen1165@gmail.com' } } }, limit: 3 } })
const matches = (users || []).filter(x => x.document).map(x => ({ uid: x.document.name.split('/').at(-1), email: x.document.fields?.email?.stringValue, active: x.document.fields?.active?.booleanValue, role: x.document.fields?.role?.stringValue }))
result.testAccount = matches.length === 1 ? matches[0] : { matchingProfiles: matches.length }
const phase = process.argv[2] || 'before'
if (!['before', 'after', 'pre-trigger', 'after-region-stop'].includes(phase)) throw new Error('Unsupported capture name')
mkdirSync('.forms-local-data/oct13-release', { recursive: true })
writeFileSync(`.forms-local-data/oct13-release/${phase}.json`, JSON.stringify(result, null, 2))
console.log(JSON.stringify({ checkedAt: result.checkedAt, functionCount: result.functions.length, selected: result.functions.filter(x => selected.has(x.name)).map(x => ({ name: x.name, state: x.state, revision: x.revision, secrets: x.secrets.map(s => s.key), event: x.event })), apiStates: result.apiStates, runtimeRoleNames: result.runtimeRoleNames, deliveryCounts: result.deliveryCounts, testAccount: result.testAccount, mutations: false }))
