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

function createShopForemanCatalogFixture() {
  const fixture = createAdminWorkspaceFixture()
  fixture.auth.user.uid = 'shop-foreman-e2e'
  fixture.auth.user.email = 'shop@example.com'
  fixture.auth.user.displayName = 'CJ Shop Foreman'
  fixture.auth.profile.id = 'shop-foreman-e2e'
  fixture.auth.profile.email = 'shop@example.com'
  fixture.auth.profile.firstName = 'CJ'
  fixture.auth.profile.lastName = 'Shop Foreman'
  fixture.auth.profile.role = 'shop-foreman'
  fixture.auth.profile.assignedJobIds = []
  fixture.users = [
    {
      id: 'shop-foreman-e2e',
      email: 'shop@example.com',
      firstName: 'CJ',
      lastName: 'Shop Foreman',
      role: 'shop-foreman',
      active: true,
      assignedJobIds: [],
    },
    ...fixture.users,
  ]
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
    await expect(page.getByText('List editing is not available yet.')).toBeVisible()
  })

  test('shop catalog page filters tree nodes on the real view', async ({ page }) => {
    await gotoPhase2App(page, '/settings/shop-catalog', createAdminWorkspaceFixture())

    await expect(page.getByTestId('shop-catalog-page')).toBeVisible()
    await expect(page.getByTestId('shop-catalog-root-row')).toBeVisible()

    await page.getByTestId('shop-catalog-search').fill('wedge')

    await expect(page.getByTestId('shop-catalog-item-catalog-1')).toBeVisible()
    await expect(page.getByTestId('shop-catalog-item-catalog-2')).toHaveCount(0)
  })

  test('shop foremen can manage the real shop catalog route', async ({ page }) => {
    await gotoPhase2App(page, '/settings/shop-catalog', createShopForemanCatalogFixture())

    const inspector = page.locator('.catalog-inspector-pane')

    await expect(page.getByTestId('shop-catalog-page')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Shop Catalog' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Timecard Export' })).toHaveCount(0)

    await page.getByTestId('shop-catalog-root-row').click({ button: 'right' })
    await page.getByRole('button', { name: 'New Item' }).click()
    await inspector.getByLabel('Description').fill('Shop Foreman Harness')
    await inspector.getByLabel('SKU').fill('SF-HARNESS')
    await inspector.getByRole('button', { name: 'Create Item' }).click()

    const harnessItem = page.locator('.catalog-tree-node', { hasText: 'Shop Foreman Harness' })
    await expect(harnessItem).toBeVisible()

    await harnessItem.click()
    await inspector.getByLabel('Description').fill('Shop Foreman Harness - XL')
    await inspector.getByRole('button', { name: 'Save Changes' }).click()

    await expect(page.locator('.catalog-tree-node', { hasText: 'Shop Foreman Harness - XL' })).toBeVisible()
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          shopCatalogItems?: Array<{
            active?: boolean
            description?: string | null
            sku?: string | null
          }>
        }
        const item = state.shopCatalogItems?.find((entry) => entry.sku === 'SF-HARNESS')

        return {
          active: item?.active ?? null,
          description: item?.description ?? null,
        }
      }))
      .toEqual({
        active: true,
        description: 'Shop Foreman Harness - XL',
      })
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
    await page
      .getByRole('dialog', { name: 'Archive item?' })
      .getByRole('button', { name: 'Archive Item' })
      .click()
    await expect(page.locator('.catalog-tree-node', { hasText: 'Hard Hat - White' })).toHaveCount(0)

    await page.getByLabel('Show Archived').check()
    await page.locator('.catalog-tree-node', { hasText: 'Hard Hat - White' }).click()
    await inspector.getByRole('button', { name: 'Delete Item' }).click()
    await page
      .getByRole('dialog', { name: 'Delete item?' })
      .getByRole('button', { name: 'Delete Item' })
      .click()
    await expect(page.locator('.catalog-tree-node', { hasText: 'Hard Hat - White' })).toHaveCount(0)

    await page.locator('.catalog-tree-node', { hasText: 'Field Safety' }).click()
    await inspector.getByRole('button', { name: 'Delete Folder' }).click()
    await page
      .getByRole('dialog', { name: 'Delete folder?' })
      .getByRole('button', { name: 'Delete Folder' })
      .click()
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

  test('timecard export lets admins submit drafts and re-open submitted weeks for corrections', async ({ page }) => {
    await gotoPhase2App(page, '/exports/timecards', createAdminWorkspaceFixture())

    await expect(page.getByTestId('timecard-export-submit-week-week-e2e')).toBeVisible()
    await expect(page.getByTestId('timecard-export-reopen-week-week-admin-2')).toBeVisible()

    await page.getByTestId('timecard-export-submit-week-week-e2e').click()
    await page
      .getByRole('dialog', { name: 'Submit draft week?' })
      .getByRole('button', { name: 'Submit Week' })
      .click()

    await expect(page.getByText('Week submitted.')).toBeVisible()
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          timecardWeeks?: Array<{ id?: string; status?: string }>
        }

        return state.timecardWeeks?.find((week) => week.id === 'week-e2e')?.status ?? null
      }))
      .toBe('submitted')

    await page.getByTestId('timecard-export-reopen-week-week-admin-2').click()
    await page
      .getByRole('dialog', { name: 'Re-open submitted week for corrections?' })
      .getByRole('button', { name: 'Re-open for Corrections' })
      .click()

    await expect(page.getByText('Week re-opened for corrections.')).toBeVisible()
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          timecardWeeks?: Array<{ id?: string; status?: string; submittedAt?: unknown }>
        }

        const week = state.timecardWeeks?.find((entry) => entry.id === 'week-admin-2')
        return week ? { status: week.status, submittedAt: week.submittedAt ?? null } : null
      }))
      .toEqual({ status: 'draft', submittedAt: null })
  })

  test('timecard export lets admins delete draft weeks only', async ({ page }) => {
    await gotoPhase2App(page, '/exports/timecards', createAdminWorkspaceFixture())

    await expect(page.getByTestId('timecard-export-week-week-e2e')).toBeVisible()
    await expect(page.getByTestId('timecard-export-week-week-admin-2')).toBeVisible()
    await expect(page.getByTestId('timecard-export-delete-week-week-e2e')).toBeVisible()
    await expect(page.getByTestId('timecard-export-delete-week-week-admin-2')).toHaveCount(0)

    await page.getByTestId('timecard-export-delete-week-week-e2e').click()
    await page
      .getByRole('dialog', { name: 'Delete draft week?' })
      .getByRole('button', { name: 'Delete Draft' })
      .click()

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

  test('timecard export deletes editable saved cards through the shared confirmation dialog', async ({ page }) => {
    await gotoPhase2App(page, '/exports/timecards', createAdminWorkspaceFixture())

    await page.getByTestId('timecard-export-week-search').fill('1A')
    await expect(page.getByTestId('timecard-export-week-week-admin-2')).toHaveCount(0)
    await expect.poll(async () => page.locator('.timecards-canvas__item').count()).toBe(1)

    await page.getByRole('button', { name: 'Edit Card', exact: true }).click()
    await page.getByRole('button', { name: 'Delete Card', exact: true }).click()
    await page
      .getByRole('dialog', { name: 'Delete saved timecard?' })
      .getByRole('button', { name: 'Delete Card' })
      .click()

    await expect(page.getByText('Removed the timecard.')).toBeVisible()
    await expect.poll(async () => page.locator('.timecards-canvas__item').count()).toBe(0)
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          timecardCards?: Array<{ id?: string }>
        }

        return state.timecardCards?.some((card) => card.id === 'card-admin-1') ?? true
      }))
      .toBe(false)
  })

  test('timecard export csv downloads the filtered package from the real export page', async ({ page }) => {
    await gotoPhase2App(page, '/exports/timecards', createExportActionsFixture())

    await page.getByTestId('timecard-export-week-search').fill('1A')
    await expect(page.getByTestId('timecard-export-week-week-admin-2')).toHaveCount(0)
    await expect.poll(async () => page.locator('.timecards-canvas__item').count()).toBe(1)

    await page.getByRole('button', { name: 'Export CSV' }).click()

    await expect(page.getByText('Downloaded CSV with 1 detail row from 1 timecard.')).toBeVisible()
  })

  test('timecard export pdf opens the real print route payload', async ({ page, context }) => {
    const fixture = createAdminWorkspaceFixture()
    await context.addInitScript((state) => {
      Object.assign(window, { __PHASE2_E2E__: state })
      window.print = () => undefined
    }, fixture)

    await gotoPhase2App(page, '/exports/timecards', fixture)

    await page.getByTestId('timecard-export-week-search').fill('1A')
    await expect(page.getByTestId('timecard-export-week-week-admin-2')).toHaveCount(0)
    await expect.poll(async () => page.locator('.timecards-canvas__item').count()).toBe(1)

    const popupPromise = page.waitForEvent('popup')
    await page.getByRole('button', { name: 'Export PDF' }).click()
    const popup = await popupPromise

    await expect(page.getByText('Opened 1 timecard for PDF export.')).toBeVisible()
    await expect(popup).toHaveURL(/\/exports\/timecards\/print\?exportId=/)
    await expect(popup.getByTestId('timecard-export-print-document')).toBeVisible()
    for (const exportPage of [page, popup]) {
      expect(await exportPage.evaluate(() => ({
        local: localStorage.getItem('phase2-timecard-pdf-exports'),
        session: sessionStorage.getItem('phase2-timecard-pdf-exports'),
      }))).toEqual({ local: null, session: null })
    }
    await popup.close()
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
      window.sessionStorage.setItem(
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
