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
  { deliverFormSubmission, formEmail, buildFormEmailHtml } = require('../functions/formDelivery.js')
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
  const choices = {
    title: 'Common choice controls',
    description: '',
    recipients: [],
    fields: [
      { id: 'ack', kind: 'checkbox', label: 'Acknowledgement', required: true, options: [] },
      {
        id: 'optional',
        kind: 'checkbox',
        label: 'Optional follow-up',
        required: false,
        options: [],
      },
      {
        id: 'schedule',
        kind: 'radio',
        label: 'Schedule',
        required: true,
        options: ['Daily', 'Weekly'],
      },
      {
        id: 'areas',
        kind: 'multiselect',
        label: 'Work areas',
        required: true,
        options: [
          'North',
          'South',
          '<West&Co>',
          ...Array.from({ length: 21 }, (_, i) => 'Area ' + i),
        ],
      },
      {
        id: 'extras',
        kind: 'multiselect',
        label: 'Optional areas',
        required: false,
        options: ['Office', 'Shop'],
      },
      { id: 'photo', kind: 'photo', label: 'Choice photos', required: false, options: [] },
    ],
  }
  await reject(
    () => template(signed.uid, 'save', { id: 'choices', revision: 0, definition: choices }),
    'permission-denied',
  )
  await template('admin', 'save', { id: 'choices', revision: 0, definition: choices })
  await template('admin', 'issue', { id: 'choices', revision: 1 })
  let choiceRecord = await record(signed.uid, 'create', {
    templateId: 'choices',
    version: 1,
    requestId: randomUUID(),
  })
  assert.deepEqual(choiceRecord.answers, {
    ack: false,
    optional: false,
    schedule: '',
    areas: [],
    extras: [],
    photo: [],
  })
  for (const [field, value] of [
    ['ack', 'true'],
    ['ack', 0],
    ['optional', null],
    ['schedule', ['Daily']],
    ['schedule', 'Monthly'],
    ['areas', 'North'],
    ['areas', ['North', 'North']],
    ['areas', ['Unknown']],
    ['areas', [false]],
  ])
    await reject(
      () =>
        record(signed.uid, 'save', {
          id: choiceRecord.id,
          revision: choiceRecord.revision,
          requestId: randomUUID(),
          answers: { ...choiceRecord.answers, [field]: value },
        }),
      'invalid-argument',
    )
  for (const answers of [{}, { ack: true }, { ack: true, schedule: 'Daily' }]) {
    choiceRecord = await record(signed.uid, 'save', {
      id: choiceRecord.id,
      revision: choiceRecord.revision,
      requestId: randomUUID(),
      answers,
    })
    await reject(
      () =>
        record(signed.uid, 'submit', {
          id: choiceRecord.id,
          revision: choiceRecord.revision,
          requestId: randomUUID(),
        }),
      'invalid-argument',
    )
  }
  choiceRecord = await record(signed.uid, 'save', {
    id: choiceRecord.id,
    revision: choiceRecord.revision,
    requestId: randomUUID(),
    answers: {
      ack: true,
      optional: false,
      schedule: 'Daily',
      areas: choices.fields[3].options.slice(0, 21),
    },
  })
  // Twenty-one multiselect choices must not consume the independent photo allowance.
  choiceRecord = await record(signed.uid, 'upload', {
    id: choiceRecord.id,
    revision: choiceRecord.revision,
    fieldId: 'photo',
    contentType: 'image/png',
    base64: bytes.toString('base64'),
  })
  choiceRecord = await record(signed.uid, 'save', {
    id: choiceRecord.id,
    revision: choiceRecord.revision,
    requestId: randomUUID(),
    answers: { ...choiceRecord.answers, areas: ['South', 'North', '<West&Co>'] },
  })
  assert.deepEqual(choiceRecord.answers.areas, ['North', 'South', '<West&Co>'])
  assert.equal(choiceRecord.answers.optional, false)
  assert.deepEqual(choiceRecord.answers.extras, [])
  assert.deepEqual(
    (await record(signed.uid, 'get', { id: choiceRecord.id })).answers,
    choiceRecord.answers,
  )
  await reject(
    () =>
      record('other', 'save', {
        id: choiceRecord.id,
        revision: choiceRecord.revision,
        requestId: randomUUID(),
        answers: choiceRecord.answers,
      }),
    'permission-denied',
  )
  await template('admin', 'save', {
    id: 'choices',
    revision: 2,
    definition: {
      ...choices,
      title: 'Later choice controls',
      fields: choices.fields.map((field) =>
        field.id === 'schedule'
          ? { ...field, options: ['Monthly', 'Yearly'] }
          : field.id === 'areas'
            ? { ...field, options: ['East', 'West'] }
            : field,
      ),
    },
  })
  await template('admin', 'issue', { id: 'choices', revision: 3 })
  choiceRecord = await record(signed.uid, 'submit', {
    id: choiceRecord.id,
    revision: choiceRecord.revision,
    requestId: randomUUID(),
  })
  assert.equal(choiceRecord.templateVersion, 1)
  assert.equal(choiceRecord.definition.title, 'Common choice controls')
  assert.deepEqual(choiceRecord.answers.areas, ['North', 'South', '<West&Co>'])
  const choiceSnapshot = (await db.doc('formSubmissions/' + choiceRecord.id).get()).data(),
    html = buildFormEmailHtml(choiceSnapshot)
  assert.match(html, /<h3>Acknowledgement<\/h3><p>Yes<\/p>/)
  assert.match(html, /<h3>Optional follow-up<\/h3><p>No<\/p>/)
  assert.match(html, /North, South, &lt;West&amp;Co&gt;/)
  assert.match(html, /<h3>Optional areas<\/h3><p>No selections<\/p>/)
  assert.ok(!html.includes(choiceRecord.answers.photo[0]))
  assert.ok(!html.includes('<img'))
  assert.ok(!html.includes('href='))
  await template('admin', 'remove', { id: 'choices', revision: 4 })
  assert.deepEqual(
    (await record(signed.uid, 'get', { id: choiceRecord.id })).answers,
    choiceRecord.answers,
  )
  assert.deepEqual(
    (await db.doc('formSubmissions/' + choiceRecord.id).get()).data(),
    choiceSnapshot,
  )
  const {
    dashboardWorkspace,
    validateDashboardWidgets,
  } = require('../functions/dashboardFunctions.js')
  const dashboard = (uid, data) => dashboardWorkspace.run({ auth: uid ? { uid } : undefined, data })
  const shortDefinition = {
    ...source,
    title: 'Short inline check',
    fields: source.fields.slice(0, 2),
  }
  await template('admin', 'save', { id: 'inline-widget', revision: 0, definition: shortDefinition })
  await template('admin', 'issue', { id: 'inline-widget', revision: 1 })
  const widget = {
    id: 'quick',
    type: 'form',
    span: 12,
    title: 'Quick check',
    text: '',
    form: {
      templateId: 'inline-widget',
      version: 1,
      presentation: 'inline',
      unexpected: 'discard',
    },
  }
  const personal = { action: 'save', scope: 'personal', version: 0, widgets: [widget] }
  await reject(() => dashboard(undefined, personal), 'unauthenticated')
  await reject(() => dashboard('inactive', personal), 'permission-denied')
  await reject(() => dashboard(signed.uid, { ...personal, uid: 'other' }), 'invalid-argument')
  await reject(
    () => dashboard(signed.uid, { ...personal, scope: 'role', role: 'foreman' }),
    'permission-denied',
  )
  await reject(
    () => dashboard(signed.uid, { action: 'load', scope: 'role', role: 'admin' }),
    'permission-denied',
  )
  await reject(() => dashboard('payroll', personal), 'permission-denied')
  await reject(
    () => dashboard('admin', { ...personal, scope: 'role', role: 'payroll' }),
    'permission-denied',
  )
  await reject(
    () =>
      dashboard(signed.uid, {
        ...personal,
        widgets: [{ ...widget, form: { ...widget.form, version: 0 } }],
      }),
    'invalid-argument',
  )
  await reject(
    () =>
      dashboard(signed.uid, {
        ...personal,
        widgets: [{ ...widget, form: { ...widget.form, version: 999 } }],
      }),
    'failed-precondition',
  )
  await template('admin', 'save', { id: 'large-widget', revision: 0, definition: source })
  await template('admin', 'issue', { id: 'large-widget', revision: 1 })
  await reject(
    () =>
      dashboard(signed.uid, {
        ...personal,
        widgets: [{ ...widget, form: { ...widget.form, templateId: 'large-widget' } }],
      }),
    'invalid-argument',
  )
  assert.equal(validateDashboardWidgets([widget])[0].form.unexpected, undefined)
  const layout = await dashboard(signed.uid, personal)
  assert.deepEqual(layout.widgets[0].form, {
    templateId: 'inline-widget',
    version: 1,
    presentation: 'inline',
  })
  assert.equal(layout.canEdit, true)
  await template('admin', 'save', {
    id: 'inline-widget',
    revision: 2,
    definition: { ...shortDefinition, title: 'Next issued title' },
  })
  await template('admin', 'issue', { id: 'inline-widget', revision: 3 })
  assert.equal(
    (await dashboard(signed.uid, { action: 'load', scope: 'personal' })).widgets[0].form.version,
    1,
  )
  assert.equal((await dashboard('other', { action: 'load', scope: 'personal' })).version, 0)
  await dashboard('admin', { ...personal, scope: 'role', role: 'foreman' })
  assert.equal(
    (await dashboard(signed.uid, { action: 'load', scope: 'role', role: 'foreman' })).canEdit,
    false,
  )
  const launcher = await dashboard(signed.uid, {
    ...personal,
    version: 1,
    widgets: [{ ...widget, form: { ...widget.form, presentation: 'launcher' } }],
  })
  assert.equal(launcher.widgets[0].form.presentation, 'launcher')
  console.log(
    JSON.stringify({
      passed: true,
      sourceFields: 41,
      commonChoiceControls: true,
      dashboardPresentationPermissionsAndPinnedVersions: true,
      choiceSnapshotsAndEmailSummary: true,
      multiSelectDoesNotConsumePhotos: true,
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
