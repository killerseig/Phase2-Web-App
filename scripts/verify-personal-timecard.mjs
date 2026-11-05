import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
assert.match(
  process.env.FIRESTORE_EMULATOR_HOST || '',
  /^(127\.0\.0\.1|localhost):\d+$/,
  'Local Firestore emulator required',
)
assert.equal(process.env.GCLOUD_PROJECT, 'demo-phase2-security', 'Synthetic project only')
const { ensureTimecardWeekRecord } = require('../functions/lib/timecardWeekFunctions.js'),
  { db } = require('../functions/lib/runtime.js')
const uid = 'personal-synthetic-user',
  employeeId = 'personal-synthetic-employee',
  weekId = 'personal-synthetic-week',
  jobId = 'personal-synthetic-job'
const profile = {
  role: 'project-manager',
  active: true,
  assignedJobIds: [jobId, 'personal-second-job'],
  firstName: 'Synthetic',
  lastName: 'User',
  myTimecard: { employeeId, confirmed: true, confirmedBy: 'synthetic-admin' },
}
await db.doc('users/' + uid).set(profile)
await db
  .doc('employees/' + employeeId)
  .set({
    firstName: 'Synthetic',
    lastName: 'Employee',
    employeeNumber: 'TEST-001',
    active: true,
    myTimecardUserId: uid,
  })
await db.doc('jobs/' + jobId).set({ name: 'Synthetic first job', code: '100', active: true })
await db
  .doc('jobs/personal-second-job')
  .set({ name: 'Synthetic second job', number: '200', active: true })
const call = (data = {}, actor = uid) =>
  ensureTimecardWeekRecord.run({
    auth: actor ? { uid: actor } : null,
    data: { personalAction: 'load', jobId, weekEndDate: '2026-11-07', ...data },
  })
await assert.rejects(() => call({}, null), /signed in/)
await assert.rejects(() => call(), /not been enabled/)
await db.doc('settings/myTimecard').set({ enabledRoles: ['project-manager'] })
assert.equal((await call()).state, 'week-not-open')
assert.equal(
  (await db.collection('timecardWeeks').get()).size,
  0,
  'Loading must not create/copy weeks',
)
await db
  .doc('timecardWeeks/' + weekId)
  .set({
    jobId,
    jobCode: '100',
    weekStartDate: '2026-11-01',
    weekEndDate: '2026-11-07',
    status: 'draft',
    employeeCardCount: 1,
  })
await db
  .doc(`timecardWeeks/${weekId}/cards/unrelated`)
  .set({ employeeId: 'someone-else', notes: 'Unchanged crew card' })
await assert.rejects(() => call({ weekEndDate: '2026-02-35' }), /valid Saturday/)
await db.doc('timecardWeeks/' + weekId).update({ weekStartDate: '2026-10-25' })
await assert.rejects(() => call(), /dates on this legacy week/)
await db.doc('timecardWeeks/' + weekId).update({ weekStartDate: '2026-11-01' })
const initial = await call()
assert.equal(initial.card.lines.length, 13)
assert.equal(initial.version, null)
const card = structuredClone(initial.card)
card.lines[0].jobNumber = '100'
card.lines[0].account = 'PAINT'
card.lines[0].hours[1] = 4
card.lines[1].jobNumber = '200'
card.lines[1].account = 'PAINT'
card.lines[1].hours[1] = 4
const save = { personalAction: 'save', card, expectedVersion: null, requestId: 'synthetic-save-1' }
const concurrent = await Promise.all([call(save), call(save)])
const first = concurrent[0]
assert(first.version)
assert.equal(first.card.lines[0].hours[1], 4)
assert(concurrent.some((result) => result.replayed))
const replay = await call(save)
assert.equal(replay.replayed, true)
assert.equal((await db.doc('timecardWeeks/' + weekId).get()).data().employeeCardCount, 2)
assert.equal(
  (await db.doc(`timecardWeeks/${weekId}/cards/unrelated`).get()).data().notes,
  'Unchanged crew card',
)
assert.equal(
  (await db.collection(`timecardWeeks/${weekId}/cards`).get()).size,
  2,
  'No roster copy or duplicate on retry',
)
await assert.rejects(() => call({ ...save, requestId: 'synthetic-save-2' }), /changed elsewhere/)
await assert.rejects(
  () => call({ ...save, card: { ...card, notes: 'Changed request' } }),
  /new request identifier/,
)
await db.doc('users/' + uid).update({ assignedJobIds: [jobId] })
await assert.rejects(
  () => call({ ...save, expectedVersion: first.version, requestId: 'synthetic-save-3' }),
  /job numbers/,
)
await db.doc('users/' + uid).set(profile)
await db.doc('timecardWeeks/' + weekId).update({ status: 'submitted' })
assert.equal((await call()).readOnly, true)
await assert.rejects(
  () => call({ ...save, expectedVersion: first.version, requestId: 'synthetic-save-4' }),
  /locked/,
)
await db.doc('timecardWeeks/' + weekId).update({ status: 'draft' })
await db.doc('employees/' + employeeId).update({ myTimecardUserId: 'different-user' })
await assert.rejects(() => call(), /link.*changed/)
await db.doc('employees/' + employeeId).update({ myTimecardUserId: uid })
await db.doc('users/' + uid).update({ active: false })
await assert.rejects(() => call(), /not been enabled/)
assert.equal((await db.collection('formEmailDeliveries').get()).size, 0)
console.log(
  JSON.stringify({
    passed: true,
    syntheticOnly: true,
    checks: 19,
    realEmails: 0,
    crewCardUntouched: true,
    personalWeekCreation: false,
  }),
)
