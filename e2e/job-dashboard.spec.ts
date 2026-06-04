import { expect, test } from '@playwright/test'

test.describe('job dashboard navigation', () => {
  test('job dashboard launches each E2E module successfully', async ({ page }) => {
    await page.goto('/__e2e/job-dashboard')

    await expect(page.getByTestId('e2e-job-dashboard-page')).toBeVisible()
    await expect(page.getByTestId('job-dashboard-module-timecards')).toBeVisible()
    await expect(page.getByTestId('job-dashboard-module-daily-log-draft')).toBeVisible()
    await expect(page.getByTestId('job-dashboard-module-daily-log-typing')).toBeVisible()

    await page.getByTestId('job-dashboard-module-timecards').click()
    await expect(page).toHaveURL(/\/__e2e\/timecard-workbook$/)
    await expect(page.getByTestId('e2e-timecard-page')).toBeVisible()

    await page.goto('/__e2e/job-dashboard')
    await page.getByTestId('job-dashboard-module-daily-log-draft').click()
    await expect(page).toHaveURL(/\/__e2e\/daily-log-draft$/)
    await expect(page.getByTestId('e2e-daily-log-page')).toBeVisible()

    await page.goto('/__e2e/job-dashboard')
    await page.getByTestId('job-dashboard-module-daily-log-typing').click()
    await expect(page).toHaveURL(/\/__e2e\/daily-log-typing$/)
    await expect(page.getByTestId('e2e-dailylog-page')).toBeVisible()
  })
})
