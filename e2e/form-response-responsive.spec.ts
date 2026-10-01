import { expect, test } from './helpers/test.js'
import { setupFormServer, fillCommitteeAudit } from './helpers/formFixture.js'

test('phone respondent controls fit the actual scroll pane', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 844 })
  await setupFormServer(page)
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  await fillCommitteeAudit(page)
  await page.getByRole('button', { name: 'Submit form', exact: true }).click()
  await expect(page.getByText('Record status: submitted', { exact: false })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForFunction(
    () => document.querySelector('.app-shell__sidebar')!.getBoundingClientRect().right <= 0,
  )
  await expect(page.getByLabel('Job name', { exact: false })).toBeDisabled()
  await expect
    .poll(() =>
      page.locator('.app-shell__content').evaluate((el) => el.scrollWidth - el.clientWidth),
    )
    .toBeLessThanOrEqual(1)
})
