import { expect, test } from '@playwright/test'

test.describe('jobs page regressions', () => {
  test('job search filters matching job cards', async ({ page }) => {
    await page.goto('/__e2e/jobs')

    await expect(page.getByTestId('job-card-1A')).toBeVisible()
    await expect(page.getByTestId('job-card-2B')).toBeVisible()
    await expect(page.getByTestId('job-card-3C')).toBeVisible()

    await page.getByTestId('jobs-search').fill('drywall')

    await expect(page.getByTestId('job-card-1A')).toHaveCount(0)
    await expect(page.getByTestId('job-card-2B')).toBeVisible()
    await expect(page.getByTestId('jobs-empty')).toHaveCount(0)
  })

  test('creating a new job adds it to the list', async ({ page }) => {
    await page.goto('/__e2e/jobs')

    await page.getByTestId('jobs-create-name').fill('Ceiling Repair')
    await page.getByTestId('jobs-create-code').fill('4D')
    await page.getByTestId('jobs-create-gc').fill('Capstone')
    await page.getByTestId('jobs-create-address').fill('321 Elm St')
    await page.getByTestId('jobs-create-button').click()

    await expect(page.getByTestId('job-card-4D')).toBeVisible()
    await expect(page.getByTestId('job-card-4D')).toContainText('Ceiling Repair')
    await expect(page.getByTestId('job-card-4D')).toContainText('Capstone')
  })
})
