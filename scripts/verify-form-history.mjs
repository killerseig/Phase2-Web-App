import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

// This focused regression harness must never use a production database.
const projectId = process.env.GCLOUD_PROJECT
assert.match(projectId || '', /^demo-[a-z0-9-]+$/)
assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):\d+$/)
const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { initializeApp, deleteApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const app = initializeApp({ projectId, storageBucket: projectId + '.appspot.com' })
const db = getFirestore()
const { formWorkspace } = require('../functions/lib/formFunctions.js')
const suffix = randomUUID()
const owner = 'history-' + suffix
const other = 'other-' + suffix
const job = 'job-' + suffix
const deniedJob = 'denied-' + suffix
const templateId = 'template-' + suffix
const definition = JSON.parse(
  readFileSync(new URL('../functions/src/committeeAudit.json', import.meta.url), 'utf8'),
)
const list = (uid, data = {}) =>
  formWorkspace.run({
    auth: uid ? { uid } : undefined,
    data: { action: 'list', ...data },
  })
try {
  const batch = db.batch()
  batch.set(db.doc('users/' + owner), { role: 'foreman', active: true, assignedJobIds: [job] })
  batch.set(db.doc('users/' + other), { role: 'foreman', active: true, assignedJobIds: [job] })
  batch.set(db.doc('jobs/' + job), { name: 'Synthetic history job' })
  batch.set(db.doc('jobs/' + deniedJob), { name: 'Synthetic inaccessible job' })
  const put = (prefix, index, changes = {}) => {
    const id = prefix + '-' + suffix + '-' + String(index).padStart(3, '0')
    batch.set(db.doc('formRecords/' + id), {
      id,
      ownerUid: owner,
      templateId,
      jobId: job,
      templateVersion: 1,
      definition,
      status: 'draft',
      answers: {},
      revision: 1,
      createdAt: index,
      updatedAt: index,
      ...changes,
    })
    return id
  }
  // These precede all relevant records in document-ID order.
  for (let i = 0; i < 120; i++) put('a', i, { templateId: 'unrelated' })
  for (let i = 0; i < 120; i++) put('b', i, { jobId: deniedJob })
  const expected = Array.from({ length: 105 }, (_, i) => put('z', i))
  put('z', 105, { ownerUid: other })
  await batch.commit()

  const first = await list(owner, { dashboardJobId: job, templateId })
  assert.equal(first.records.length, 100)
  assert.equal(first.nextCursor, expected[99])
  const second = await list(owner, { dashboardJobId: job, templateId, cursor: first.nextCursor })
  assert.deepEqual(
    [...first.records, ...second.records].map((record) => record.id),
    expected,
  )
  assert.equal(second.nextCursor, null)
  assert.ok(
    first.records.every(
      (record) =>
        record.ownerUid === owner && record.jobId === job && record.templateId === templateId,
    ),
  )
  const hiddenPage = await list(owner, { templateId })
  assert.equal(hiddenPage.records.length, 0)
  assert.ok(hiddenPage.nextCursor, 'Authorization-filtered pages must still allow continuation')
  const otherPage = await list(other, { dashboardJobId: job, templateId })
  assert.equal(otherPage.records.length, 1)
  await assert.rejects(() => list(undefined, { templateId }), { code: 'unauthenticated' })
  await assert.rejects(() => list(owner, { dashboardJobId: deniedJob, templateId }), {
    code: 'permission-denied',
  })
  await assert.rejects(() => list(owner, { templateId: '../invalid' }), {
    code: 'invalid-argument',
  })
  await assert.rejects(() => list(owner, { templateId, cursor: '../invalid' }), {
    code: 'invalid-argument',
  })
  console.log(
    'PASS: 346 synthetic records; scoped filtering before pagination, both pages, ownership, inaccessible jobs, auth, and input validation. No production calls or email sends.',
  )
} finally {
  await db.terminate()
  await deleteApp(app)
}
