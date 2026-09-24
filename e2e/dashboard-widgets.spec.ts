import { expect, test, type Page } from './helpers/test.js'
import {
  createJobsFixture,
  createJobDashboardFixture,
  gotoPhase2App,
} from './helpers/phase2AppFixture.js'
import { mockDashboard } from './helpers/dashboardFixture.js'

async function emptyDocuments(page: Page) {
  await page.route('**/sdsWorkspace', (route) =>
    route.fulfill({
      json: {
        result: {
          version: 0,
          folders: [],
          sheets: [],
          binder: { version: 0, selections: [] },
          resources: [],
        },
      },
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
    }),
  )
}

test('admin builds a shared role layout with draggable widgets and saves it independently', async ({
  page,
}) => {
  const api = await mockDashboard(page)
  await emptyDocuments(page)
  await gotoPhase2App(page, '/dashboards/role', createJobsFixture())
  await page.getByLabel('Shared layout for', { exact: true }).selectOption('foreman')
  await page.getByRole('button', { name: 'Edit layout', exact: true }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Remove widget 1', exact: true }).click()
  await page.getByRole('button', { name: 'Add Notes', exact: true }).click()
  await page.getByLabel('Widget 1 title', { exact: true }).fill('Field reminders')
  await page
    .getByLabel('Widget 1 notes', { exact: true })
    .fill('Review the job documents before starting work.')
  const source = page.getByRole('button', { name: 'Add Quick links', exact: true })
  const start = (await source.boundingBox())!
  const destination = (await page.locator('.dashboard-widget').boundingBox())!
  await page.mouse.move(start.x + 10, start.y + 10)
  await page.mouse.down()
  await page.mouse.move(destination.x + 30, destination.y + 10, { steps: 15 })
  await expect(page.locator('.dashboard-drag-ghost')).toBeVisible()
  await page.mouse.up()
  await expect(page.locator('.dashboard-widget')).toHaveCount(2)
  await expect(page.locator('.dashboard-widget').first()).toContainText('Quick links')
  await page.getByRole('button', { name: 'Save layout', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Shared role layout saved.')
  expect(api.layouts.get('role-foreman')!.widgets.map((widget) => widget.type)).toEqual([
    'shortcuts',
    'notes',
  ])
  expect(api.layouts.has('personal')).toBe(false)
  await page.getByRole('button', { name: 'Reload layout', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Field reminders', exact: true })).toBeVisible()
  await page.getByLabel('Shared layout for', { exact: true }).selectOption('admin')
  await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Field reminders', exact: true })).toHaveCount(0)
  await page.getByLabel('Shared layout for', { exact: true }).selectOption('foreman')
  await expect(page.getByRole('heading', { name: 'Field reminders', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  const widgets = page.locator('.dashboard-widget')
  expect((await widgets.nth(1).boundingBox())!.y).toBeGreaterThan(
    (await widgets.first().boundingBox())!.y,
  )
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})

test('foremen can edit personal layouts but shared layouts are read only; failed saves retain edits', async ({
  page,
}) => {
  const api = await mockDashboard(page, false)
  await emptyDocuments(page)
  await gotoPhase2App(page, '/dashboards/role', createJobDashboardFixture())
  await expect(page.getByText('Loading layout…', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit layout', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Shared layout for', { exact: true })).toHaveCount(0)
  await gotoPhase2App(page, '/dashboards/personal', createJobDashboardFixture())
  await page.getByRole('button', { name: 'Edit layout', exact: true }).click()
  await page.getByRole('button', { name: 'Add Notes', exact: true }).click()
  await page.getByLabel('Widget 2 notes', { exact: true }).fill('Keep my private draft')
  api.failSave()
  await page.getByRole('button', { name: 'Save layout', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('changed elsewhere')
  await expect(page.getByLabel('Widget 2 notes', { exact: true })).toHaveValue(
    'Keep my private draft',
  )
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Reload layout', exact: true }).click()
  await expect(page.getByLabel('Widget 2 notes', { exact: true })).toHaveValue(
    'Keep my private draft',
  )
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Cancel layout edits', exact: true }).click()
  await expect(page.locator('.dashboard-widget')).toHaveCount(1)
})
