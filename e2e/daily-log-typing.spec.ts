import { expect, test } from './helpers/test.js'
import { createDailyLogsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

test.describe('daily log typing regressions', () => {
  test('draft log autosaves after typing and reflects the latest text', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e/daily-logs', createDailyLogsFixture())

    const weeklySchedule = page.getByTestId('dailylog-weeklySchedule')
    const details = 'Update schedule with crew A, crew B, and crew C.'

    await expect(weeklySchedule).toBeVisible()
    await weeklySchedule.fill(details)
    await expect(weeklySchedule).toHaveValue(details)

    await expect(page.getByTestId('dailylog-saved-weeklySchedule')).toHaveText(details)

    await weeklySchedule.fill(`${details} Add safety briefing at 0800.`)

    await expect(page.getByTestId('dailylog-saved-weeklySchedule')).toHaveText(
      `${details} Add safety briefing at 0800.`,
    )
  })
})
