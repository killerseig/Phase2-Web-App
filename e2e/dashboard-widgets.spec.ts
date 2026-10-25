import { expect, test, type Page } from './helpers/test.js'
import {
  createJobsFixture,
  createJobDashboardFixture,
  gotoPhase2App,
} from './helpers/phase2AppFixture.js'
import { mockDashboard } from './helpers/dashboardFixture.js'

async function emptyDocuments(page: Page) {
  await page.route('**/sdsWorkspace', async (route) => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return }
    await route.fulfill({
      json: {
        result: {
          version: 0,
          folders: [],
          sheets: [],
          binder: { version: 0, selections: [] },
          resources: [],
        },
      },
      headers,
    })
  })
}

test('Admin reuses the shared editor for a role layout, drag placement and responsive viewing', async ({ page }) => {
  const api = await mockDashboard(page)
  await emptyDocuments(page)
  await gotoPhase2App(page, '/dashboards/role', createJobsFixture())
  await expect(page.getByRole('navigation', { name: 'Library categories' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Root folder', exact: true })).toBeVisible()
  expect(await page.locator('.shared-library-widget').evaluate(element => element.getBoundingClientRect().height)).toBeLessThanOrEqual(640)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByLabel('Shared layout for', { exact: true }).selectOption('foreman')
  await page.getByRole('button', { name: 'Add Notes', exact: true }).click()
  await page.getByLabel('Title', { exact: true }).fill('Field reminders')
  const source = page.getByRole('button', { name: 'Add Text', exact: true })
  const start = (await source.boundingBox())!
  const destination = (await page.locator('.shared-dashboard-widget').first().boundingBox())!
  await page.mouse.move(start.x + 10, start.y + 10)
  await page.mouse.down()
  await page.mouse.move(destination.x + 30, destination.y + 10, { steps: 15 })
  await expect(page.locator('.shared-drag-ghost')).toBeVisible()
  await page.mouse.up()
  await expect(page.locator('.shared-dashboard-widget')).toHaveCount(3)
  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(page.locator('.shared-dashboard > [role="status"]')).toHaveText('Template saved for everyone in this role.')
  expect(api.layouts.get('role-foreman')!.widgets.some(widget => widget.type === 'text')).toBe(true)
  expect(api.layouts.has('personal')).toBe(false)
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Field reminders', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  const widgets = page.locator('.shared-dashboard-widget')
  expect((await widgets.nth(1).boundingBox())!.y).toBeGreaterThan((await widgets.first().boundingBox())!.y)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('Foreman owns the personal editor while role editing stays protected; failures and cancelled discard retain work', async ({ page }) => {
  const api = await mockDashboard(page, false)
  await emptyDocuments(page)
  await gotoPhase2App(page, '/dashboards/role', createJobDashboardFixture())
  await expect(page.getByText('Loading dashboard.', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
  await gotoPhase2App(page, '/dashboards/personal', createJobDashboardFixture())
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const switcher = page.getByRole('navigation', { name: 'Builder panels' })
  await switcher.getByRole('button', { name: 'Widgets', exact: true }).click()
  await page.getByRole('button', { name: 'Add Notes', exact: true }).click()
  await expect(switcher.getByRole('button', { name: 'Editor', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Title', { exact: true }).fill('Keep my private draft')
  api.failSave()
  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(page.locator('.shared-dashboard > [role="alert"]')).toContainText('changed elsewhere')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Keep my private draft')
  await page.screenshot({ path: test.info().outputPath('personal-phone-editor.png') })
  await switcher.getByRole('button', { name: 'Editor', exact: true }).focus()
  await page.keyboard.press('Home')
  await expect(switcher.getByRole('button', { name: 'Widgets', exact: true })).toBeFocused()
  await expect(page.getByRole('complementary', { name: 'Dashboard library' })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Widget settings' })).toBeHidden()
  await page.getByRole('button', { name: 'Cancel edits', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expect(page.locator('.shared-dashboard-widget')).toHaveCount(1)
  expect(api.requests.filter(request => request.scope === 'personal').every(request => !('ownerId' in request) && !('uid' in request) && !('role' in request))).toBe(true)
})
