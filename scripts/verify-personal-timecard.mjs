import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):\d+$/, 'Local Firestore emulator required')
assert.equal(process.env.GCLOUD_PROJECT, 'demo-phase2-security', 'Synthetic project only')
const { ensureTimecardWeekRecord } = require('../functions/lib/timecardWeekFunctions.js')
const { db } = require('../functions/lib/runtime.js')
const paths = ['users/personal-paused-synthetic', 'employees/personal-paused-synthetic', 'timecardWeeks/personal-paused-synthetic', 'timecardWeeks/personal-paused-synthetic/cards/personal-paused-synthetic']
const samples = [
  { role: 'employee', active: true, myTimecard: { employeeId: 'personal-paused-synthetic', confirmed: true } },
  { employeeNumber: 'SYNTHETIC-PAUSED', myTimecardUserId: 'personal-paused-synthetic' },
  { status: 'draft', jobId: 'personal-paused-synthetic' },
  { employeeId: 'personal-paused-synthetic', notes: 'Retain existing content', hours: 8 },
]
try {
  await Promise.all(paths.map((path, index) => db.doc(path).set(samples[index])))
  for (const personalAction of ['context', 'load', 'save', 'auto-link', 'link-status']) {
    await assert.rejects(() => ensureTimecardWeekRecord.run({ auth: { uid: 'personal-paused-synthetic' }, data: { personalAction } }), error => error.code === 'failed-precondition' && /unavailable/.test(error.message))
  }
  await assert.rejects(() => ensureTimecardWeekRecord.run({ data: { personalAction: 'save' } }), error => error.code === 'unauthenticated')
  for (const [index, path] of paths.entries()) assert.deepEqual((await db.doc(path).get()).data(), samples[index])
  console.log('PASS: all personal actions disabled; authentication and existing synthetic records preserved.')
} finally {
  await Promise.all(paths.map(path => db.doc(path).delete()))
  await db.terminate()
}
