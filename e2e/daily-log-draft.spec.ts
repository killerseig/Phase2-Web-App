import { expect, test } from '@playwright/test'

test.describe('daily log draft regressions', () => {
  test('typing in weekly schedule survives autosave echo', async ({ page }) => {
    await page.goto('/__e2e/daily-log-draft')

    const weeklySchedule = page.getByTestId('dailylog-weeklySchedule')
    const text = 'Week 1 schedule 123 with spaces between crews'

    await weeklySchedule.fill(text)
    await expect(weeklySchedule).toHaveValue(text)

    await page.waitForTimeout(900)

    await expect(weeklySchedule).toHaveValue(text)
    await expect(page.getByTestId('dailylog-saved-weeklySchedule')).toHaveText(text)
  })

  test('safety, budget, and deliveries text keep numbers and spaces while autosaving', async ({ page }) => {
    await page.goto('/__e2e/daily-log-draft')

    const safety = 'Lift 2 needs guard rail 44 and spotter'
    const budget = 'Need 3 extra boxes and 2 lift hours'
    const deliveries = 'Bring 12 sheets, 4 boxes, and 1 pallet Friday'

    await page.getByTestId('dailylog-safetyConcerns').fill(safety)
    await page.getByTestId('dailylog-budgetConcerns').fill(budget)
    await page.getByTestId('dailylog-deliveriesNeeded').fill(deliveries)

    await page.waitForTimeout(900)

    await expect(page.getByTestId('dailylog-safetyConcerns')).toHaveValue(safety)
    await expect(page.getByTestId('dailylog-budgetConcerns')).toHaveValue(budget)
    await expect(page.getByTestId('dailylog-deliveriesNeeded')).toHaveValue(deliveries)

    await expect(page.getByTestId('dailylog-saved-safetyConcerns')).toHaveText(safety)
    await expect(page.getByTestId('dailylog-saved-budgetConcerns')).toHaveText(budget)
    await expect(page.getByTestId('dailylog-saved-deliveriesNeeded')).toHaveText(deliveries)
  })
})
