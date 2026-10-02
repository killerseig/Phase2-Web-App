import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
for (const name of [
  'FIRESTORE_EMULATOR_HOST',
  'FIREBASE_AUTH_EMULATOR_HOST',
  'FIREBASE_STORAGE_EMULATOR_HOST',
])
  assert.match(process.env[name] || '', /^(127\.0\.0\.1|localhost):\d+$/)
const projectId = 'demo-phase2-security'
process.env.GCLOUD_PROJECT = projectId
const require = createRequire(new URL('../functions/package.json', import.meta.url))
require('firebase-admin/app').initializeApp({
  projectId,
  storageBucket: projectId + '.appspot.com',
})
const db = require('firebase-admin/firestore').getFirestore(),
  { formTemplates, formWorkspace } = require('../functions/formFunctions.js')
const run = randomUUID(),
  admin = 'authoring-admin-' + run,
  foreman = 'authoring-foreman-' + run,
  sourceId = 'authoring-source-' + run
const template = (uid, data) => formTemplates.run({ auth: uid ? { uid } : undefined, data }),
  workspace = (data) => formWorkspace.run({ auth: { uid: foreman }, data })
let rejections = 0
async function reject(action, code) {
  await assert.rejects(action, (error) => error.code === code)
  rejections++
}
const definition = JSON.parse(
  readFileSync(new URL('../functions/src/committeeAudit.json', import.meta.url), 'utf8'),
)
definition.recipients = ['authoring@example.com']
await db.doc('users/' + admin).set({ role: 'admin', active: true })
await db.doc('users/' + foreman).set({ role: 'foreman', active: true })
await template(admin, { action: 'save', id: sourceId, revision: 0, definition })
await template(admin, { action: 'issue', id: sourceId, revision: 1 })
const sourceBefore = (await db.doc('formTemplates/' + sourceId).get()).data(),
  versionBefore = (await db.doc('formTemplates/' + sourceId + '/versions/v1').get()).data()
const record = await workspace({
  action: 'create',
  templateId: sourceId,
  version: 1,
  requestId: randomUUID(),
})
const targetId = randomUUID(),
  request = { action: 'duplicate', id: sourceId, revision: 2, targetId }
await reject(() => template(undefined, request), 'unauthenticated')
await reject(() => template(foreman, request), 'permission-denied')
await reject(() => template(admin, { ...request, targetId: sourceId }), 'invalid-argument')
await reject(() => template(admin, { ...request, revision: 0 }), 'aborted')
const copy = await template(admin, request)
assert.equal(copy.id, targetId)
assert.equal(copy.latestVersion, 0)
assert.equal(copy.used, false)
assert.equal(copy.draft.fields.length, 41)
assert.equal(copy.draft.title, definition.title + ' (copy)')
assert.deepEqual(copy.draft.recipients, ['authoring@example.com'])
assert.ok(
  copy.draft.fields.every(
    (field) => !definition.fields.some((original) => original.id === field.id),
  ),
)
for (const [index, field] of copy.draft.fields.entries()) {
  const original = definition.fields[index]
  if (original.requiredWhen) {
    const referenced = definition.fields.findIndex(
      (item) => item.id === original.requiredWhen.fieldId,
    )
    assert.equal(field.requiredWhen.fieldId, copy.draft.fields[referenced].id)
    assert.deepEqual(field.requiredWhen.values, original.requiredWhen.values)
  }
  assert.equal(field.minimum, original.minimum)
  assert.equal(field.integer, original.integer)
}
assert.equal((await template(admin, request)).id, targetId)
assert.equal(
  (
    await db
      .doc('formTemplates/' + targetId)
      .collection('versions')
      .get()
  ).size,
  0,
)
assert.deepEqual(
  (await db.doc('formTemplates/' + sourceId + '/versions/v1').get()).data(),
  versionBefore,
)
const sourceAfter = (await db.doc('formTemplates/' + sourceId).get()).data()
assert.deepEqual(sourceAfter.draft, sourceBefore.draft)
assert.deepEqual((await workspace({ action: 'get', id: record.id })).definition, record.definition)
await reject(
  () => template(foreman, { action: 'remove', id: targetId, revision: 1 }),
  'permission-denied',
)
await template(admin, { action: 'issue', id: targetId, revision: 1 })
await template(admin, { action: 'remove', id: targetId, revision: 2 })
assert.equal((await db.doc('formTemplates/' + targetId).get()).data().archived, true)
await reject(
  () => template(admin, { action: 'duplicate', id: targetId, revision: 3, targetId: randomUUID() }),
  'failed-precondition',
)
assert.deepEqual((await workspace({ action: 'get', id: record.id })).answers, record.answers)
console.log(
  JSON.stringify({
    passed: true,
    rejectionChecks: rejections,
    freshTemplateAndFieldIds: true,
    copyRetriesSingleIdentity: true,
    conditionalRemap: true,
    legacySchemaPreserved: true,
    sourceVersionsAndDraftPreserved: true,
    archiveAuthorization: true,
    productionWrites: false,
    realEmails: 0,
  }),
)
