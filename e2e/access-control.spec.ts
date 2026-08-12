import { expect, test } from './helpers/test.js'
import {
  createAdminWorkspaceFixture,
  createDailyLogsFixture,
  createJobDashboardFixture,
  createShopOrdersFixture,
  createTimecardsFixture,
  gotoPhase2App,
} from './helpers/phase2AppFixture.js'

function createProjectManagerDashboardFixture() {
  const fixture = createJobDashboardFixture()

  fixture.auth.user.email = 'pm@example.com'
  fixture.auth.user.displayName = 'Pat Project Manager'
  fixture.auth.profile.email = 'pm@example.com'
  fixture.auth.profile.firstName = 'Pat'
  fixture.auth.profile.lastName = 'Project Manager'
  fixture.auth.profile.role = 'project-manager'
  fixture.users = fixture.users.map((user) => (
    user.id === 'foreman-e2e'
      ? {
          ...user,
          email: 'pm@example.com',
          firstName: 'Pat',
          lastName: 'Project Manager',
          role: 'project-manager',
        }
      : user
  ))

  return fixture
}

function createProjectManagerTimecardReportFixture() {
  const fixture = createTimecardsFixture({ seededCard: true })

  fixture.auth.user.uid = 'pm-e2e'
  fixture.auth.user.email = 'pm@example.com'
  fixture.auth.user.displayName = 'Pat Project Manager'
  fixture.auth.profile.id = 'pm-e2e'
  fixture.auth.profile.email = 'pm@example.com'
  fixture.auth.profile.firstName = 'Pat'
  fixture.auth.profile.lastName = 'Project Manager'
  fixture.auth.profile.role = 'project-manager'
  fixture.auth.profile.assignedJobIds = ['job-e2e']
  fixture.users = [
    {
      id: 'pm-e2e',
      email: 'pm@example.com',
      firstName: 'Pat',
      lastName: 'Project Manager',
      role: 'project-manager',
      active: true,
      assignedJobIds: ['job-e2e'],
    },
    {
      id: 'foreman-e2e',
      email: 'cj@example.com',
      firstName: 'Chris',
      lastName: '(CJ) Larsen',
      role: 'foreman',
      active: true,
      assignedJobIds: ['job-e2e'],
    },
  ]
  fixture.jobs[0].assignedForemanIds = ['pm-e2e', 'foreman-e2e']
  fixture.timecardWeeks = [
    {
      ...fixture.timecardWeeks[0],
      status: 'submitted',
      submittedAt: '2026-06-04T17:00:00.000Z',
    },
    {
      ...fixture.timecardWeeks[0],
      id: 'week-draft-pm-hidden',
      weekStartDate: '2026-06-07',
      weekEndDate: '2026-06-13',
      status: 'draft',
      employeeCardCount: 0,
      submittedAt: null,
    },
  ]

  return fixture
}

function createOnePixelPngBuffer() {
  return (globalThis as unknown as {
    Buffer: { from: (bytes: number[]) => unknown }
  }).Buffer.from([
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00,
    0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00,
    0x0c, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xd7, 0x63,
    0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x03, 0x01, 0x01,
    0x00, 0x18, 0xdd, 0x8d,
    0xb0, 0x00, 0x00, 0x00,
    0x00, 0x49, 0x45, 0x4e,
    0x44, 0xae, 0x42, 0x60,
    0x82,
  ])
}

function createShopForemanDashboardFixture() {
  const fixture = createJobDashboardFixture()

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
  ]
  fixture.jobs = [
    {
      ...fixture.jobs[0],
      id: 'job-shop',
      code: '736',
      name: 'Shop',
      type: 'general',
      assignedForemanIds: [],
    },
    {
      ...fixture.jobs[0],
      id: 'job-field',
      code: '5229',
      name: 'Lucky 3 Ranch',
      type: 'general',
      assignedForemanIds: [],
    },
  ]

  return fixture
}

function createShopForemanTimecardsFixture() {
  const fixture = createTimecardsFixture({ seededCard: false })

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
  ]
  fixture.jobs[0] = {
    ...fixture.jobs[0],
    code: '736',
    name: 'Shop',
    assignedForemanIds: [],
  }
  fixture.timecardWeeks = []
  fixture.timecardCards = []

  return fixture
}

function createPayrollAdminFixture() {
  const fixture = createAdminWorkspaceFixture()

  fixture.auth.user.uid = 'payroll-e2e'
  fixture.auth.user.email = 'payroll@example.com'
  fixture.auth.user.displayName = 'Mackensie Payroll'
  fixture.auth.profile.id = 'payroll-e2e'
  fixture.auth.profile.email = 'payroll@example.com'
  fixture.auth.profile.firstName = 'Mackensie'
  fixture.auth.profile.lastName = 'Payroll'
  fixture.auth.profile.role = 'payroll'
  fixture.auth.profile.assignedJobIds = []
  fixture.users = [
    {
      id: 'payroll-e2e',
      email: 'payroll@example.com',
      firstName: 'Mackensie',
      lastName: 'Payroll',
      role: 'payroll',
      active: true,
      assignedJobIds: [],
    },
    ...fixture.users,
  ]

  return fixture
}

test.describe('route access control', () => {
  test('foremen are redirected away from admin-only routes', async ({ page }) => {
    const deniedRoutes = [
      '/users',
      '/employees',
      '/exports/timecards',
      '/settings/shop-catalog',
    ]

    await gotoPhase2App(page, deniedRoutes[0], createJobDashboardFixture())

    for (const route of deniedRoutes) {
      if (page.url() !== new URL(route, page.url()).toString()) {
        await page.goto(route)
      }

      await expect(page).toHaveURL(/\/jobs$/)
      await expect(page.getByRole('heading', { name: 'Jobs' })).toBeVisible()
    }

    await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Employees' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Timecard Export' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Shop Catalog' })).toHaveCount(0)
  })

  test('foremen are redirected away from jobs they are not assigned to', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-blocked/daily-logs', createJobDashboardFixture())

    await expect(page).toHaveURL(/\/jobs$/)
    await expect(page.getByRole('heading', { name: 'Jobs' })).toBeVisible()
    await expect(page.getByTestId('daily-logs-page')).toHaveCount(0)
  })

  test('foremen can see jobs assigned on the job record when profile assignments are stale', async ({ page }) => {
    const fixture = createJobDashboardFixture()
    fixture.auth.profile.assignedJobIds = []
    fixture.users = fixture.users.map((user) => (
      user.id === 'foreman-e2e'
        ? { ...user, assignedJobIds: [] }
        : user
    ))
    fixture.jobs[0].assignedForemanIds = ['foreman-e2e']

    await gotoPhase2App(page, '/jobs', fixture)

    await expect(page.getByTestId('job-card-1A')).toBeVisible()
  })

  test('foremen can use timecards when job record assignment exists but profile assignments are stale', async ({ page }) => {
    const fixture = createTimecardsFixture({ seededCard: false })
    fixture.auth.profile.assignedJobIds = []
    fixture.users = fixture.users.map((user) => (
      user.id === 'foreman-e2e'
        ? { ...user, assignedJobIds: [] }
        : user
    ))
    fixture.jobs[0].assignedForemanIds = ['foreman-e2e']
    fixture.timecardWeeks = []
    fixture.timecardCards = []

    await gotoPhase2App(page, '/jobs/job-e2e/timecards', fixture)

    await expect(page.getByTestId('timecards-page')).toBeVisible()
    await page.getByTestId('timecards-week-ending').fill('2026-06-06')
    await page.getByTestId('timecards-week-ending').dispatchEvent('change')
    await expect(page.getByTestId('create-week')).toBeEnabled()
    await page.getByTestId('create-week').click()
    await expect(page.getByTestId('create-card')).toBeEnabled()
    await expect(page.getByText(/missing or insufficient permissions/i)).toHaveCount(0)
  })

  test('foremen can submit daily logs when job record assignment exists but profile assignments are stale', async ({ page }) => {
    const fixture = createDailyLogsFixture()
    fixture.auth.profile.assignedJobIds = []
    fixture.users = fixture.users.map((user) => (
      user.id === 'foreman-e2e'
        ? { ...user, assignedJobIds: [] }
        : user
    ))
    fixture.jobs[0].assignedForemanIds = ['foreman-e2e']
    fixture.dailyLogs[0].payload = {
      ...fixture.dailyLogs[0].payload,
      weeklySchedule: 'Crew A framing, Crew B layout.',
      manpowerAssessment: 'Staffing is sufficient for the planned work.',
      safetyConcerns: 'Reviewed lift traffic and floor openings.',
      ahaReviewed: 'Reviewed before work started.',
      scheduleConcerns: 'No blockers.',
      budgetConcerns: 'No concerns.',
      deliveriesReceived: 'Received fasteners.',
      deliveriesNeeded: 'Need board by Thursday.',
      newWorkAuthorizations: 'None.',
      qcAssignedTo: 'CJ Larsen',
      qcAreasInspected: 'Lobby and corridor.',
      qcIssuesIdentified: 'No open issues.',
      qcIssuesResolved: 'N/A.',
      notesCorrespondence: 'Updated PM.',
      actionItems: 'Confirm delivery window.',
    }

    await gotoPhase2App(page, '/jobs/job-e2e/daily-logs', fixture)

    await expect(page.getByTestId('daily-logs-page')).toBeVisible()
    await page.getByRole('button', { name: 'Submit Daily Log' }).click()
    await expect(page.getByText(/missing or insufficient permissions/i)).toHaveCount(0)
    await expect(page.getByText('Daily log submitted and emailed.')).toBeVisible()
  })

  test('foremen can type and save daily log draft fields for assigned jobs', async ({ page }) => {
    const fixture = createDailyLogsFixture()
    fixture.auth.profile.assignedJobIds = []
    fixture.users = fixture.users.map((user) => (
      user.id === 'foreman-e2e'
        ? { ...user, assignedJobIds: [] }
        : user
    ))
    fixture.jobs[0].assignedForemanIds = ['foreman-e2e']
    const draftNotes = 'Vince can type daily log details with spaces.'

    await gotoPhase2App(page, '/jobs/job-e2e/daily-logs', fixture)

    await expect(page.getByTestId('daily-logs-page')).toBeVisible()
    await expect(page.getByTestId('dailylog-weeklySchedule')).toBeEnabled()
    await page.getByTestId('dailylog-weeklySchedule').fill(draftNotes)
    await page.getByRole('button', { name: 'Save Draft' }).click()

    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          dailyLogs?: Array<{ id: string; payload?: { weeklySchedule?: string } }>
        }
        return state.dailyLogs?.find((log) => log.id === 'daily-log-1')?.payload?.weeklySchedule ?? ''
      }))
      .toBe(draftNotes)
    await expect(page.getByText(/missing or insufficient permissions/i)).toHaveCount(0)
  })

  test('foremen can submit shop orders when job record assignment exists but profile assignments are stale', async ({ page }) => {
    const fixture = createShopOrdersFixture()
    fixture.auth.profile.assignedJobIds = []
    fixture.users = fixture.users.map((user) => (
      user.id === 'foreman-e2e'
        ? { ...user, assignedJobIds: [] }
        : user
    ))
    fixture.jobs[0].assignedForemanIds = ['foreman-e2e']

    await gotoPhase2App(page, '/jobs/job-e2e/shop-orders', fixture)

    await expect(page.getByTestId('shop-orders-page')).toBeVisible()
    await page.getByTestId('shoporder-root-row').click({ button: 'right' })
    await page.getByTestId('shoporder-context-expand-all').click()
    await page.getByTestId('shoporder-add-item-box').click()
    await page.getByTestId('shoporder-submit').click()
    await page
      .getByRole('dialog', { name: 'Submit shop order?' })
      .getByRole('button', { name: 'Submit Order' })
      .click()
    await expect(page.getByText(/missing or insufficient permissions/i)).toHaveCount(0)
    await expect(page.getByTestId('shoporder-comments')).toHaveCount(0)
  })

  test('project managers can use assigned daily log and shop order workflows', async ({ page }) => {
    const fixture = createProjectManagerDashboardFixture()

    await gotoPhase2App(page, '/jobs', fixture)

    await expect(page.getByTestId('job-card-1A')).toBeVisible()

    await page.goto('/jobs/job-e2e/daily-logs')
    await expect(page.getByTestId('daily-logs-page')).toBeVisible()
    await expect(page.getByText(/missing or insufficient permissions/i)).toHaveCount(0)
    await page.getByRole('button', { name: 'Create Daily Log' }).click()

    const photosCard = page.locator('.daily-logs-card', {
      has: page.getByRole('heading', { name: 'Photos', exact: true }),
    })
    await photosCard.locator('input[type="file"]').setInputFiles({
      name: 'pm-progress.png',
      mimeType: 'image/png',
      buffer: createOnePixelPngBuffer() as never,
    })
    await expect(photosCard.getByText('pm-progress.png')).toBeVisible()
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          dailyLogs?: Array<{ payload?: { attachments?: unknown[] } }>
        }
        return state.dailyLogs?.some((log) => (log.payload?.attachments?.length ?? 0) > 0) ?? false
      }))
      .toBe(true)

    await page.goto('/jobs/job-e2e/shop-orders')
    await expect(page.getByTestId('shop-orders-page')).toBeVisible()
    await expect(page.getByText(/missing or insufficient permissions/i)).toHaveCount(0)
  })

  test('project managers can edit assigned jobs and assign foremen without delete or archive access', async ({ page }) => {
    const fixture = createProjectManagerDashboardFixture()
    fixture.users.push({
      id: 'vince-e2e',
      email: 'vince@example.com',
      firstName: 'Vince',
      lastName: 'Hintz',
      role: 'foreman',
      active: true,
      assignedJobIds: [],
    })

    await gotoPhase2App(page, '/jobs', fixture)

    await expect(page.getByTestId('job-card-1A')).toBeVisible()
    await expect(page.getByTestId('jobs-edit-mode')).toBeVisible()

    await page.getByTestId('jobs-edit-mode').click()
    await page.getByTestId('job-card-1A').click()

    await expect(page.getByRole('heading', { name: 'Phase 2 Company Acoustical remodel' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Archive Job|Restore Job|Delete Job/ })).toHaveCount(0)

    await page.getByLabel('Job Name').fill('Assigned PM Billing Job')
    await page.getByLabel('Start Date').fill('2026-06-02')
    await page.getByLabel('Burden').fill('0.42')
    await page.getByPlaceholder('Search foremen or project managers').fill('Vince')
    await page.locator('.jobs-foreman-toggle', { hasText: 'Vince Hintz' }).click()

    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          jobs?: Array<{
            id: string
            assignedForemanIds?: string[]
            name?: string
            productionBurden?: number | null
            startDate?: string | null
          }>
          users?: Array<{ id: string; assignedJobIds?: string[] }>
        }
        const job = state.jobs?.find((entry) => entry.id === 'job-e2e')
        const foreman = state.users?.find((entry) => entry.id === 'vince-e2e')
        return Boolean(
          job?.name === 'Assigned PM Billing Job'
          && job?.startDate === '2026-06-02'
          && job?.productionBurden === 0.42
          && job.assignedForemanIds?.includes('vince-e2e')
          && foreman?.assignedJobIds?.includes('job-e2e'),
        )
      }))
      .toBe(true)
    await expect(page.getByText(/missing or insufficient permissions/i)).toHaveCount(0)
  })

  test('project managers view assigned job submitted timecards without draft or edit access', async ({ page }) => {
    const fixture = createProjectManagerTimecardReportFixture()

    await gotoPhase2App(page, '/jobs/job-e2e/timecards', fixture)

    await expect(page.getByTestId('timecards-page')).toBeVisible()
    await expect(page.getByTestId('timecards-history-week-e2e')).toBeVisible()
    await expect(page.getByTestId('timecards-history-week-draft-pm-hidden')).toHaveCount(0)
    await expect(page.getByTestId('timecards-card-card-e2e')).toBeVisible()
    await expect(page.getByTestId('create-week')).toHaveCount(0)
    await expect(page.getByTestId('create-card')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Submit Week' })).toBeDisabled()
    await expect(page.getByText(/missing or insufficient permissions/i)).toHaveCount(0)
  })

  test('role dashboard gives project managers assigned job shortcuts only', async ({ page }) => {
    const fixture = createProjectManagerDashboardFixture()
    fixture.jobs.push({
      ...fixture.jobs[0],
      id: 'job-blocked',
      code: '9Z',
      name: 'Unassigned PM Job',
      assignedForemanIds: [],
    })

    await gotoPhase2App(page, '/dashboard', fixture)

    await expect(page.getByTestId('role-dashboard-job-shortcut-job-e2e')).toBeVisible()
    await expect(page.getByTestId('role-dashboard-job-shortcut-job-blocked')).toHaveCount(0)
    await expect(
      page
        .getByTestId('role-dashboard-job-shortcut-job-e2e')
        .getByRole('link', { name: 'Submitted Timecards' }),
    ).toBeVisible()
  })

  test('project managers cannot open unassigned job dashboards directly', async ({ page }) => {
    const fixture = createProjectManagerDashboardFixture()
    fixture.jobs.push({
      ...fixture.jobs[0],
      id: 'job-blocked',
      code: '9Z',
      name: 'Unassigned PM Job',
      assignedForemanIds: [],
    })

    await gotoPhase2App(page, '/jobs/job-blocked/daily-logs', fixture)

    await expect(page).toHaveURL(/\/jobs$/)
    await expect(page.getByRole('heading', { name: 'Jobs' })).toBeVisible()
    await expect(page.getByTestId('daily-logs-page')).toHaveCount(0)
  })

  test('shop foremen can open the Shop job workflow from the role dashboard', async ({ page }) => {
    await gotoPhase2App(page, '/dashboard', createShopForemanDashboardFixture())

    await expect(page.getByTestId('role-dashboard-module-shop-catalog')).toBeVisible()
    await expect(page.getByTestId('role-dashboard-job-shortcut-job-shop')).toBeVisible()
    await expect(page.getByTestId('role-dashboard-job-shortcut-job-field')).toHaveCount(0)

    await page
      .getByTestId('role-dashboard-job-shortcut-job-shop')
      .getByRole('link', { name: 'Shop Orders' })
      .click()

    await expect(page).toHaveURL(/\/jobs\/job-shop\/shop-orders$/)
    await expect(page.getByTestId('shop-orders-page')).toBeVisible()
    await expect(page.getByText(/missing or insufficient permissions/i)).toHaveCount(0)
  })

  test('shop foremen can use Shop daily logs without explicit assignment', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-shop/daily-logs', createShopForemanDashboardFixture())

    await expect(page).toHaveURL(/\/jobs\/job-shop\/daily-logs$/)
    await expect(page.getByTestId('daily-logs-page')).toBeVisible()
    await expect(page.getByText(/missing or insufficient permissions/i)).toHaveCount(0)
  })

  test('shop foremen can create Shop timecard weeks without explicit assignment', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e/timecards', createShopForemanTimecardsFixture())

    await expect(page).toHaveURL(/\/jobs\/job-e2e\/timecards$/)
    await expect(page.getByTestId('timecards-page')).toBeVisible()
    await page.getByTestId('timecards-week-ending').fill('2026-06-06')
    await page.getByTestId('timecards-week-ending').dispatchEvent('change')
    await expect(page.getByTestId('create-week')).toBeEnabled()
    await page.getByTestId('create-week').click()
    await expect(page.getByTestId('create-card')).toBeEnabled()
    await expect(page.getByText(/missing or insufficient permissions/i)).toHaveCount(0)
  })

  test('shop foremen can view all jobs in setup read-only while only drilling into Shop workflows', async ({ page }) => {
    await gotoPhase2App(page, '/jobs', createShopForemanDashboardFixture())

    await expect(page.getByTestId('job-card-736')).toBeVisible()
    await expect(page.getByTestId('job-card-5229')).toBeVisible()
    await expect(page.getByTestId('jobs-edit-mode')).toHaveCount(0)
    await expect(page.getByTestId('jobs-new-button')).toHaveCount(0)
    await expect(page.getByLabel('Job Name')).toHaveCount(0)

    await page.goto('/jobs/job-field/shop-orders')

    await expect(page).toHaveURL(/\/jobs$/)
    await expect(page.getByRole('heading', { name: 'Jobs' })).toBeVisible()
    await expect(page.getByTestId('shop-orders-page')).toHaveCount(0)
  })

  test('payroll can manage employees and open timecard export without other admin routes', async ({ page }) => {
    await gotoPhase2App(page, '/employees', createPayrollAdminFixture())

    await expect(page).toHaveURL(/\/employees$/)
    await expect(page.getByTestId('employees-page')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Employees' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Timecard Export' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Shop Catalog' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Reference Lists' })).toHaveCount(0)

    await page.getByRole('button', { name: 'New Employee' }).click()
    await page.getByLabel('Employee Number').fill('4001')
    await page.getByLabel('First Name').fill('Mackensie')
    await page.getByLabel('Last Name').fill('Dannels')
    await page.getByLabel('Occupation').fill('Payroll Specialist')
    await page.getByRole('button', { name: 'Create Employee', exact: true }).click()

    await page.getByTestId('employees-search').fill('4001')
    await expect(page.locator('.employees-browser__secondary', { hasText: 'Employee #4001' })).toBeVisible()

    const occupationInput = page.getByLabel('Occupation')
    await occupationInput.fill('Payroll Lead')
    await occupationInput.blur()

    await expect(page.getByText('All changes saved.')).toBeVisible()
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          employees?: Array<{ employeeNumber?: string; occupation?: string }>
        }
        return state.employees?.find((employee) => employee.employeeNumber === '4001')?.occupation ?? null
      }))
      .toBe('Payroll Lead')

    await page.getByRole('link', { name: 'Timecard Export' }).click()

    await expect(page).toHaveURL(/\/exports\/timecards$/)
    await expect(page.getByTestId('timecard-export-page')).toBeVisible()
    await expect(page.getByText(/missing or insufficient permissions/i)).toHaveCount(0)
  })

  test('payroll cannot open field workflow forms', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e/shop-orders', createPayrollAdminFixture())

    await expect(page).toHaveURL(/\/jobs$/)
    await expect(page.getByRole('heading', { name: 'Jobs' })).toBeVisible()
    await expect(page.getByTestId('shop-orders-page')).toHaveCount(0)
  })

  test('project managers cannot open employee management', async ({ page }) => {
    await gotoPhase2App(page, '/employees', createProjectManagerDashboardFixture())

    await expect(page).toHaveURL(/\/jobs$/)
    await expect(page.getByRole('heading', { name: 'Jobs' })).toBeVisible()
    await expect(page.getByTestId('employees-page')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Employees' })).toHaveCount(0)
  })

  test('admins can open job routes even when the job is not assigned to them', async ({ page }) => {
    const fixture = createAdminWorkspaceFixture()
    fixture.jobs.push({
      id: 'job-blocked',
      name: 'Blocked Job For Admin Check',
      code: '9Z',
      gc: 'Phase 2',
      type: 'general',
      active: true,
      assignedForemanIds: [],
      notificationRecipients: {
        dailyLogs: [],
        timecards: [],
        shopOrders: [],
      },
      productionBurden: 0.33,
    })

    await gotoPhase2App(page, '/jobs/job-blocked/daily-logs', fixture)

    await expect(page).toHaveURL(/\/jobs\/job-blocked\/daily-logs$/)
    await expect(page.getByTestId('daily-logs-page')).toBeVisible()
  })

  test('users without a valid workspace role are redirected back to login', async ({ page }) => {
    const fixture = createJobDashboardFixture()
    fixture.auth.profile.role = 'none'
    fixture.users[0].role = 'none'

    await gotoPhase2App(page, '/jobs', fixture)

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Phase 2 Web Application' })).toBeVisible()
  })
})
