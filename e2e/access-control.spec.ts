import { expect, test } from './helpers/test.js'
import { createAdminWorkspaceFixture, createJobDashboardFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

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
