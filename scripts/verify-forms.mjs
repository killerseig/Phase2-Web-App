import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth'
import { getStorage, connectStorageEmulator, ref, getBytes } from 'firebase/storage'
const projectId = 'demo-phase2-security'
for (const key of [
  'FIRESTORE_EMULATOR_HOST',
  'FIREBASE_AUTH_EMULATOR_HOST',
  'FIREBASE_STORAGE_EMULATOR_HOST',
])
  assert.match(process.env[key] || '', /^(127\.0\.0\.1|localhost):\d+$/)
process.env.GCLOUD_PROJECT = projectId
const require = createRequire(new URL('../functions/package.json', import.meta.url)),
  { initializeApp: adminApp } = require('firebase-admin/app'),
  { getFirestore } = require('firebase-admin/firestore')
adminApp({ projectId, storageBucket: projectId + '.appspot.com' })
const db = getFirestore(),
  { formTemplates, formWorkspace } = require('../functions/formFunctions.js'),
  { deliverFormSubmission, formEmail } = require('../functions/formDelivery.js')
const template = (uid, action, data = {}) =>
    formTemplates.run({ auth: uid ? { uid } : undefined, data: { action, ...data } }),
  record = (uid, action, data = {}) =>
    formWorkspace.run({ auth: uid ? { uid } : undefined, data: { action, ...data } })
let negatives = 0
async function reject(call, code) {
  await assert.rejects(call, (error) => error.code === code)
  negatives++
}
const source = JSON.parse(
  readFileSync(new URL('../functions/src/committeeAudit.json', import.meta.url), 'utf8'),
)
assert.equal(source.fields.length, 41)
assert.equal(source.recipients[0], 'dan2@phase2co.com')
const app = initializeApp({
    projectId,
    apiKey: 'local-only',
    storageBucket: projectId + '.appspot.com',
  }),
  auth = getAuth(app)
connectAuthEmulator(auth, 'http://' + process.env.FIREBASE_AUTH_EMULATOR_HOST, {
  disableWarnings: true,
})
const signed = (await signInAnonymously(auth)).user,
  storage = getStorage(app)
connectStorageEmulator(storage, '127.0.0.1', 9199)
try {
  for (const [uid, role, active] of [
    ['admin', 'admin', true],
    [signed.uid, 'foreman', true],
    ['other', 'foreman', true],
    ['inactive', 'admin', false],
    ['payroll', 'payroll', true],
  ])
    await db.doc('users/' + uid).set({ role, active })
  await reject(() => template(undefined, 'list'), 'unauthenticated')
  await reject(() => template('inactive', 'list'), 'permission-denied')
  await reject(() => template('payroll', 'list'), 'permission-denied')
  await reject(
    () => template(signed.uid, 'save', { id: 'audit', revision: 0, definition: source }),
    'permission-denied',
  )
  await reject(
    () => template(signed.uid, 'issue', { id: 'audit', revision: 0 }),
    'permission-denied',
  )
  await reject(
    () => template(signed.uid, 'remove', { id: 'audit', revision: 0 }),
    'permission-denied',
  )
  const saved = await template('admin', 'save', { id: 'audit', revision: 0, definition: source })
  assert.equal(saved.revision, 1)
  await template('admin', 'issue', { id: 'audit', revision: 1 })
  assert.equal((await record(signed.uid, 'list')).records.length, 0)
  const createId = randomUUID(),
    draft = await record(signed.uid, 'create', {
      templateId: 'audit',
      version: 1,
      requestId: createId,
    })
  assert.deepEqual(draft.definition.recipients, [])
  assert.equal(
    (await record(signed.uid, 'create', { templateId: 'audit', version: 1, requestId: createId }))
      .id,
    draft.id,
  )
  assert.equal((await record(signed.uid, 'list')).records.length, 1)
  await reject(() => record('other', 'get', { id: draft.id }), 'permission-denied')
  await reject(
    () =>
      record('other', 'save', { id: draft.id, revision: 1, requestId: randomUUID(), answers: {} }),
    'permission-denied',
  )
  const answers = {}
  for (const field of source.fields)
    answers[field.id] =
      field.kind === 'photo'
        ? []
        : field.kind === 'choice'
          ? field.options[0]
          : field.kind === 'number'
            ? 0
            : field.kind === 'date'
              ? '2026-10-01'
              : field.required
                ? 'Synthetic audit value'
                : ''
  const saveId = randomUUID()
  let current = await record(signed.uid, 'save', {
    id: draft.id,
    revision: draft.revision,
    requestId: saveId,
    answers,
  })
  assert.equal(
    (await record(signed.uid, 'save', { id: current.id, revision: 1, requestId: saveId, answers }))
      .revision,
    current.revision,
  )
  await reject(
    () =>
      record(signed.uid, 'save', { id: current.id, revision: 1, requestId: randomUUID(), answers }),
    'aborted',
  )
  for (const [key, value] of [
    ['personnel', -1],
    ['personnel', 1.5],
    ['date', '2026-02-30'],
    ['rating_ppe', 'Not a choice'],
    ['jobName', {}],
  ])
    await reject(
      () =>
        record(signed.uid, 'save', {
          id: current.id,
          revision: current.revision,
          requestId: randomUUID(),
          answers: { ...answers, [key]: value },
        }),
      'invalid-argument',
    )
  current = await record(signed.uid, 'save', {
    id: current.id,
    revision: current.revision,
    requestId: randomUUID(),
    answers: { ...answers, rating_impression: 'Unsatisfactory' },
  })
  await reject(
    () =>
      record(signed.uid, 'submit', {
        id: current.id,
        revision: current.revision,
        requestId: randomUUID(),
      }),
    'invalid-argument',
  )
  current = await record(signed.uid, 'save', {
    id: current.id,
    revision: current.revision,
    requestId: randomUUID(),
    answers: { ...current.answers, notes_impression: 'Synthetic required follow-up.' },
  })
  const sharp = require('sharp'),
    bytes = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#336699' } })
      .png()
      .toBuffer()
  await reject(
    () =>
      record('other', 'upload', {
        id: current.id,
        revision: current.revision,
        fieldId: 'photo_impression',
        contentType: 'image/png',
        base64: bytes.toString('base64'),
      }),
    'permission-denied',
  )
  await reject(
    () =>
      record(signed.uid, 'upload', {
        id: current.id,
        revision: current.revision,
        fieldId: 'jobName',
        contentType: 'image/png',
        base64: bytes.toString('base64'),
      }),
    'failed-precondition',
  )
  await reject(
    () =>
      record(signed.uid, 'upload', {
        id: current.id,
        revision: current.revision,
        fieldId: 'photo_impression',
        contentType: 'image/png',
        base64: Buffer.from('not an image').toString('base64'),
      }),
    'invalid-argument',
  )
  current = await record(signed.uid, 'upload', {
    id: current.id,
    revision: current.revision,
    fieldId: 'photo_impression',
    contentType: 'image/png',
    base64: bytes.toString('base64'),
  })
  const photo = current.answers.photo_impression[0],
    asset = (await db.doc('formAssets/' + photo).get()).data()
  assert.equal(
    (await record(signed.uid, 'photo', { id: current.id, assetId: photo })).contentType,
    'image/webp',
  )
  await reject(
    () => record('other', 'photo', { id: current.id, assetId: photo }),
    'permission-denied',
  )
  await assert.rejects(() => getBytes(ref(storage, asset.path)))
  negatives++
  const unrelated = await record('other', 'create', {
    templateId: 'audit',
    version: 1,
    requestId: randomUUID(),
  })
  await reject(
    () =>
      record('other', 'save', {
        id: unrelated.id,
        revision: unrelated.revision,
        requestId: randomUUID(),
        answers: { ...answers, photo_impression: [photo] },
      }),
    'permission-denied',
  )
  await template('admin', 'save', {
    id: 'audit',
    revision: 2,
    definition: { ...source, title: 'Later committee audit' },
  })
  await template('admin', 'issue', { id: 'audit', revision: 3 })
  const submitId = randomUUID()
  const submitted = await record(signed.uid, 'submit', {
    id: current.id,
    revision: current.revision,
    requestId: submitId,
  })
  assert.equal(submitted.templateVersion, 1)
  assert.equal(submitted.definition.title, 'Committee Site Audit')
  assert.equal(submitted.status, 'submitted')
  assert.equal(
    (
      await record(signed.uid, 'submit', {
        id: current.id,
        revision: current.revision,
        requestId: submitId,
      })
    ).id,
    submitted.id,
  )
  await reject(
    () =>
      record(signed.uid, 'submit', {
        id: submitted.id,
        revision: submitted.revision,
        requestId: randomUUID(),
      }),
    'already-exists',
  )
  await reject(
    () =>
      record(signed.uid, 'save', {
        id: submitted.id,
        revision: submitted.revision,
        requestId: randomUUID(),
        answers,
      }),
    'failed-precondition',
  )
  await reject(
    () =>
      record(signed.uid, 'upload', {
        id: submitted.id,
        revision: submitted.revision,
        fieldId: 'photo_impression',
        contentType: 'image/png',
        base64: bytes.toString('base64'),
      }),
    'failed-precondition',
  )
  const frozen = (await db.doc('formSubmissions/' + submitted.id).get()).data()
  let sends = 0
  await deliverFormSubmission(submitted.id, false, {
    enabled: () => true,
    send: async () => {
      sends++
      throw Object.assign(new Error('Synthetic provider rejection'), { httpStatus: 429 })
    },
  })
  assert.equal((await db.doc('formDeliveries/' + submitted.id).get()).data().status, 'failed')
  assert.deepEqual((await db.doc('formSubmissions/' + submitted.id).get()).data(), frozen)
  await Promise.all([
    deliverFormSubmission(submitted.id, true, {
      enabled: () => true,
      send: async () => {
        sends++
      },
    }),
    deliverFormSubmission(submitted.id, true, {
      enabled: () => true,
      send: async () => {
        sends++
      },
    }),
  ])
  assert.equal(sends, 2)
  assert.equal((await db.doc('formDeliveries/' + submitted.id).get()).data().status, 'sent')
  await deliverFormSubmission(submitted.id, true, {
    enabled: () => true,
    send: async () => {
      sends++
    },
  })
  assert.equal(sends, 2)
  await reject(
    () => formEmail.run({ auth: { uid: 'other' }, data: { action: 'retry', id: submitted.id } }),
    'permission-denied',
  )
  await template('admin', 'remove', { id: 'audit', revision: 4 })
  assert.equal((await record(signed.uid, 'get', { id: submitted.id })).templateVersion, 1)
  await reject(
    () =>
      record(signed.uid, 'create', { templateId: 'audit', version: 2, requestId: randomUUID() }),
    'failed-precondition',
  )
  assert.equal((await db.collection('formSubmissions').get()).size, 1)
  assert.deepEqual((await db.doc('formSubmissions/' + submitted.id).get()).data(), frozen)
  const basics = {
    title: 'Basics',
    description: '',
    recipients: [],
    fields: ['email', 'phone', 'time'].map((kind) => ({
      id: kind,
      kind,
      label: kind,
      required: true,
      options: [],
    })),
  }
  await template('admin', 'save', { id: 'basics', revision: 0, definition: basics })
  await template('admin', 'issue', { id: 'basics', revision: 1 })
  let basicRecord = await record(signed.uid, 'create', {
    templateId: 'basics',
    version: 1,
    requestId: randomUUID(),
  })
  const valid = { email: 'employee@example.com', phone: '+1 (555) 010-0200', time: '14:30' }
  for (const [field, value] of [
    ['email', 'bad'],
    ['phone', 'call-me'],
    ['time', '25:00'],
  ])
    await reject(
      () =>
        record(signed.uid, 'save', {
          id: basicRecord.id,
          revision: basicRecord.revision,
          requestId: randomUUID(),
          answers: { ...valid, [field]: value },
        }),
      'invalid-argument',
    )
  basicRecord = await record(signed.uid, 'save', {
    id: basicRecord.id,
    revision: basicRecord.revision,
    requestId: randomUUID(),
    answers: valid,
  })
  assert.deepEqual((await record(signed.uid, 'get', { id: basicRecord.id })).answers, valid)
  assert.equal(
    (
      await record(signed.uid, 'submit', {
        id: basicRecord.id,
        revision: basicRecord.revision,
        requestId: randomUUID(),
      })
    ).status,
    'submitted',
  )
  console.log(
    JSON.stringify({
      passed: true,
      sourceFields: 41,
      rejectionChecks: negatives,
      draftResume: true,
      stableCreateSaveSubmit: true,
      privatePhotoPermissions: true,
      immutableTemplateVersion: true,
      submissionSurvivesEmailFailure: true,
      concurrentRetrySingleSend: true,
      archivePreservesRecords: true,
      productionWrites: false,
      realEmailsSent: 0,
    }),
  )
} finally {
  await deleteApp(app)
}
