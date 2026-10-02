import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
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
  { formTemplates, formWorkspace } = require('../functions/formFunctions.js')
const {
    prepareFormEmail,
    fitFormEmailPayload,
    FormEmailPreparationError,
  } = require('../functions/formEmailContent.js'),
  { deliverFormSubmission } = require('../functions/formDelivery.js')
const id = randomUUID(),
  admin = 'email-admin-' + id,
  owner = 'email-owner-' + id,
  other = 'email-other-' + id
await db.doc('users/' + admin).set({ role: 'admin', active: true })
await db.doc('users/' + owner).set({ role: 'foreman', active: true, email: 'sender@example.com' })
await db
  .doc('users/' + other)
  .set({ role: 'foreman', active: true, email: 'recipient@example.com' })
const fields = [
  ['text', 'Question <script>alert(1)</script>'],
  ['textarea', 'Long notes'],
  ['checkbox', 'Acknowledgement'],
  ['radio', 'Rating'],
  ['multiselect', 'Areas'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['time', 'Time'],
  ['date', 'Date'],
  ['number', 'Number'],
  ['photo', 'Photos <&>'],
  ['photo', 'More photos'],
].map(([kind, label], i) => ({
  id: 'field_' + i,
  kind,
  label,
  required: false,
  options: ['North', 'South'],
  section: i < 4 ? 'Site <&>' : 'Assessment',
  hint: i === 1 ? 'Keep each line.' : undefined,
}))
const definition = {
  title: 'Completed audit <&>',
  description: 'Full form\nSecond line',
  fields,
  recipients: ['recipient@example.com'],
}
const template = await formTemplates.run({
  auth: { uid: admin },
  data: { action: 'save', id, revision: 0, definition },
})
await formTemplates.run({
  auth: { uid: admin },
  data: { action: 'issue', id, revision: template.revision },
})
const call = (data) => formWorkspace.run({ auth: { uid: owner }, data })
let record = await call({ action: 'create', templateId: id, version: 1, requestId: randomUUID() })
const long = 'First <&> line\n  Second\tline\n' + 'Long answer preserved. '.repeat(350)
const answers = {
  field_0: '<img src=x onerror=alert(1)>',
  field_1: long,
  field_2: true,
  field_3: 'North',
  field_4: ['North', 'South'],
  field_5: 'employee@example.com',
  field_6: '+1 (555) 123-4567',
  field_7: '13:20',
  field_8: '2026-10-02',
  field_9: 4,
}
record = await call({
  action: 'save',
  id: record.id,
  revision: record.revision,
  requestId: randomUUID(),
  answers,
})
const image = await require('sharp')({
  create: { width: 960, height: 640, channels: 3, background: '#2987aa' },
})
  .png()
  .toBuffer()
for (const fieldId of ['field_10', 'field_10', 'field_10', 'field_11'])
  record = await call({
    action: 'upload',
    id: record.id,
    revision: record.revision,
    fieldId,
    base64: image.toString('base64'),
    contentType: 'image/png',
  })
record = await call({
  action: 'submit',
  id: record.id,
  revision: record.revision,
  requestId: randomUUID(),
})
const snapshot = (await db.doc('formSubmissions/' + record.id).get()).data()
const capture = await prepareFormEmail(snapshot, definition.recipients)
assert.equal(capture.attachments.length, 3)
assert.equal(new Set(capture.attachments.map((a) => a.contentId)).size, 3)
for (const attachment of capture.attachments) {
  assert.ok(attachment.isInline)
  assert.match(capture.html, new RegExp('cid:' + attachment.contentId.replaceAll('.', '\\.')))
  const bytes = Buffer.from(attachment.contentBytes, 'base64'),
    metadata = await require('sharp')(bytes).metadata()
  assert.equal(metadata.format, 'jpeg')
  assert.ok(metadata.width <= 480 && metadata.height <= 480)
  assert.ok(bytes.length <= 128 * 1024)
}
assert.ok(capture.html.includes('&lt;img src=x onerror=alert(1)&gt;'))
assert.ok(!capture.html.includes('<script>'))
assert.ok(!capture.html.includes('<img src=x'))
assert.ok(capture.text.includes(long.trim()))
assert.ok(capture.html.includes('First &lt;&amp;&gt; line<br>'))
assert.ok(capture.html.includes('View all 3 photos'))
assert.ok(capture.text.includes('3 photos'))
for (const field of fields) {
  assert.ok(capture.text.includes(field.label))
  assert.ok(
    capture.html.includes(
      field.label.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    ),
  )
}
assert.deepEqual(capture.to, ['recipient@example.com', 'sender@example.com'])
assert.equal(capture.replyTo, 'sender@example.com')
const deps = {
  loadAsset: async () => undefined,
  download: async () => {
    throw new Error('Must not fetch untrusted paths')
  },
  ownerEmail: async () => undefined,
  appBaseUrl: () => 'http://127.0.0.1:5173',
}
const missing = await prepareFormEmail(snapshot, definition.recipients, deps)
assert.ok(!missing.attachments)
assert.ok(!missing.html.includes('cid:'))
assert.ok(missing.html.includes('View all 3 photos'))
const forged = await prepareFormEmail(snapshot, definition.recipients, {
  ...deps,
  loadAsset: async () => ({
    recordId: snapshot.id,
    fieldId: 'field_10',
    ownerUid: other,
    path: 'form-photos/' + snapshot.id + '/other.webp',
  }),
})
assert.ok(!forged.attachments)
const oversized = fitFormEmailPayload({
  ...capture,
  attachments: [
    { name: 'big.jpg', isInline: true, contentBytes: Buffer.alloc(900000).toString('base64') },
  ],
})
assert.ok(!oversized.attachments)
assert.ok(!oversized.html.includes('cid:'))
assert.ok(oversized.html.includes('View all 3 photos'))
assert.ok(oversized.text.includes(long.trim()))
assert.throws(
  () =>
    fitFormEmailPayload({
      ...capture,
      html: 'x'.repeat(910000),
      dailyLogPhotoFallbackHtml: 'x'.repeat(910000),
    }),
  FormEmailPreparationError,
)
const { formOutputIssues } = require('../functions/formOutputTemplate.js')
const custom = {
  ...snapshot,
  definition: {
    ...snapshot.definition,
    output: {
      requireLogin: true,
      pdf: true,
      template: 'Report <script>\nNotes: {{field_1}}\nPhotos: {{field_10}}',
    },
  },
}
const customEmail = await prepareFormEmail(custom, definition.recipients)
assert.ok(customEmail.html.includes('Report &lt;script&gt;'))
assert.ok(!customEmail.html.includes('<script>'))
assert.ok(customEmail.text.includes(long.trim()))
assert.ok(customEmail.html.includes('cid:'))
const pdfAttachment = customEmail.attachments.find((a) => a.contentType === 'application/pdf')
assert.ok(pdfAttachment && !pdfAttachment.isInline)
const pdfBytes = Buffer.from(pdfAttachment.contentBytes, 'base64')
assert.equal(pdfBytes.subarray(0, 4).toString(), '%PDF')
const pdf = await require('pdf-lib').PDFDocument.load(pdfBytes)
assert.ok(pdf.getPageCount() > 1, 'Long answers flow across PDF pages instead of truncating')
assert.ok(
  formOutputIssues(custom.definition).some(
    (issue) => issue.severity === 'warning' && issue.message.includes('Email'),
  ),
)
const renamed = {
  ...custom.definition,
  fields: custom.definition.fields.map((field) =>
    field.id === 'field_1' ? { ...field, label: 'Renamed notes' } : field,
  ),
}
assert.equal(formOutputIssues(renamed).filter((issue) => issue.severity === 'error').length, 0)
const missingField = {
  ...custom.definition,
  fields: custom.definition.fields.filter((field) => field.id !== 'field_1'),
}
assert.ok(formOutputIssues(missingField).some((issue) => issue.severity === 'error'))
await assert.rejects(() =>
  prepareFormEmail({ ...custom, definition: missingField }, definition.recipients),
)
const copy = await formTemplates.run({
  auth: { uid: admin },
  data: { action: 'duplicate', id, revision: 2, targetId: randomUUID() },
})
assert.ok(copy.draft.fields.every((field) => !fields.some((original) => original.id === field.id)))
const withPdfFallback = fitFormEmailPayload({
  ...customEmail,
  attachments: [
    pdfAttachment,
    { name: 'large.jpg', isInline: true, contentBytes: Buffer.alloc(900000).toString('base64') },
  ],
})
assert.equal(withPdfFallback.attachments.length, 1)
assert.equal(withPdfFallback.attachments[0].contentType, 'application/pdf')
assert.ok(!withPdfFallback.html.includes('cid:'))
if (process.env.FORMS_EMAIL_CAPTURE_DIR) {
  mkdirSync(process.env.FORMS_EMAIL_CAPTURE_DIR, { recursive: true })
  writeFileSync(process.env.FORMS_EMAIL_CAPTURE_DIR + '/completed-form.pdf', pdfBytes)
  writeFileSync(process.env.FORMS_EMAIL_CAPTURE_DIR + '/custom-email.html', customEmail.html)
}
let sends = 0
const adapter = {
  enabled: () => true,
  send: async () => {
    sends++
    throw new FormEmailPreparationError('Synthetic preparation failure')
  },
}
await deliverFormSubmission(record.id, false, adapter)
assert.equal((await db.doc('formDeliveries/' + record.id).get()).data().status, 'failed')
await Promise.all([
  deliverFormSubmission(record.id, true, {
    enabled: () => true,
    send: async () => {
      sends++
      await prepareFormEmail(snapshot, definition.recipients)
    },
  }),
  deliverFormSubmission(record.id, true, {
    enabled: () => true,
    send: async () => {
      sends++
    },
  }),
])
assert.equal(sends, 2)
assert.equal((await db.doc('formDeliveries/' + record.id).get()).data().status, 'sent')
await deliverFormSubmission(record.id, true, {
  enabled: () => true,
  send: async () => {
    throw new Error('Must not resend')
  },
})
assert.deepEqual((await db.doc('formSubmissions/' + record.id).get()).data(), snapshot)
await assert.rejects(
  () => formWorkspace.run({ auth: { uid: other }, data: { action: 'get', id: record.id } }),
  (e) => e.code === 'permission-denied',
)
await assert.rejects(
  () =>
    formWorkspace.run({
      auth: { uid: other },
      data: { action: 'photo', id: record.id, assetId: snapshot.answers.field_10[0] },
    }),
  (e) => e.code === 'permission-denied',
)
if (process.env.FORMS_EMAIL_CAPTURE_DIR) {
  mkdirSync(process.env.FORMS_EMAIL_CAPTURE_DIR, { recursive: true })
  writeFileSync(process.env.FORMS_EMAIL_CAPTURE_DIR + '/form-email.html', capture.html)
  writeFileSync(process.env.FORMS_EMAIL_CAPTURE_DIR + '/form-email.txt', capture.text)
  writeFileSync(
    process.env.FORMS_EMAIL_CAPTURE_DIR + '/form-email.json',
    JSON.stringify(capture, null, 2),
  )
}
console.log(
  JSON.stringify({
    passed: true,
    completeQuestionsAndAnswers: true,
    optionalPdfMultiPage: true,
    safeStableFieldTemplates: true,
    omissionsWarnDeletedFieldsError: true,
    pdfRetainedInImageFallback: true,
    longMultilineEscaped: true,
    boundedJpegInlinePhotos: 3,
    overflowViewerLink: true,
    missingAndForgedPhotosSafe: true,
    payloadFallback: true,
    failedRetryPreservesSubmission: true,
    concurrentRetrySingleSend: true,
    recipientAccessUnchanged: true,
    productionWrites: false,
    realEmails: 0,
  }),
)
