import { expect, test } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { mockDashboard } from './helpers/dashboardFixture.js'

for (const width of [1280, 390])
  test(`large dashboard jobs list is searchable and bounded at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const api = await mockDashboard(page)
    api.layouts.set('role-admin', {
      version: 1,
      widgets: [{ id: 'jobs', type: 'jobs', title: 'Assigned jobs', text: '', span: 12 }],
    })
    const fixture = createJobsFixture()
    fixture.jobs = Array.from({ length: 85 }, (_, index) => ({
      ...fixture.jobs[0]!,
      id: `job-${index}`,
      code: `P${index}`,
      name: index === 84 ? 'North Campus Remodel' : `Building ${index}`,
    }))
    await gotoPhase2App(page, '/dashboards/role', fixture)
    const widget = page.locator('.dashboard-jobs')
    const region = widget.getByRole('region', { name: 'Matching jobs' })
    const search = widget.getByRole('searchbox', { name: 'Find a job' })
    await expect(region.locator('article')).toHaveCount(85)
    await expect(widget.getByRole('status')).toHaveText('85 of 85 jobs')
    const dimensions = await region.evaluate((element) => ({
      height: element.clientHeight,
      content: element.scrollHeight,
    }))
    expect(dimensions.height).toBeLessThanOrEqual(490)
    expect(dimensions.content).toBeGreaterThan(dimensions.height)
    await search.click()
    await region.focus()
    await expect(region).toBeFocused()
    await page.keyboard.press('PageDown')
    await expect.poll(() => region.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    await search.fill('  north P84  ')
    await expect(region.locator('article')).toHaveCount(1)
    await expect(widget.getByRole('status')).toHaveText('1 of 85 jobs')
    await expect(region.getByRole('link', { name: 'Timecards', exact: true })).toHaveAttribute(
      'href',
      '/jobs/job-84/timecards',
    )
    await expect(region.getByRole('link', { name: 'Daily Logs', exact: true })).toHaveAttribute(
      'href',
      '/jobs/job-84/daily-logs',
    )
    await expect(region.getByRole('link', { name: 'Shop Orders', exact: true })).toHaveAttribute(
      'href',
      '/jobs/job-84/shop-orders',
    )
    await search.fill('no-such-job')
    await expect(
      widget.getByText('No jobs match your search. Try a different job number or name.'),
    ).toBeVisible()
    await search.press('Tab')
    await expect(widget.getByRole('button', { name: 'Clear search' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(search).toBeFocused()
    await expect(region.locator('article')).toHaveCount(85)
    await search.fill('Campus')
    await search.press('Escape')
    await expect(search).toHaveValue('')
    await expect(region.locator('article')).toHaveCount(85)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    await widget.screenshot({ path: test.info().outputPath(`jobs-${width}.png`) })
  })
