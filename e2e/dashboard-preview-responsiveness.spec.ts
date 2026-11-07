import { expect, test, type Page } from './helpers/test.js'
import { mockDashboard } from './helpers/dashboardFixture.js'
import {
  createJobsFixture,
  createJobDashboardFixture,
  gotoPhase2App,
} from './helpers/phase2AppFixture.js'
import { createRequire } from 'node:module'
import type { SharedDashboardWidget } from '../functions/src/sharedDashboardModel.js'
const { defaultDashboardViewport } = createRequire(import.meta.url)(
  '../functions/lib/sharedDashboardModel.js',
) as typeof import('../functions/src/sharedDashboardModel')
const tools: SharedDashboardWidget = {
  id: 'tools',
  type: 'workflows',
  title: 'Job tools',
  text: '',
  span: 12,
  placement: { x: 0, y: 0, w: 24, h: 12 },
}
const job = { id: 'job-1', code: '1A', name: 'Acoustical Remodel' }
async function columns(page: Page) {
  return page
    .locator('.module-launcher-grid')
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
}
async function check(page: Page, count: number, description: 'block' | 'none') {
  await expect.poll(() => columns(page)).toBe(count)
  await expect(page.locator('.module-launcher-card p').first()).toHaveCSS('display', description)
  await expect
    .poll(() =>
      page
        .locator('.module-launcher-card')
        .first()
        .evaluate((el) => el.scrollWidth - el.clientWidth),
    )
    .toBe(0)
}
for (const scope of [
  { key: 'personal', path: '/dashboards/personal', chooseJob: true },
  { key: 'role-admin', path: '/dashboards/role-home', chooseJob: true },
  { key: 'all-jobs', path: '/dashboards/job-home/job-1', chooseJob: false },
]) {
  test(`${scope.key} tools follow device width at different zoom and browser sizes`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 })
    const api = await mockDashboard(page, true, scope.chooseJob ? null : job)
    const widgets = [tools]
    if (scope.key === 'role-admin')
      widgets.push({
        id: 'jobs',
        type: 'jobs',
        title: 'Jobs',
        text: '',
        span: 12,
        placement: { x: 0, y: 14, w: 24, h: 10 },
      })
    api.layouts.set(scope.key, {
      version: 1,
      widgets,
      viewport: { ...defaultDashboardViewport(), width: 1600 },
    })
    await gotoPhase2App(page, scope.path, createJobsFixture())
    if (scope.chooseJob)
      await page
        .getByRole('combobox', { name: 'Choose job for tools', exact: true })
        .selectOption('job-1')
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await check(page, 4, 'block')
    await page.getByRole('button', { name: 'Phone', exact: true }).click()
    await check(page, 2, 'none')
    await expect(page.locator('[data-widget-id="tools"]')).toHaveCSS('padding', '14px')
    await page.getByRole('button', { name: 'Actual size', exact: true }).click()
    await check(page, 2, 'none')
    await page.getByRole('button', { name: 'Tablet', exact: true }).click()
    await check(page, 2, 'block')
    await page.setViewportSize({ width: 640, height: 900 })
    await page.getByRole('button', { name: 'Desktop', exact: true }).click()
    await check(page, 4, 'block')
    await expect(page.locator('[data-widget-id="tools"]')).toHaveCSS('padding', '18px')
    await expect(page.getByRole('button', { name: 'Save template', exact: true })).toBeDisabled()
    expect(api.requests.filter((r) => String(r.action).startsWith('save'))).toHaveLength(0)
  })
}

test('a narrow nested Job tools widget uses one readable column on a desktop browser', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  const api = await mockDashboard(page, true, job)
  api.layouts.set('all-jobs', {
    version: 1,
    widgets: [
      {
        id: 'panel',
        type: 'container',
        title: 'Panel',
        text: '',
        span: 12,
        placement: { x: 0, y: 0, w: 8, h: 24 },
        container: {
          kind: 'panel',
          labels: ['Content'],
          direction: 'row',
          ratio: 50,
          collapsed: false,
        },
      },
      { ...tools, parentId: 'panel', region: '0', placement: { x: 0, y: 0, w: 20, h: 14 } },
    ],
  })
  await gotoPhase2App(page, '/dashboards/job-home/job-1', createJobsFixture())
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await check(page, 1, 'none')
  await page.getByRole('button', { name: 'Fit content', exact: true }).click()
  await check(page, 1, 'none')
})

test('legacy Jobs keeps its existing viewport-responsive launcher and navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/jobs/job-e2e', createJobDashboardFixture())
  await check(page, 4, 'block')
  await expect(page.locator('.module-launcher-grid')).not.toHaveClass(
    /module-launcher-grid--container/,
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await check(page, 2, 'none')
  await page.getByTestId('job-dashboard-module-timecards').click()
  await expect(page).toHaveURL(/\/jobs\/job-e2e\/timecards$/)
  await expect(page.getByTestId('timecards-page')).toBeVisible()
})
