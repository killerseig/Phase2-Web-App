import { expect, test, type Page } from './helpers/test.js'
import type { Locator } from '@playwright/test'
import { createAdminWorkspaceFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { mockDashboard } from './helpers/dashboardFixture.js'

const devices = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 1000 },
] as const
const anonymous = () => ({ ...createAdminWorkspaceFixture(), auth: null })

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
}
async function reachable(control: Locator) {
  await control.scrollIntoViewIfNeeded()
  await expect(control).toBeVisible()
  expect(await control.evaluate(element => {
    const rect = element.getBoundingClientRect()
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    return { width: rect.width >= 24, height: rect.height >= 24, within: rect.left >= -1 && rect.right <= innerWidth + 1, hit: !!hit && (hit === element || element.contains(hit)) }
  })).toEqual({ width: true, height: true, within: true, hit: true })
}
async function screenshot(page: Page, name: string) {
  await noHorizontalOverflow(page)
  await page.screenshot({ path: test.info().outputPath(`${name}.png`) })
}
async function showCatalogInspector(page: Page, width: number) {
  if (width <= 1180) await page.getByRole('tab', { name: 'Inspector', exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  // All remote application requests must use explicit synthetic routes below.
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin === 'http://127.0.0.1:5196' || ['data:', 'blob:'].includes(url.protocol)) return route.continue()
    return route.abort('blockedbyclient')
  })
})

for (const device of devices) test.describe(device.name, () => {
  test.use({ viewport: { width: device.width, height: device.height } })

  test('users directory, editor and confirmation remain reachable', async ({ page }) => {
    await mockDashboard(page)
    await gotoPhase2App(page, '/users', createAdminWorkspaceFixture())
    await reachable(page.getByTestId('users-search'))
    await page.getByTestId('users-search').fill('no-such-synthetic-person')
    await expect(page.getByTestId('users-row-foreman-2')).toHaveCount(0)
    await screenshot(page, 'users-empty-search')
    await page.getByTestId('users-search').fill('sam@example.com')
    await page.getByTestId('users-row-foreman-2').click()
    const firstName = page.getByRole('textbox', { name: 'First Name', exact: true })
    await reachable(firstName)
    await firstName.fill('Responsive Sam'); await firstName.blur()
    await expect.poll(() => page.evaluate(() => (window.__PHASE2_E2E_STATE__ as { users: Array<{ id: string; firstName: string }> }).users.find(user => user.id === 'foreman-2')?.firstName)).toBe('Responsive Sam')
    const opener = page.getByRole('button', { name: 'Delete User', exact: true })
    await reachable(opener); await opener.click()
    const dialog = page.getByRole('dialog', { name: 'Delete user?', exact: true })
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
    await screenshot(page, 'users-confirmation')
    await page.keyboard.press('Escape'); await expect(opener).toBeFocused()
    await screenshot(page, 'users-editor')
  })

  test('employee selection and editing keep the primary form accessible', async ({ page }) => {
    await mockDashboard(page)
    await gotoPhase2App(page, '/employees', createAdminWorkspaceFixture())
    await reachable(page.getByTestId('employees-search'))
    await page.getByTestId('employee-row-employee-1').click()
    const occupation = page.getByLabel('Occupation', { exact: true })
    await reachable(occupation); await occupation.fill('Responsive installer'); await occupation.blur()
    await expect(page.getByText('All changes saved.', { exact: true })).toBeVisible()
    await reachable(page.getByRole('button', { name: 'Delete Employee', exact: true }))
    await screenshot(page, 'employee-editor')
  })

  test('catalog search, item form and menu stay within the viewport', async ({ page }) => {
    await mockDashboard(page)
    await gotoPhase2App(page, '/settings/shop-catalog', createAdminWorkspaceFixture())
    const search = page.getByTestId('shop-catalog-search')
    await reachable(search); await search.fill('wedge')
    await page.getByTestId('shop-catalog-item-catalog-1').click()
    await showCatalogInspector(page, device.width)
    const description = page.getByRole('textbox', { name: 'Description', exact: true })
    await reachable(description); await description.fill('Responsive wedge anchor')
    const save = page.getByRole('button', { name: 'Save Changes', exact: true })
    await reachable(save); await save.click()
    await expect(description).toHaveValue('Responsive wedge anchor')
    await screenshot(page, 'catalog-editor')
  })

  test('catalog context actions support keyboard focus and return to their trigger', async ({ page }) => {
    await mockDashboard(page)
    await gotoPhase2App(page, '/settings/shop-catalog', createAdminWorkspaceFixture())
    await page.getByTestId('shop-catalog-search').fill('wedge')
    const item = page.getByTestId('shop-catalog-item-catalog-1')
    await item.focus()
    await item.press('Shift+F10')
    const menu = page.getByRole('menu', { name: 'Catalog actions', exact: true })
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem').first()).toBeFocused()
    await page.keyboard.press('End')
    await expect(menu.getByRole('menuitem', { name: 'Delete Item', exact: true })).toBeFocused()
    await reachable(menu.getByRole('menuitem', { name: 'Delete Item', exact: true }))
    await page.keyboard.press('Home')
    await page.keyboard.press('ArrowDown')
    await expect(menu.getByRole('menuitem').nth(1)).toBeFocused()
    await screenshot(page, 'catalog-keyboard-menu')
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(item).toBeFocused()
  })

  test('announcement form retains edits after a failed save and cancelled reload', async ({ page }) => {
    const api = await mockDashboard(page)
    await gotoPhase2App(page, '/admin/announcements', createAdminWorkspaceFixture())
    await expect(page.getByText('No announcement drafts yet.', { exact: true })).toBeVisible()
    await reachable(page.getByRole('button', { name: 'Edit announcement drafts', exact: true }))
    await page.getByRole('button', { name: 'Edit announcement drafts', exact: true }).click()
    await page.getByRole('button', { name: 'Add announcement draft', exact: true }).click()
    const title = page.getByLabel('Draft title 1', { exact: true })
    await title.fill('A compact site update')
    await page.getByLabel('Draft message 1', { exact: true }).fill('Synthetic message retained after a failed request.')
    await page.getByRole('combobox', { name: 'Audience 1', exact: true }).selectOption('everyone')
    api.failAnnouncementSave()
    const save = page.getByRole('button', { name: 'Save announcement drafts', exact: true })
    await reachable(save); await save.click()
    await expect(page.getByRole('alert')).toContainText('changed elsewhere')
    await expect(title).toHaveValue('A compact site update')
    await page.getByRole('button', { name: 'Reload drafts', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Discard unsaved announcement edits?', exact: true })
    await reachable(dialog.getByRole('button', { name: 'Cancel', exact: true }))
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(title).toHaveValue('A compact site update')
    await screenshot(page, 'announcements-editing')
    expect(api.announcements).toHaveLength(0)
  })

  test('reference lists honestly show their current availability', async ({ page }) => {
    await mockDashboard(page)
    for (const [key, title] of [['job-types', 'Job Types'], ['gcs', 'GCs'], ['occupations', 'Occupations']]) {
      await gotoPhase2App(page, `/settings/lists/${key}`, createAdminWorkspaceFixture())
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
      await expect(page.getByText('List editing is not available yet.', { exact: true })).toBeVisible()
      await screenshot(page, `reference-${key}`)
    }
  })

  test('login and reset show persistent errors beside their compact forms', async ({ page }) => {
    await gotoPhase2App(page, '/login', anonymous())
    await reachable(page.locator('#login-email')); await reachable(page.locator('#login-password'))
    await page.getByRole('button', { name: 'Login', exact: true }).click()
    await expect(page.locator('.auth-card [role="alert"]')).toContainText('Enter your email and password.')
    await screenshot(page, 'login-validation')
    await page.getByRole('link', { name: 'Forgot Password?', exact: true }).click()
    await reachable(page.getByRole('button', { name: 'Send Reset Link', exact: true }))
    await page.getByRole('button', { name: 'Send Reset Link', exact: true }).click()
    await expect(page.locator('.auth-card [role="alert"]')).toContainText('Enter your email first.')
    await screenshot(page, 'reset-validation')
  })

  test('expired setup and missing pages offer an accessible route back', async ({ page }) => {
    await gotoPhase2App(page, '/set-password', anonymous())
    await expect(page.locator('.auth-card [role="alert"]')).toContainText('Invalid setup link.')
    await reachable(page.getByRole('link', { name: 'Back to login', exact: true }))
    await screenshot(page, 'setup-invalid')
    await page.goto('/this-page/does-not-exist')
    await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible()
    await reachable(page.getByRole('link', { name: 'Back to Jobs', exact: true }))
    await screenshot(page, 'not-found')
  })
})

test('password setup submits by keyboard and keeps mismatched values available', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/verifySetupToken', route => route.fulfill({ headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, json: { result: { email: 'synthetic@example.invalid' } } }))
  await gotoPhase2App(page, '/set-password?uid=synthetic&setupToken=synthetic-token', anonymous())
  await page.getByLabel('New Password', { exact: true }).fill('Synthetic-password-123')
  await page.getByLabel('Confirm Password', { exact: true }).fill('Different-password-123')
  await page.getByLabel('Confirm Password', { exact: true }).press('Enter')
  await expect(page.locator('.auth-card [role="alert"]')).toContainText('Passwords do not match.')
  await expect(page.getByLabel('New Password', { exact: true })).toHaveValue('Synthetic-password-123')
  await reachable(page.getByRole('button', { name: 'Create Password & Login', exact: true }))
  await screenshot(page, 'setup-keyboard-validation')
})
