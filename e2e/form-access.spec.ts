import { expect, test } from './helpers/test.js'
import {
  createJobDashboardFixture,
  gotoPhase2App,
} from './helpers/phase2AppFixture.js'
import { setupFormServer } from './helpers/formFixture.js'
import { mockDashboard } from './helpers/dashboardFixture.js'

for (const path of [
  '/admin/forms',
  '/admin/website',
  '/forms/audit-e2e',
  '/form-submissions/entry#token=legacy-token',
])
  test('anonymous visitors must log in before opening ' + path, async ({ page }) => {
    let calls = 0
    await page.route('**/formSubmissionViewer', async (route) => {
      calls++
      await route.abort()
    })
    await page.goto(path)
    await expect(page).toHaveURL(/\/login\?redirect=/)
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
    await expect(page.locator('.form-builder, .submission-view')).toHaveCount(0)
    expect(calls).toBe(0)
  })

for (const role of ['foreman', 'project-manager', 'shop-foreman'])
  test(role + ' cannot view either builder', async ({ page }) => {
    const fixture = createJobDashboardFixture()
    fixture.auth.profile.role = role
    await gotoPhase2App(page, '/admin/forms', fixture)
    await expect(page).not.toHaveURL(/\/admin\/forms$/)
    await expect(page.getByRole('heading', { name: 'Form Builder', exact: true })).toHaveCount(0)
    await page.goto('/admin/website')
    await expect(page).not.toHaveURL(/\/admin\/website$/)
    await expect(page.getByRole('heading', { name: 'Website Builder', exact: true })).toHaveCount(0)
  })

for (const presentation of ['inline', 'launcher'] as const)
  test('signed-in employees complete the dashboard ' + presentation + ' form', async ({ page }) => {
    const dashboard = await mockDashboard(page, false)
    dashboard.layouts.set('personal', {
      version: 1,
      widgets: [
        {
          id: 'employee-form',
          type: 'form',
          title: 'Employee check',
          text: '',
          span: 12,
          form: { templateId: 'audit-e2e', version: 1, presentation },
        },
      ],
    })
    const server = await setupFormServer(page, {
      fixture: createJobDashboardFixture(),
      initialPath: '/dashboards/personal',
      definition: {
        title: 'Employee check',
        description: 'Internal employee form',
        recipients: [],
        fields: [
          { id: 'job', kind: 'text', label: 'Job name', required: true, options: [] },
          { id: 'ack', kind: 'checkbox', label: 'Reviewed', required: true, options: [] },
        ],
      },
    })
    const open = {
      inline: () => Promise.resolve(),
      launcher: () => page.getByRole('link', { name: 'Open full-page form', exact: true }).click(),
    }
    await open[presentation]()
    await page.getByRole('button', { name: 'Start draft', exact: true }).click()
    await page.getByLabel('Job name', { exact: false }).fill('Employee submitted job')
    await page.getByLabel('Reviewed', { exact: false }).check()
    await page.getByRole('button', { name: 'Submit form', exact: true }).click()
    await expect(page.getByText('Record status: submitted', { exact: false })).toBeVisible()
    expect(server.submitted).toBe(1)
    expect([...server.records.values()][0]?.ownerUid).toBe('foreman-e2e')
    await expect(page.getByRole('button', { name: 'New form', exact: true })).toHaveCount(0)
  })
