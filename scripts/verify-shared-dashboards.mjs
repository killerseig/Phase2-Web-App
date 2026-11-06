import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { initializeApp as initializeClientApp, deleteApp } from 'firebase/app'
import { getFirestore as getClientFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, terminate } from 'firebase/firestore'
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
const clientApp = initializeClientApp({ projectId }, 'dashboard-rules-audit')
const clientDb = getClientFirestore(clientApp)
connectFirestoreEmulator(clientDb, '127.0.0.1', 8280, { mockUserToken: { sub: 'dash-a' } })
const { sharedDashboardWorkspace } = require('../functions/lib/sharedDashboardFunctions.js')
const { formTemplates, formWorkspace } = require('../functions/lib/formFunctions.js')
const { formSubmissionViewer } = require('../functions/lib/formSubmissionViewer.js')
const { announcementId } = require('../functions/lib/dashboardAnnouncements.js')
const { defaultSharedWidgets } = require('../functions/lib/sharedDashboardModel.js')
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
  // All three scopes use the same editor, but personal identity is always server-derived.
  for (const uid of ['dash-none', 'dash-inactive']) await denied(() => call(uid, 'personal'))
  await denied(() => call('dash-a', 'personal', 'load', { ownerId: 'dash-b' }), 'invalid-argument')
  await denied(() => call('dash-a', 'personal', 'load', { role: 'admin' }), 'invalid-argument')
  await db.doc('dashboardPersonal/dash-a').set({ version: 7, widgets: [{ id: 'old-note', type: 'notes', span: 6, title: 'My notes', text: 'Original private note' }] })
  const personal = await call('dash-a', 'personal')
  equal(personal.canEdit, true)
  equal(personal.notes['old-note'], 'Original private note')
  equal((await db.doc('sharedDashboardPersonal/dash-a').get()).exists, false)
  equal((await call('dash-b', 'personal')).notes['old-note'], undefined)
  const infoWidget = { id: 'job-info', type: 'job-info', span: 6, title: 'Job information', text: '' }
  await call('dash-a', 'personal', 'save-template', { version: 0, widgets: [...personal.widgets, infoWidget] })
  equal((await call('dash-a', 'personal')).widgets.some(widget => widget.type === 'job-info'), true)
  equal((await call('dash-b', 'personal')).widgets.some(widget => widget.type === 'job-info'), false)
  await denied(() => call('dash-a', 'personal', 'save-template', { version: 1, widgets: [infoWidget, { ...infoWidget, id: 'duplicate-info' }] }), 'invalid-argument')
  equal((await db.doc('dashboardPersonal/dash-a').get()).data().version, 7)
  equal((await call('dash-a', 'personal')).notes['old-note'], 'Original private note')
  await call('dash-a', 'personal', 'save-notes', { version: 0, widgetId: 'old-note', text: 'Updated only for me' })
  equal((await call('dash-a', 'personal')).notes['old-note'], 'Updated only for me')
  equal((await call('dash-a', 'role')).notes['old-note'], undefined)
  equal((await call('dash-a', 'role')).notesVersion, 0)
  equal((await call('dash-b', 'personal')).notes['old-note'], undefined)
  for (const collection of ['sharedDashboardPersonal', 'sharedDashboardPersonalData', 'sharedDashboardTemplates']) {
    await denied(() => getDoc(doc(clientDb, collection, 'dash-a')))
    await denied(() => setDoc(doc(clientDb, collection, 'dash-a'), { widgets: [] }))
  }
  await denied(() => call('dash-a', 'personal', 'save-template', { version: 0, widgets: personal.widgets }), 'aborted')

  const taskWidget = { id: 'private-tasks', type: 'tasks', span: 6, title: 'My tasks', text: '' }
  const aLayout = await call('dash-a', 'personal')
  await call('dash-a', 'personal', 'save-template', { version: aLayout.version, widgets: [...aLayout.widgets, taskWidget] })
  const taskState = await call('dash-a', 'personal')
  const tasks = [{ id: 'one', title: 'Private reminder', done: false }]
  await call('dash-a', 'personal', 'save-tasks', { version: taskState.notesVersion, tasks })
  equal((await call('dash-a', 'personal')).tasks, tasks)
  for (const uid of ['dash-b', 'dash-admin']) equal((await call(uid, 'personal')).tasks, [])
  equal((await call('dash-a', 'role')).tasks, [])
  equal((await call('dash-a', 'job', 'load', { jobId: 'dash-job-a' })).tasks, [])
  for (const uid of ['dash-none', 'dash-inactive']) await denied(() => call(uid, 'personal', 'save-tasks', { version: 0, tasks }))
  await denied(() => call(undefined, 'personal', 'save-tasks', { version: 0, tasks }), 'unauthenticated')
  await denied(() => call('dash-b', 'personal', 'save-tasks', { ownerId: 'dash-a', version: 0, tasks }), 'invalid-argument')
  await denied(() => call('dash-admin', 'personal', 'save-tasks', { uid: 'dash-a', version: 0, tasks }), 'invalid-argument')
  for (const scope of ['role', 'job']) await denied(() => call('dash-admin', scope, 'save-tasks', { version: 0, tasks }))
  await denied(() => call('dash-b', 'personal', 'save-tasks', { version: 0, tasks }), 'failed-precondition')
  await denied(() => call('dash-a', 'personal', 'save-tasks', { version: taskState.notesVersion, tasks: [] }), 'aborted')
  const latest = await call('dash-a', 'personal')
  await denied(() => call('dash-a', 'personal', 'save-tasks', { version: latest.notesVersion, tasks: [{...tasks[0], assignee: 'dash-b'}] }), 'invalid-argument')
  await call('dash-a', 'personal', 'save-tasks', { version: latest.notesVersion, tasks: [{ ...tasks[0], done: true }] })
  equal((await call('dash-a', 'personal')).tasks[0].done, true)
  const beforeRemoval = await call('dash-a', 'personal')
  await call('dash-a', 'personal', 'save-template', { version: beforeRemoval.version, widgets: beforeRemoval.widgets.filter(w => w.type !== 'tasks') })
  equal((await call('dash-a', 'personal')).tasks[0].done, true)


  // Announcements remain unpublished author-private drafts until audience/publishing decisions.
  await db.doc('users/dash-admin-2').set({ role: 'admin', active: true })
  const draftWidget = { id: 'announcement-drafts', type: 'announcement-drafts', span: 12, title: 'Announcement drafts', text: '' }
  const adminPersonal = await call('dash-admin', 'personal')
  await call('dash-admin', 'personal', 'save-template', { version: adminPersonal.version, widgets: [...adminPersonal.widgets, draftWidget] })
  const draft = { id: 'first', title: 'Private draft', body: 'Unpublished message' }
  const adminData = await call('dash-admin', 'personal')
  await call('dash-admin', 'personal', 'save-announcement-drafts', { version: adminData.notesVersion, announcementDrafts: [draft] })
  equal((await call('dash-admin', 'personal')).announcementDrafts, [draft])
  equal((await call('dash-admin-2', 'personal')).announcementDrafts, [])
  equal((await call('dash-admin', 'role')).announcementDrafts, [])
  equal((await call('dash-admin', 'job', 'load', { jobId: 'dash-job-a' })).announcementDrafts, [])
  for (const uid of ['dash-a', 'dash-b', 'dash-shop', 'dash-payroll', 'dash-none', 'dash-inactive'])
    await denied(() => call(uid, 'personal', 'save-announcement-drafts', { version: 0, announcementDrafts: [draft] }))
  await denied(() => call(undefined, 'personal', 'save-announcement-drafts', { version: 0, announcementDrafts: [draft] }), 'unauthenticated')
  for (const scope of ['role', 'job'])
    await denied(() => call('dash-admin', scope, 'save-announcement-drafts', { version: 0, announcementDrafts: [draft] }))
  await denied(() => call('dash-admin-2', 'personal', 'load', { ownerId: 'dash-admin' }), 'invalid-argument')
  await denied(() => call('dash-admin-2', 'personal', 'save-announcement-drafts', { uid: 'dash-admin', version: 0, announcementDrafts: [draft] }), 'invalid-argument')
  const nonAdminLayout = await call('dash-a', 'personal')
  await denied(() => call('dash-a', 'personal', 'save-template', { version: nonAdminLayout.version, widgets: [...nonAdminLayout.widgets, draftWidget] }))
  const draftVersion = (await call('dash-admin', 'personal')).notesVersion
  for (const fields of [{ recipients: ['dash-a'] }, { published: true }, { audience: 'unknown' }])
    await denied(() => call('dash-admin', 'personal', 'save-announcement-drafts', { version: draftVersion, announcementDrafts: [{ ...draft, ...fields }] }), 'invalid-argument')
  await denied(() => call('dash-admin', 'personal', 'save-announcement-drafts', { version: adminData.notesVersion, announcementDrafts: [] }), 'aborted')
  await denied(() => call('dash-admin', 'personal', 'publish-announcement', { announcementDrafts: [draft] }), 'invalid-argument')
  await denied(() => getDoc(doc(clientDb, 'sharedDashboardPersonalData', 'dash-admin')))
  await db.doc('users/dash-admin').update({ role: 'foreman' })
  equal((await call('dash-admin', 'personal')).announcementDrafts, [])
  await denied(() => call('dash-admin', 'personal', 'save-announcement-drafts', { version: draftVersion, announcementDrafts: [] }))
  await db.doc('users/dash-admin').update({ role: 'admin' })
  equal((await call('dash-admin', 'personal')).announcementDrafts, [draft])


  // Both published audiences use current server identity and assignment.
  await db.doc('users/dash-pm').set({ role: 'project-manager', active: true, assignedJobIds: ['dash-job-a'] })
  await db.doc('users/dash-employee').set({ role: 'employee', active: true })
  const audienceDrafts = [
    { ...draft, id: 'everyone-update', audience: 'everyone' },
    { ...draft, id: 'job-update', title: 'Job A only', audience: 'job', jobId: 'dash-job-a' },
    { ...draft, id: 'uid-update', title: 'UID assignment', audience: 'job', jobId: 'dash-job-uid' },
  ]
  const audienceVersion = (await call('dash-admin', 'personal')).notesVersion
  await call('dash-admin', 'personal', 'save-announcement-drafts', { version: audienceVersion, announcementDrafts: audienceDrafts })
  const publishVersion = (await call('dash-admin', 'personal')).notesVersion
  for (const item of audienceDrafts) await call('dash-admin', 'personal', 'publish-announcement', { version: publishVersion, draftId: item.id })
  const feed = async (uid, scope = 'personal', more = {}) => (await call(uid, scope, 'list-announcements', more)).items
  const titles = items => items.map(item => item.title).sort()
  equal(titles(await feed('dash-a')), ['Job A only', 'Private draft', 'UID assignment'])
  for (const uid of ['dash-b', 'dash-shop', 'dash-payroll', 'dash-admin', 'dash-admin-2'])
    equal(titles(await feed(uid)), ['Private draft'])
  equal(titles(await feed('dash-pm')), ['Job A only', 'Private draft'])
  equal(titles(await feed('dash-a', 'role')), ['Job A only', 'Private draft', 'UID assignment'])
  equal(titles(await feed('dash-a', 'job', {jobId: 'dash-job-a'})), ['Job A only', 'Private draft'])
  for (const uid of ['dash-inactive', 'dash-none', 'dash-employee']) await denied(() => feed(uid))
  await denied(() => feed(undefined), 'unauthenticated')
  await denied(() => feed('dash-b', 'job', {jobId: 'dash-job-a'}))
  await denied(() => feed('dash-b', 'personal', {assignedJobIds: ['dash-job-a']}), 'invalid-argument')
  await denied(() => feed('dash-a', 'role', {role: 'admin'}))
  for (const uid of ['dash-a', 'dash-b', 'dash-shop', 'dash-payroll', 'dash-pm'])
    await denied(() => call(uid, 'personal', 'publish-announcement', {version: publishVersion, draftId: 'everyone-update'}))
  await denied(() => call('dash-admin', 'personal', 'publish-announcement', {version: publishVersion, draftId: 'everyone-update', audience: 'everyone'}), 'invalid-argument')
  await denied(() => call('dash-admin', 'personal', 'publish-announcement', {version: 0, draftId: 'missing'}), 'aborted')
  equal(announcementId('a_b', 'c') === announcementId('a', 'b_c'), false)
  const firstPublication = await db.doc('dashboardAnnouncements/' + announcementId('dash-admin', 'everyone-update')).get()
  await call('dash-admin', 'personal', 'publish-announcement', {version: 0, draftId: 'everyone-update'})
  equal((await db.doc('dashboardAnnouncements/' + announcementId('dash-admin', 'everyone-update')).get()).data(), firstPublication.data())
  await denied(() => getDoc(doc(clientDb, 'dashboardAnnouncements', announcementId('dash-admin', 'everyone-update'))))
  await denied(() => setDoc(doc(clientDb, 'dashboardAnnouncements', 'injected'), { title: 'Unauthorized' }))
  await db.doc('users/dash-a').update({assignedJobIds: []})
  equal(titles(await feed('dash-a')), ['Private draft', 'UID assignment'])
  await db.doc('jobs/dash-job-uid').update({assignedForemanIds: []})
  equal(titles(await feed('dash-a')), ['Private draft'])
  await db.doc('users/dash-a').update({assignedJobIds: ['dash-job-a']})
  await db.doc('jobs/dash-job-uid').update({assignedForemanIds: ['dash-a']})
  // Hidden newer records cannot crowd out an authorized audience before the bound.
  const batch = db.batch()
  for (let i = 0; i < 60; i++) batch.set(db.doc('dashboardAnnouncements/hidden-' + i), {title: 'Hidden B', body:'Other job', audience:'job', jobId:'dash-job-b', publishedAt: Date.now() + i + 1})
  await batch.commit()
  equal(titles(await feed('dash-a')), ['Job A only', 'Private draft', 'UID assignment'])


  // Specific people: the audience is not a role, a job, an email list or an Admin bypass.
  await db.doc('users/dash-a').update({firstName:'Pat',lastName:'Foreman',email:'pat@example.invalid'})
  const peopleDraft = {...draft,id:'people-update',title:'Selected people only',audience:'people',recipientIds:['dash-a','dash-pm']}
  const previous = await call('dash-admin','personal')
  await call('dash-admin','personal','save-announcement-drafts',{version:previous.notesVersion,announcementDrafts:[...audienceDrafts,peopleDraft]})
  const selectedVersion = (await call('dash-admin','personal')).notesVersion
  await db.doc('users/dash-pm').update({active:false,assignedJobIds:[]})
  await denied(()=>call('dash-admin','personal','publish-announcement',{version:selectedVersion,draftId:peopleDraft.id}),'failed-precondition')
  await db.doc('users/dash-pm').update({active:true})
  await call('dash-admin','personal','publish-announcement',{version:selectedVersion,draftId:peopleDraft.id})
  for (const uid of ['dash-a','dash-pm']) {
    const message=(await feed(uid)).find(item=>item.title==='Selected people only')
    equal(!!message,true)
    equal('recipientIds' in message,false)
    equal('createdBy' in message,false)
  }
  await denied(()=>call('dash-pm','job','load',{jobId:'dash-job-a'}))
  await db.doc('users/dash-pm').update({assignedJobIds:['dash-job-a']})
  for (const uid of ['dash-b','dash-payroll','dash-shop','dash-admin','dash-admin-2'])
    equal((await feed(uid)).some(item=>item.title==='Selected people only'),false)
  await denied(()=>feed('dash-b','personal',{recipientIds:['dash-a']}),'invalid-argument')
  const beforeInvalid = await call('dash-admin','personal')
  for (const recipientIds of [['missing-user'],['dash-inactive'],['dash-employee'],['dash-none']])
    await denied(()=>call('dash-admin','personal','save-announcement-drafts',{version:beforeInvalid.notesVersion,announcementDrafts:[{...peopleDraft,recipientIds}]}),'failed-precondition')
  for (const uid of ['dash-a','dash-b','dash-payroll','dash-shop','dash-pm'])
    await denied(()=>call(uid,'personal','list-announcement-recipients'))
  await denied(()=>call('dash-admin','personal','list-announcement-recipients',{ownerId:'dash-a'}),'invalid-argument')
  const directory = await call('dash-admin','personal','list-announcement-recipients',{search:'Pat Foreman'})
  equal(directory.items.map(person=>person.uid),['dash-a'])
  const allPeople = await call('dash-admin','personal','list-announcement-recipients')
  equal(allPeople.items.some(person=>['dash-inactive','dash-employee','dash-none'].includes(person.uid)),false)
  const emptyPageBatch=db.batch()
  for(let i=0;i<100;i++)emptyPageBatch.set(db.doc('users/aaa-hidden-'+String(i).padStart(3,'0')),{role:'foreman',active:false})
  await emptyPageBatch.commit()
  const emptyPage=await call('dash-admin','personal','list-announcement-recipients',{search:'Pat Foreman'})
  equal(emptyPage.items,[])
  equal(typeof emptyPage.nextCursor,'string')
  const continued=await call('dash-admin','personal','list-announcement-recipients',{search:'Pat Foreman',cursor:emptyPage.nextCursor})
  equal(continued.items.map(person=>person.uid),['dash-a'])

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
  await terminate(clientDb)
  await deleteApp(clientApp)
  await db.terminate()
}
