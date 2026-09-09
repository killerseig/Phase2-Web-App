import { expect, test } from './helpers/test.js'
import {
  createAdminWorkspaceFixture,
  createDailyLogsFixture,
  createJobDashboardFixture,
  createShopOrdersFixture,
  createTimecardsFixture,
  gotoPhase2App,
} from './helpers/phase2AppFixture.js'

const viewports = [
  { label: 'desktop', width: 1600, backContainer: '.app-shell__navigation-heading' },
  { label: 'compact laptop', width: 1280, backContainer: '.app-shell__topbar-leading' },
  { label: 'phone', width: 390, backContainer: '.app-shell__topbar-leading' },
] as const

test.describe('job dashboard navigation', () => {
  for (const viewport of viewports) {
    test(`job modules return to the current job on ${viewport.label}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: 900 })
      await gotoPhase2App(page, '/jobs/job-e2e', createJobDashboardFixture())
      await expect(page.getByTestId('job-dashboard-page')).toBeVisible()
      await expect(page.getByRole('link', { name: 'Back to Job' })).toHaveCount(0)

      for (const module of ['timecards', 'daily-logs', 'shop-orders']) {
        await page.getByTestId(`job-dashboard-module-${module}`).click()
        await expect(page).toHaveURL(new RegExp(`/jobs/job-e2e/${module}$`))

        const backLink = page.getByRole('link', { name: 'Back to Job' })
        await expect(backLink).toHaveCount(1)
        await expect(backLink).toBeInViewport()
        await expect(backLink).toHaveAttribute('href', '/jobs/job-e2e')
        await expect(backLink).toHaveAttribute('title', 'Back to Job')
        await expect(page.locator(viewport.backContainer).getByRole('link', { name: 'Back to Job' })).toBeVisible()

        await backLink.click()
        await expect(page).toHaveURL(/\/jobs\/job-e2e$/)
        await expect(page.getByTestId('job-dashboard-page')).toBeVisible()
        await expect(page.getByRole('link', { name: 'Back to Job' })).toHaveCount(0)
      }
    })
  }

  test('Back to Job works from a direct module link for another job using the keyboard', async ({ page }) => {
    const fixture = createJobDashboardFixture()
    fixture.jobs[0]!.id = 'job-from-link'
    fixture.auth.profile.assignedJobIds = ['job-from-link']
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoPhase2App(page, '/jobs/job-from-link/daily-logs', fixture)

    const backLink = page.getByRole('link', { name: 'Back to Job' })
    await expect(backLink).toHaveAttribute('href', '/jobs/job-from-link')
    await backLink.focus()
    await expect(backLink).toBeFocused()
    await backLink.press('Enter')
    await expect(page).toHaveURL(/\/jobs\/job-from-link$/)
    await expect(page.getByTestId('job-dashboard-page')).toBeVisible()
    await page.getByTestId('job-dashboard-module-shop-orders').click()
    await expect(page).toHaveURL(/\/jobs\/job-from-link\/shop-orders$/)
  })

  test('pages outside a job module do not show Back to Job', async ({ page }) => {
    await gotoPhase2App(page, '/jobs', createAdminWorkspaceFixture())
    for (const route of ['/jobs', '/dashboard', '/exports/timecards', '/users']) {
      await page.goto(route)
      await expect(page.locator('.app-shell')).toBeVisible()
      await expect(page.locator('.app-shell__back-to-job')).toHaveCount(0)
    }
  })

  test('a recent timecard edit is retained after Back to Job', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 })
    await gotoPhase2App(page, '/jobs/job-e2e/timecards', createTimecardsFixture({ seededCard: true }))
    const week = page.getByTestId('timecards-week-ending')
    await week.fill('2026-06-06')
    await week.dispatchEvent('change')
    const mondayHours = page.locator('.timecard-grid__body-row--hours .timecard-grid__day-cell input').first()
    await mondayHours.fill('8')
    await page.getByRole('link', { name: 'Back to Job' }).click()
    await expect(page.getByTestId('job-dashboard-page')).toBeVisible()

    await page.getByTestId('job-dashboard-module-timecards').click()
    await week.fill('2026-06-06')
    await week.dispatchEvent('change')
    await expect(mondayHours).toHaveValue('8.00')
    await expect(page.getByTestId('timecard-total-hours')).toHaveText('8.0')
  })

  test('recent shop order comments are retained after Back to Job', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 })
    await gotoPhase2App(page, '/jobs/job-e2e/shop-orders', createShopOrdersFixture())
    const comments = page.getByTestId('shoporder-comments')
    await comments.fill('Deliver at the south gate')
    await page.getByRole('link', { name: 'Back to Job' }).click()
    await expect(page.getByTestId('job-dashboard-page')).toBeVisible()
    await page.getByTestId('job-dashboard-module-shop-orders').click()
    await expect(comments).toHaveValue('Deliver at the south gate')
  })

  test('a daily log field is retained after Back to Job', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 })
    await gotoPhase2App(page, '/jobs/job-e2e/daily-logs', createDailyLogsFixture())
    const schedule = page.getByTestId('dailylog-weeklySchedule')
    await schedule.fill('Complete framing on Thursday')
    await page.getByRole('link', { name: 'Back to Job' }).click()
    await expect(page.getByTestId('job-dashboard-page')).toBeVisible()
    await page.getByTestId('job-dashboard-module-daily-logs').click()
    await expect(schedule).toHaveValue('Complete framing on Thursday')
  })
})
