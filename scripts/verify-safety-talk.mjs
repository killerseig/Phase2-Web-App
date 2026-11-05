import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
// Synthetic Firestore only. No live provider, production reads or outbound mail.
assert.match(process.env.GCLOUD_PROJECT || '', /^demo-[a-z0-9-]+$/)
assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):\d+$/)
const require = createRequire(new URL('../functions/package.json', import.meta.url))
require('firebase-admin/app').initializeApp({ projectId: process.env.GCLOUD_PROJECT, storageBucket: process.env.GCLOUD_PROJECT + '.appspot.com' })
const db = require('firebase-admin/firestore').getFirestore()
const { formTemplates, formWorkspace } = require('../functions/lib/formFunctions.js')
const { formSubmissionViewer } = require('../functions/lib/formSubmissionViewer.js')
const { deliverFormSubmission } = require('../functions/lib/formDelivery.js')
const { prepareFormEmail } = require('../functions/lib/formEmailContent.js')
const { parseFormSignature } = require('../functions/lib/formSignatures.js')
const id = randomUUID(), owner = 'signature-owner-' + id, admin = 'signature-admin-' + id, other = 'signature-other-' + id
for (const [uid, role] of [[owner, 'foreman'], [admin, 'admin'], [other, 'foreman']])
  await db.doc('users/' + uid).set({ active: true, role, email: uid + '@example.invalid' })
const definition = { title: 'Synthetic safety talk', description: 'Isolated test fixture', recipients: ['test-recipient@example.invalid'], output: { requireLogin: true, pdf: true, template: '' }, fields: [
  { id: 'attendees', kind: 'repeat', label: 'Attendee', required: true, options: [], sequential: true, minInstances: 1, maxInstances: 20, fields: [
    { id: 'name', kind: 'text', label: 'Attendee name', required: true, options: [] },
    { id: 'signature', kind: 'signature', label: 'Signature', required: true, options: [] },
  ] },
] }
const template = data => formTemplates.run({ auth: { uid: admin }, data: { ...data, id } })
let recordId = id
const workspace = (data, uid = owner) => formWorkspace.run({ auth: { uid }, data: { ...data, id: recordId } })
await template({ action: 'save', revision: 0, definition })
await template({ action: 'issue', revision: 1 })
const initial = await workspace({ action: 'create', templateId: id, version: 1, requestId: randomUUID() })
recordId = initial.id
const ink = JSON.stringify({ strokes: [[[.1, .2], [.2, .8], [.4, .3]]], signedAt: 123 })
const answers = { attendees: [{ instanceId: 'one', answers: { name: 'Synthetic attendee one', signature: ink } }] }
const saveId = randomUUID()
const input = { action: 'save', revision: initial.revision, requestId: saveId, answers, handoff: { groupId: 'attendees', instanceId: 'one' } }
const [saved, replay] = await Promise.all([workspace(input), workspace(input)])
assert.equal(saved.revision, replay.revision)
const signedAt = parseFormSignature(saved.answers.attendees[0].answers.signature).signedAt
assert(signedAt > 123)
assert.equal(JSON.stringify(saved.answers), JSON.stringify(replay.answers))
assert.equal((await workspace({ action: 'get' })).id, recordId)
const second = structuredClone(saved.answers)
second.attendees.push({ instanceId: 'two', answers: { name: 'Synthetic attendee two', signature: ink } })
const next = await workspace({ action: 'save', revision: saved.revision, requestId: randomUUID(), answers: second, handoff: { groupId: 'attendees', instanceId: 'two' } })
assert.equal(parseFormSignature(next.answers.attendees[0].answers.signature).signedAt, signedAt)
await assert.rejects(() => workspace({ action: 'save', revision: next.revision, requestId: randomUUID(), answers: { attendees: [{ instanceId: 'unfinished', answers: { name: '', signature: '' } }] }, handoff: { groupId: 'attendees', instanceId: 'unfinished' } }), /required|attendee/i)
const changed = structuredClone(next.answers); changed.attendees[0].answers.name = 'Changed after signing'
await assert.rejects(() => workspace({ action: 'save', revision: next.revision, requestId: randomUUID(), answers: changed }), /details changed/)
const submitId = randomUUID()
const submission = await workspace({ action: 'submit', revision: next.revision, requestId: submitId })
assert.equal((await workspace({ action: 'submit', revision: next.revision, requestId: submitId })).id, submission.id)
await assert.rejects(() => workspace({ action: 'save', revision: submission.revision, requestId: randomUUID(), answers: next.answers }), /immutable/)
await assert.rejects(() => workspace({ action: 'get' }, other), /another user/)
const pdf = await formSubmissionViewer.run({ auth: { uid: owner }, data: { action: 'pdf', id: recordId } })
const { getDocument, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs')
const pdfTask = getDocument({ data: new Uint8Array(Buffer.from(pdf.base64, 'base64')), useSystemFonts: false })
const document = await pdfTask.promise
let text = '', strokes = 0
for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
  const page = await document.getPage(pageNumber)
  text += (await page.getTextContent()).items.map(item => item.str || '').join(' ')
  strokes += (await page.getOperatorList()).fnArray.filter(operation => operation === OPS.stroke || operation === OPS.constructPath).length
}
assert(text.includes('Synthetic attendee one') && text.includes('Synthetic attendee two'))
assert(text.includes(new Date(signedAt).toISOString()))
assert(strokes >= 2, 'Both attendees must have drawn ink in the PDF')
await pdfTask.destroy()
let sends = 0
const adapter = { enabled: () => true, send: async (record, recipients) => {
  sends++
  assert.deepEqual(recipients, ['test-recipient@example.invalid'])
  const email = await prepareFormEmail(record, recipients)
  assert(email.attachments.some(attachment => attachment.contentType === 'application/pdf'))
} }
await Promise.all([deliverFormSubmission(recordId, true, adapter), deliverFormSubmission(recordId, true, adapter)])
await deliverFormSubmission(recordId, true, adapter)
assert.equal(sends, 1)
assert.equal((await db.doc('formDeliveries/' + recordId).get()).data().status, 'sent')
console.log(JSON.stringify({ passed: true, firestore: 'local emulator', attendees: 2, authoritativeTimes: true, concurrentSaveReplay: true, submitReplay: true, immutableEntry: true, pdfInkAndTimes: true, privateAccessDenied: true, simulatedMailCalls: sends, realEmails: 0 }))
await db.terminate()
