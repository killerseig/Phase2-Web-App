import { expect, test } from '@playwright/test'
import { createJobDashboardFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

test.describe('job dashboard navigation', () => {
  test('job dashboard launches each real module successfully', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e', createJobDashboardFixture())

    await expect(page.getByTestId('job-dashboard-page')).toBeVisible()
    await expect(page.getByTestId('job-dashboard-module-timecards')).toBeVisible()
    await expect(page.getByTestId('job-dashboard-module-daily-logs')).toBeVisible()
    await expect(page.getByTestId('job-dashboard-module-shop-orders')).toBeVisible()

    await page.getByTestId('job-dashboard-module-timecards').click()
    await expect(page).toHaveURL(/\/jobs\/job-e2e\/timecards$/)
    await expect(page.getByTestId('timecards-page')).toBeVisible()

    await page.goto('/jobs/job-e2e')
    await page.getByTestId('job-dashboard-module-daily-logs').click()
    await expect(page).toHaveURL(/\/jobs\/job-e2e\/daily-logs$/)
    await expect(page.getByTestId('daily-logs-page')).toBeVisible()

    await page.goto('/jobs/job-e2e')
    await page.getByTestId('job-dashboard-module-shop-orders').click()
    await expect(page).toHaveURL(/\/jobs\/job-e2e\/shop-orders$/)
  })
})
