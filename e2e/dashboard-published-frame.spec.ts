import { expect, test, type Page } from './helpers/test.js'
import { mockDashboard } from './helpers/dashboardFixture.js'
import {
  createJobsFixture,
  createJobDashboardFixture,
  gotoPhase2App,
} from './helpers/phase2AppFixture.js'
import type { SharedDashboardWidget } from '../functions/src/sharedDashboardModel.js'
import { createRequire } from 'node:module'
const { defaultDashboardViewport } = createRequire(import.meta.url)(
  '../functions/lib/sharedDashboardModel.js',
) as typeof import('../functions/src/sharedDashboardModel')

const widgets: SharedDashboardWidget[] = [
  {
    id: 'alpha',
    type: 'text',
    title: 'Alpha',
    text: 'Frame reference',
    span: 6,
    placement: { x: 3, y: 4, w: 6, h: 8 },
  },
]
const frame = { x: 60, y: 64, width: 600, height: 360 }
const config = () => ({
  ...defaultDashboardViewport(),
  width: 960,
  frame: 'custom' as const,
  mode: 'fixed' as const,
  pan: 'locked' as const,
  publishedFrame: { ...frame },
})
const controls = (page: Page) => page.getByRole('group', { name: 'Published frame', exact: true })
async function editFrame(page: Page) {
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.locator('.dashboard-view-settings summary').click()
  await page.getByRole('button', { name: 'Adjust published frame', exact: true }).click()
  await page.getByLabel('Snap to grid', { exact: true }).uncheck()
}
async function setup(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1000 })
  const api = await mockDashboard(page)
  api.layouts.set('personal', { version: 1, widgets: structuredClone(widgets), viewport: config() })
  await gotoPhase2App(page, '/dashboards/personal', createJobsFixture())
  await editFrame(page)
  return api
}
async function drag(page: Page, label: string, dx: number, dy: number, finish = true) {
  const handle = controls(page).getByRole('button', { name: label, exact: true })
  await handle.scrollIntoViewIfNeeded()
  const box = (await handle.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 6 })
  if (finish) await page.mouse.up()
}

for (const scale of ['Fit', '50%'])
  test(`published frame moves/resizes independently at ${scale}, with single-step history and cancellation`, async ({
    page,
  }) => {
    const api = await setup(page)
    if (scale === '50%') {
      await page.getByRole('button', { name: 'Actual size', exact: true }).click()
      for (let i = 0; i < 5; i++)
        await page.getByRole('button', { name: 'Zoom out', exact: true }).click()
    }
    const alpha = page.locator('[data-widget-id="alpha"]')
    const initialWidget = (await alpha.boundingBox())!
    const initial = (await controls(page).boundingBox())!
    const zoom = initial.width / frame.width
    await expect(controls(page).getByRole('button')).toHaveCount(9)
    const pegs = await controls(page)
      .locator('[data-selection-control]:not([data-selection-control="move"])')
      .evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().width))
    pegs.forEach((width) => expect(width).toBeCloseTo(24, 1))
    await drag(page, 'Move Published frame', 40 * zoom, 32 * zoom)
    await expect(page.getByLabel('Frame X', { exact: true })).toHaveValue('100')
    await expect(page.getByLabel('Frame Y', { exact: true })).toHaveValue('96')
    await expect.poll(() => alpha.boundingBox()).toEqual(initialWidget)
    await page.getByRole('button', { name: 'Undo template edit', exact: true }).click()
    await expect(page.getByLabel('Frame X', { exact: true })).toHaveValue('60')
    await expect(page.getByLabel('Frame Y', { exact: true })).toHaveValue('64')
    await drag(page, 'Resize published frame', 80 * zoom, 64 * zoom)
    await expect(page.getByLabel('Published width', { exact: true })).toHaveValue('680')
    await expect(page.getByLabel('Published height', { exact: true })).toHaveValue('424')
    await expect.poll(() => alpha.boundingBox()).toEqual(initialWidget)
    await drag(page, 'Resize published frame from nw', 30 * zoom, 25 * zoom, false)
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await expect(page.getByLabel('Frame X', { exact: true })).toHaveValue('60')
    await expect(page.getByLabel('Published width', { exact: true })).toHaveValue('680')
    await controls(page)
      .getByRole('button', { name: 'Move Published frame', exact: true })
      .press('Shift+ArrowLeft')
    await expect(page.getByLabel('Frame X', { exact: true })).toHaveValue('56')
    await controls(page)
      .getByRole('button', { name: 'Resize published frame from n', exact: true })
      .press('ArrowUp')
    await expect(page.getByLabel('Published height', { exact: true })).toHaveValue('425')
    await page.getByRole('button', { name: 'Save template', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
    expect(api.layouts.get('personal')!.widgets).toEqual(widgets)
    expect(api.layouts.get('personal')!.viewport).toMatchObject({
      width: 960,
      start: { x: 0, y: 0 },
      publishedFrame: { x: 56, y: 63, width: 680, height: 425 },
    })
    await page.reload()
    await editFrame(page)
    await expect(page.getByLabel('Published width', { exact: true })).toHaveValue('680')
    await page.screenshot({
      path: `test-results/dashboard-published-frame-${scale.replace('%', '')}.png`,
    })
  })

test('published window defines runtime cropping, origin, fit and pan policy without reflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 900 })
  const api = await mockDashboard(page)
  api.layouts.set('personal', { version: 1, widgets: structuredClone(widgets), viewport: config() })
  await gotoPhase2App(page, '/dashboards/personal', createJobsFixture())
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  const bounds = page.locator('.shared-published-bounds'),
    alpha = page.locator('[data-widget-id="alpha"]')
  const windowRect = (await bounds.boundingBox())!,
    widgetRect = (await alpha.boundingBox())!
  expect(windowRect.width).toBe(600)
  expect(windowRect.height).toBe(360)
  expect(widgetRect.width).toBe(240)
  expect(widgetRect.x - windowRect.x).toBeCloseTo(60, 1)
  expect(widgetRect.y - windowRect.y).toBeCloseTo(64, 1)
  await expect(bounds).toHaveCSS('overflow', 'hidden')
  await expect(controls(page)).toHaveCount(0)
  await page.getByLabel('Dashboard canvas', { exact: true }).press('ArrowDown')
  await expect.poll(() => alpha.boundingBox()).toEqual(widgetRect)
  await editFrame(page)
  await page.getByLabel('Runtime layout', { exact: true }).selectOption('scale')
  await page.getByLabel('Published width', { exact: true }).fill('1800')
  await page.getByLabel('Runtime panning', { exact: true }).selectOption('overflow')
  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  const available = await page
    .getByLabel('Dashboard canvas', { exact: true })
    .evaluate((el) => el.clientWidth)
  await expect
    .poll(async () => (await alpha.boundingBox())!.width)
    .toBeCloseTo((240 * available) / 1800, 1)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.locator('.dashboard-view-settings summary').click()
  await page.getByLabel('Runtime layout', { exact: true }).selectOption('fixed')
  await page.getByLabel('Starting X (columns)', { exact: true }).fill('2')
  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  const viewport = page.getByLabel('Dashboard canvas', { exact: true })
  await expect.poll(() => viewport.evaluate((el) => el.scrollLeft)).toBe(80)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.locator('.dashboard-view-settings summary').click()
  await page.getByLabel('Runtime panning', { exact: true }).selectOption('free')
  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  const before = (await alpha.boundingBox())!
  await viewport.press('ArrowLeft')
  await expect.poll(async () => (await alpha.boundingBox())!.x - before.x).toBeCloseTo(40, 1)
})

for (const scope of [
  { key: 'role-admin', url: '/dashboards/role-home', type: 'jobs' as const },
  { key: 'all-jobs', url: '/dashboards/job-home/job-1', type: 'workflows' as const },
])
  test(`${scope.key} saves its frame and keeps shared editing restricted`, async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 })
    const api = await mockDashboard(page)
    const entries = [
      ...widgets,
      { id: 'tools', type: scope.type, span: 12 as const, title: 'Required', text: '' },
    ]
    api.layouts.set(scope.key, { version: 1, widgets: entries, viewport: config() })
    await gotoPhase2App(page, scope.url, createJobsFixture())
    await editFrame(page)
    await controls(page)
      .getByRole('button', { name: 'Move Published frame', exact: true })
      .press('ArrowRight')
    await page.getByRole('button', { name: 'Save template', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
    expect(api.layouts.get(scope.key)!.viewport!.publishedFrame!.x).toBe(61)
    expect(api.layouts.get(scope.key)!.widgets).toEqual(entries)
  })

test('undelegated role members see no frame authoring controls', async ({ page }) => {
  const api = await mockDashboard(page, false)
  api.layouts.set('role-foreman', { version: 1, widgets, viewport: config() })
  await gotoPhase2App(page, '/dashboards/role-home', createJobDashboardFixture())
  await expect(page.getByRole('heading', { name: 'Foreman home', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
  await expect(controls(page)).toHaveCount(0)
  expect(api.requests.filter((r) => r.action === 'save-template')).toHaveLength(0)
})

test('legacy frame controls are opt-in; live snap, all edges and cancel leave widgets and saved bounds intact', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  const api = await mockDashboard(page)
  const legacy = {
    ...defaultDashboardViewport(),
    mode: 'fixed' as const,
    width: 960,
    height: 480,
    frame: 'custom' as const,
  }
  api.layouts.set('personal', { version: 1, widgets: structuredClone(widgets), viewport: legacy })
  await gotoPhase2App(page, '/dashboards/personal', createJobsFixture())
  await editFrame(page)
  const initial = (await controls(page).boundingBox())!,
    scale = initial.width / 960
  await controls(page).getByRole('button', { name: 'Move Published frame', exact: true }).click()
  await controls(page)
    .getByRole('button', { name: 'Resize published frame from n', exact: true })
    .press('ArrowLeft')
  await expect(page.getByLabel('Frame X', { exact: true })).toHaveCount(0)
  for (const direction of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
    const label =
      direction === 'se' ? 'Resize published frame' : `Resize published frame from ${direction}`
    await drag(
      page,
      label,
      direction.includes('e') ? -25 * scale : direction.includes('w') ? 25 * scale : 0,
      direction.includes('s') ? -25 * scale : direction.includes('n') ? 25 * scale : 0,
      false,
    )
    await expect
      .poll(
        async () =>
          (await controls(page).boundingBox())!.width +
          (await controls(page).boundingBox())!.height,
      )
      .toBeLessThan(initial.width + initial.height - 10 * scale)
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await expect(page.getByLabel('Frame X', { exact: true })).toHaveCount(0)
  }
  await page.getByLabel('Snap to grid', { exact: true }).check()
  await drag(page, 'Move Published frame', 55 * scale, 45 * scale, false)
  await expect
    .poll(async () => (await controls(page).boundingBox())!.x - initial.x)
    .toBeCloseTo(40 * scale, 1)
  await expect(page.getByLabel('Frame X', { exact: true })).toHaveCount(0)
  await page.mouse.up()
  await expect(page.getByLabel('Frame X', { exact: true })).toHaveValue('40')
  await expect(page.getByLabel('Frame Y', { exact: true })).toHaveValue('32')
  await drag(page, 'Move Published frame', 45 * scale, 40 * scale, false)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await page.mouse.up()
  await expect(page.getByLabel('Frame X', { exact: true })).toHaveValue('40')
  await page.getByRole('button', { name: 'Reset frame bounds', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save template', exact: true })).toBeDisabled()
  expect(api.layouts.get('personal')!.viewport).not.toHaveProperty('publishedFrame')
  expect(api.layouts.get('personal')!.widgets).toEqual(widgets)
})

test('negative published origins produce intentional margins without moving authored widgets', async ({
  page,
}) => {
  const api = await mockDashboard(page)
  api.layouts.set('personal', {
    version: 1,
    widgets,
    viewport: { ...config(), publishedFrame: { ...frame, x: -80, y: -32 }, start: { x: 1, y: 1 } },
  })
  await gotoPhase2App(page, '/dashboards/personal', createJobsFixture())
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  const bounds = (await page.locator('.shared-published-bounds').boundingBox())!
  const widget = (await page.locator('[data-widget-id="alpha"]').boundingBox())!
  expect(widget.x - bounds.x).toBeCloseTo(200, 1)
  expect(widget.y - bounds.y).toBeCloseTo(160, 1)
  await expect(page.locator('.shared-published-bounds')).toHaveCSS('overflow', 'hidden')
})
