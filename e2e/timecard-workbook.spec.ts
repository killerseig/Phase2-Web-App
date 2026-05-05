import { expect, test } from '@playwright/test'

test.describe('timecard workbook regressions', () => {
  test('new card creation seeds every job number line', async ({ page }) => {
    await page.goto('/__e2e/timecard-workbook')

    await expect(page.getByTestId('prefill-status')).toHaveText('prefilled')
    await expect(page.getByTestId('job-number-summary')).toHaveText('9411|9411|9411|9411')
    await expect(page.getByTestId('timecard-job-number-0')).toHaveValue('9411')
    await expect(page.getByTestId('timecard-job-number-1')).toHaveValue('9411')
    await expect(page.getByTestId('timecard-job-number-2')).toHaveValue('9411')
    await expect(page.getByTestId('timecard-job-number-3')).toHaveValue('9411')
  })

  test('job number edits cascade downward and stop at the first intentionally changed row', async ({ page }) => {
    await page.goto('/__e2e/timecard-workbook')

    await page.getByTestId('timecard-job-number-0').fill('123')
    await expect(page.getByTestId('job-number-summary')).toHaveText('123|123|123|123')

    await page.getByTestId('timecard-job-number-2').fill('456')
    await expect(page.getByTestId('job-number-summary')).toHaveText('123|123|456|456')

    await page.getByTestId('timecard-job-number-1').fill('565')
    await expect(page.getByTestId('job-number-summary')).toHaveText('123|565|456|456')
  })

  test('the full H / P / C row structure stays visible', async ({ page }) => {
    await page.goto('/__e2e/timecard-workbook')

    await expect(page.getByTestId('timecard-row-label-0-hours')).toHaveText('H')
    await expect(page.getByTestId('timecard-row-label-0-production')).toHaveText('P')
    await expect(page.getByTestId('timecard-row-label-0-cost')).toHaveText('C')
  })
})
