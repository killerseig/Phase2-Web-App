import { expect, test, type Page } from './helpers/test.js'
import { createJobDashboardFixture, createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { mockDashboard } from './helpers/dashboardFixture.js'

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:5196'
    ? route.continue() : route.abort('blockedbyclient'))
})

async function prepare(page: Page, role = 'admin') {
  const fixture = role === 'admin' ? createJobsFixture() : createJobDashboardFixture()
  fixture.auth.profile.role = role
  const job = fixture.jobs[0]!
  const api = await mockDashboard(page, role === 'admin', job)
  api.layouts.set('personal', { version: 0, widgets: [] })
  api.layouts.set(`role-${role}`, { version: 0, widgets: [{ id: 'jobs', type: 'jobs', span: 12, title: 'Assigned jobs', text: '' }] })
  api.layouts.set('all-jobs', { version: 0, widgets: [{ id: 'tools', type: 'workflows', span: 12, title: 'Job tools', text: '' }] })
  return { fixture, job, api }
}

async function navigation(page: Page) {
  const open = page.getByRole('button', { name: 'Open navigation', exact: true })
  if (await open.isVisible()) {
    await open.click()
    await expect(page.getByRole('dialog', { name: 'Navigation', exact: true })).toBeVisible()
    await expect.poll(async () => Math.abs((await page.locator('.app-shell__sidebar').boundingBox())?.x ?? Infinity)).toBeLessThan(1)
  }
  return page.locator('.app-shell__sidebar')
}

for (const role of ['admin', 'project-manager', 'foreman', 'shop-foreman']) {
  test(`${role} reaches each existing dashboard through normal navigation`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const { fixture, job, api } = await prepare(page, role)
    await gotoPhase2App(page, '/jobs', fixture)
    const nav = await navigation(page)
    await nav.getByRole('link', { name: 'Personal dashboard', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Personal dashboard', exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Dashboard content' })).toHaveAttribute('aria-busy', 'false')
    await nav.getByRole('link', { name: 'Role dashboard', exact: true }).click()
    await expect(page).toHaveURL(/\/dashboards\/role$/)
    await expect(page.getByRole('region', { name: 'Dashboard content' })).toHaveAttribute('aria-busy', 'false')
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(role === 'admin' ? 1 : 0)
    await nav.getByRole('link', { name: 'Job dashboards', exact: true }).click()
    await expect(page.getByLabel('Choose job', { exact: true })).toBeVisible()
    await page.getByLabel('Choose job', { exact: true }).selectOption(job.id)
    await expect(page).toHaveURL(new RegExp(`/dashboards/job-home/${job.id}(?:\\?|$)`))
    await expect(page.getByRole('region', { name: 'Dashboard content' })).toHaveAttribute('aria-busy', 'false')
    await page.getByRole('link', { name: 'Existing job page', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/jobs/${job.id}$`))
    expect(api.requests.filter(request => request.action === 'load').map(request => request.scope)).toEqual(expect.arrayContaining(['personal', 'role', 'job']))
    expect(api.requests.some(request => String(request.action).startsWith('save'))).toBe(false)
  })
}

test('Payroll reaches Personal and Role dashboards while retaining Jobs and export access', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const { fixture } = await prepare(page, 'payroll')
  fixture.auth.profile.assignedJobIds = []
  await gotoPhase2App(page, '/jobs', fixture)
  const nav = await navigation(page)
  await expect(nav.getByRole('link', { name: 'Job dashboards', exact: true })).toHaveCount(0)
  await expect(nav.getByRole('link', { name: 'Jobs', exact: true })).toHaveAttribute('href', '/jobs')
  await expect(nav.getByRole('link', { name: 'Timecard Export', exact: true })).toHaveAttribute('href', '/exports/timecards')
  await nav.getByRole('link', { name: 'Personal dashboard', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Personal dashboard', exact: true })).toBeVisible()
  await nav.getByRole('link', { name: 'Role dashboard', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Payroll home', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Dashboard content' })).toHaveAttribute('aria-busy', 'false')
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
})

for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 844, height: 390 }]) {
  test(`mobile navigation keeps focus and all destinations reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const { fixture } = await prepare(page)
    await gotoPhase2App(page, '/jobs', fixture)
    const open = page.getByRole('button', { name: 'Open navigation', exact: true })
    await expect(open).toBeVisible()
    await expect(page.locator('.app-shell__sidebar')).toHaveAttribute('inert', '')
    await open.focus()
    await page.keyboard.press('Enter')
    const drawer = page.getByRole('dialog', { name: 'Navigation', exact: true })
    const close = drawer.getByRole('button', { name: 'Close navigation', exact: true })
    await expect(close).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(drawer.getByRole('button', { name: 'Sign Out', exact: true })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(close).toBeFocused()
    await drawer.getByRole('link', { name: 'Shop Catalog', exact: true }).focus()
    await expect(drawer.getByRole('link', { name: 'Shop Catalog', exact: true })).toBeInViewport()
    await page.keyboard.press('Escape')
    await expect(drawer).toHaveCount(0)
    await expect(open).toBeFocused()
    await open.press('Enter')
    await drawer.getByRole('link', { name: 'Personal dashboard', exact: true }).click()
    await expect(page).toHaveURL(/\/dashboards\/personal$/)
    await expect(page.getByRole('heading', { name: 'Personal dashboard', exact: true })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Navigation', exact: true })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Dashboard content' })).toHaveAttribute('aria-busy', 'false')
    await navigation(page)
    await expect(page.locator('.app-shell__sidebar a[href="/dashboards/personal"]')).toHaveAttribute('aria-current', 'page')
    await page.screenshot({ path: test.info().outputPath(`dashboard-navigation-${viewport.width}.png`) })
    await page.keyboard.press('Escape')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}

test('old role bookmarks and login returns keep their destination, query and fragment', async ({ page }) => {
  const { fixture } = await prepare(page)
  await gotoPhase2App(page, '/login?redirect=' + encodeURIComponent('/dashboards/role-home?source=bookmark#notes'), fixture)
  await expect(page).toHaveURL(/\/dashboards\/role\?source=bookmark#notes$/)
  await expect(page.locator('.app-shell__sidebar a[href="/dashboards/role"]')).toHaveAttribute('aria-current', 'page')
})

for (const width of [390, 820, 1440]) test(`Employee remains announcements-only and My Timecard stays paused at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  const { fixture, api } = await prepare(page, 'employee')
  await gotoPhase2App(page, '/dashboards/personal', fixture)
  await expect(page).toHaveURL(/\/dashboards\/announcements$/)
  await expect(page.locator('.app-shell__nav a')).toHaveCount(1)
  await expect(page.locator('.app-shell__nav a')).toHaveAttribute('href', '/dashboards/announcements')
  await expect(page.getByRole('heading', { name: 'Announcements', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: test.info().outputPath(`employee-updates-${width}.png`) })
  for (const path of ['/dashboards/role-home', '/dashboards/job-home', '/dashboards/job-home/job-e2e']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/dashboards\/announcements$/)
  }
  expect(api.requests.some(request => request.action === 'load')).toBe(false)
  await page.goto('/jobs/my-timecard')
  await expect(page.getByText('My Timecard is temporarily unavailable', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: test.info().outputPath(`employee-timecard-paused-${width}.png`) })
})

test('dashboard navigation does not grant access to an unassigned job', async ({ page }) => {
  const { fixture, api } = await prepare(page, 'foreman')
  await gotoPhase2App(page, '/dashboards/job-home/not-assigned', fixture)
  await expect(page).toHaveURL(/\/jobs$/)
  expect(api.requests.some(request => request.action === 'load' && request.jobId === 'not-assigned')).toBe(false)
})
