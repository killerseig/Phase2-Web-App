import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

// Never connect these fixtures to production.
assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):\d+$/)
const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { initializeApp, deleteApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const app = initializeApp({
  projectId: 'demo-phase2-security',
  storageBucket: 'demo-phase2-security.appspot.com',
})
const db = getFirestore()
const { updateDailyLogRecordCallable } = require('../functions/dailyLogRecordFunctions.js')
const logRef = db.doc('dailyLogs/retry-log')
const submit = (uid, data = {}) =>
  updateDailyLogRecordCallable.run({
    auth: { uid },
    data: {
      dailyLogId: logRef.id,
      status: 'submitted',
      submissionRequestId: 'retry-request',
      payload: { weeklySchedule: 'Final schedule' },
      ...data,
    },
  })

try {
  await db
    .doc('users/foreman')
    .set({ role: 'foreman', active: true, assignedJobIds: ['retry-job'] })
  await db.doc('users/other').set({ role: 'foreman', active: true, assignedJobIds: ['retry-job'] })
  await db.doc('users/admin').set({ role: 'admin', active: true })
  await db.doc('jobs/retry-job').set({ name: 'Retry test', assignedForemanIds: ['foreman'] })
  const draft = { jobId: 'retry-job', status: 'draft', foremanUserId: 'foreman', payload: {} }
  await logRef.set(draft)

  // Represents two copies of the same request arriving concurrently.
  await Promise.all([submit('foreman'), submit('foreman')])
  const committed = (await logRef.get()).data()
  assert.equal(committed.status, 'submitted')
  assert.equal(committed.payload.weeklySchedule, 'Final schedule')
  assert.equal(committed.submissionRequestId, 'retry-request')

  // Simulate a lost response and retry; even changed content with the same
  // request ID must not rewrite the committed submission or its timestamp.
  await submit('foreman', { payload: { weeklySchedule: 'Must not replace' } })
  assert.deepEqual((await logRef.get()).data(), committed)
  await assert.rejects(submit('other'), { code: 'failed-precondition' })
  await assert.rejects(submit('foreman', { submissionRequestId: 'different' }), {
    code: 'failed-precondition',
  })
  await assert.rejects(
    submit('foreman', { status: 'draft', payloadFields: { weeklySchedule: 'Stale blur save' } }),
    { code: 'failed-precondition' },
  )
  assert.deepEqual((await logRef.get()).data(), committed)

  // A delayed draft write racing a submit either wins before the submit or
  // is rejected after it. It must never overwrite submitted content.
  await logRef.set(draft)
  const outcomes = await Promise.allSettled([
    submit('foreman', {
      status: 'draft',
      payloadFields: { weeklySchedule: 'Stale blur save' },
      payload: undefined,
    }),
    submit('foreman'),
  ])
  assert.equal(outcomes[1].status, 'fulfilled')
  if (outcomes[0].status === 'rejected')
    assert.equal(outcomes[0].reason.code, 'failed-precondition')
  assert.equal((await logRef.get()).data().payload.weeklySchedule, 'Final schedule')

  // Existing clients without a request ID still submit, and admin corrections
  // remain supported.
  await logRef.set(draft)
  await submit('foreman', { submissionRequestId: undefined })
  await submit('admin', { payload: { weeklySchedule: 'Admin correction' } })
  assert.equal((await logRef.get()).data().payload.weeklySchedule, 'Admin correction')
  await db.doc('users/admin').update({ active: false })
  await assert.rejects(submit('admin'), { code: 'permission-denied' })
  console.log(
    'Daily-log submission checks passed: retries, concurrent writes, permissions, legacy clients, admin corrections.',
  )
} finally {
  await deleteApp(app)
}
