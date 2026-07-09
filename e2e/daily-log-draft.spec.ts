import { expect, test } from './helpers/test.js'
import { createDailyLogsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

test.describe('daily log draft regressions', () => {
  test('opening today does not create a daily log draft until the foreman asks for one', async ({ page }) => {
    const fixture = createDailyLogsFixture()
    fixture.dailyLogs = []

    await gotoPhase2App(page, '/jobs/job-e2e/daily-logs', fixture)

    await expect(page.getByRole('button', { name: 'Create Daily Log' })).toBeVisible()
    await expect(page.getByText('No daily log is selected for this date.')).toBeVisible()
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          dailyLogs?: unknown[]
        }
        return state.dailyLogs?.length ?? -1
      }))
      .toBe(0)

    await page.getByRole('button', { name: 'Create Daily Log' }).click()

    await expect(page.getByText('Daily log draft created.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Draft #1' })).toBeVisible()
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          dailyLogs?: unknown[]
        }
        return state.dailyLogs?.length ?? -1
      }))
      .toBe(1)
  })

  test('submitted daily logs show first and creating another log stays intentional', async ({ page }) => {
    const fixture = createDailyLogsFixture()
    fixture.dailyLogs[0].status = 'submitted'
    fixture.dailyLogs[0].submittedAt = '2026-06-04T12:30:00.000Z'

    await gotoPhase2App(page, '/jobs/job-e2e/daily-logs', fixture)

    await expect(page.getByRole('heading', { name: 'Submitted #1' })).toBeVisible()
    await expect(page.getByTestId('dailylog-weeklySchedule')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Another Daily Log' })).toBeVisible()
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          dailyLogs?: unknown[]
        }
        return state.dailyLogs?.length ?? -1
      }))
      .toBe(1)

    await page.getByRole('button', { name: 'Another Daily Log' }).click()

    await expect(page.getByText('Daily log draft created.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Draft #2' })).toBeVisible()
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          dailyLogs?: Array<{ status?: string | null }>
        }
        return state.dailyLogs?.map((log) => log.status) ?? []
      }))
      .toEqual(['submitted', 'draft'])
  })

  test('typing in weekly schedule stays stable until the field blurs', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e/daily-logs', createDailyLogsFixture())

    const weeklySchedule = page.getByTestId('dailylog-weeklySchedule')
    const manpowerAssessment = page.getByTestId('dailylog-manpowerAssessment')
    const text = 'Week 1 schedule 123 with spaces between crews'

    await expect(weeklySchedule).toBeVisible()
    await weeklySchedule.fill(text)
    await expect(weeklySchedule).toHaveValue(text)
    await expect(page.getByText('Unsaved changes')).toBeVisible()
    await expect(page.getByTestId('dailylog-saved-weeklySchedule')).not.toHaveText(text)

    await manpowerAssessment.focus()
    await expect(page.getByTestId('dailylog-saved-weeklySchedule')).toHaveText(text)
  })

  test('safety, budget, and deliveries text keep numbers and spaces while fields save on blur', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e/daily-logs', createDailyLogsFixture())

    const safety = 'Lift 2 needs guard rail 44 and spotter'
    const budget = 'Need 3 extra boxes and 2 lift hours'
    const deliveries = 'Bring 12 sheets, 4 boxes, and 1 pallet Friday'

    await page.getByTestId('dailylog-safetyConcerns').fill(safety)
    await page.getByTestId('dailylog-budgetConcerns').fill(budget)
    await page.getByTestId('dailylog-deliveriesNeeded').fill(deliveries)

    await expect(page.getByTestId('dailylog-safetyConcerns')).toHaveValue(safety)
    await expect(page.getByTestId('dailylog-budgetConcerns')).toHaveValue(budget)
    await expect(page.getByTestId('dailylog-deliveriesNeeded')).toHaveValue(deliveries)
    await expect(page.getByText('Unsaved changes')).toBeVisible()
    await expect(page.getByTestId('dailylog-saved-safetyConcerns')).toHaveText(safety)
    await expect(page.getByTestId('dailylog-saved-budgetConcerns')).toHaveText(budget)
    await expect(page.getByTestId('dailylog-saved-deliveriesNeeded')).not.toHaveText(deliveries)

    await page.getByTestId('dailylog-newWorkAuthorizations').focus()
    await expect(page.getByTestId('dailylog-saved-safetyConcerns')).toHaveText(safety)
    await expect(page.getByTestId('dailylog-saved-budgetConcerns')).toHaveText(budget)
    await expect(page.getByTestId('dailylog-saved-deliveriesNeeded')).toHaveText(deliveries)
  })
})
