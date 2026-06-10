import { expect, test } from './helpers/test.js'
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
    await expect(page.getByText('Saving...')).toBeVisible()
    await jobName.fill(nextName)

    await expect(jobName).toHaveValue(nextName)
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          jobs?: Array<{ id?: string; name?: string | null }>
        }
        return state.jobs?.find((job) => job.id === 'job-1')?.name ?? null
      }))
      .toBe(nextName)
    await expect(jobName).toHaveValue(nextName)
  })

  test('job editor saves module-specific email recipients for the selected job', async ({ page }) => {
    await gotoPhase2App(page, '/jobs', createJobsFixture())

    await page.getByTestId('jobs-edit-mode').click()
    await page.getByTestId('job-card-1A').click()

    const detailPanel = page.locator('.jobs-detail')
    const recipients = [
      { section: 'Daily Logs', email: 'daily-log-office@example.com', stateKey: 'dailyLogs' },
      { section: 'Timecards', email: 'payroll-office@example.com', stateKey: 'timecards' },
      { section: 'Shop Orders', email: 'shop-office@example.com', stateKey: 'shopOrders' },
    ] as const

    for (const recipient of recipients) {
      const section = detailPanel.locator('.jobs-recipient-section', { hasText: recipient.section })
      await section.getByPlaceholder('name@example.com').fill(recipient.email)
      await section.getByRole('button', { name: 'Add' }).click()
      await expect(section.getByText(recipient.email)).toBeVisible()
      await expect(section).toContainText('1 recipients')
    }

    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          jobs?: Array<{
            id?: string
            notificationRecipients?: {
              dailyLogs?: string[]
              timecards?: string[]
              shopOrders?: string[]
            }
          }>
        }

        return state.jobs?.find((job) => job.id === 'job-1')?.notificationRecipients ?? null
      }))
      .toEqual({
        dailyLogs: ['daily-log-office@example.com'],
        timecards: ['payroll-office@example.com'],
        shopOrders: ['shop-office@example.com'],
      })
  })

  test('job editor archives, restores, and deletes jobs from the real admin view', async ({ page }) => {
    await gotoPhase2App(page, '/jobs', createJobsFixture())

    await page.getByTestId('jobs-edit-mode').click()
    await page.getByTestId('job-card-3C').click()

    const detailPanel = page.locator('.jobs-detail')

    await detailPanel.getByRole('button', { name: 'Archive Job' }).click()
    await expect(page.getByTestId('job-card-3C')).toHaveCount(0)
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          jobs?: Array<{ id?: string; active?: boolean }>
        }
        return state.jobs?.find((job) => job.id === 'job-3')?.active ?? null
      }))
      .toBe(false)

    await page.getByLabel('Show Archived').check()
    await page.getByTestId('job-card-3C').click()
    await detailPanel.getByRole('button', { name: 'Restore Job' }).click()

    await expect(page.getByTestId('job-card-3C')).toBeVisible()
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          jobs?: Array<{ id?: string; active?: boolean }>
        }
        return state.jobs?.find((job) => job.id === 'job-3')?.active ?? null
      }))
      .toBe(true)

    await detailPanel.getByRole('button', { name: 'Delete Job' }).click()

    await expect(page.getByTestId('job-card-3C')).toHaveCount(0)
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          jobs?: Array<{ id?: string }>
        }
        return state.jobs?.some((job) => job.id === 'job-3') ?? false
      }))
      .toBe(false)
  })

  test('all-jobs defaults save and remove global notification recipients', async ({ page }) => {
    await gotoPhase2App(page, '/jobs', createJobsFixture())

    await page.getByTestId('jobs-edit-mode').click()
    await page.getByRole('button', { name: /All Jobs/ }).click()

    const detailPanel = page.locator('.jobs-detail')
    const recipients = [
      { section: 'Daily Logs', email: 'daily-default@example.com' },
      { section: 'Timecards', email: 'timecard-default@example.com' },
      { section: 'Shop Orders', email: 'shop-default@example.com' },
    ] as const

    for (const recipient of recipients) {
      const section = detailPanel.locator('.jobs-recipient-section', { hasText: recipient.section })
      await section.getByPlaceholder('name@example.com').fill(recipient.email)
      await section.getByRole('button', { name: 'Add' }).click()
      await expect(section.getByText(recipient.email)).toBeVisible()
    }

    const dailyLogsSection = detailPanel.locator('.jobs-recipient-section', { hasText: 'Daily Logs' })
    await dailyLogsSection.getByLabel('Remove recipient').click()
    await expect(dailyLogsSection.getByText('daily-default@example.com')).toHaveCount(0)

    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          globalNotificationRecipients?: {
            dailyLogs?: string[]
            timecards?: string[]
            shopOrders?: string[]
          }
        }

        return state.globalNotificationRecipients ?? null
      }))
      .toEqual({
        dailyLogs: [],
        timecards: ['timecard-default@example.com'],
        shopOrders: ['shop-default@example.com'],
      })
  })
})
