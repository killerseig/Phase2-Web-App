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
const { personalCurrentWeekEnd } = require('../functions/lib/personalTimecardWorkspace.js')
const currentPeriod = personalCurrentWeekEnd()
const start = new Date(currentPeriod + 'T12:00:00Z'); start.setUTCDate(start.getUTCDate() - 6)
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
    data: { personalAction: 'load', jobId, weekEndDate: currentPeriod, ...data },
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
    weekStartDate: start.toISOString().slice(0, 10),
    weekEndDate: currentPeriod,
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
// Employee accounts use the same linked card but have no general workforce privileges.
await db.doc('users/' + uid).set({ ...profile, role: 'employee', assignedJobIds: [] })
await db.doc('employees/' + employeeId).update({ jobId })
await db.doc('jobs/unassigned-job').set({ active: true, code: '999', name: 'Not assigned', assignedForemanIds: [uid] })
const employeeContext = await call({ personalAction: 'context' })
assert.deepEqual(employeeContext.jobs.map(job => job.id), [jobId])
assert.equal(employeeContext.defaultJobId, jobId)
assert.equal(employeeContext.currentWeekEndDate, currentPeriod)
await assert.rejects(() => call({ jobId: 'unassigned-job' }), /not assigned/)
const own = await call()
assert.equal(own.card.lines[0].hours[1], 4, 'Employee sees the same previously saved job card')
assert.equal('wageRate' in own.card, false)
const ownCardRef = db.doc('timecardWeeks/' + weekId + '/cards/' + require('../functions/lib/personalTimecardModel.js').personalCardId(employeeId))
await ownCardRef.update({ notes: 'Foreman correction', wageRate: 31, footerAmount: 'Protected payroll value' })
assert.equal((await call()).card.notes, 'Foreman correction', 'Foreman changes round-trip through the same card')
await assert.rejects(() => call({ personalAction: 'save', card: own.card, expectedVersion: own.version, requestId: 'employee-conflict' }), /changed elsewhere/)
await db.doc('users/' + uid).update({ assignedJobIds: ['personal-second-job'] })
const multiple = await call({ personalAction: 'context' })
assert.equal(multiple.defaultJobId, jobId)
assert.equal(multiple.jobs.length, 2)
const fresh = await call()
const changed = structuredClone(fresh.card); changed.notes = 'Employee saved detail'; changed.lines[0].hours[1] = 5
await call({ personalAction: 'save', card: changed, expectedVersion: fresh.version, requestId: 'employee-shared-save' })
const foremanRecord = (await ownCardRef.get()).data()
assert.equal(foremanRecord.notes, changed.notes)
assert.equal(foremanRecord.lines[0].days[1].hours, 5)
assert.equal(foremanRecord.wageRate, 31)
assert.equal(foremanRecord.footerAmount, 'Protected payroll value')
await db.doc('employees/' + employeeId).update({ jobId: null })
assert.equal((await call({ personalAction: 'context' })).defaultJobId, 'personal-second-job', 'Single assignment opens automatically')
await db.doc('users/' + uid).update({ assignedJobIds: [jobId, 'personal-second-job'] })
assert.equal((await call({ personalAction: 'context' })).defaultJobId, '', 'Multiple assignments without primary require a deliberate choice')
await db.doc('jobs/personal-second-job').update({ active: false })
assert.equal((await call({ personalAction: 'context' })).jobs.length, 1)
await db.doc('jobs/personal-second-job').update({ active: true })
const past = new Date(currentPeriod + 'T12:00:00Z'); past.setUTCDate(past.getUTCDate() - 7)
const pastEnd = past.toISOString().slice(0, 10); past.setUTCDate(past.getUTCDate() - 6)
await db.doc('timecardWeeks/past-personal-week').set({ jobId, weekEndDate: pastEnd, weekStartDate: past.toISOString().slice(0, 10), status: 'draft' })
await db.doc('timecardWeeks/past-personal-week/cards/old-own').set({ ...foremanRecord })
assert.equal((await call({ weekEndDate: pastEnd })).readOnly, true)
await assert.rejects(() => call({ weekEndDate: pastEnd, personalAction: 'save', card: changed, expectedVersion: null, requestId: 'past-forged-save' }), /locked/)
assert.equal((await db.doc('timecardWeeks/past-personal-week/cards/old-own').get()).data().notes, 'Employee saved detail')
await db.doc('users/' + uid).update({ assignedJobIds: [] })
assert.equal((await call({ personalAction: 'context' })).jobs.length, 0)
await assert.rejects(() => call(), /not assigned/)
// Admin-save exact matching is automatic, but self-edited names never grant access.
await db.doc('users/matching-admin').set({ role: 'admin', active: true })
await db.doc('users/automatic-employee').set({ role: 'employee', active: true, firstName: 'New', lastName: 'Payroll Person', assignedJobIds: [jobId] })
await db.doc('employees/automatic-payroll').set({ firstName: 'NEW', lastName: 'Payroll   Person', employeeNumber: 'T2', active: true, jobId })
const match = (action = 'auto-link', actor = 'matching-admin', extra = {}) => call({ personalAction: action, accountUid: 'automatic-employee', expectedFirstName: 'New', expectedLastName: 'Payroll Person', ...extra }, actor)
assert.equal((await match('link-status')).status, 'matched')
assert.equal((await db.doc('users/automatic-employee').get()).data().myTimecard, undefined, 'Read-only status never grants a link')
await assert.rejects(() => match('auto-link', 'automatic-employee'), /administrator/)
await assert.rejects(() => call({ personalAction: 'context' }, 'automatic-employee'), /matched to payroll/)
await assert.rejects(() => match('auto-link', 'matching-admin', { expectedFirstName: 'Old name' }), /details changed/)
await db.doc('employees/duplicate-payroll').set({ firstName: 'New', lastName: 'Payroll Person', active: true })
assert.equal((await match()).status, 'ambiguous')
await db.doc('employees/duplicate-payroll').delete()
await db.doc('users/duplicate-account').set({ firstName: 'New', lastName: 'Payroll Person', role: 'employee', active: true })
assert.equal((await match()).status, 'ambiguous')
await db.doc('users/duplicate-account').delete()
await db.doc('employees/automatic-payroll').update({ myTimecardUserId: 'another-account' })
assert.equal((await match()).status, 'conflict')
await db.doc('employees/automatic-payroll').update({ myTimecardUserId: null })
assert.equal((await match()).status, 'linked')
assert.equal((await db.doc('employees/automatic-payroll').get()).data().myTimecardUserId, 'automatic-employee')
assert.equal((await call({ personalAction: 'context' }, 'automatic-employee')).defaultJobId, jobId)
await db.doc('users/automatic-employee').update({ firstName: 'Someone', lastName: 'Else' })
assert.equal((await match('link-status')).status, 'linked', 'Later self-name changes do not move the established identity')
assert.equal((await db.doc('users/automatic-employee').get()).data().myTimecard.employeeId, 'automatic-payroll')
// General app callables remain denied even when the Employee has job assignments.
await assert.rejects(() => require('../functions/lib/sdsFunctions.js').sdsWorkspace.run({ auth: { uid }, data: { action: 'page' } }), cause => cause.code === 'permission-denied')
await assert.rejects(() => require('../functions/lib/sharedDashboardFunctions.js').sharedDashboardWorkspace.run({ auth: { uid }, data: { action: 'load', scope: 'personal' } }), cause => cause.code === 'permission-denied')
// Verify actual Firestore rules keep employee accounts out of other employees and crew data.
const { initializeApp, deleteApp } = await import('firebase/app')
const { getAuth, connectAuthEmulator, signInAnonymously } = await import('firebase/auth')
const { getFirestore, connectFirestoreEmulator, terminate, doc, getDoc, getDocs, collection, updateDoc } = await import('firebase/firestore')
assert.match(process.env.FIREBASE_AUTH_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):\d+$/)
const clients = []
async function rulesClient(role, assignedJobIds = []) {
  const app = initializeApp({ projectId: 'demo-phase2-security', apiKey: 'synthetic-key' }, 'personal-rules-' + clients.length)
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://' + process.env.FIREBASE_AUTH_EMULATOR_HOST, { disableWarnings: true })
  const clientDb = getFirestore(app)
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':')
  connectFirestoreEmulator(clientDb, host, Number(port))
  const credential = await signInAnonymously(auth)
  await db.doc('users/' + credential.user.uid).set({ role, active: true, assignedJobIds })
  clients.push({ app, db: clientDb })
  return { db: clientDb, uid: credential.user.uid }
}
const denied = async promise => assert.rejects(promise, cause => cause.code === 'permission-denied')
try {
  const employeeClient = await rulesClient('employee', [jobId])
  const employeeDb = employeeClient.db
  await getDoc(doc(employeeDb, 'users', employeeClient.uid))
  await denied(getDoc(doc(employeeDb, 'employees', employeeId)))
  await denied(getDocs(collection(employeeDb, 'timecardWeeks', weekId, 'cards')))
  await denied(getDoc(doc(employeeDb, 'timecardWeeks', weekId, 'cards', 'unrelated')))
  await denied(getDoc(doc(employeeDb, 'jobs', jobId)))
  await denied(updateDoc(doc(employeeDb, 'users', employeeClient.uid), { role: 'foreman' }))
  await db.doc('users/synthetic-foreman').set({ role: 'foreman', active: true, assignedJobIds: [jobId] })
  const visible = await require('../functions/lib/timecardWeekFunctions.js').listTimecardCardsForCurrentUser.run({ auth: { uid: 'synthetic-foreman' }, data: { weekId } })
  const shared = visible.cards.find(card => card.id === ownCardRef.id)
  assert.equal(shared.notes, 'Employee saved detail')
  assert.equal(shared.lines[0].days[1].hours, 5)
  await assert.rejects(() => require('../functions/lib/timecardWeekFunctions.js').listTimecardCardsForCurrentUser.run({ auth: { uid }, data: { weekId } }), /cannot|access|permission|unavailable/i)

} finally {
  for (const client of clients) { await terminate(client.db); await deleteApp(client.app) }
}
assert.equal((await db.collection('formEmailDeliveries').get()).size, 0)
console.log(
  JSON.stringify({
    passed: true,
    syntheticOnly: true,
    checks: 59,
    realEmails: 0,
    crewCardUntouched: true,
    personalWeekCreation: false,
  }),
)
