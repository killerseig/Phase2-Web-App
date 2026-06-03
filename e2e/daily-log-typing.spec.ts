import { expect, test } from '@playwright/test'

test.describe('daily log typing regressions', () => {
  test('draft log autosaves after typing and reflects the latest text', async ({ page }) => {
    await page.goto('/__e2e/daily-log-typing')

    const weeklySchedule = page.getByTestId('dailylog-weekly-schedule')
    const details = 'Update schedule with crew A, crew B, and crew C.'

    await weeklySchedule.fill(details)
    await expect(weeklySchedule).toHaveValue(details)

    await page.waitForTimeout(220)

    await expect(page.getByTestId('dailylog-save-count')).toHaveText('1')
    await expect(page.getByTestId('dailylog-weekly-schedule-summary')).toHaveText(details)

    await weeklySchedule.fill(`${details} Add safety briefing at 0800.`)
    await page.waitForTimeout(220)

    await expect(page.getByTestId('dailylog-save-count')).toHaveText('2')
    await expect(page.getByTestId('dailylog-weekly-schedule-summary')).toHaveText(
      `${details} Add safety briefing at 0800.`,
    )
  })
})
