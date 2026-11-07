import { expect, test, type Page } from './helpers/test.js'
import { mockDashboard } from './helpers/dashboardFixture.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { createRequire } from 'node:module'
import type {
  SharedDashboardWidget,
  DashboardPublishedFrame,
} from '../functions/src/sharedDashboardModel.js'
const { defaultDashboardViewport } = createRequire(import.meta.url)(
  '../functions/lib/sharedDashboardModel.js',
) as typeof import('../functions/src/sharedDashboardModel')
const entries: SharedDashboardWidget[] = [
  {
    id: 'a',
    type: 'text',
    title: 'Alpha',
    text: 'First',
    span: 6,
    placement: { x: 4, y: 4, w: 6, h: 6 },
  },
  {
    id: 'b',
    type: 'text',
    title: 'Beta',
    text: 'Second',
    span: 6,
    placement: { x: 15, y: 20, w: 8, h: 10 },
    devices: { phone: { x: 0, y: 13, w: 24, h: 5 }, tablet: { x: 1, y: 12, w: 20, h: 8 } },
  },
]
const publishedFrame = { x: -400, y: 500, width: 800, height: 2400 }
const display = () => ({
  ...defaultDashboardViewport(),
  width: 960,
  frame: 'custom' as const,
  mode: 'fixed' as const,
  publishedFrame: { ...publishedFrame },
  start: { x: 2, y: 1 },
  zoom: 0.75,
})
const fit = (page: Page, name: 'frame' | 'content') =>
  page.getByRole('button', { name: `Fit ${name}`, exact: true })
async function measurements(page: Page, bounds: DashboardPublishedFrame) {
  return page.evaluate((bounds) => {
    const view = document.querySelector<HTMLElement>('.shared-dashboard-viewport')!
    const body = document.querySelector<HTMLElement>('.shared-dashboard-content')!
    const v = view.getBoundingClientRect(),
      b = body.getBoundingClientRect(),
      scale = b.width / body.offsetWidth
    return {
      scale,
      left: b.left + bounds.x * scale - v.left - view.clientLeft,
      top: b.top + bounds.y * scale - v.top - view.clientTop,
      width: bounds.width * scale,
      height: bounds.height * scale,
      availableWidth: view.clientWidth,
      availableHeight: view.clientHeight,
    }
  }, bounds)
}
async function assertFit(page: Page, bounds: DashboardPublishedFrame) {
  await expect
    .poll(async () => {
      const m = await measurements(page, bounds)
      return Math.max(
        Math.abs(m.left + m.width / 2 - m.availableWidth / 2),
        Math.abs(m.top + m.height / 2 - m.availableHeight / 2),
      )
    })
    .toBeLessThan(2)
  const m = await measurements(page, bounds)
  expect(m.left).toBeGreaterThanOrEqual(23)
  expect(m.top).toBeGreaterThanOrEqual(23)
  expect(m.left + m.width).toBeLessThanOrEqual(m.availableWidth - 23)
  expect(m.top + m.height).toBeLessThanOrEqual(m.availableHeight - 23)
  expect(m.scale).toBeLessThanOrEqual(1)
  return m
}
async function contentBounds(page: Page) {
  return page.evaluate(() => {
    const body = document.querySelector<HTMLElement>('.shared-dashboard-content')!
    const b = body.getBoundingClientRect(),
      scale = b.width / body.offsetWidth,
      column = body.offsetWidth / 24
    const rects = [
      ...body.querySelectorAll<HTMLElement>(
        '[data-widget-surface="shared-dashboard"] > [data-widget-id]',
      ),
    ]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width && r.height)
    // Browser percentage layout is quantized; measure cell indices to 0.001 cell.
    const cell = (position: number, origin: number, size: number) =>
      Math.round(((position - origin) / scale / size) * 1000) / 1000
    const x = Math.floor(Math.min(...rects.map((r) => cell(r.left, b.left, column)))) * column
    const y = Math.floor(Math.min(...rects.map((r) => cell(r.top, b.top, 32)))) * 32
    return {
      x,
      y,
      width: Math.ceil(Math.max(...rects.map((r) => cell(r.right, b.left, column)))) * column - x,
      height: Math.ceil(Math.max(...rects.map((r) => cell(r.bottom, b.top, 32)))) * 32 - y,
    }
  })
}
async function setup(page: Page, widgets = entries) {
  await page.setViewportSize({ width: 1600, height: 1000 })
  const api = await mockDashboard(page)
  api.layouts.set('personal', {
    version: 1,
    widgets: structuredClone(widgets),
    viewport: display(),
  })
  await gotoPhase2App(page, '/dashboards/personal', createJobsFixture())
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  return api
}

for (const scope of [
  { key: 'personal', url: '/dashboards/personal', required: undefined },
  { key: 'role-admin', url: '/dashboards/role-home', required: 'jobs' as const },
  { key: 'all-jobs', url: '/dashboards/job-home/job-1', required: 'workflows' as const },
])
  test(`${scope.key} fits a translated tall frame and its content without editing or saving`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 })
    const api = await mockDashboard(page)
    const widgets = [
      ...entries,
      ...(scope.required
        ? [
            {
              id: 'tools',
              type: scope.required,
              title: 'Required',
              text: '',
              span: 12 as const,
              placement: { x: 0, y: 35, w: 24, h: 8 },
            },
          ]
        : []),
    ]
    const saved = { version: 1, widgets: structuredClone(widgets), viewport: display() }
    api.layouts.set(scope.key, structuredClone(saved))
    await gotoPhase2App(page, scope.url, createJobsFixture())
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await fit(page, 'frame').focus()
    await page.keyboard.press('Enter')
    await assertFit(page, publishedFrame)
    await expect(fit(page, 'frame')).toBeFocused()
    const bounds = await contentBounds(page)
    await fit(page, 'content').click()
    await assertFit(page, bounds)
    await expect(page.getByRole('button', { name: 'Save template', exact: true })).toBeDisabled()
    await expect(
      page.getByRole('button', { name: 'Undo template edit', exact: true }),
    ).toBeDisabled()
    await page.getByRole('button', { name: 'Cancel edits', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(api.layouts.get(scope.key)).toEqual(saved)
    expect(api.requests.filter((r) => String(r.action).startsWith('save'))).toHaveLength(0)
  })

test('fitting extreme content stays direction-safe below manual zoom and retains 24px pegs', async ({
  page,
}) => {
  await setup(page, [
    { ...entries[0]!, placement: { x: 0, y: 0, w: 24, h: 3 } },
    { ...entries[1]!, placement: { x: 0, y: 997, w: 24, h: 3 } },
  ])
  await fit(page, 'content').click()
  const m = await assertFit(page, { x: 0, y: 0, width: 960, height: 32000 })
  expect(m.scale).toBeLessThan(0.15)
  await expect(page.getByRole('button', { name: 'Zoom out', exact: true })).toBeDisabled()
  const handles = page
    .getByRole('group', { name: 'Selected widget frame', exact: true })
    .locator('[data-selection-control]:not([data-selection-control="move"])')
  const widths = await handles.evaluateAll((nodes) =>
    nodes.map((el) => el.getBoundingClientRect().width),
  )
  expect(widths).toHaveLength(8)
  widths.forEach((w) => expect(w).toBeCloseTo(24, 1))
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  expect((await measurements(page, publishedFrame)).scale).toBeGreaterThan(m.scale)
  await page.getByRole('button', { name: 'Actual size', exact: true }).click()
  expect((await measurements(page, publishedFrame)).scale).toBeCloseTo(1, 2)
  await expect(page.getByRole('button', { name: 'Save template', exact: true })).toBeDisabled()
})

test('empty content falls back to the frame', async ({ page }) => {
  await setup(page, [])
  await fit(page, 'content').click()
  await assertFit(page, publishedFrame)
  await expect(page.getByRole('button', { name: 'Save template', exact: true })).toBeDisabled()
})

test('legacy flow fits its measured content, excluding the edit workspace minimum', async ({
  page,
}) => {
  await setup(page, [{ ...entries[0]!, placement: undefined }])
  const bounds = await contentBounds(page)
  expect(bounds.height).toBeLessThan(500)
  await fit(page, 'content').click()
  await assertFit(page, bounds)
  await expect(page.getByRole('button', { name: 'Save template', exact: true })).toBeDisabled()
})

test('content fit uses root container bounds, not clipped child geometry', async ({ page }) => {
  await setup(page, [
    {
      id: 'panel',
      type: 'container',
      title: 'Panel',
      text: '',
      span: 12,
      placement: { x: 4, y: 3, w: 10, h: 12 },
      container: {
        kind: 'panel',
        labels: ['Content'],
        direction: 'row',
        ratio: 50,
        collapsed: false,
      },
    },
    { ...entries[0]!, parentId: 'panel', region: '0', placement: { x: 2, y: 80, w: 20, h: 8 } },
  ])
  await fit(page, 'content').click()
  const m = await assertFit(page, { x: 160, y: 96, width: 400, height: 384 })
  expect(m.scale).toBe(1)
})

test('fit is one-shot across viewport resize and uses fresh geometry after device changes', async ({
  page,
}) => {
  await setup(page)
  await fit(page, 'frame').click()
  const before = (await measurements(page, publishedFrame)).scale
  await page.setViewportSize({ width: 1400, height: 900 })
  expect((await measurements(page, publishedFrame)).scale).toBeCloseTo(before, 5)
  await fit(page, 'frame').click()
  await assertFit(page, publishedFrame)
  await page.getByRole('button', { name: 'Phone', exact: true }).click()
  await expect(fit(page, 'frame')).toBeDisabled()
  const phone = await contentBounds(page)
  await fit(page, 'content').click()
  await assertFit(page, phone)
  await page.getByRole('button', { name: 'Tablet', exact: true }).click()
  const tablet = await contentBounds(page)
  await fit(page, 'content').click()
  await assertFit(page, tablet)
  await page.getByRole('button', { name: 'Return to canvas origin', exact: true }).click()
  await expect(page.locator('[data-dashboard-origin]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save template', exact: true })).toBeDisabled()
  await page.screenshot({ path: 'test-results/dashboard-fit-tablet.png' })
})
