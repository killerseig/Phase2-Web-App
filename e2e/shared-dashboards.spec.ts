import { expect, test, type Page } from './helpers/test.js'
import {
  createJobsFixture,
  createJobDashboardFixture,
  gotoPhase2App,
} from './helpers/phase2AppFixture.js'
import { createRequire } from 'node:module'
import type { SharedDashboardWidget } from '../functions/src/sharedDashboardModel'
import type { FormRecord } from '../functions/src/formModel'
const { defaultSharedWidgets } = createRequire(import.meta.url)(
  '../functions/sharedDashboardModel.js',
) as typeof import('../functions/src/sharedDashboardModel')
async function mockShared(page: Page, admin = true, enabled = false) {
  const templates = new Map<
    string,
    { widgets: SharedDashboardWidget[]; version: number; allowRoleEditing: boolean }
  >()
  const content = new Map<
    string,
    { notes: Record<string, string>; events: unknown[]; version: number }
  >()
  const requests: Record<string, unknown>[] = []
  let fail = false
  await page.route('**/sharedDashboardWorkspace', async (route) => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers })
      return
    }
    const data = route.request().postDataJSON().data
    requests.push(data)
    const role = data.role || (admin ? 'admin' : 'foreman'),
      key = data.scope === 'job' ? 'all-jobs' : 'role-' + role
    const state = templates.get(key) || {
      widgets: defaultSharedWidgets(data.scope),
      version: 0,
      allowRoleEditing: enabled,
    }
    const owner = data.scope === 'job' ? data.jobId : admin ? 'admin-e2e' : 'foreman-e2e'
    const saved = content.get(owner) || { notes: {}, events: [], version: 0 }
    if (data.action === 'save-template') {
      if (fail) {
        fail = false
        await route.fulfill({
          status: 409,
          headers,
          json: {
            error: {
              status: 'ABORTED',
              message: 'This dashboard changed elsewhere. Reload and review before saving.',
            },
          },
        })
        return
      }
      state.widgets = structuredClone(data.widgets)
      state.version++
      state.allowRoleEditing = data.allowRoleEditing ?? state.allowRoleEditing
      templates.set(key, state)
    } else if (data.action === 'save-notes') {
      saved.notes[data.widgetId] = data.text
      saved.version++
      content.set(owner, saved)
    } else if (data.action === 'save-calendar') {
      saved.events = data.events
      saved.version++
      content.set(owner, saved)
    }
    if (data.action === 'save-notes' || data.action === 'save-calendar') {
      await route.fulfill({ headers, json: { result: { ...saved } } })
      return
    }
    const fixture = admin ? createJobsFixture() : createJobDashboardFixture(),
      job = fixture.jobs.find((job) => job.id === data.jobId)
    await route.fulfill({
      headers,
      json: {
        result: {
          ...state,
          canEdit: admin || (data.scope === 'role' && state.allowRoleEditing),
          role,
          job: job ? { ...job, startDate: '2026-10-03', finishDate: '2026-10-30' } : null,
          notes: saved.notes,
          events: saved.events,
          notesVersion: saved.version,
        },
      },
    })
  })
  await page.route('**/formTemplates', (route) =>
    route.fulfill({
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      json: { result: { templates: [] } },
    }),
  )
  await page.addInitScript(() => {
    window.__PHASE2_FORM_SERVER__ = true
  })
  return {
    templates,
    requests,
    content,
    failSave: () => {
      fail = true
    },
  }
}

test('shared job template uses safe styled Text and the same catalog, while job notes remain distinct', async ({
  page,
}) => {
  const api = await mockShared(page)
  await gotoPhase2App(page, '/dashboards/job-home/job-1', createJobsFixture())
  await expect(page.locator('.shared-variable-text')).toContainText('Acoustical Remodel')
  await expect(page.locator('.app-shell__sidebar-main nav a')).toHaveText(['Jobs'])
  await expect(page.locator('.app-shell__sidebar a[href="/dashboards/role-home"]')).toHaveCount(0)
  await expect(page.locator('.app-shell__sidebar a[href="/dashboards/job-home"]')).toHaveCount(0)
  await expect(page.getByRole('complementary', { name: 'Dashboard library' })).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: 'Daily Logs', exact: false }).first(),
  ).toHaveAttribute('href', '/jobs/job-1/daily-logs')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  for (const label of [
    'Job tools',
    'Text',
    'Assigned jobs',
    'Calendar',
    'Notes',
    'Documents',
    'Role resources',
    'Forms',
  ])
    await expect(page.getByRole('button', { name: 'Add ' + label, exact: true })).toBeVisible()
  await page.getByLabel('Text content', { exact: true }).fill('Job: ')
  await page.getByRole('button', { name: 'Job name', exact: true }).click()
  await expect(page.getByLabel('Text content', { exact: true })).toHaveValue('Job: {{ job.name }}')
  await page.getByLabel('Font size (px)', { exact: true }).fill('32')
  await page.getByLabel('Font size (px)', { exact: true }).blur()
  await page.getByLabel('Text alignment', { exact: true }).selectOption('center')
  await page.getByRole('button', { name: 'Phone', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Fit', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  await expect(page.locator('.shared-variable-text')).toHaveCSS('font-size', '32px')
  await page.getByRole('button', { name: 'Edit notes', exact: true }).click()
  await page.getByLabel('Job notes', { exact: true }).fill('Only the first job')
  await page.getByRole('button', { name: 'Save notes', exact: true }).click()
  await expect(page.locator('.shared-note-text')).toHaveText('Only the first job')
  await page.getByLabel('Choose job', { exact: true }).selectOption('job-2')
  await expect(page.locator('.shared-variable-text')).toHaveText('Job: Drywall Buildout')
  await expect(page.locator('.shared-note-text')).toHaveText('No notes yet.')
  await expect(page.locator('.shared-variable-text')).toHaveCSS('text-align', 'center')
  expect(api.templates.size).toBe(1)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect
    .poll(() =>
      page
        .locator('.app-shell__sidebar')
        .evaluate((element) => element.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({
    path: 'C:/Users/atlas/Documents/Codex/2026-10-01/task-3/shared-job-phone.png',
    fullPage: true,
  })
})

test('Admin explicitly enables a selected role; editor and permission controls stay out of normal viewing', async ({
  page,
}) => {
  const api = await mockShared(page)
  await gotoPhase2App(page, '/dashboards/role-home', createJobsFixture())
  await expect(page.getByLabel('Shared layout for', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByLabel('Shared layout for', { exact: true }).selectOption('foreman')
  const permission = page.getByLabel('Allow this role to edit its dashboard', { exact: true })
  await expect(permission).not.toBeChecked()
  await permission.check()
  await page.getByLabel('Text content', { exact: true }).fill('Welcome {{ user.name }}')
  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(page.getByLabel('Shared layout for', { exact: true })).toHaveCount(0)
  expect(api.templates.get('role-foreman')!.allowRoleEditing).toBe(true)
  await expect(page.locator('.shared-variable-text')).toHaveText('Welcome Dan Admin')
  await page.screenshot({
    path: 'C:/Users/atlas/Documents/Codex/2026-10-01/task-3/shared-role-desktop.png',
    fullPage: true,
  })
})

test('a foreman owns personal notes and calendar without being able to edit the role template', async ({
  page,
}) => {
  await mockShared(page, false)
  await gotoPhase2App(page, '/dashboards/role-home', createJobDashboardFixture())
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
  await expect(page.locator('.shared-variable-text')).toContainText('Chris (CJ) Larsen')
  await page.getByRole('button', { name: 'Edit notes', exact: true }).click()
  await page.getByLabel('Your notes', { exact: true }).fill('My private reminder')
  await page.getByRole('button', { name: 'Save notes', exact: true }).click()
  await expect(page.locator('.shared-note-text')).toHaveText('My private reminder')
  await page.getByRole('button', { name: 'Edit calendar', exact: true }).click()
  await page.getByRole('button', { name: 'Add date', exact: true }).click()
  await page.getByLabel('Event title', { exact: true }).fill('My inspection')
  await page.getByLabel('Date', { exact: true }).fill('2026-10-09')
  await page.getByRole('button', { name: 'Save calendar', exact: true }).click()
  await expect(page.locator('.shared-dates')).toContainText('My inspection')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.locator('.shared-note-text')).toHaveText('My private reminder')
  await page.setViewportSize({ width: 320, height: 740 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('an opted-in foreman edits only their template; failed saves and cancelled navigation retain edits', async ({
  page,
}) => {
  const api = await mockShared(page, false, true)
  await gotoPhase2App(page, '/dashboards/role-home', createJobDashboardFixture())
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page.getByLabel('Shared layout for', { exact: true })).toHaveCount(0)
  await expect(
    page.getByLabel('Allow this role to edit its dashboard', { exact: true }),
  ).toHaveCount(0)
  await page.getByLabel('Text content', { exact: true }).fill('Unsaved welcome')
  api.failSave()
  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('changed elsewhere')
  await expect(page.getByLabel('Text content', { exact: true })).toHaveValue('Unsaved welcome')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByLabel('Text content', { exact: true })).toHaveValue('Unsaved welcome')
  await page.getByRole('button', { name: 'Cancel edits', exact: true }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Discard changes', exact: true })
    .click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
})

test('Text renders HTML literally and clearly reports unavailable or unsupported tokens', async ({
  page,
}) => {
  await mockShared(page)
  await gotoPhase2App(page, '/dashboards/role-home', createJobsFixture())
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page
    .getByLabel('Text content', { exact: true })
    .fill('<img src=x onerror=alert(1)> {{ job.name }} {{ user.name.toUpperCase() }}')
  await expect(page.locator('.shared-variable-text img')).toHaveCount(0)
  await expect(page.locator('.shared-variable-text')).toContainText('[Not available: job.name]')
  await expect(page.locator('.shared-variable-text')).toContainText(
    '[Unknown variable: user.name.toUpperCase()]',
  )
})

test('anonymous visits to either new dashboard require authentication', async ({ page }) => {
  for (const path of ['/dashboards/role-home', '/dashboards/job-home/job-1']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/login/)
  }
})

test('job Forms keep context through launcher, return and inline presentation without mixing drafts', async ({
  page,
}) => {
  const api = await mockShared(page),
    records = new Map<string, FormRecord>(),
    creates: string[] = []
  const definition = {
    title: 'Synthetic inspection',
    description: '',
    recipients: [],
    fields: [
      {
        id: 'inspection',
        label: 'Inspection',
        kind: 'text' as const,
        required: false,
        options: [],
      },
    ],
    version: 1,
    createdAt: '2026-10-03T00:00:00Z',
  }
  api.templates.set('all-jobs', {
    version: 1,
    allowRoleEditing: false,
    widgets: [
      ...defaultSharedWidgets('job'),
      {
        id: 'inspection-form',
        type: 'form',
        title: 'Inspection form',
        text: '',
        span: 12,
        form: { templateId: 'inspection', version: 1, presentation: 'launcher' },
      },
    ],
  })
  for (const name of ['formTemplates', 'formWorkspace'])
    await page.route('**/' + name, async (route) => {
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
      if (route.request().method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers })
        return
      }
      const data = route.request().postDataJSON().data
      let result: unknown
      if (name === 'formTemplates')
        result = {
          templates: [
            {
              id: 'inspection',
              draft: definition,
              definition,
              revision: 2,
              latestVersion: 1,
              archived: false,
              used: true,
            },
          ],
        }
      else if (data.action === 'list')
        result = {
          records: [...records.values()].filter(
            (record) => !data.dashboardJobId || record.jobId === data.dashboardJobId,
          ),
        }
      else if (data.action === 'create') {
        const record: FormRecord = {
          id: crypto.randomUUID(),
          ownerUid: 'admin-e2e',
          jobId: data.dashboardJobId,
          templateId: 'inspection',
          templateVersion: 1,
          definition,
          revision: 1,
          status: 'draft',
          answers: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        records.set(record.id, record)
        creates.push(data.dashboardJobId)
        result = record
      } else if (data.action === 'save') {
        const record = records.get(data.id)!
        record.answers = data.answers
        record.revision++
        result = record
      } else result = records.get(data.id)
      await route.fulfill({ headers, json: { result } })
    })
  await gotoPhase2App(page, '/dashboards/job-home/job-1', createJobsFixture())
  await page.getByRole('link', { name: 'Open full-page form', exact: true }).click()
  await expect(page).toHaveURL(/dashboardJob=job-1/)
  expect(records.size).toBe(0)
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  await page.getByRole('textbox', { name: 'Inspection', exact: true }).fill('First job inspection')
  await page.getByRole('button', { name: 'Return to dashboard', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboards\/job-home\/job-1/)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page
    .getByRole('complementary', { name: 'Dashboard library' })
    .getByRole('button', { name: 'Inspection form', exact: true })
    .click()
  await page.getByLabel('Presentation', { exact: true }).selectOption('inline')
  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Inspection', exact: true })).toHaveValue(
    'First job inspection',
  )
  expect(creates).toEqual(['job-1'])
  await page.getByLabel('Choose job', { exact: true }).selectOption('job-2')
  await expect(page.getByRole('button', { name: 'Start draft', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  await page.getByRole('textbox', { name: 'Inspection', exact: true }).fill('Second job inspection')
  await page.getByLabel('Choose job', { exact: true }).selectOption('job-1')
  await expect(page.getByRole('textbox', { name: 'Inspection', exact: true })).toHaveValue(
    'First job inspection',
  )
  expect(creates).toEqual(['job-1', 'job-2'])
  await page.getByLabel('Choose job',{exact:true}).selectOption('')
  await expect(page.getByText('Choose a job to use forms.',{exact:true})).toBeVisible()
  await expect(page.getByRole('link',{name:'Open full-page form',exact:true})).toHaveCount(0)
})
