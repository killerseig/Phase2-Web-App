import { expect, test } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { mockDashboard } from './helpers/dashboardFixture.js'

test('Admin creates and publishes private drafts without a dashboard widget', async ({ page }) => {
  const api = await mockDashboard(page, true)
  await gotoPhase2App(page, '/login?redirect=/admin/announcements', createJobsFixture())
  await expect(page).toHaveURL(/\/admin\/announcements$/)
  await expect(
    page
      .locator('.app-shell__sidebar-admin')
      .getByRole('link', { name: 'Announcements', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Edit announcement drafts' }).click()
  await page.getByRole('button', { name: 'Add announcement draft' }).click()
  await page.getByLabel('Draft title 1', { exact: true }).fill('Site access')
  await page.getByLabel('Draft message 1', { exact: true }).fill('Use the north entrance.')
  await page.getByRole('combobox', { name: 'Audience 1', exact: true }).selectOption('job')
  await page
    .getByRole('combobox', { name: 'Announcement job 1', exact: true })
    .selectOption('job-1')
  api.failAnnouncementSave()
  await page.getByRole('button', { name: 'Save announcement drafts' }).click()
  await expect(page.getByRole('alert')).toContainText('changed elsewhere')
  await expect(page.getByLabel('Draft title 1', { exact: true })).toHaveValue('Site access')
  await page.getByRole('button', { name: 'Save announcement drafts' }).click()
  await page.getByRole('button', { name: 'Publish Site access', exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: 'Publish announcement?' })
  await expect(confirmation).toContainText('Acoustical Remodel')
  await confirmation.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByText('Announcement published.', { exact: true })).toBeVisible()
  expect(
    api.requests.some((request) => request.action === 'save-template' || request.action === 'load'),
  ).toBe(false)
  expect(api.announcements).toHaveLength(1)
  await page.getByRole('button', { name: 'Edit announcement drafts' }).click()
  await page.getByLabel('Draft title 1', { exact: true }).fill('Unsaved change')
  await page.getByRole('link', { name: 'Jobs', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Discard unsaved announcement edits?' })
    .getByRole('button', { name: 'Cancel', exact: true })
    .click()
  await expect(page.getByLabel('Draft title 1', { exact: true })).toHaveValue('Unsaved change')
  await page.screenshot({ path: test.info().outputPath('admin-announcements.png') })
})

for (const role of ['foreman', 'employee', 'payroll'] as const)
  test(`${role} cannot open announcement administration`, async ({ page }) => {
    const api = await mockDashboard(page, false)
    const fixture = createJobsFixture()
    fixture.auth.profile.role = role
    await gotoPhase2App(page, '/admin/announcements', fixture)
    await expect(page).toHaveURL(role === 'employee' ? /\/dashboards\/announcements$/ : /\/jobs$/)
    await expect(page.getByRole('link', { name: 'Announcements', exact: true })).toHaveCount(0)
    expect(api.requests.some((request) => request.action === 'load-announcement-drafts')).toBe(
      false,
    )
  })

for (const width of [1280, 390])
  test(`entry modal supports keyboard dismissal and job re-entry at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const api = await mockDashboard(page, true)
    api.announcements.push({
      id: 'update',
      title: 'Company update',
      body: '<b>Plain text</b>\n' + 'Update details. '.repeat(220),
      audience: 'everyone',
      publishedAt: 3,
    })
    await gotoPhase2App(page, '/login', createJobsFixture())
    const modal = page.getByRole('dialog', { name: 'Announcements for you' })
    await expect(modal).toBeVisible()
    await expect(modal.getByRole('heading', { name: 'Announcements for you' })).toBeFocused()
    await expect(modal.getByRole('heading', { name: 'Company update' })).toBeVisible()
    await expect(modal.locator('b')).toHaveCount(0)
    expect((await modal.boundingBox())!.height).toBeLessThanOrEqual(868)
    await modal.getByRole('button', { name: 'Continue', exact: true }).focus()
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true)
    await page.screenshot({ path: test.info().outputPath(`announcement-modal-${width}.png`) })
    await page.keyboard.press('Escape')
    await expect(modal).toBeHidden()
    await page.getByTestId('job-card-1A').click()
    await expect(modal).toBeVisible()
    expect(
      api.requests
        .filter((request) => request.action === 'list-announcements')
        .map((request) => request.scope),
    ).toEqual(['personal', 'job'])
    await modal.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(modal).toBeHidden()
  })
