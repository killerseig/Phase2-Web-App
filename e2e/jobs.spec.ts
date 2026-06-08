import { expect, test } from '@playwright/test'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

test.describe('jobs page regressions', () => {
  test('job search filters matching job cards', async ({ page }) => {
    await gotoPhase2App(page, '/jobs', createJobsFixture())

    await expect(page.getByTestId('job-card-1A')).toBeVisible()
    await expect(page.getByTestId('job-card-2B')).toBeVisible()
    await expect(page.getByTestId('job-card-3C')).toBeVisible()

    await page.getByTestId('jobs-search').fill('drywall')

    await expect(page.getByTestId('job-card-1A')).toHaveCount(0)
    await expect(page.getByTestId('job-card-2B')).toBeVisible()
    await expect(page.getByTestId('jobs-empty')).toHaveCount(0)
  })

  test('creating a new job adds it to the list', async ({ page }) => {
    await gotoPhase2App(page, '/jobs', createJobsFixture())

    await page.getByTestId('jobs-edit-mode').click()
    await page.getByTestId('jobs-new-button').click()

    await page.getByTestId('jobs-create-name').fill('Ceiling Repair')
    await page.getByTestId('jobs-create-code').fill('4D')
    await page.getByTestId('jobs-create-gc').fill('Capstone')
    await page.getByTestId('jobs-create-address').fill('321 Elm St')
    await page.locator('[data-testid="jobs-foreman-foreman-e2e"] input').check()
    await page.getByTestId('jobs-create-button').click()

    await expect(page.getByTestId('job-card-4D')).toBeVisible()
    await expect(page.getByTestId('job-card-4D')).toContainText('Ceiling Repair')
    await expect(page.getByTestId('job-card-4D')).toContainText('Capstone')
  })

  test('job detail keeps the latest typed text while autosave responses arrive late', async ({ page }) => {
    const fixture = createJobsFixture()
    fixture.delays = { jobUpdateMs: 700 }

    await gotoPhase2App(page, '/jobs', fixture)

    await page.getByTestId('jobs-edit-mode').click()
    await page.getByTestId('job-card-1A').click()

    const jobName = page.getByLabel('Job Name')
    const nextName = 'Phase 2 South Buildout'

    await expect(jobName).toHaveValue('Acoustical Remodel')

    await jobName.fill('Phase')
    await page.waitForTimeout(500)
    await jobName.fill(nextName)

    await page.waitForTimeout(800)
    await expect(jobName).toHaveValue(nextName)

    await page.waitForTimeout(600)
    await expect(jobName).toHaveValue(nextName)
  })
})
