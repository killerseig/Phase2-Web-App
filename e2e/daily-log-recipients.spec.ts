import { expect, test } from './helpers/test.js'
import { createDailyLogsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

test.describe('daily log recipients', () => {
  test('additional recipients can be added and removed on the real daily log page', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e/daily-logs', createDailyLogsFixture())

    await page.getByPlaceholder('name@example.com').fill('field.alerts@example.com')
    await page.getByRole('button', { name: 'Add', exact: true }).click()

    await expect(page.getByText('Recipient added.')).toBeVisible()
    await expect(page.getByText('field.alerts@example.com')).toBeVisible()

    await page.getByRole('button', { name: 'Remove recipient' }).click()

    await expect(page.getByText('Recipient removed.')).toBeVisible()
    await expect(page.getByText('field.alerts@example.com')).toHaveCount(0)
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          dailyLogs?: Array<{ additionalRecipients?: string[] }>
        }
        return state.dailyLogs?.[0]?.additionalRecipients ?? []
      }))
      .toEqual([])
  })
})
