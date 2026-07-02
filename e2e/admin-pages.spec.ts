import { expect, test } from './helpers/test.js'
import { createAdminWorkspaceFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

function createExportActionsFixture() {
  const fixture = createAdminWorkspaceFixture()
  const firstCard = fixture.timecardCards?.find((card) => card.id === 'card-admin-1')
  const secondCard = fixture.timecardCards?.find((card) => card.id === 'card-admin-2')

  if (firstCard?.lines?.[0]?.days?.[1]) {
    firstCard.lines[0].days[1].hours = 8
    firstCard.lines[0].days[1].production = 3
  }

  if (secondCard?.lines?.[0]?.days?.[2]) {
    secondCard.lines[0].days[2].hours = 4
    secondCard.lines[0].days[2].production = 2
  }

  return fixture
}

test.describe('admin page coverage', () => {
  test('users page filters the real directory', async ({ page }) => {
    const fixture = createAdminWorkspaceFixture()
    fixture.users?.push({
      id: 'inactive-user',
      email: 'inactive@example.com',
      firstName: 'Inactive',
      lastName: 'User',
      role: 'foreman',
      active: false,
      assignedJobIds: [],
    })

    await gotoPhase2App(page, '/users', fixture)

    await expect(page.getByTestId('users-page')).toBeVisible()
    await expect(page.getByTestId('users-row-foreman-e2e')).toBeVisible()
    await expect(page.getByTestId('users-row-user-pending')).toBeVisible()
    await expect(page.getByTestId('users-row-inactive-user')).toHaveCount(0)

    await page.getByTestId('users-search').fill('pending')

    await expect(page.getByTestId('users-row-user-pending')).toBeVisible()
    await expect(page.getByTestId('users-row-foreman-e2e')).toHaveCount(0)

    await page.getByTestId('users-search').clear()
    await page.getByTestId('users-status-filter').selectOption('inactive')

    await expect(page.getByTestId('users-row-inactive-user')).toBeVisible()
    await expect(page.getByTestId('users-row-foreman-e2e')).toHaveCount(0)

    await page.getByTestId('users-status-filter').selectOption('both')

    await expect(page.getByTestId('users-row-inactive-user')).toBeVisible()
    await expect(page.getByTestId('users-row-foreman-e2e')).toBeVisible()
  })

  test('employees page filters the live directory', async ({ page }) => {
    await gotoPhase2App(page, '/employees', createAdminWorkspaceFixture())

    await expect(page.getByTestId('employees-page')).toBeVisible()
    await expect(page.getByTestId('employee-row-employee-1')).toBeVisible()
    await expect(page.getByTestId('employee-row-employee-2')).toBeVisible()
    await expect(page.getByTestId('employee-row-employee-3')).toHaveCount(0)

    await page.getByTestId('employees-search').fill('installer')

    await expect(page.getByTestId('employee-row-employee-2')).toBeVisible()
    await expect(page.getByTestId('employee-row-employee-1')).toHaveCount(0)

    await page.getByTestId('employees-search').clear()
    await page.getByTestId('employees-status-filter').selectOption('inactive')

    await expect(page.getByTestId('employee-row-employee-3')).toBeVisible()
    await expect(page.getByTestId('employee-row-employee-1')).toHaveCount(0)

    await page.getByTestId('employees-status-filter').selectOption('both')

    await expect(page.getByTestId('employee-row-employee-3')).toBeVisible()
    await expect(page.getByTestId('employee-row-employee-1')).toBeVisible()
  })

  test('users page creates project managers with job assignments', async ({ page }) => {
    await gotoPhase2App(page, '/users', createAdminWorkspaceFixture())

    await page.getByRole('button', { name: 'New User' }).click()
    await page.getByLabel('Email').fill('pm@example.com')
    await page.getByLabel('Role').selectOption('project-manager')
    await page.getByLabel('First Name').fill('Paige')
    await page.getByLabel('Last Name').fill('Manager')

    await expect(page.locator('.users-jobs-panel')).toBeVisible()
    await page.locator('.users-job-toggle', { hasText: 'Phase 2 Company Acoustical remodel' }).getByRole('checkbox').check()
    await page.getByRole('button', { name: "Create User, Don't Send Invite" }).click()

    const projectManagerRow = page.locator('.users-browser__row', { hasText: 'pm@example.com' })
    await expect(projectManagerRow).toBeVisible()
    await expect(projectManagerRow).toContainText('Project Manager')

    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          users?: Array<{ id?: string; email?: string | null; role?: string | null; assignedJobIds?: string[] }>
          jobs?: Array<{ id?: string; assignedForemanIds?: string[] }>
        }
        const user = state.users?.find((entry) => entry.email === 'pm@example.com')
        const job = state.jobs?.find((entry) => entry.id === 'job-e2e')
        return {
          role: user?.role ?? null,
          assignedJobIds: user?.assignedJobIds ?? [],
          jobHasUser: user?.id ? job?.assignedForemanIds?.includes(user.id) ?? false : false,
        }
      }))
      .toEqual({
        role: 'project-manager',
        assignedJobIds: ['job-e2e'],
        jobHasUser: true,
      })
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

  test('shop catalog admin creates, edits, archives, and deletes real catalog entries', async ({ page }) => {
    await gotoPhase2App(page, '/settings/shop-catalog', createAdminWorkspaceFixture())

    const inspector = page.locator('.catalog-inspector-pane')

    await page.getByTestId('shop-catalog-root-row').click({ button: 'right' })
    await page.getByRole('button', { name: 'New Folder' }).click()
    await page.locator('.catalog-tree-node__rename').fill('Safety Gear')
    await page.locator('.catalog-tree-node__rename').press('Enter')

    const safetyFolder = page.locator('.catalog-tree-node', { hasText: 'Safety Gear' })
    await expect(safetyFolder).toBeVisible()

    await safetyFolder.click()
    await inspector.getByLabel('Folder Name').fill('Field Safety')
    await inspector.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.locator('.catalog-tree-node', { hasText: 'Field Safety' })).toBeVisible()

    await page.locator('.catalog-tree-node', { hasText: 'Field Safety' }).click({ button: 'right' })
    await page.getByRole('button', { name: 'New Item' }).click()
    await inspector.getByLabel('Description').fill('Hard Hat')
    await inspector.getByLabel('SKU').fill('HH-01')
    await inspector.getByLabel('Price').fill('18.75')
    await inspector.getByRole('button', { name: 'Create Item' }).click()

    const hardHatItem = page.locator('.catalog-tree-node', { hasText: 'Hard Hat' })
    await expect(hardHatItem).toBeVisible()

    await hardHatItem.click()
    await inspector.getByLabel('Description').fill('Hard Hat - White')
    await inspector.getByLabel('SKU').fill('HH-WHITE')
    await inspector.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.locator('.catalog-tree-node', { hasText: 'Hard Hat - White' })).toBeVisible()

    await inspector.getByRole('button', { name: 'Archive Item' }).click()
    await expect(page.locator('.catalog-tree-node', { hasText: 'Hard Hat - White' })).toHaveCount(0)

    await page.getByLabel('Show Archived').check()
    await page.locator('.catalog-tree-node', { hasText: 'Hard Hat - White' }).click()
    await inspector.getByRole('button', { name: 'Delete Item' }).click()
    await expect(page.locator('.catalog-tree-node', { hasText: 'Hard Hat - White' })).toHaveCount(0)

    await page.locator('.catalog-tree-node', { hasText: 'Field Safety' }).click()
    await inspector.getByRole('button', { name: 'Delete Folder' }).click()
    await expect(page.locator('.catalog-tree-node', { hasText: 'Field Safety' })).toHaveCount(0)

    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          shopCategories?: Array<{ name?: string | null }>
          shopCatalogItems?: Array<{ description?: string | null }>
        }

        return {
          categoryExists: state.shopCategories?.some((category) => category.name === 'Field Safety') ?? false,
          itemExists: state.shopCatalogItems?.some((item) => item.description === 'Hard Hat - White') ?? false,
        }
      }))
      .toEqual({ categoryExists: false, itemExists: false })
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

  test('timecard export lets admins delete draft weeks only', async ({ page }) => {
    await gotoPhase2App(page, '/exports/timecards', createAdminWorkspaceFixture())

    await expect(page.getByTestId('timecard-export-week-week-e2e')).toBeVisible()
    await expect(page.getByTestId('timecard-export-week-week-admin-2')).toBeVisible()
    await expect(page.getByTestId('timecard-export-delete-week-week-e2e')).toBeVisible()
    await expect(page.getByTestId('timecard-export-delete-week-week-admin-2')).toHaveCount(0)

    await page.getByTestId('timecard-export-delete-week-week-e2e').click()

    await expect(page.getByText('Draft week deleted.')).toBeVisible()
    await expect(page.getByTestId('timecard-export-week-week-e2e')).toHaveCount(0)
    await expect(page.getByTestId('timecard-export-week-week-admin-2')).toBeVisible()
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          timecardWeeks?: Array<{ id?: string }>
          timecardCards?: Array<{ weekId?: string }>
        }

        return {
          draftWeekExists: state.timecardWeeks?.some((week) => week.id === 'week-e2e') ?? true,
          draftCardsExist: state.timecardCards?.some((card) => card.weekId === 'week-e2e') ?? true,
          submittedWeekExists: state.timecardWeeks?.some((week) => week.id === 'week-admin-2') ?? false,
        }
      }))
      .toEqual({
        draftWeekExists: false,
        draftCardsExist: false,
        submittedWeekExists: true,
      })
  })

  test('timecard export csv downloads the filtered package from the real export page', async ({ page }) => {
    await gotoPhase2App(page, '/exports/timecards', createExportActionsFixture())

    await page.getByTestId('timecard-export-week-search').fill('1A')
    await expect(page.getByTestId('timecard-export-week-week-admin-2')).toHaveCount(0)
    await expect.poll(async () => page.locator('.timecards-canvas__item').count()).toBe(1)

    await page.getByRole('button', { name: 'Export CSV' }).click()

    await expect(page.getByText('Downloaded CSV with 1 detail row from 1 timecard.')).toBeVisible()
  })

  test('timecard export pdf opens the real print route payload', async ({ page }) => {
    await page.addInitScript(() => {
      const fakeWindow = {
        document: {
          title: '',
          body: {
            innerHTML: '',
          },
        },
        location: {
          href: '',
        },
        close() {
          return undefined
        },
      }

      ;(window as Window & { __PHASE2_LAST_PRINT_WINDOW__?: typeof fakeWindow | null }).__PHASE2_LAST_PRINT_WINDOW__ = null
      window.open = () => {
        ;(window as Window & { __PHASE2_LAST_PRINT_WINDOW__?: typeof fakeWindow }).__PHASE2_LAST_PRINT_WINDOW__ = fakeWindow
        return fakeWindow as unknown as Window
      }
    })

    await gotoPhase2App(page, '/exports/timecards', createAdminWorkspaceFixture())

    await page.getByTestId('timecard-export-week-search').fill('1A')
    await expect(page.getByTestId('timecard-export-week-week-admin-2')).toHaveCount(0)
    await expect.poll(async () => page.locator('.timecards-canvas__item').count()).toBe(1)

    await page.getByRole('button', { name: 'Export PDF' }).click()

    await expect(page.getByText('Opened 1 timecard for PDF export.')).toBeVisible()
    await expect
      .poll(async () => page.evaluate(() => {
        const host = window as Window & {
          __PHASE2_LAST_PRINT_WINDOW__?: { location?: { href?: string } } | null
        }
        return host.__PHASE2_LAST_PRINT_WINDOW__?.location?.href ?? ''
      }))
      .toContain('/exports/timecards/print?exportId=')
  })

  test('timecard export can toggle a card between locked and editable modes', async ({ page }) => {
    await gotoPhase2App(page, '/exports/timecards', createAdminWorkspaceFixture())

    await page.getByTestId('timecard-export-week-search').fill('1A')
    await expect(page.getByTestId('timecard-export-week-week-admin-2')).toHaveCount(0)
    await expect.poll(async () => page.locator('.timecards-canvas__item').count()).toBe(1)

    await expect(page.getByTestId('timecard-wage-display')).toBeVisible()
    await expect(page.getByTestId('timecard-wage-input')).toHaveCount(0)

    await page.getByRole('button', { name: 'Edit Card', exact: true }).click()

    await expect(page.getByRole('button', { name: 'Lock Card', exact: true })).toBeVisible()
    await expect(page.getByTestId('timecard-wage-input')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete Card', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Lock Card', exact: true }).click()

    await expect(page.getByRole('button', { name: 'Edit Card', exact: true })).toBeVisible()
    await expect(page.getByTestId('timecard-wage-input')).toHaveCount(0)
    await expect(page.getByTestId('timecard-wage-display')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete Card', exact: true })).toHaveCount(0)
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
      generatedAt: Date.now(),
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
