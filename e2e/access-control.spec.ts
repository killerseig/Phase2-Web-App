import { expect, test } from '@playwright/test'
import { createJobDashboardFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

test.describe('route access control', () => {
  test('foremen are redirected away from admin-only routes', async ({ page }) => {
    await gotoPhase2App(page, '/users', createJobDashboardFixture())

    await expect(page).toHaveURL(/\/jobs$/)
    await expect(page.getByTestId('job-card-1A')).toBeVisible()
  })

  test('foremen are redirected away from jobs they are not assigned to', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-blocked/daily-logs', createJobDashboardFixture())

    await expect(page).toHaveURL(/\/jobs$/)
    await expect(page.getByTestId('job-card-1A')).toBeVisible()
    await expect(page.getByTestId('daily-logs-page')).toHaveCount(0)
  })
})
