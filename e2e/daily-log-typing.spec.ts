import { expect, test } from './helpers/test.js'
import { createDailyLogsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

test.describe('daily log typing regressions', () => {
  test('draft log typing stays local while focused and saves on blur', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e/daily-logs', createDailyLogsFixture())

    const weeklySchedule = page.getByTestId('dailylog-weeklySchedule')
    const manpowerAssessment = page.getByTestId('dailylog-manpowerAssessment')
    const details = 'Update schedule with crew A, crew B, and crew C.'

    await expect(weeklySchedule).toBeVisible()
    await weeklySchedule.fill(details)
    await expect(weeklySchedule).toHaveValue(details)
    await expect(page.getByText('Unsaved changes')).toBeVisible()
    await expect(page.getByTestId('dailylog-saved-weeklySchedule')).not.toHaveText(details)

    await manpowerAssessment.focus()
    await expect(page.getByTestId('dailylog-saved-weeklySchedule')).toHaveText(details)

    const updatedDetails = `${details} Add safety briefing at 0800.`
    await weeklySchedule.focus()
    await weeklySchedule.fill(updatedDetails)
    await expect(weeklySchedule).toHaveValue(updatedDetails)
    await expect(page.getByText('Unsaved changes')).toBeVisible()
    await expect(page.getByTestId('dailylog-saved-weeklySchedule')).toHaveText(details)

    await manpowerAssessment.focus()
    await expect(page.getByTestId('dailylog-saved-weeklySchedule')).toHaveText(updatedDetails)
  })
})
