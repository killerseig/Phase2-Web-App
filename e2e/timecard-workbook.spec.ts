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

  test('new card creation uses the current linked job number for all initial rows', async ({ page }) => {
    await page.goto('/__e2e/timecard-workbook')

    await page.getByTestId('linked-job-number').fill('9988')
    await page.getByTestId('create-card').click()

    await expect(page.getByTestId('job-number-summary')).toHaveText('9988|9988|9988|9988')
    await expect(page.getByTestId('timecard-job-number-0')).toHaveValue('9988')
    await expect(page.getByTestId('timecard-job-number-1')).toHaveValue('9988')
  })

  test('blank wage value stays blank after blur', async ({ page }) => {
    await page.goto('/__e2e/timecard-workbook')

    const wageInput = page.getByTestId('timecard-wage-input')
    await wageInput.fill('')
    await wageInput.blur()

    await expect(wageInput).toHaveValue('')
  })

  test('invalid wage value clears on blur', async ({ page }) => {
    await page.goto('/__e2e/timecard-workbook')

    const wageInput = page.getByTestId('timecard-wage-input')
    await wageInput.fill('abc')
    await wageInput.blur()

    await expect(wageInput).toHaveValue('')
  })

  test('incomplete numeric wage commits a valid number on blur', async ({ page }) => {
    await page.goto('/__e2e/timecard-workbook')

    const wageInput = page.getByTestId('timecard-wage-input')
    await wageInput.fill('1.')
    await wageInput.blur()

    await expect(wageInput).toHaveValue('$1.00')
  })

  test('non-numeric wage characters are stripped to digits', async ({ page }) => {
    await page.goto('/__e2e/timecard-workbook')

    const wageInput = page.getByTestId('timecard-wage-input')
    await wageInput.fill('a1b2.3c')
    await wageInput.blur()

    await expect(wageInput).toHaveValue('$12.30')
  })

  test('valid wage values format to currency on blur', async ({ page }) => {
    await page.goto('/__e2e/timecard-workbook')

    const wageInput = page.getByTestId('timecard-wage-input')
    await wageInput.fill('20')
    await wageInput.blur()
    await expect(wageInput).toHaveValue('$20.00')

    await wageInput.fill('2.5')
    await wageInput.blur()
    await expect(wageInput).toHaveValue('$2.50')
  })

  test('the full H / P / C row structure stays visible', async ({ page }) => {
    await page.goto('/__e2e/timecard-workbook')

    await expect(page.getByTestId('timecard-row-label-0-hours')).toHaveText('H')
    await expect(page.getByTestId('timecard-row-label-0-production')).toHaveText('P')
    await expect(page.getByTestId('timecard-row-label-0-cost')).toHaveText('C')
  })
})
