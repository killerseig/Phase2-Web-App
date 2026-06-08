import { expect, test } from '@playwright/test'
import { createAdminWorkspaceFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

test.describe('admin page coverage', () => {
  test('users page filters the real directory', async ({ page }) => {
    await gotoPhase2App(page, '/users', createAdminWorkspaceFixture())

    await expect(page.getByTestId('users-page')).toBeVisible()
    await expect(page.getByTestId('users-row-foreman-e2e')).toBeVisible()
    await expect(page.getByTestId('users-row-user-pending')).toBeVisible()

    await page.getByTestId('users-search').fill('pending')

    await expect(page.getByTestId('users-row-user-pending')).toBeVisible()
    await expect(page.getByTestId('users-row-foreman-e2e')).toHaveCount(0)
  })

  test('employees page filters the live directory', async ({ page }) => {
    await gotoPhase2App(page, '/employees', createAdminWorkspaceFixture())

    await expect(page.getByTestId('employees-page')).toBeVisible()
    await expect(page.getByTestId('employee-row-employee-1')).toBeVisible()
    await expect(page.getByTestId('employee-row-employee-2')).toBeVisible()

    await page.getByTestId('employees-search').fill('installer')

    await expect(page.getByTestId('employee-row-employee-2')).toBeVisible()
    await expect(page.getByTestId('employee-row-employee-1')).toHaveCount(0)
  })

  test('reference list page renders through the real admin route', async ({ page }) => {
    await gotoPhase2App(page, '/settings/lists/job-types', createAdminWorkspaceFixture())

    await expect(page.getByTestId('reference-list-page')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Job Types' })).toBeVisible()
    await expect(page.getByText('List management scaffold')).toBeVisible()
  })

  test('shop catalog page filters tree nodes on the real view', async ({ page }) => {
    await gotoPhase2App(page, '/settings/shop-catalog', createAdminWorkspaceFixture())

    await expect(page.getByTestId('shop-catalog-page')).toBeVisible()
    await expect(page.getByTestId('shop-catalog-root-row')).toBeVisible()

    await page.getByTestId('shop-catalog-search').fill('wedge')

    await expect(page.getByTestId('shop-catalog-item-catalog-1')).toBeVisible()
    await expect(page.getByTestId('shop-catalog-item-catalog-2')).toHaveCount(0)
  })

  test('timecard export page shows saved week packages from runtime data', async ({ page }) => {
    await gotoPhase2App(page, '/exports/timecards', createAdminWorkspaceFixture())

    await expect(page.getByTestId('timecard-export-page')).toBeVisible()
    await expect(page.getByTestId('timecard-export-week-week-e2e')).toBeVisible()
    await expect(page.getByTestId('timecard-export-week-week-admin-2')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit Card' }).first()).toBeVisible()

    await page.getByTestId('timecard-export-week-search').fill('sam')

    await expect(page.getByTestId('timecard-export-week-week-admin-2')).toBeVisible()
    await expect(page.getByTestId('timecard-export-week-week-e2e')).toHaveCount(0)
  })

  test('timecard print route renders a stored export payload', async ({ page }) => {
    const fixture = createAdminWorkspaceFixture()
    const baseCard = fixture.timecardCards?.[0]

    if (!baseCard) {
      throw new Error('Admin workspace fixture must include a timecard card for print coverage.')
    }

    const exportId = 'timecard-export-e2e'
    const payload = {
      exportId,
      title: 'Timecard Export',
      subtitle: 'Week Ending 6/6/2026',
      generatedAt: Date.parse('2026-06-08T09:00:00.000Z'),
      cards: [
        {
          ...baseCard,
          exportWeekId: 'week-e2e',
          exportWeekStartDate: '2026-05-31',
          exportWeekEndDate: '2026-06-06',
          exportWeekStatus: 'draft',
          exportJobId: 'job-e2e',
          exportJobCode: '1A',
          exportJobName: 'Phase 2 Company Acoustical remodel',
          exportForemanName: 'Chris (CJ) Larsen',
          exportBurden: 0.33,
        },
      ],
    }

    await page.addInitScript(({ nextExportId, nextPayload }) => {
      window.localStorage.setItem(
        'phase2-timecard-pdf-exports',
        JSON.stringify({ [nextExportId]: nextPayload }),
      )
      window.print = () => undefined
    }, { nextExportId: exportId, nextPayload: payload })

    await gotoPhase2App(page, `/exports/timecards/print?exportId=${exportId}`, fixture)

    await expect(page.getByTestId('timecard-export-print-page')).toBeVisible()
    await expect(page.getByTestId('timecard-export-print-document')).toBeVisible()
    await expect(page.getByTestId('timecard-export-print-card-card-admin-1')).toBeVisible()
  })
})
