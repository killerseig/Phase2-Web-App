import { expect, test, type Page } from './helpers/test.js'
import { setupFormServer } from './helpers/formFixture.js'
import { mockDashboard } from './helpers/dashboardFixture.js'
import { createJobDashboardFixture, createJobsFixture } from './helpers/phase2AppFixture.js'
import type { FormDefinition } from '../functions/src/formModel'
const smallForm: FormDefinition = {
  title: 'Quick safety check',
  description: 'Synthetic dashboard form',
  recipients: [],
  fields: [
    { id: 'job', label: 'Job name', kind: 'text', required: true, options: [] },
    { id: 'ack', label: 'Reviewed', kind: 'checkbox', required: true, options: [] },
  ],
}
async function addForm(page: Page, presentation: 'inline' | 'launcher') {
  await page.getByRole('button', { name: 'Edit layout', exact: true }).click()
  await page.getByRole('button', { name: 'Add Form', exact: true }).click()
  await page.getByLabel('Widget 1 form', { exact: true }).selectOption('audit-e2e')
  await page.getByLabel('Widget 1 presentation', { exact: true }).selectOption(presentation)
  await page.getByRole('button', { name: 'Save layout', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit layout', exact: true })).toBeVisible()
}
function seed(
  api: Awaited<ReturnType<typeof mockDashboard>>,
  scope = 'personal',
  presentation: 'inline' | 'launcher' = 'inline',
) {
  api.layouts.set(scope, {
    version: 1,
    widgets: [
      {
        id: 'quick-form',
        type: 'form',
        title: 'Quick safety check',
        text: '',
        span: 12,
        form: { templateId: 'audit-e2e', version: 1, presentation },
      },
    ],
  })
}

test('palette saves both presentations; switching retains the same pinned record without duplicate drafts', async ({
  page,
}) => {
  const dashboard = await mockDashboard(page)
  dashboard.layouts.set('personal', { version: 0, widgets: [] })
  const server = await setupFormServer(page, {
    definition: smallForm,
    initialPath: '/dashboards/personal',
  })
  await addForm(page, 'launcher')
  expect(server.created).toBe(0)
  expect(dashboard.layouts.get('personal')!.widgets[0]!.form).toEqual({
    templateId: 'audit-e2e',
    version: 1,
    presentation: 'launcher',
  })
  server.issueNextVersion({ ...smallForm, title: 'Later version title' })
  await page.getByRole('link', { name: 'Open full-page form', exact: true }).click()
  await expect(page).toHaveURL(/version=1/)
  await page.getByRole('button', { name: 'Start draft', exact: true }).dblclick()
  await page.getByLabel('Job name', { exact: false }).fill('Launcher draft')
  await page.getByRole('button', { name: 'Return to dashboard', exact: true }).click()
  expect(server.created).toBe(1)
  expect([...server.records.values()][0]!.answers.job).toBe('Launcher draft')
  await page.getByRole('button', { name: 'Edit layout', exact: true }).click()
  await page.getByLabel('Widget 1 presentation', { exact: true }).selectOption('inline')
  await page.getByRole('button', { name: 'Save layout', exact: true }).click()
  await expect(page.getByLabel('Job name', { exact: false })).toHaveValue('Launcher draft')
  await expect(
    page.getByRole('heading', { name: 'Quick safety check · version 1', exact: true }),
  ).toBeVisible()
  await page.getByLabel('Job name', { exact: false }).fill('Inline revision')
  await page.getByRole('button', { name: 'Open full-page form', exact: true }).click()
  await expect(page).toHaveURL(/record=/)
  await expect(page.getByLabel('Job name', { exact: false })).toHaveValue('Inline revision')
  await page.getByRole('button', { name: 'Start draft', exact: true }).dblclick()
  expect(server.created).toBe(1)
  await page.getByLabel('Reviewed', { exact: false }).check()
  await page.getByRole('button', { name: 'Submit form', exact: true }).click()
  await expect(page.getByText('Record status: submitted', { exact: false })).toBeVisible()
  expect([...server.records.values()][0]!.templateVersion).toBe(1)
  await page.getByRole('button', { name: 'Return to dashboard', exact: true }).click()
  await expect(page.getByLabel('Job name', { exact: false })).toHaveValue('Inline revision')
  await expect(page.getByLabel('Job name', { exact: false })).toBeDisabled()
  expect(server.created).toBe(1)
  expect(server.submitted).toBe(1)
})

test('failed navigation save retains inline answers and retries the same save request', async ({
  page,
}) => {
  const dashboard = await mockDashboard(page)
  seed(dashboard)
  const server = await setupFormServer(page, {
    definition: smallForm,
    initialPath: '/dashboards/personal',
    lostSave: true,
  })
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  await page.getByLabel('Job name', { exact: false }).fill('Keep these answers')
  await page.getByRole('button', { name: 'Open full-page form', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(new RegExp('dashboards/personal$'))
  await expect(page.getByLabel('Job name', { exact: false })).toHaveValue('Keep these answers')
  await page.getByRole('button', { name: 'Open full-page form', exact: true }).click()
  await expect(page).toHaveURL(new RegExp('forms/audit-e2e'))
  await expect(page.getByLabel('Job name', { exact: false })).toHaveValue('Keep these answers')
  expect(server.created).toBe(1)
  expect(server.saveRequests[0]).toBe(server.saveRequests[1])
})

test('employee personal selection works; shared role layout and template authoring stay protected', async ({
  page,
}) => {
  const dashboard = await mockDashboard(page, false)
  dashboard.layouts.set('personal', { version: 0, widgets: [] })
  const server = await setupFormServer(page, {
    definition: smallForm,
    initialPath: '/dashboards/personal',
    fixture: createJobDashboardFixture(),
  })
  await addForm(page, 'inline')
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  await page.getByLabel('Job name', { exact: false }).fill('Employee draft')
  await page.getByRole('button', { name: 'Save progress', exact: true }).click()
  seed(dashboard, 'role-foreman')
  await page.goto('/dashboards/role')
  await expect(page.getByRole('button', { name: 'Edit layout', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Job name', { exact: false })).toHaveValue('Employee draft')
  expect(server.created).toBe(1)
  const status = await page.evaluate(async () => {
    const response = await fetch('http://127.0.0.1:5194/dashboardWorkspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: { action: 'save', scope: 'role', role: 'foreman', widgets: [], version: 1 },
      }),
    })
    return response.status
  })
  expect(status).toBe(403)
  await page.goto('/admin/forms')
  await expect(page.getByLabel('Form editor', { exact: true })).toHaveCount(0)
})

test('disallowed employee role cannot launch a stored form or add it to their palette', async ({
  page,
}) => {
  const dashboard = await mockDashboard(page, false)
  seed(dashboard)
  const fixture = createJobsFixture()
  fixture.auth.profile.role = 'payroll'
  const server = await setupFormServer(page, {
    definition: smallForm,
    initialPath: '/dashboards/personal',
    fixture,
  })
  await expect(page.getByRole('alert')).toContainText('cannot use this form workflow')
  await expect(page.getByRole('button', { name: 'Start draft', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Edit layout', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Add Form', exact: true })).toHaveCount(0)
  expect(server.created).toBe(0)
})

for (const width of [390, 768])
  test(
    'inline keyboard validation and retry-safe submission at ' + width + 'px',
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      const dashboard = await mockDashboard(page)
      seed(dashboard)
      const server = await setupFormServer(page, {
        definition: smallForm,
        initialPath: '/dashboards/personal',
        lostSubmit: true,
      })
      await page.getByRole('button', { name: 'Start draft', exact: true }).click()
      await page.getByRole('button', { name: 'Submit form', exact: true }).click()
      await expect(page.getByRole('alert')).toContainText('Job name is required')
      await expect(page.getByLabel('Job name', { exact: false })).toBeFocused()
      await page.getByLabel('Job name', { exact: false }).fill('Keyboard mobile draft')
      await page.getByLabel('Reviewed', { exact: false }).focus()
      await page.keyboard.press('Space')
      await page.getByRole('button', { name: 'Submit form', exact: true }).click()
      await expect(
        page.getByRole('button', { name: 'Retry submission confirmation', exact: true }),
      ).toBeVisible()
      await page.getByRole('button', { name: 'Retry submission confirmation', exact: true }).click()
      await expect(page.getByLabel('Job name', { exact: false })).toBeDisabled()
      expect(server.created).toBe(1)
      expect(server.submitted).toBe(1)
      expect(server.submitRequests.at(-2)).toBe(server.submitRequests.at(-1))
      const pane = page.locator('.dashboard-scroll')
      expect(await pane.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
      await page
        .locator('[aria-label="Dashboard form"]')
        .screenshot({ path: test.info().outputPath('inline-form.png') })
    },
  )

test('layout reload and presentation edits save dirty inline progress before changing the view', async ({
  page,
}) => {
  const dashboard = await mockDashboard(page)
  seed(dashboard)
  const server = await setupFormServer(page, {
    definition: smallForm,
    initialPath: '/dashboards/personal',
  })
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  await page.getByLabel('Job name', { exact: false }).fill('Before layout reload')
  await page.getByRole('button', { name: 'Reload layout', exact: true }).click()
  await expect
    .poll(() => dashboard.requests.filter((item) => item.action === 'load').length)
    .toBe(2)
  await expect(page.getByRole('button', { name: 'Edit layout', exact: true })).toBeEnabled()
  await expect(page.getByLabel('Job name', { exact: false })).toHaveValue('Before layout reload')
  expect([...server.records.values()][0]!.answers.job).toBe('Before layout reload')
  await page.getByLabel('Job name', { exact: false }).fill('Before mode edit')
  await page.getByRole('button', { name: 'Edit layout', exact: true }).click()
  await page.getByLabel('Widget 1 presentation', { exact: true }).selectOption('launcher')
  await page.getByRole('button', { name: 'Save layout', exact: true }).click()
  await page.getByRole('link', { name: 'Open full-page form', exact: true }).click()
  await expect(page.getByLabel('Job name', { exact: false })).toHaveValue('Before mode edit')
  expect(server.created).toBe(1)
})

test('an explicitly pinned full-page link rejects a record from another template version', async ({
  page,
}) => {
  const server = await setupFormServer(page, { definition: smallForm })
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  await page.getByLabel('Job name', { exact: false }).fill('Version one answers')
  await page.getByRole('button', { name: 'Save progress', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Progress saved')
  const id = [...server.records.keys()][0]!
  server.issueNextVersion({ ...smallForm, title: 'Version two' })
  await page.goto('/forms/audit-e2e?version=2&record=' + id)
  await expect(page.getByRole('alert')).toContainText('does not match the selected form version')
  await expect(page.getByLabel('Job name', { exact: false })).toHaveCount(0)
  expect(server.created).toBe(1)
  expect([...server.records.values()][0]!.answers.job).toBe('Version one answers')
})
