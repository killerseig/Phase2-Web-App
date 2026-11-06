import type { Route } from '@playwright/test'
import { expect, test, type Page } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { mockDashboard } from './helpers/dashboardFixture.js'

const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
const choices = [
  { id: 'admin-only', latestVersion: 1, definition: { title: 'Admin form', access: { respondentRoles: ['admin'] } } },
  { id: 'foreman-form', latestVersion: 2, definition: { title: 'Foreman form', access: { respondentRoles: ['foreman'] } } },
  { id: 'shop-form', latestVersion: 1, definition: { title: 'Shop form', access: { respondentRoles: ['shop-foreman'] } } },
]
async function setupPicker(page: Page) {
  const api = await mockDashboard(page)
  for (const role of ['admin', 'foreman', 'shop-foreman'])
    api.layouts.set(`role-${role}`, {
      version: 1,
      widgets: [
        { id: 'jobs', type: 'jobs', title: 'Assigned jobs', text: '', span: 12 },
        { id: 'form', type: 'form', title: 'Forms', text: '', span: 12,
          form: { templateId: 'foreman-form', version: 2, presentation: 'launcher' } },
      ],
    })
  const pending: Route[] = []
  await page.route('**/formTemplates', async route => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return }
    pending.push(route)
  })
  await gotoPhase2App(page, '/dashboards/role-home', createJobsFixture())
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect.poll(() => pending.length).toBe(1)
  await page.getByRole('button', { name: 'Edit Forms', exact: true }).click()
  return { pending, api }
}
const respond = (route: Route, templates = choices) => route.fulfill({ headers, json: { result: { templates } } })

test('form picker clears old role choices during loading and failure, then retries with the selected role audience', async ({ page }) => {
  const { pending } = await setupPicker(page)
  const picker = page.getByRole('combobox', { name: 'Employee form', exact: true })
  await expect(picker).toBeDisabled()
  await expect(page.getByText('Loading available forms.', { exact: true })).toBeVisible()
  await respond(pending[0]!)
  await expect(picker).toBeEnabled()
  await expect(picker.locator('option[value="admin-only"]')).toHaveCount(1)
  await page.getByLabel('Shared layout for', { exact: true }).selectOption('foreman')
  await expect.poll(() => pending.length).toBe(2)
  await page.getByRole('button', { name: 'Edit Forms', exact: true }).click()
  await expect(picker).toBeDisabled()
  await expect(picker.locator('option[value="admin-only"]')).toHaveCount(0)
  await pending[1]!.fulfill({ status: 503, headers, json: { error: { status: 'UNAVAILABLE', message: 'Form service unavailable' } } })
  await expect(page.getByRole('button', { name: 'Retry forms', exact: true })).toBeVisible()
  await expect(picker).toBeDisabled()
  await expect(picker.locator('option:not([disabled]):not([value=""])')).toHaveCount(0)
  await page.getByRole('button', { name: 'Retry forms', exact: true }).click()
  await expect.poll(() => pending.length).toBe(3)
  await respond(pending[2]!)
  await expect(picker).toBeEnabled()
  await expect(picker.locator('option:not([disabled]):not([value=""])')).toHaveText(['Foreman form · v2'])
  await expect(picker).toHaveValue('foreman-form')
})

test('late form-list responses cannot overwrite choices for a later selected role', async ({ page }) => {
  const { pending } = await setupPicker(page)
  await page.getByLabel('Shared layout for', { exact: true }).selectOption('shop-foreman')
  await expect.poll(() => pending.length).toBe(2)
  await page.getByRole('button', { name: 'Edit Forms', exact: true }).click()
  await respond(pending[1]!)
  const picker = page.getByRole('combobox', { name: 'Employee form', exact: true })
  await expect(picker).toBeEnabled()
  await picker.selectOption('shop-form')
  await respond(pending[0]!)
  await expect(page.getByLabel('Shared layout for', { exact: true })).toHaveValue('shop-foreman')
  await expect(picker).toHaveValue('shop-form')
  await expect(picker.locator('option:not([disabled]):not([value=""])')).toHaveText(['Shop form · v1'])
})

test('empty form audience is explained and does not offer a usable form choice', async ({ page }) => {
  const { pending } = await setupPicker(page)
  await respond(pending[0]!, [])
  await expect(page.getByRole('combobox', { name: 'Employee form', exact: true })).toBeDisabled()
  await expect(page.getByText('No issued forms are available for this dashboard role.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry forms', exact: true })).toHaveCount(0)
})

test('dashboard job links and job picker preserve numeric job-code order', async ({ page }) => {
  const api = await mockDashboard(page)
  const layout = { version: 1, widgets: [{ id: 'jobs', type: 'jobs' as const, title: 'Assigned jobs', text: '', span: 12 as const }] }
  api.layouts.set('role-admin', layout)
  api.layouts.set('personal', layout)
  const fixture = createJobsFixture()
  fixture.jobs = ['100', '2', '10'].map(code => ({ ...fixture.jobs[0]!, id: `sort-${code}`, code, name: `Project ${code}`, active: true }))
  await gotoPhase2App(page, '/dashboards/role-home', fixture)
  await expect(page.locator('.dashboard-jobs__job > a')).toHaveText(['2 · Project 2', '10 · Project 10', '100 · Project 100'])
  await page.locator('.dashboard-jobs__job > a').first().click()
  await expect(page.getByLabel('Choose job', { exact: true }).locator('option')).toHaveText(['Choose a job', '2 · Project 2', '10 · Project 10', '100 · Project 100'])
})
