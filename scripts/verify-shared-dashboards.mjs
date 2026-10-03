import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
const projectId = process.env.GCLOUD_PROJECT || 'demo-phase2-shared-dashboards'
assert.match(projectId, /^demo-/)
assert.equal(
  process.env.FIRESTORE_EMULATOR_HOST,
  '127.0.0.1:8280',
  'Use the separate test emulator, never the shared preview or production',
)
const require = createRequire(new URL('../functions/package.json', import.meta.url))
require('firebase-admin/app').initializeApp({
  projectId,
  storageBucket: projectId + '.appspot.com',
})
const db = require('firebase-admin/firestore').getFirestore()
const { sharedDashboardWorkspace } = require('../functions/sharedDashboardFunctions.js')
const { formTemplates, formWorkspace } = require('../functions/formFunctions.js')
const { formSubmissionViewer } = require('../functions/formSubmissionViewer.js')
const { defaultSharedWidgets } = require('../functions/sharedDashboardModel.js')
const call = (uid, scope, action = 'load', data = {}) =>
  sharedDashboardWorkspace.run({
    auth: uid ? { uid } : undefined,
    data: { scope, action, ...data },
  })
let negatives = 0,
  assertions = 0
const equal = (a, b) => {
  assert.deepEqual(a, b)
  assertions++
}
async function denied(fn, code = 'permission-denied') {
  await assert.rejects(fn, (e) => e.code === code)
  negatives++
}
const form = (uid, data) => formWorkspace.run({ auth: { uid }, data })
try {
  for (const [uid, role, assignedJobIds, active] of [
    ['dash-admin', 'admin', [], true],
    ['dash-a', 'foreman', ['dash-job-a'], true],
    ['dash-b', 'foreman', ['dash-job-b'], true],
    ['dash-shop', 'shop-foreman', [], true],
    ['dash-none', 'none', [], true],
    ['dash-inactive', 'admin', [], false],
    ['dash-payroll', 'payroll', [], true],
  ])
    await db.doc('users/' + uid).set({ role, assignedJobIds, active })
  for (const id of ['a', 'b'])
    await db
      .doc('jobs/dash-job-' + id)
      .set({ name: 'Synthetic job ' + id, code: '90' + id, active: true, assignedForemanIds: [] })
  await db
    .doc('jobs/dash-job-uid')
    .set({
      name: 'Synthetic UID assigned',
      code: '903',
      active: true,
      assignedForemanIds: ['dash-a'],
    })
  for (const uid of ['dash-none', 'dash-inactive']) await denied(() => call(uid, 'role'))
  await denied(() => call(undefined, 'role'), 'unauthenticated')
  await denied(() => call('dash-a', 'job', 'load', { jobId: 'dash-job-b' }))
  equal((await call('dash-a', 'job', 'load', { jobId: 'dash-job-uid' })).job.id, 'dash-job-uid')
  await denied(() => call('dash-a', 'role', 'load', { role: 'admin' }))
  await denied(() => call('dash-a', 'role', 'load', { uid: 'dash-b' }), 'invalid-argument')
  await denied(() => call('dash-a', 'role', 'load', { jobId: 'dash-job-a' }), 'invalid-argument')
  for (const uid of ['dash-a', 'dash-shop', 'dash-payroll'])
    equal((await call(uid, 'role')).canEdit, false)
  const roleWidgets = defaultSharedWidgets('role')
  await denied(() => call('dash-a', 'role', 'save-template', { version: 0, widgets: roleWidgets }))
  await denied(() =>
    call('dash-a', 'role', 'save-template', {
      version: 0,
      widgets: roleWidgets,
      allowRoleEditing: true,
    }),
  )
  let adminRole = await call('dash-admin', 'role', 'save-template', {
    role: 'foreman',
    version: 0,
    widgets: roleWidgets,
    allowRoleEditing: true,
  })
  equal(adminRole.allowRoleEditing, true)
  equal((await call('dash-a', 'role')).canEdit, true)
  equal((await call('dash-shop', 'role')).canEdit, false)
  const changed = structuredClone(roleWidgets)
  changed[0].title = 'Shared welcome'
  const saved = await call('dash-a', 'role', 'save-template', { version: 1, widgets: changed })
  equal(saved.version, 2)
  equal((await call('dash-b', 'role')).widgets[0].title, 'Shared welcome')
  await denied(() =>
    call('dash-a', 'role', 'save-template', {
      version: 2,
      widgets: changed,
      allowRoleEditing: false,
    }),
  )
  await denied(() =>
    call('dash-a', 'role', 'save-template', { role: 'shop-foreman', version: 0, widgets: changed }),
  )
  await denied(
    () => call('dash-a', 'role', 'save-template', { version: 1, widgets: changed }),
    'aborted',
  )
  await call('dash-a', 'role', 'save-notes', {
    version: 0,
    widgetId: 'notes',
    text: 'A private note',
  })
  await call('dash-b', 'role', 'save-notes', {
    version: 0,
    widgetId: 'notes',
    text: 'B private note',
  })
  equal((await call('dash-a', 'role')).notes.notes, 'A private note')
  equal((await call('dash-b', 'role')).notes.notes, 'B private note')
  const event = { id: 'inspection', title: 'My inspection', date: '2026-10-08' }
  await call('dash-a', 'role', 'save-calendar', { version: 1, events: [event] })
  equal((await call('dash-a', 'role')).events, [event])
  equal((await call('dash-b', 'role')).events, [])
  await denied(
    () =>
      call('dash-a', 'role', 'save-calendar', {
        version: 2,
        events: [{ ...event, date: '2026-02-30' }],
      }),
    'invalid-argument',
  )
  await call('dash-admin', 'role', 'save-template', {
    role: 'foreman',
    version: 2,
    widgets: changed,
    allowRoleEditing: false,
  })
  equal((await call('dash-a', 'role')).canEdit, false)
  await denied(() => call('dash-a', 'role', 'save-template', { version: 3, widgets: changed }))
  await call('dash-a', 'role', 'save-notes', {
    version: 2,
    widgetId: 'notes',
    text: 'Still my note',
  })
  const jobWidgets = defaultSharedWidgets('job')
  jobWidgets[0].title = 'Shared job heading'
  await call('dash-admin', 'job', 'save-template', { version: 0, widgets: jobWidgets })
  equal(
    (await call('dash-a', 'job', 'load', { jobId: 'dash-job-a' })).widgets[0].title,
    'Shared job heading',
  )
  equal(
    (await call('dash-b', 'job', 'load', { jobId: 'dash-job-b' })).widgets[0].title,
    'Shared job heading',
  )
  await denied(() =>
    call('dash-a', 'job', 'save-template', {
      jobId: 'dash-job-a',
      version: 1,
      widgets: jobWidgets,
    }),
  )
  await denied(() =>
    call('dash-a', 'job', 'save-notes', {
      jobId: 'dash-job-a',
      version: 0,
      widgetId: 'notes',
      text: 'Forbidden',
    }),
  )
  await call('dash-admin', 'job', 'save-notes', {
    jobId: 'dash-job-a',
    version: 0,
    widgetId: 'notes',
    text: 'A job note',
  })
  equal((await call('dash-b', 'job', 'load', { jobId: 'dash-job-b' })).notes, {})
  equal((await call('dash-a', 'job', 'load', { jobId: 'dash-job-a' })).notes.notes, 'A job note')
  await call('dash-admin', 'job', 'save-calendar', {
    jobId: 'dash-job-a',
    version: 1,
    events: [event],
  })
  equal((await call('dash-b', 'job', 'load', { jobId: 'dash-job-b' })).events, [])
  // Existing Forms contract with additive, immutable job context; owner access remains independent of layout sharing.
  const definition = {
    title: 'Synthetic job form',
    description: '',
    recipients: [],
    fields: [{ id: 'name', type: 'text', kind: 'text', label: 'Name', required: false }],
  }
  const source = JSON.parse(
    require('node:fs').readFileSync(
      new URL('../functions/src/committeeAudit.json', import.meta.url),
      'utf8',
    ),
  )
  source.title = definition.title
  source.recipients = []
  const template = await formTemplates.run({
    auth: { uid: 'dash-admin' },
    data: { action: 'save', id: 'dash-form', revision: 0, definition: source },
  })
  await formTemplates.run({
    auth: { uid: 'dash-admin' },
    data: { action: 'issue', id: 'dash-form', revision: template.revision },
  })
  const requestId = randomUUID()
  const plain = await form('dash-admin', {
    action: 'create',
    templateId: 'dash-form',
    version: 1,
    requestId,
  })
  const a = await form('dash-admin', {
    action: 'create',
    templateId: 'dash-form',
    version: 1,
    requestId,
    dashboardJobId: 'dash-job-a',
  })
  const b = await form('dash-admin', {
    action: 'create',
    templateId: 'dash-form',
    version: 1,
    requestId,
    dashboardJobId: 'dash-job-b',
  })
  equal(new Set([plain.id, a.id, b.id]).size, 3)
  equal(
    (await form('dash-admin', { action: 'list', dashboardJobId: 'dash-job-a' })).records.map(
      (r) => r.id,
    ),
    [a.id],
  )
  equal(
    (
      await form('dash-admin', {
        action: 'create',
        templateId: 'dash-form',
        version: 1,
        requestId,
        dashboardJobId: 'dash-job-a',
      })
    ).id,
    a.id,
  )
  await denied(() =>
    form('dash-a', {
      action: 'create',
      templateId: 'dash-form',
      version: 1,
      requestId: randomUUID(),
      dashboardJobId: 'dash-job-b',
    }),
  )
  await denied(() => form('dash-b', { action: 'get', id: a.id }))
  await denied(() => form('dash-admin', { action: 'get', id: a.id, dashboardJobId: 'dash-job-b' }))
  const own = await form('dash-a', {
    action: 'create',
    templateId: 'dash-form',
    version: 1,
    requestId: randomUUID(),
    dashboardJobId: 'dash-job-a',
  })
  await db.doc('formSubmissions/' + own.id).set({ ...own, status: 'submitted' })
  equal(
    (
      await formSubmissionViewer.run({
        auth: { uid: 'dash-a' },
        data: { action: 'get', id: own.id },
      })
    ).id,
    own.id,
  )
  await db.doc('users/dash-a').update({ assignedJobIds: [] })
  await denied(() => form('dash-a', { action: 'get', id: own.id }))
  equal(
    (await form('dash-a', { action: 'list' })).records.some((record) => record.id === own.id),
    false,
  )
  await denied(() =>
    formSubmissionViewer.run({ auth: { uid: 'dash-a' }, data: { action: 'get', id: own.id } }),
  )
  equal(
    (
      await formSubmissionViewer.run({
        auth: { uid: 'dash-admin' },
        data: { action: 'get', id: own.id },
      })
    ).id,
    own.id,
  )
  console.log(JSON.stringify({ projectId, assertions, deniedCases: negatives, result: 'passed' }))
} finally {
  await db.terminate()
}
