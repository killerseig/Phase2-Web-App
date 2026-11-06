import { expect, test } from './helpers/test'
import { mockDashboard } from './helpers/dashboardFixture'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture'

for (const screen of [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'phone', width: 390, height: 844 },
]) {
  test.describe(screen.name, () => {
    test.use({ viewport: { width: screen.width, height: screen.height } })
    for (const role of ['employee', 'admin', 'foreman'] as const) {
      test(role + ' cannot enter personal timecards while other access is preserved', async ({ page }) => {
        const fixture = createJobsFixture()
        fixture.auth.profile.role = role
        const requests: string[] = []
        page.on('request', request => {
          if (request.url().includes('ensureTimecardWeekRecord')) requests.push(request.url())
        })
        await gotoPhase2App(page, '/jobs/my-timecard', fixture)
        await expect(page.getByText('My Timecard is temporarily unavailable', { exact: true })).toBeVisible()
        await expect(page.getByRole('combobox', { name: 'Payroll job' })).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Save my timecard', exact: true })).toHaveCount(0)
        await expect(page.locator('.app-shell__nav a[href="/jobs/my-timecard"]')).toHaveCount(0)
        await expect(page.locator('.app-shell__nav a[href="/jobs"]')).toHaveCount(role === 'employee' ? 0 : 1)
        await expect(page.locator('.app-shell__nav a[href="/users"]')).toHaveCount(role === 'admin' ? 1 : 0)
        expect(requests).toHaveLength(0)
      })
    }

    test('employee cannot bypass the pause through Jobs', async ({ page }) => {
      const fixture = createJobsFixture()
      fixture.auth.profile.role = 'employee'
      await mockDashboard(page,false)
      await gotoPhase2App(page, '/jobs', fixture)
      await expect(page).toHaveURL(/\/dashboards\/announcements$/)
      await expect(page.getByRole('heading', {name:'Announcements',exact:true})).toBeVisible()
    })
  })
}
