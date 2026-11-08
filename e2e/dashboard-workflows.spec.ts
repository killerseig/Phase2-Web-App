import { expect, test } from './helpers/test.js'
import { mockDashboard } from './helpers/dashboardFixture.js'
import { setupFormServer } from './helpers/formFixture.js'
import { createJobDashboardFixture } from './helpers/phase2AppFixture.js'
const widgets = [
  { id: 'work', type: 'workflows' as const, title: 'Job tools', text: '', span: 12 as const },
]
const definition = {
  title: 'Issued safety check',
  description: '',
  recipients: [],
  fields: [{ id: 'note', label: 'Notes', kind: 'text' as const, required: false, options: [] }],
}

for (const width of [1280, 390])
  for (const scope of ['personal', 'role', 'job'] as const)
    test(`${scope} dashboard forms return to their origin at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      const api = await mockDashboard(page, false)
      api.layouts.set(scope === 'role' ? 'role-foreman' : 'personal', { version: 1, widgets })
      if (scope === 'job')
        await page.route(/\/(?:dashboardWorkspace|sharedDashboardWorkspace)$/, async (route) => {
          const headers = {
            'access-control-allow-origin': '*',
            'access-control-allow-headers': '*',
          }
          if (route.request().method() === 'OPTIONS') {
            await route.fulfill({ status: 204, headers })
            return
          }
          await route.fulfill({
            headers,
            json: {
              result: {
                version: 1,
                widgets,
                canEdit: false,
                role: 'foreman',
                allowRoleEditing: false,
                job: { id: 'job-e2e', name: 'Test job', code: '1A' },
                notes: {},
                events: [],
                notesVersion: 0,
              },
            },
          })
        })
      const path =
        scope === 'job'
          ? '/dashboards/job-home/job-e2e'
          : scope === 'role'
            ? '/dashboards/role-home'
            : '/dashboards/personal'
      const server = await setupFormServer(page, {
        initialPath: path,
        fixture: createJobDashboardFixture(),
        definition,
      })
      if (scope !== 'job') {
        const choose = page.getByLabel('Choose job for tools')
        await choose.click()
        await choose.selectOption('job-e2e')
      }
      const tools = page.locator('.dashboard-workflows')
      await expect(tools.getByRole('link', { name: /Company Library/ })).toHaveAttribute(
        'href',
        '/company-library',
      )
      for (const [name, destination] of [
        ['Timecards', 'timecards'],
        ['Daily Logs', 'daily-logs'],
        ['Shop Orders', 'shop-orders'],
      ])
        await expect(tools.getByRole('link', { name: new RegExp(name!) })).toHaveAttribute(
          'href',
          `/jobs/job-e2e/${destination}`,
        )
      const form = tools
        .getByRole('list', { name: 'Available forms' })
        .getByRole('button', { name: 'Issued safety check' })
      await expect(form).toBeVisible()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true)
      expect(server.created).toBe(0)
      await form.click({ trial: true })
      await form.focus()
      await expect(form).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(
        (url) =>
          url.pathname === '/forms/audit-e2e' &&
          url.searchParams.get('dashboardJob') === 'job-e2e' &&
          url.searchParams.get('dashboard') === (scope === 'personal' ? 'personal' : 'role'),
      )
      await expect.poll(() => server.created).toBe(1)
      expect(server.submitted).toBe(0)
      await expect(page.getByRole('button', { name: 'Back to job', exact: true })).toHaveCount(0)
      await page.getByRole('button', { name: 'Return to dashboard', exact: true }).click()
      // Legacy role-home bookmarks return through the canonical role dashboard route.
      await expect(page).toHaveURL(
        (url) =>
          url.pathname === (scope === 'role' ? '/dashboards/role' : path) &&
          (scope === 'job' || url.searchParams.get('dashboardJob') === 'job-e2e'),
      )
      if (scope !== 'job')
        await expect(page.getByLabel('Choose job for tools')).toHaveValue('job-e2e')
      await expect(page.getByRole('list', { name: 'Available forms' })).toBeVisible()
      await expect(form).toBeVisible()
      if (scope !== 'job') {
        server.archived = true
        await page.getByLabel('Choose job for tools').selectOption('')
        await page.getByLabel('Choose job for tools').selectOption('job-e2e')
        await expect(
          page.getByText('No published forms are available to your account.'),
        ).toBeVisible()
      }
    })

test('legacy job forms retain Back to job and their original destination', async ({ page }) => {
  await setupFormServer(page, {
    initialPath: '/jobs/job-e2e',
    fixture: createJobDashboardFixture(),
    definition,
  })
  await page
    .getByTestId('job-forms-list')
    .getByRole('button', { name: 'Issued safety check' })
    .click()
  await expect(page).toHaveURL(/\/forms\/audit-e2e\?dashboardJob=job-e2e$/)
  await expect(page.getByRole('button', { name: 'Return to dashboard', exact: true })).toHaveCount(
    0,
  )
  await page.getByRole('button', { name: 'Back to job', exact: true }).click()
  await expect(page).toHaveURL(/\/jobs\/job-e2e$/)
})

test('dashboard workflows preserve form listing role restrictions', async ({ page }) => {
  const api = await mockDashboard(page, false)
  api.layouts.set('personal', { version: 1, widgets })
  const fixture = createJobDashboardFixture()
  fixture.auth.profile.role = 'payroll'
  const server = await setupFormServer(page, { initialPath: '/dashboards/personal', fixture })
  await expect(page.getByText('No jobs are available for your account.')).toBeVisible()
  await expect(page.locator('.dashboard-workflows')).toHaveCount(0)
  await expect(page.getByRole('list', { name: 'Available forms' })).toHaveCount(0)
  expect(server.actions).not.toContain('formTemplates:list')
  expect(server.created).toBe(0)
})

for (const scope of ['personal', 'role'] as const)
  test(`${scope} inline form ignores restored workflow job context`, async ({ page }) => {
    const api = await mockDashboard(page, false)
    api.layouts.set(scope === 'personal' ? 'personal' : 'role-foreman', {
      version: 1,
      widgets: [
        ...widgets,
        {
          id: 'independent',
          type: 'form',
          title: 'Independent form',
          text: '',
          span: 12,
          form: { templateId: 'audit-e2e', version: 1, presentation: 'inline' },
        },
      ],
    })
    const requests: Record<string, unknown>[] = []
    page.on('request', (request) => {
      if (request.url().endsWith('/formWorkspace') && request.method() === 'POST')
        requests.push(request.postDataJSON().data)
    })
    const path = scope === 'personal' ? '/dashboards/personal' : '/dashboards/role-home'
    const server = await setupFormServer(page, {
      initialPath: path + '?dashboardJob=job-e2e',
      fixture: createJobDashboardFixture(),
      definition,
    })
    await expect(page.getByLabel('Choose job for tools')).toHaveValue('job-e2e')
    const inline = page.getByRole('region', { name: 'Dashboard form', exact: true })
    await inline.getByRole('button', { name: 'Start draft', exact: true }).click()
    await expect.poll(() => server.created).toBe(1)
    expect(
      requests.filter((request) => request.action === 'list' || request.action === 'create').length,
    ).toBeGreaterThan(0)
    expect(requests.every((request) => request.dashboardJobId === undefined)).toBe(true)
    expect([...server.records.values()][0]!.jobId).toBeUndefined()
  })
