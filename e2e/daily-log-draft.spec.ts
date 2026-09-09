import { expect, test } from './helpers/test.js'
import { createDailyLogsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

test.describe('daily log draft regressions', () => {
  test('email deep links open the exact submitted daily log for that date', async ({ page }) => {
    const fixture = createDailyLogsFixture()
    fixture.dailyLogs[0].status = 'submitted'
    fixture.dailyLogs[0].submittedAt = '2026-06-04T12:30:00.000Z'
    fixture.dailyLogs.push({
      ...fixture.dailyLogs[0],
      id: 'daily-log-2',
      sequenceNumber: 2,
      foremanName: 'Vince Hintz',
      submittedAt: '2026-06-04T16:30:00.000Z',
      payload: {
        ...fixture.dailyLogs[0].payload,
        foremanOnSite: 'Vince Hintz',
        weeklySchedule: 'Second submitted log selected from the email.',
      },
    })

    await gotoPhase2App(page, '/jobs/job-e2e/daily-logs?date=2026-06-04&logId=daily-log-2', fixture)

    await expect(page.getByRole('heading', { name: 'Submitted #2' })).toBeVisible()
    await expect(page.getByTestId('dailylog-weeklySchedule')).toHaveValue(
      'Second submitted log selected from the email.',
    )
  })

  test('email photo links open an isolated single-log gallery on mobile', async ({ page }) => {
    const fixture = createDailyLogsFixture()
    const fullSizePhoto = `data:image/svg+xml,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200"><rect width="1600" height="1200" fill="#71889a"/></svg>',
    )}`
    fixture.publicDailyLogGalleries = {
      'gallery-e2e': {
        jobName: 'Phase 2 Company Acoustical remodel',
        jobCode: '1A',
        logDate: '2026-06-04',
        sequenceNumber: 1,
        foremanName: 'Chris (CJ) Larsen',
        submittedAt: '2026-06-04T12:30:00.000Z',
        attachments: [
          {
            name: 'lobby-progress.jpg',
            url: fullSizePhoto,
            thumbnailUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
            type: 'photo',
            description: 'Lobby ceiling progress',
          },
          {
            name: 'ptp-board.jpg',
            url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
            type: 'ptp',
            description: 'Morning PTP board',
          },
          {
            name: 'qc-grid-1.jpg',
            url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
            type: 'qc',
            description: 'First QC inspection',
          },
          {
            name: 'qc-grid-2.jpg',
            url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
            type: 'qc',
            description: 'Second QC inspection',
          },
        ],
      },
    }

    await page.setViewportSize({ width: 390, height: 844 })
    await gotoPhase2App(page, '/daily-log-gallery/gallery-e2e', fixture)

    await expect(page).toHaveURL(/\/daily-log-gallery\/gallery-e2e$/)
    await expect(page.getByTestId('public-daily-log-gallery')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Phase 2 Company Acoustical remodel (#1A)' }),
    ).toBeVisible()
    await expect(page.getByText('Chris (CJ) Larsen')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Photo sections' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Photos (1)', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'PTP Photos (1)', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'QC Photos (2)', exact: true })).toBeVisible()
    await expect(page.getByTestId('gallery-section-photo')).toContainText('Lobby ceiling progress')
    await expect(page.getByTestId('gallery-section-ptp')).toContainText('Morning PTP board')
    await expect(page.getByTestId('gallery-section-qc')).toContainText('Second QC inspection')
    await expect(page.locator('.app-shell')).toHaveCount(0)
    await expect(page.getByText('Email Recipients')).toHaveCount(0)
    await expect(page.getByText('History', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Sign In', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Sign Out', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Save Draft', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Delete Draft', { exact: true })).toHaveCount(0)
    await expect(page.getByText('ADMIN', { exact: true })).toHaveCount(0)
    await expect(page.getByText('FOREMAN', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'View lobby-progress.jpg' })).toBeVisible()

    await page.getByRole('button', { name: 'View lobby-progress.jpg' }).click()
    const viewer = page.getByRole('dialog', { name: 'Photo viewer: lobby-progress.jpg' })
    await expect(viewer).toBeVisible()
    const viewerImage = viewer.getByRole('img', { name: 'lobby-progress.jpg' })
    await expect(viewerImage).toBeVisible()
    await expect(viewerImage).toHaveAttribute('src', fullSizePhoto)
    await expect(viewerImage).toHaveCSS('object-fit', 'contain')
    await expect(viewer.getByText('Lobby ceiling progress')).toBeVisible()
    await expect(viewer.getByText('Photos: 1 of 1')).toBeVisible()

    const imageBounds = await viewerImage.boundingBox()
    expect(imageBounds).not.toBeNull()
    expect(imageBounds!.x).toBeGreaterThanOrEqual(0)
    expect(imageBounds!.y).toBeGreaterThanOrEqual(0)
    expect(imageBounds!.x + imageBounds!.width).toBeLessThanOrEqual(390)
    expect(imageBounds!.y + imageBounds!.height).toBeLessThanOrEqual(844)

    await viewer.getByRole('button', { name: 'Close photo viewer' }).click()
    await expect(viewer).toBeHidden()

    await page.getByRole('button', { name: 'View qc-grid-1.jpg' }).click()
    const qcViewer = page.getByRole('dialog', { name: 'Photo viewer: qc-grid-1.jpg' })
    await expect(qcViewer.getByText('QC Photos: 1 of 2')).toBeVisible()
    await qcViewer.getByRole('button', { name: 'Next photo' }).click()
    await expect(page.getByRole('dialog', { name: 'Photo viewer: qc-grid-2.jpg' })).toBeVisible()
    await expect(page.getByText('QC Photos: 2 of 2')).toBeVisible()
    await page.getByRole('button', { name: 'Close photo viewer' }).click()

    await page.locator('body').evaluate(() => {
      window.location.hash = '#gallery-ptp-1'
    })
    await expect(page.getByRole('dialog', { name: 'Photo viewer: ptp-board.jpg' })).toBeVisible()
  })

  test('public photo galleries scroll through long albums on small screens', async ({ page }) => {
    const fixture = createDailyLogsFixture()
    fixture.publicDailyLogGalleries = {
      'scrollable-gallery-e2e': {
        jobName: 'Long Album Job',
        jobCode: '5229',
        logDate: '2026-06-04',
        sequenceNumber: 2,
        foremanName: 'Vince Hintz',
        submittedAt: '2026-06-04T16:30:00.000Z',
        attachments: Array.from({ length: 12 }, (_, index) => ({
          name: `progress-${index + 1}.jpg`,
          url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
          type: 'photo' as const,
          description: `Progress photo ${index + 1}`,
        })),
      },
    }

    await page.setViewportSize({ width: 390, height: 640 })
    await gotoPhase2App(page, '/daily-log-gallery/scrollable-gallery-e2e', fixture)

    const galleryPage = page.getByTestId('public-daily-log-gallery')
    await expect(galleryPage).toBeVisible()
    await expect(page.getByRole('button', { name: 'View progress-12.jpg' })).toBeAttached()

    const scrollMetrics = await galleryPage.evaluate((element) => ({
      clientHeight: element.clientHeight,
      overflowY: getComputedStyle(element).overflowY,
      scrollHeight: element.scrollHeight,
    }))
    expect(scrollMetrics.overflowY).toBe('auto')
    expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight)

    await galleryPage.hover({ position: { x: 20, y: 320 } })
    await page.mouse.wheel(0, 1000)
    await expect.poll(() => galleryPage.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  })

  test('legacy email photo links never render the authenticated daily log workspace', async ({
    page,
  }) => {
    const fixture = createDailyLogsFixture()
    fixture.publicDailyLogGalleries = {
      'legacy:job-e2e:daily-log-1': {
        jobName: 'Phase 2 Company Acoustical remodel',
        jobCode: '1A',
        logDate: '2026-06-04',
        sequenceNumber: 1,
        foremanName: 'Chris (CJ) Larsen',
        submittedAt: '2026-06-04T12:30:00.000Z',
        attachments: [
          {
            name: 'legacy-progress.jpg',
            url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
            type: 'photo',
            description: 'Legacy email photo',
          },
        ],
      },
    }

    await gotoPhase2App(
      page,
      '/jobs/job-e2e/daily-logs?date=2026-06-04&logId=daily-log-1#daily-log-photos',
      fixture,
    )

    await expect(page).toHaveURL(/\/daily-log-gallery\/legacy\/job-e2e\/daily-log-1$/)
    await expect(page.getByTestId('public-daily-log-gallery')).toBeVisible()
    await expect(page.locator('.app-shell')).toHaveCount(0)
    await expect(page.getByRole('navigation')).toHaveCount(0)
    await expect(page.getByText('Email Recipients')).toHaveCount(0)
    await expect(page.getByText('History', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Save Draft', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Sign Out', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'View legacy-progress.jpg' })).toBeVisible()
  })

  test('opening today does not create a daily log draft until the foreman asks for one', async ({
    page,
  }) => {
    const fixture = createDailyLogsFixture()
    fixture.dailyLogs = []

    await gotoPhase2App(page, '/jobs/job-e2e/daily-logs', fixture)

    await expect(page.getByRole('button', { name: 'Create Daily Log' })).toBeVisible()
    await expect(page.getByText('No daily log is selected for this date.')).toBeVisible()
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const state = window.__PHASE2_E2E_STATE__ as {
            dailyLogs?: unknown[]
          }
          return state.dailyLogs?.length ?? -1
        }),
      )
      .toBe(0)

    await page.getByRole('button', { name: 'Create Daily Log' }).click()

    await expect(page.getByText('Daily log draft created.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Draft #1' })).toBeVisible()
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const state = window.__PHASE2_E2E_STATE__ as {
            dailyLogs?: unknown[]
          }
          return state.dailyLogs?.length ?? -1
        }),
      )
      .toBe(1)
  })

  test('submitted daily logs show first and creating another log stays intentional', async ({
    page,
  }) => {
    const fixture = createDailyLogsFixture()
    fixture.dailyLogs[0].status = 'submitted'
    fixture.dailyLogs[0].submittedAt = '2026-06-04T12:30:00.000Z'

    await gotoPhase2App(page, '/jobs/job-e2e/daily-logs', fixture)

    await expect(page.getByRole('heading', { name: 'Submitted #1' })).toBeVisible()
    await expect(page.getByTestId('dailylog-weeklySchedule')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Another Daily Log' })).toBeVisible()
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const state = window.__PHASE2_E2E_STATE__ as {
            dailyLogs?: unknown[]
          }
          return state.dailyLogs?.length ?? -1
        }),
      )
      .toBe(1)

    await page.getByRole('button', { name: 'Another Daily Log' }).click()

    await expect(page.getByText('Daily log draft created.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Draft #2' })).toBeVisible()
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const state = window.__PHASE2_E2E_STATE__ as {
            dailyLogs?: Array<{ status?: string | null }>
          }
          return state.dailyLogs?.map((log) => log.status) ?? []
        }),
      )
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

  test('safety, budget, and deliveries text keep numbers and spaces while fields save on blur', async ({
    page,
  }) => {
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

  test('draft daily logs delete through the shared confirmation dialog', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e/daily-logs', createDailyLogsFixture())

    await page.getByRole('button', { name: 'Delete Draft' }).click()
    await page
      .getByRole('dialog', { name: 'Delete daily log draft?' })
      .getByRole('button', { name: 'Delete Draft' })
      .click()

    await expect(page.getByText('Daily log draft deleted.')).toBeVisible()
    await expect(page.getByText('No daily log is selected for this date.')).toBeVisible()
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const state = window.__PHASE2_E2E_STATE__ as {
            dailyLogs?: unknown[]
          }
          return state.dailyLogs?.length ?? -1
        }),
      )
      .toBe(0)
  })
})
