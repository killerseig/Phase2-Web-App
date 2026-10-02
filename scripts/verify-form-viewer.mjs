import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { createRequire } from 'node:module'
assert.match(process.env.GCLOUD_PROJECT || '', /^demo-[a-z0-9-]+$/, 'Only demo emulator projects are allowed')
for (const name of [
  'FIRESTORE_EMULATOR_HOST',
  'FIREBASE_AUTH_EMULATOR_HOST',
  'FIREBASE_STORAGE_EMULATOR_HOST',
])
  assert.match(process.env[name] || '', /^127\.0\.0\.1:\d+$/)
const require = createRequire(new URL('../functions/package.json', import.meta.url))
require('firebase-admin/app').initializeApp({
  projectId: process.env.GCLOUD_PROJECT,
  storageBucket: process.env.GCLOUD_PROJECT + '.appspot.com',
})
const db = require('firebase-admin/firestore').getFirestore(),
  { formTemplates, formWorkspace } = require('../functions/formFunctions.js'),
  { formSubmissionViewer } = require('../functions/formSubmissionViewer.js'),
  { prepareFormEmail } = require('../functions/formEmailContent.js')
const id = randomUUID(),
  owner = 'viewer-owner-' + id,
  admin = 'viewer-admin-' + id,
  other = 'viewer-other-' + id
for (const [uid, role] of [
  [owner, 'foreman'],
  [admin, 'admin'],
  [other, 'foreman'],
])
  await db.doc('users/' + uid).set({ active: true, role, email: uid + '@example.com' })
const templates = (data) => formTemplates.run({ auth: { uid: admin }, data }),
  workspace = (data) => formWorkspace.run({ auth: { uid: owner }, data }),
  viewer = (data, uid) => formSubmissionViewer.run({ auth: uid ? { uid } : undefined, data })
let definition = {
  title: 'Scoped viewer check',
  description: 'Synthetic only',
  recipients: ['recipient@example.com'],
  fields: [
    { id: 'notes', kind: 'textarea', label: 'Completed notes', required: true, options: [] },
    { id: 'photo', kind: 'photo', label: 'Site photos', required: false, options: [] },
  ],
}
let saved = await templates({ action: 'save', id, revision: 0, definition })
let issued = await templates({ action: 'issue', id, revision: saved.revision })
async function submit(version) {
  let r = await workspace({ action: 'create', templateId: id, version, requestId: randomUUID() })
  r = await workspace({
    action: 'save',
    id: r.id,
    revision: r.revision,
    requestId: randomUUID(),
    answers: { notes: 'Full immutable answers' },
  })
  r = await workspace({
    action: 'upload',
    id: r.id,
    revision: r.revision,
    fieldId: 'photo',
    contentType: 'image/png',
    base64:
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  })
  return workspace({ action: 'submit', id: r.id, revision: r.revision, requestId: randomUUID() })
}
const privateRecord = await submit(1)
let denied = 0
async function rejection(data, uid) {
  await assert.rejects(
    () => viewer(data, uid),
    (e) => e.code === 'permission-denied',
  )
  denied++
}
await rejection({ action: 'get', id: privateRecord.id })
await rejection({ action: 'get', id: privateRecord.id }, other)
await rejection({ action: 'issue-link', id: privateRecord.id }, owner)
assert.equal((await viewer({ action: 'get', id: privateRecord.id }, owner)).requireLogin, true)
assert.equal((await viewer({ action: 'get', id: privateRecord.id }, admin)).canManage, true)
definition = { ...definition, output: { requireLogin: false, pdf: false, template: '' } }
saved = await templates({ action: 'save', id, revision: issued.revision, definition })
issued = await templates({ action: 'issue', id, revision: saved.revision })
const publicRecord = await submit(2),
  frozen = (await db.doc('formSubmissions/' + publicRecord.id).get()).data()
const link = await viewer({ action: 'issue-link', id: publicRecord.id }, admin),
  token = new URLSearchParams(new URL(link.url).hash.slice(1)).get('token')
assert.match(token, /^[A-Za-z0-9_-]{43}$/)
assert.ok(link.expiresAt > Date.now() + 29 * 86400000)
const share = (
  await db.doc('formViewerShares/' + createHash('sha256').update(token).digest('hex')).get()
).data()
assert.ok(!JSON.stringify(share).includes(token))
const visible = await viewer({ action: 'get', id: publicRecord.id, token })
assert.equal(visible.answers.notes, 'Full immutable answers')
assert.equal(visible.canManage, false)
assert.deepEqual(visible.definition.recipients, [])
assert.equal((await viewer({ action: 'get', id: publicRecord.id, token }, other)).canManage, false)
const photo = await viewer({
  action: 'photo',
  id: publicRecord.id,
  token,
  assetId: publicRecord.answers.photo[0],
})
assert.equal(photo.contentType, 'image/webp')
assert.ok(photo.base64)
await rejection({ action: 'get', id: privateRecord.id, token })
await rejection({ action: 'get', id: randomUUID(), token })
await rejection({ action: 'list', token })
await rejection({ action: 'save', id: publicRecord.id, token })
await rejection({
  action: 'photo',
  id: publicRecord.id,
  token,
  assetId: privateRecord.answers.photo[0],
})
await rejection({ action: 'revoke-links', id: publicRecord.id, token })
await rejection({ action: 'issue-link', id: publicRecord.id, token }, other)
await rejection({ action: 'get', id: publicRecord.id, token: 'x'.repeat(43) })
// A later private template setting neither widens old private records nor changes this issued public version.
definition = {
  ...definition,
  output: { requireLogin: true, pdf: true, template: 'Notes: {{notes}}\nPhotos: {{photo}}' },
}
saved = await templates({ action: 'save', id, revision: issued.revision, definition })
issued = await templates({ action: 'issue', id, revision: saved.revision })
assert.equal((await viewer({ action: 'get', id: publicRecord.id, token })).requireLogin, false)
await rejection({ action: 'get', id: privateRecord.id, token })
const duplicated = await templates({
  action: 'duplicate',
  id,
  targetId: randomUUID(),
  revision: saved.revision + 1,
})
const freshNotes = duplicated.draft.fields.find((field) => field.label === 'Completed notes').id
assert.notEqual(freshNotes, 'notes')
assert.ok(duplicated.draft.output.template.includes('{{' + freshNotes + '}}'))
assert.ok(!duplicated.draft.output.template.includes('{{notes}}'))
const pdf = await viewer(
  { action: 'preview-pdf', definition, answers: { notes: 'PDF full answer', photo: [] } },
  admin,
)
assert.ok(Buffer.from(pdf.base64, 'base64').subarray(0, 5).equals(Buffer.from('%PDF-')))
await rejection({ action: 'preview-pdf', definition, answers: { notes: 'Denied', photo: [] } })
await rejection(
  { action: 'preview-pdf', definition, answers: { notes: 'Denied', photo: [] } },
  other,
)
const email = await prepareFormEmail(frozen, ['recipient@example.com'])
assert.ok(email.html.includes('Anyone with this link'))
const match = email.html.match(/href="([^\"]*#token=[^\"]*)"/)
assert.ok(match)
const params = new URLSearchParams(new URL(match[1].replaceAll('&amp;', '&')).hash.slice(1)),
  emailToken = params.get('token')
assert.equal(params.get('field'), 'photo')
assert.equal(
  (await viewer({ action: 'get', id: publicRecord.id, token: emailToken })).id,
  publicRecord.id,
)
await viewer({ action: 'revoke-links', id: publicRecord.id }, owner)
await rejection({ action: 'get', id: publicRecord.id, token })
await rejection({ action: 'get', id: publicRecord.id, token: emailToken })
assert.equal((await viewer({ action: 'get', id: publicRecord.id }, owner)).id, publicRecord.id)
const renewed = await viewer({ action: 'issue-link', id: publicRecord.id }, owner),
  nextToken = new URLSearchParams(new URL(renewed.url).hash.slice(1)).get('token')
assert.equal(
  (await viewer({ action: 'get', id: publicRecord.id, token: nextToken })).id,
  publicRecord.id,
)
await db
  .doc('formViewerShares/' + createHash('sha256').update(nextToken).digest('hex'))
  .update({ expiresAt: 0 })
await rejection({ action: 'get', id: publicRecord.id, token: nextToken })
assert.deepEqual((await db.doc('formSubmissions/' + publicRecord.id).get()).data(), frozen)
if (process.env.FORMS_VIEWER_FIXTURE) {
  const fixtureLink = await viewer({ action: 'issue-link', id: publicRecord.id }, owner)
  require('node:fs').writeFileSync(
    process.env.FORMS_VIEWER_FIXTURE,
    JSON.stringify({ privateId: privateRecord.id, publicUrl: fixtureLink.url }),
  )
}
console.log(
  JSON.stringify({
    passed: true,
    rejectionChecks: denied,
    privateDefault: true,
    publicSingleEntryOnly: true,
    hashed256BitTokens: true,
    thirtyDayExpiry: true,
    revocation: true,
    noEnumeration: true,
    historicalSettingScope: true,
    publicEmailTokenPreserved: true,
    productionWrites: false,
    realEmails: 0,
  }),
)
