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

async function showWidgetPalette(page: Page) {
  const panels = page.getByRole('navigation', { name: 'Builder panels' })
  if (await panels.isVisible()) {
    const button = panels.getByRole('button', { name: 'Widgets', exact: true })
    await button.click()
    await page.mouse.move(0, 0)
    const background = await panels.evaluate(element => {
      const sample = document.createElement('span')
      sample.style.backgroundColor = 'var(--editor-selected)'
      element.append(sample)
      const value = getComputedStyle(sample).backgroundColor
      sample.remove()
      return value
    })
    await expect(button).toHaveCSS('background-color', background)
  }
}
async function showDashboardCanvas(page: Page) {
  const panels = page.getByRole('navigation', { name: 'Builder panels' })
  if (await panels.isVisible()) await panels.getByRole('button', { name: 'Canvas', exact: true }).click()
}

for (const width of [1280, 390]) test(`grouped widget editing and recovery at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  const api = await mockDashboard(page)
  await emptyDocuments(page)
  api.layouts.set('role-admin', { version: 1, widgets: [
    { id: 'jobs', type: 'jobs', title: 'Jobs', text: '', span: 12 },
    { id: 'text', type: 'text', title: 'Welcome', text: 'Original message', span: 6 },
    { id: 'notes', type: 'notes', title: 'Notes', text: '', span: 6 },
  ] })
  await gotoPhase2App(page, '/dashboards/role', createJobsFixture())
  await expect(page.getByRole('button', { name: 'Edit Welcome', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await showWidgetPalette(page)
  await expect(page.getByRole('region', { name: 'Work tools', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Files & resources', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Content & planning', exact: true })).toBeVisible()
  await page.screenshot({ path: test.info().outputPath(`grouped-picker-${width}.png`) })
  await expect(page.getByRole('button', { name: 'Add Assigned jobs', exact: true })).toBeDisabled()
  await page.getByLabel('Find a widget', { exact: true }).fill('not-a-widget')
  await expect(page.getByText('No widgets match your search.', { exact: true })).toBeVisible()
  await page.getByLabel('Find a widget', { exact: true }).fill('variables')
  await expect(page.getByRole('button', { name: 'Add Text', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Notes', exact: true })).toHaveCount(0)
  await page.getByLabel('Find a widget', { exact: true }).fill('')
  const list = page.getByRole('group', { name: 'On this dashboard', exact: true })
  await list.getByRole('button', { name: 'Jobs', exact: true }).focus()
  await page.keyboard.press('ArrowDown')
  await expect(list.getByRole('button', { name: 'Welcome', exact: true })).toBeFocused()
  await expect(list.getByRole('button', { name: 'Welcome', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Enter')
  const inspector = page.getByRole('complementary', { name: 'Widget settings', exact: true })
  await expect(inspector.getByRole('heading', { name: 'Widget settings', exact: true })).toBeFocused()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Welcome')
  await page.getByRole('button', { name: 'Duplicate widget', exact: true }).click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Welcome copy')
  await expect(page.getByLabel('Text content', { exact: true })).toHaveValue('Original message')
  await page.getByLabel('Title', { exact: true }).fill('Field message')
  await page.getByRole('button', { name: 'Move up', exact: true }).click()
  await page.getByRole('button', { name: 'Undo template edit', exact: true }).click()
  const order = () => page.locator('.shared-dashboard-widget').evaluateAll(elements => elements.map(element => element.getAttribute('data-widget-id')))
  const beforeMove = await order()
  expect(beforeMove).toHaveLength(4)
  expect(beforeMove.slice(0, 2)).toEqual(['jobs', 'text'])
  await page.getByRole('button', { name: 'Redo template edit', exact: true }).click()
  expect((await order())[1]).not.toBe('text')
  await page.getByRole('button', { name: 'Undo template edit', exact: true }).click()
  expect(await order()).toEqual(beforeMove)
  await page.screenshot({ path: test.info().outputPath(`contextual-editor-${width}.png`) })
  await page.getByRole('button', { name: 'Remove widget', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Field message')
  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  const saved = api.layouts.get('role-admin')!.widgets
  expect(new Set(saved.map(widget => widget.id)).size).toBe(4)
  expect(saved.map(widget => widget.title)).toEqual(['Jobs', 'Welcome', 'Field message', 'Notes'])
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Field message', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await showDashboardCanvas(page)
  await page.getByRole('button', { name: 'Edit Jobs', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Duplicate widget', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Remove widget', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Move up', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Cancel edits', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await showWidgetPalette(page)
  await page.getByRole('button', { name: 'Add Text', exact: true }).click()
  await page.getByRole('button', { name: 'Cancel edits', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expect(page.locator('.shared-dashboard-widget')).toHaveCount(4)
  await page.screenshot({ path: test.info().outputPath(`grouped-dashboard-${width}.png`) })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('widget limits and removal use the existing undo and discard baseline', async ({ page }) => {
  const api = await mockDashboard(page)
  await emptyDocuments(page)
  api.layouts.set('role-admin', { version: 1, widgets: [
    { id: 'jobs', type: 'jobs', title: 'Jobs', text: '', span: 12 },
    ...Array.from({ length: 11 }, (_, index) => ({ id: `text-${index}`, type: 'text' as const, title: `Message ${index + 1}`, text: 'Test', span: 6 as const })),
  ] })
  await gotoPhase2App(page, '/dashboards/role', createJobsFixture())
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Add Text', exact: true })).toBeDisabled()
  const list = page.getByRole('group', { name: 'On this dashboard', exact: true })
  await list.getByRole('button', { name: 'Jobs', exact: true }).focus()
  await page.keyboard.press('End')
  await expect(list.getByRole('button', { name: 'Message 11', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Duplicate widget', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Move down', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Remove widget', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(page.locator('.shared-dashboard-widget')).toHaveCount(11)
  await expect(page.getByRole('button', { name: 'Add Text', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Undo template edit', exact: true }).click()
  await expect(page.locator('.shared-dashboard-widget')).toHaveCount(12)
  await expect(page.getByRole('button', { name: 'Save template', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Cancel edits', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('duplicating a personal note copies layout settings without copying saved private content', async ({ page }) => {
  const api = await mockDashboard(page, false)
  await emptyDocuments(page)
  api.layouts.set('personal', { version: 1, widgets: [{ id: 'notes', type: 'notes', title: 'Notes', text: '', span: 6 }] })
  await gotoPhase2App(page, '/dashboards/personal', createJobDashboardFixture())
  await page.getByRole('button', { name: 'Edit notes', exact: true }).click()
  await page.getByLabel('Your notes', { exact: true }).fill('Synthetic private note')
  await page.getByRole('button', { name: 'Save notes', exact: true }).click()
  await expect(page.getByText('Synthetic private note', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('button', { name: 'Edit Notes', exact: true }).click()
  await page.getByRole('button', { name: 'Duplicate widget', exact: true }).click()
  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  const copy = api.layouts.get('personal')!.widgets.find(widget => widget.id !== 'notes')!
  await expect(page.locator(`[data-widget-id="${copy.id}"]`)).toContainText('No notes yet.')
  await expect(page.locator('[data-widget-id="notes"]')).toContainText('Synthetic private note')
  expect(api.requests.filter(request => request.scope === 'personal').every(request => !('ownerId' in request) && !('uid' in request) && !('role' in request))).toBe(true)
})

for (const scheme of ['dark', 'light'] as const) for (const width of [1280, 390]) test(`dashboard visual consistency ${scheme} at ${width}px`, async ({ page }) => {
  await page.emulateMedia({ colorScheme: scheme })
  await page.setViewportSize({ width, height: 900 })
  const api = await mockDashboard(page)
  await emptyDocuments(page)
  api.layouts.set('role-admin', { version: 1, widgets: [
    { id: 'jobs', type: 'jobs', title: 'Jobs', text: '', span: 6 },
    { id: 'notes', type: 'notes', title: 'Notes', text: '', span: 6 },
    { id: 'dates', type: 'dates', title: 'Calendar', text: '', span: 6 },
    { id: 'documents', type: 'documents', title: 'Documents', text: '', span: 12 },
  ] })
  await gotoPhase2App(page, '/dashboards/role', createJobsFixture())
  const jobs = page.locator('[data-widget-id="jobs"]')
  await expect(jobs.locator('.shared-job-links article').first()).toBeVisible()
  await page.locator('.shared-dashboard').screenshot({ path: test.info().outputPath(`dashboard-${scheme}-${width}.png`) })
  const expected = await page.locator('.shared-dashboard').evaluate(element => {
    const sample = document.createElement('span')
    sample.style.cssText = 'background:var(--panel-background);color:var(--text);border:1px solid var(--border)'
    element.append(sample)
    const style = getComputedStyle(sample), result = { background: style.backgroundColor, color: style.color }
    sample.remove(); return result
  })
  await expect(jobs).toHaveCSS('background-color', expected.background)
  await expect(jobs).toHaveCSS('color', expected.color)
  await page.getByRole('button', { name: 'Edit notes', exact: true }).click()
  const save = page.getByRole('button', { name: 'Save notes', exact: true })
  await expect(save).toHaveClass(/app-button--primary/)
  await expect(save).toBeDisabled()
  await page.getByLabel('Your notes', { exact: true }).fill('Synthetic visual review')
  await expect(save).toBeEnabled()
  await page.getByRole('button', { name: 'Cancel notes', exact: true }).click()
  await page.getByRole('button', { name: 'Edit calendar', exact: true }).click()
  await page.getByRole('button', { name: 'Add date', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save calendar', exact: true })).toHaveClass(/app-button--primary/)
  await page.getByRole('button', { name: 'Cancel calendar', exact: true }).click()
  const embeddedUpload = page.getByRole('button', { name: 'Upload document', exact: true })
  const background = await embeddedUpload.evaluate(element => getComputedStyle(element).backgroundColor)
  await expect(embeddedUpload).toHaveClass(/app-button--primary/)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save template', exact: true })).toBeDisabled()
  await showWidgetPalette(page)
  await page.getByRole('button', { name: 'Add Text', exact: true }).click()
  await page.getByLabel('Font size (px)', { exact: true }).fill('28')
  await page.getByLabel('Font size (px)', { exact: true }).press('Tab')
  await expect(page.locator('.shared-variable-text')).toHaveCSS('color', expected.color)
  await page.getByRole('button', { name: 'Cancel edits', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Discard changes', exact: true }).click()
  await page.goto('/company-library')
  await expect(page.getByRole('button', { name: 'Upload document', exact: true })).toHaveCSS('background-color', background)
  await page.getByText('More', { exact: true }).click()
  await page.getByRole('button', { name: 'Bulk PDF import', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Validate and preview', exact: true })).toHaveClass(/app-button/)
  await page.locator('.company-library-widget').screenshot({ path: test.info().outputPath(`library-${scheme}-${width}.png`) })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

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
