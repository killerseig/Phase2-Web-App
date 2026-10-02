import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { initializeApp, deleteApp } from 'firebase/app'
import { getStorage, connectStorageEmulator, ref as photoRef, getBytes } from 'firebase/storage'
import {
  getFirestore as clientFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  terminate,
} from 'firebase/firestore'
assert.match(
  process.env.GCLOUD_PROJECT || '',
  /^demo-[a-z0-9-]+$/,
  'Only demo emulator projects are allowed',
)
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
const photoId = privateRecord.answers.photo[0]
// Direct client access stays denied independently of callable route guards.
const anonymousApp = initializeApp({
    projectId: process.env.GCLOUD_PROJECT,
    apiKey: 'local-only',
    storageBucket: process.env.GCLOUD_PROJECT + '.appspot.com',
  }),
  anonymousStorage = getStorage(anonymousApp),
  anonymousDb = clientFirestore(anonymousApp)
const [storageHost, storagePort] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':'),
  [firestoreHost, firestorePort] = process.env.FIRESTORE_EMULATOR_HOST.split(':')
connectStorageEmulator(anonymousStorage, storageHost, Number(storagePort))
connectFirestoreEmulator(anonymousDb, firestoreHost, Number(firestorePort))
await assert.rejects(
  () =>
    getBytes(
      photoRef(anonymousStorage, 'form-photos/' + privateRecord.id + '/' + photoId + '.webp'),
    ),
  (e) => e.code === 'storage/unauthorized',
)
await assert.rejects(
  () => getDoc(doc(anonymousDb, 'formSubmissions/' + privateRecord.id)),
  (e) => e.code === 'permission-denied',
)
denied += 2
await terminate(anonymousDb)
await deleteApp(anonymousApp)
for (const uid of [undefined, other]) {
  await rejection({ action: 'get', id: privateRecord.id }, uid)
  await rejection({ action: 'photo', id: privateRecord.id, assetId: photoId }, uid)
}
for (const uid of [owner, admin]) {
  const record = await viewer({ action: 'get', id: privateRecord.id }, uid)
  assert.equal(record.requireLogin, true)
  assert.deepEqual(record.definition.recipients, [])
  const photo = await viewer({ action: 'photo', id: privateRecord.id, assetId: photoId }, uid)
  assert.equal(photo.contentType, 'image/webp')
  assert.ok(photo.base64)
}
// An imported older draft cannot issue a new public version.
definition = {
  ...definition,
  output: { requireLogin: false, pdf: true, template: 'Notes: {{notes}}\nPhotos: {{photo}}' },
}
saved = await templates({ action: 'save', id, revision: issued.revision, definition })
assert.equal(saved.draft.output.requireLogin, true)
issued = await templates({ action: 'issue', id, revision: saved.revision })
assert.equal(
  (await db.doc('formTemplates/' + id + '/versions/v2').get()).data().output.requireLogin,
  true,
)
const legacyRecord = await submit(2),
  token = 'x'.repeat(43)
// Simulate an immutable previously issued public snapshot and an unexpired link.
const ref = db.doc('formSubmissions/' + legacyRecord.id)
const stored = (await ref.get()).data()
stored.definition.output.requireLogin = false
await ref.set(stored)
const frozen = (await ref.get()).data()
await db.doc('formViewerShares/' + createHash('sha256').update(token).digest('hex')).set({
  submissionId: legacyRecord.id,
  generation: 0,
  expiresAt: Date.now() + 86400000,
})
for (const uid of [undefined, other]) {
  await rejection({ action: 'get', id: legacyRecord.id, token }, uid)
  await rejection(
    { action: 'photo', id: legacyRecord.id, token, assetId: legacyRecord.answers.photo[0] },
    uid,
  )
}
await rejection({ action: 'get', id: randomUUID(), token }, owner)
await rejection({ action: 'list', token }, admin)
await rejection({ action: 'save', id: legacyRecord.id }, owner)
for (const uid of [undefined, other, owner, admin]) {
  await rejection({ action: 'issue-link', id: legacyRecord.id, token }, uid)
  await rejection({ action: 'revoke-links', id: legacyRecord.id, token }, uid)
}
await rejection({ action: 'photo', id: legacyRecord.id, assetId: photoId }, owner)
await db.doc('users/' + owner).update({ active: false })
await rejection({ action: 'get', id: legacyRecord.id }, owner)
await rejection(
  { action: 'photo', id: legacyRecord.id, assetId: legacyRecord.answers.photo[0] },
  owner,
)
await db.doc('users/' + owner).update({ active: true })
const visible = await viewer({ action: 'get', id: legacyRecord.id, token }, owner)
assert.equal(visible.requireLogin, true)
assert.equal(visible.definition.output, undefined)
assert.equal(visible.answers.notes, 'Full immutable answers')
const pdf = await viewer(
  { action: 'preview-pdf', definition, answers: { notes: 'Full answer', photo: [] } },
  admin,
)
assert.ok(Buffer.from(pdf.base64, 'base64').subarray(0, 5).equals(Buffer.from('%PDF-')))
for (const uid of [undefined, owner, other])
  await rejection(
    { action: 'preview-pdf', definition, answers: { notes: 'Denied', photo: [] } },
    uid,
  )
const email = await prepareFormEmail(frozen, ['recipient@example.com'])
assert.ok(email.html.includes('Sign in as the record owner or Admin'))
assert.ok(!email.html.includes('#token='))
assert.ok(!email.html.includes('Anyone with this link'))
assert.ok(!email.text.includes('#token='))
assert.equal((await db.collection('formViewerShares').count().get()).data().count, 1)
assert.deepEqual((await ref.get()).data(), frozen)
console.log(
  JSON.stringify({
    passed: true,
    rejectionChecks: denied,
    loginAlwaysRequired: true,
    anonymousAnswersAndPhotosDenied: true,
    nonOwnerDenied: true,
    ownerAndAdminAnswersAndPhotos: true,
    legacyTokensIgnored: true,
    shareIssuanceDisabled: true,
    adminOnlyPdfPreview: true,
    importedDraftsRestricted: true,
    historicalSubmissionUnchanged: true,
    emailLoginLinksOnly: true,
    productionWrites: false,
    realEmails: 0,
  }),
)
