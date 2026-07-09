import { expect, test } from './helpers/test.js'
import {
  createAdminWorkspaceFixture,
  createJobDashboardFixture,
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

test.describe('route access control', () => {
  test('foremen are redirected away from admin-only routes', async ({ page }) => {
    await gotoPhase2App(page, '/users', createJobDashboardFixture())

    await expect(page).toHaveURL(/\/jobs$/)
    await expect(page.getByTestId('job-card-1A')).toBeVisible()
  })

  test('foremen are redirected away from jobs they are not assigned to', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-blocked/daily-logs', createJobDashboardFixture())

    await expect(page).toHaveURL(/\/jobs$/)
    await expect(page.getByTestId('job-card-1A')).toBeVisible()
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

  test('project managers can use assigned job workflows like foremen for now', async ({ page }) => {
    const fixture = createProjectManagerDashboardFixture()

    await gotoPhase2App(page, '/jobs', fixture)

    await expect(page.getByTestId('job-card-1A')).toBeVisible()

    await page.goto('/jobs/job-e2e/timecards')
    await expect(page.getByTestId('timecards-page')).toBeVisible()
    await expect(page.getByText(/missing or insufficient permissions/i)).toHaveCount(0)

    await page.goto('/jobs/job-e2e/daily-logs')
    await expect(page.getByTestId('daily-logs-page')).toBeVisible()
    await expect(page.getByText(/missing or insufficient permissions/i)).toHaveCount(0)

    await page.goto('/jobs/job-e2e/shop-orders')
    await expect(page.getByTestId('shop-orders-page')).toBeVisible()
    await expect(page.getByText(/missing or insufficient permissions/i)).toHaveCount(0)
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
