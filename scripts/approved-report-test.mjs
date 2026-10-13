import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const require = createRequire(import.meta.url)
const requireFunctions = createRequire(new URL('../functions/package.json', import.meta.url))
const sharp = requireFunctions('sharp')
const { validateFormDefinition, validateFormAnswers } = requireFunctions('./formModel')
// Use only the pure ownership predicate locally; production calls still use real runtime services.
require.cache[requireFunctions.resolve('./runtime')] = { exports: { db: {}, storageBucket: {} } }
const { entryReaderAllowed } = requireFunctions('./formEntryAccess')
const auth = require('firebase-tools/lib/auth.js'), { requireAuth } = require('firebase-tools/lib/requireAuth.js'), { Client } = require('firebase-tools/lib/apiv2.js')
const project = 'phase2-website', email = 'cjlarsen1165@gmail.com', id = 'release-test-20261013-8c0e16c', bucket = project + '.firebasestorage.app'
const options = { project, projectRoot: process.cwd(), nonInteractive: true }
const account = auth.getProjectDefaultAccount(process.cwd())
if (!account) throw new Error('Existing Firebase account unavailable')
auth.setActiveAccount(options, account); await requireAuth(options, true)
const firestore = new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1' })
const storage = new Client({ urlPrefix: 'https://storage.googleapis.com', apiVersion: 'upload/storage/v1' })
const prefix = `projects/${project}/databases/(default)/documents/`
const summaryPath = '.forms-local-data/oct13-release/approved-test.json'
const state = JSON.parse(readFileSync('.forms-local-data/oct13-release/after.json'))
const profile = state.testAccount
if (profile.email !== email || !profile.active || profile.role !== 'admin' || !profile.uid) throw new Error('Exact approved test-owner account not verified')
if (!state.functions.some(f => f.name === 'deliverFormEmail' && f.state === 'ACTIVE' && f.revision === 'deliverformemail-00002-pez')) throw new Error('Updated automatic worker not verified')
function encode(value) {
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } }
  if (value && typeof value === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, encode(v)])) } }
  return { nullValue: null }
}
function decode(value) {
  if ('stringValue' in value) return value.stringValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('booleanValue' in value) return value.booleanValue
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode)
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k, v]) => [k, decode(v)]))
  return null
}
const mode = process.argv[2] || '--inspect'
if (mode === '--inspect') {
  const response = await firestore.get(prefix + 'formDeliveries/' + id, { resolveOnHTTPError: true })
  const data = response.status === 200 ? Object.fromEntries(Object.entries(response.body.fields || {}).map(([k, v]) => [k, decode(v)])) : null
  console.log(JSON.stringify({ id, exists: !!data, status: data?.status, attempts: data?.attempts, recipients: data?.recipients, attemptStartedAt: data?.attemptStartedAt, attemptFinishedAt: data?.attemptFinishedAt }))
  if (data && (!Array.isArray(data.recipients) || data.recipients.length !== 1 || data.recipients[0] !== email)) throw new Error('Unexpected test audience')
  if (data?.status === 'sent') {
    const prior = JSON.parse(readFileSync(summaryPath)); prior.delivery = { status: data.status, attempts: data.attempts, attemptFinishedAt: data.attemptFinishedAt }
    writeFileSync(summaryPath, JSON.stringify(prior, null, 2))
  }
} else if (mode === '--create-once') {
  const existing = await firestore.get(prefix + 'formSubmissions/' + id, { resolveOnHTTPError: true })
  if (existing.status === 200) throw new Error('The stable approved test already exists: inspect it; never replay or create another')
  if (existing.status !== 404) throw new Error('Test existence could not be verified')
  const { body: owner } = await firestore.get(prefix + 'users/' + profile.uid)
  if (owner.fields?.email?.stringValue !== email || owner.fields?.active?.booleanValue !== true) throw new Error('Owner identity changed')
  const definition = validateFormDefinition({ title: 'Phase 2 synthetic release test 8c0e16c', description: 'Approved synthetic test only. No employee, job or SDS information.', recipients: [email], access: { respondents: 'signed-in', identity: 'identified', respondentUserIds: [profile.uid], respondentRoles: [], entryUserIds: [profile.uid], entryRoles: [] }, output: { requireLogin: true, pdf: true, template: '' }, fields: [{ id: 'sites', kind: 'repeat', label: 'Synthetic site stops', required: true, options: [], minInstances: 1, maxInstances: 3, fields: [{ id: 'site-name', kind: 'text', label: 'Synthetic site name', required: true, options: [] }, { id: 'note', kind: 'textarea', label: 'Synthetic observation', required: true, options: [] }, { id: 'photos', kind: 'photo', label: 'Synthetic colored photo', required: false, options: [] }] }] })
  const photos = [{ id: 'release-photo-one-8c0e16c', instanceId: 'stop-one', color: '#236a95' }, { id: 'release-photo-two-8c0e16c', instanceId: 'stop-two', color: '#e99a32' }]
  const answers = validateFormAnswers(definition, { sites: photos.map((photo, index) => ({ instanceId: photo.instanceId, answers: { 'site-name': 'Synthetic stop ' + (index + 1), note: 'Harmless synthetic validation content. No real workplace observation.', photos: [photo.id] } })) }, true)
  const now = Date.now(), record = { id, ownerUid: profile.uid, validationOwnerUid: profile.uid, templateId: 'release-test-template-oct13', templateVersion: 1, definition: { ...definition, version: 1, createdAt: new Date(now).toISOString() }, answers, revision: 1, status: 'submitted', createdAt: now, updatedAt: now, submittedAt: now }
  if (!entryReaderAllowed(record, profile, definition.access) || entryReaderAllowed(record, { uid: 'other-admin', role: 'admin', active: true }, definition.access)) throw new Error('Test gallery is not isolated to the exact approved owner')
  const writes = [{ collection: 'formSubmissions', id, value: record }], uploadSummary = []
  for (const photo of photos) {
    const object = `form-photos/${id}/${photo.id}.webp`
    const bytes = await sharp({ create: { width: 640, height: 320, channels: 3, background: photo.color } }).webp().toBuffer()
    await storage.post(`b/${bucket}/o`, bytes, { queryParams: { uploadType: 'media', name: object, ifGenerationMatch: '0' }, headers: { 'Content-Type': 'image/webp' }, retries: 0 })
    writes.push({ collection: 'formAssets', id: photo.id, value: { id: photo.id, recordId: id, ownerUid: profile.uid, fieldId: 'photos', groupId: 'sites', instanceId: photo.instanceId, path: object, createdAt: now } })
    uploadSummary.push({ assetId: photo.id, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
  }
  writes.push({ collection: 'formDeliveries', id, value: { id, status: 'queued', recipients: [email], attempts: 0, createdAt: now } })
  for (const write of writes) if (!['formSubmissions', 'formAssets', 'formDeliveries'].includes(write.collection) || !write.id.startsWith('release-')) throw new Error('Unexpected fixture destination')
  await firestore.post(`projects/${project}/databases/(default)/documents:commit`, { writes: writes.map(write => ({ update: { name: prefix + write.collection + '/' + write.id, fields: Object.fromEntries(Object.entries(write.value).map(([k, v]) => [k, encode(v)])) }, currentDocument: { exists: false } })) }, { retries: 0 })
  const summary = { createdAt: new Date(now).toISOString(), id, subject: definition.title, recipients: [email], ownerUid: profile.uid, ownerOnly: true, siteStops: 2, syntheticPhotos: uploadSummary, pdfRequested: true, templatesPublished: 0, coreRecordsWritten: 0, oldQueuesReplayed: false }
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2)); console.log(JSON.stringify(summary))
} else throw new Error('Use --inspect or the single approved --create-once')
