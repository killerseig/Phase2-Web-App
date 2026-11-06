import { expect, test, type Page } from './helpers/test.js'
import { mockDashboard } from './helpers/dashboardFixture.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import type { SharedDashboardWidget } from '../functions/src/sharedDashboardModel.js'

type Point = { x: number; y: number }
type Samples = Record<string, number[]>
const legacyText: SharedDashboardWidget = {
  id: 'opaque',
  type: 'text',
  span: 12,
  title: 'Opaque legacy widget',
  text: 'First line\n' + '\n'.repeat(8) + 'Last line',
}

// Decode the actual composited browser screenshot, not the SVG or its CSS.
// CSS-pixel screenshots keep the same sampling coordinates on Retina displays.
async function pixels(page: Page, points: Record<string, Point>): Promise<Samples> {
  const entries = Object.values(points)
  const x = Math.floor(Math.min(...entries.map((p) => p.x))) - 4
  const y = Math.floor(Math.min(...entries.map((p) => p.y))) - 4
  const width = Math.ceil(Math.max(...entries.map((p) => p.x))) - x + 5
  const height = Math.ceil(Math.max(...entries.map((p) => p.y))) - y + 5
  const screenshot = await page.screenshot({
    clip: { x, y, width, height },
    scale: 'css',
    animations: 'disabled',
    caret: 'hide',
  })
  return page.evaluate(
    async ({ source, points, x, y }) => {
      const image = new Image()
      image.src = source
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0)
      return Object.fromEntries(
        Object.entries(points).map(([name, point]) => [
          name,
          Array.from(
            context.getImageData(Math.round(point.x - x) - 2, Math.round(point.y - y) - 2, 5, 5)
              .data,
          ),
        ]),
      )
    },
    { source: 'data:image/png;base64,' + screenshot.toString('base64'), points, x, y },
  )
}

function difference(a: number[], b: number[]) {
  return a.reduce((sum, value, index) => sum + Math.abs(value - b[index]!), 0)
}

async function surface(page: Page, id = 'shared-dashboard') {
  return page.locator(`[data-widget-surface="${id}"]`).evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      scale: rect.width / (element as HTMLElement).offsetWidth,
    }
  })
}

function snapPoint(grid: Awaited<ReturnType<typeof surface>>, column: number, row: number) {
  return { x: grid.x + (column * grid.width) / 24, y: grid.y + row * 32 * grid.scale }
}

for (const scope of [
  { name: 'personal', key: 'personal', url: '/dashboards/personal' },
  { name: 'role', key: 'role-admin', url: '/dashboards/role-home' },
  { name: 'job', key: 'all-jobs', url: '/dashboards/job-home/job-1' },
]) {
  test(`${scope.name} grid paints real snap points over an opaque legacy widget`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 })
    const api = await mockDashboard(page)
    const widgets = [structuredClone(legacyText)]
    if (scope.name !== 'personal')
      widgets.push({
        id: 'required',
        type: scope.name === 'job' ? 'workflows' : 'jobs',
        span: 12,
        title: 'Required tools',
        text: '',
      })
    api.layouts.set(scope.key, { version: 1, widgets })
    await gotoPhase2App(page, scope.url, createJobsFixture())
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
    await expect(page.locator('.dashboard-snap-grid')).toHaveCount(0)
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    const overlay = page.locator('[data-widget-surface="shared-dashboard"] > .dashboard-snap-grid')
    const widget = page.locator('[data-widget-id="opaque"]')
    await expect(overlay).toBeVisible()
    await expect(widget).not.toHaveAttribute('style', /position:\s*absolute/)
    expect(await widget.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
      'rgba(0, 0, 0, 0)',
    )
    const grid = await surface(page)
    const points = {
      major: snapPoint(grid, 12, 4),
      minor: snapPoint(grid, 13, 5),
      between: snapPoint(grid, 12.5, 4.5),
    }
    const bounds = (await widget.boundingBox())!
    for (const point of Object.values(points)) {
      expect(point.x).toBeGreaterThan(bounds.x + 10)
      expect(point.x).toBeLessThan(bounds.x + bounds.width - 10)
      expect(point.y).toBeGreaterThan(bounds.y + 50)
      expect(point.y).toBeLessThan(bounds.y + bounds.height - 10)
    }
    const shown = await pixels(page, points)
    await page.getByLabel('Show grid', { exact: true }).uncheck()
    await expect(overlay).toHaveCount(0)
    const hidden = await pixels(page, points)
    const major = difference(shown.major!, hidden.major!)
    const minor = difference(shown.minor!, hidden.minor!)
    expect(minor, 'Minor snap dot must be visible above the opaque widget').toBeGreaterThan(30)
    expect(major, 'Major intersections must be visibly stronger than minor dots').toBeGreaterThan(
      minor,
    )
    expect(
      difference(shown.between!, hidden.between!),
      'No dot between snap intersections',
    ).toBeLessThan(5)

    await page.getByLabel('Show grid', { exact: true }).check()
    await expect(overlay).toBeVisible()
    // Click at a painted intersection: the decorative overlay must not intercept it.
    if (await widget.evaluate((el) => el.classList.contains('is-selected')))
      await widget.click({
        position: { x: points.major.x - bounds.x, y: points.major.y - bounds.y },
        modifiers: ['Control'],
      })
    await expect(widget).not.toHaveClass(/is-selected/)
    await page.mouse.click(points.major.x, points.major.y)
    await expect(widget).toHaveClass(/is-selected/)
    const move = (await widget
      .getByRole('button', { name: 'Move Opaque legacy widget', exact: true })
      .boundingBox())!
    await page.mouse.move(move.x + move.width / 2, move.y + move.height / 2)
    await page.mouse.down()
    await page.mouse.move(move.x + move.width / 2, move.y + move.height / 2 + 64 * grid.scale, {
      steps: 5,
    })
    await page.mouse.up()
    await expect(page.getByLabel('Top row', { exact: true })).toHaveValue('2')
    await page.getByRole('button', { name: 'Save template', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
    expect(api.layouts.get(scope.key)!.viewport!.grid.visible).toBe(true)
    await expect(page.locator('.dashboard-snap-grid')).toHaveCount(0)
    const runtime = await surface(page)
    const runtimePixels = await pixels(page, {
      snap: snapPoint(runtime, 12, 4),
      between: snapPoint(runtime, 12.5, 4.5),
    })
    expect(
      difference(runtimePixels.snap!, runtimePixels.between!),
      'Runtime has no painted grid',
    ).toBeLessThan(5)
  })
}

test('a nested canvas paints its own snap points without parent grid dots', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  const api = await mockDashboard(page)
  api.layouts.set('personal', {
    version: 1,
    widgets: [
      {
        id: 'panel',
        type: 'container',
        span: 12,
        title: 'Nested panel',
        text: '',
        placement: { x: 3, y: 1, w: 17, h: 17 },
        container: {
          kind: 'panel',
          labels: ['Content'],
          direction: 'row',
          ratio: 50,
          collapsed: false,
        },
      },
      { ...legacyText, parentId: 'panel', region: '0', placement: { x: 0, y: 0, w: 24, h: 10 } },
    ],
  })
  await gotoPhase2App(page, '/dashboards/personal', createJobsFixture())
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page.locator('.dashboard-snap-grid')).toHaveCount(2)
  await expect(
    page.locator('[data-widget-surface="shared-dashboard"] > svg mask > rect[fill="black"]'),
  ).toHaveCount(1)
  const parent = await surface(page)
  const nested = await surface(page, 'panel')
  const child = (await page.locator('[data-widget-id="opaque"]').boundingBox())!
  const withinBlankContent = (point: Point) =>
    point.x > child.x + child.width * 0.5 &&
    point.x < child.x + child.width - 15 &&
    point.y > child.y + 100 * nested.scale &&
    point.y < child.y + 230 * nested.scale
  const distance = (value: number, step: number) =>
    Math.abs(value - Math.round(value / step) * step)
  const awayFrom = (point: Point, grid: typeof parent) =>
    distance(point.x - grid.x, grid.width / 24) > 5 ||
    distance(point.y - grid.y, 32 * grid.scale) > 5
  const candidates = Array.from({ length: 24 * 10 }, (_, i) => ({
    column: i % 24,
    row: Math.floor(i / 24),
  }))
  const parentOnly = candidates
    .map(({ column, row }) => snapPoint(parent, column, row))
    .find((point) => withinBlankContent(point) && awayFrom(point, nested))
  const localOnly = candidates
    .map(({ column, row }) => snapPoint(nested, column, row))
    .find((point) => withinBlankContent(point) && awayFrom(point, parent))
  expect(
    parentOnly,
    'Fixture must contain a parent intersection away from the local grid',
  ).toBeTruthy()
  expect(
    localOnly,
    'Fixture must contain a local intersection away from the parent grid',
  ).toBeTruthy()
  const points = { parentOnly: parentOnly!, localOnly: localOnly! }
  const shown = await pixels(page, points)
  await page.getByLabel('Show grid', { exact: true }).uncheck()
  await expect(page.locator('.dashboard-snap-grid')).toHaveCount(0)
  const hidden = await pixels(page, points)
  expect(
    difference(shown.localOnly!, hidden.localOnly!),
    'Local grid is visible over its child widget',
  ).toBeGreaterThan(30)
  expect(
    difference(shown.parentOnly!, hidden.parentOnly!),
    'Parent grid is masked throughout the container',
  ).toBeLessThan(5)
})

test('workspace grid follows pan, zoom and native scroll without editing the layout', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  const api = await mockDashboard(page)
  const widgets = [{ ...legacyText, placement: { x: 0, y: 0, w: 24, h: 10 } }]
  api.layouts.set('personal', { version: 1, widgets: structuredClone(widgets) })
  await gotoPhase2App(page, '/dashboards/personal', createJobsFixture())
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const viewport = page.getByLabel('Dashboard canvas', { exact: true })
  const actualSize = page.getByRole('button', { name: 'Actual size', exact: true })
  const save = page.getByRole('button', { name: 'Save template', exact: true })
  const showGrid = page.getByLabel('Show grid', { exact: true })
  await actualSize.click()
  await expect(actualSize).toHaveText('100%')
  await expect(page.getByRole('button', { name: 'Fit', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(page.locator('[data-dashboard-origin]')).toBeVisible()
  const initial = await surface(page)
  const view = (await viewport.boundingBox())!
  await expect(save).toBeDisabled()
  await page.getByRole('button', { name: 'Pan', exact: true }).click()
  for (let i = 0; i < 2; i++) {
    await page.mouse.move(view.x + 80, view.y + 100)
    await page.mouse.down()
    await page.mouse.move(view.x + view.width - 80, view.y + 170, { steps: 5 })
    await page.mouse.up()
  }
  await expect.poll(async () => (await surface(page)).x).toBeGreaterThan(view.x + view.width + 50)
  await expect(save).toBeDisabled()

  async function checkWorkspacePixels() {
    const grid = await surface(page)
    const column = 4 * Math.round((view.x + view.width * 0.35 - grid.x) / (grid.width / 6))
    const row = 4 * Math.round((view.y + view.height * 0.45 - grid.y) / (128 * grid.scale))
    const points = {
      snap: snapPoint(grid, column, row),
      between: snapPoint(grid, column + 0.5, row + 0.5),
    }
    expect(points.snap.x, 'Sample is in the workspace outside the moved canvas').toBeLessThan(
      grid.x - 10,
    )
    const shown = await pixels(page, points)
    await showGrid.uncheck()
    await expect(page.locator('.dashboard-snap-grid')).toHaveCount(0)
    const hidden = await pixels(page, points)
    expect(
      difference(shown.snap!, hidden.snap!),
      'Workspace dot follows the actual canvas origin',
    ).toBeGreaterThan(30)
    expect(
      difference(shown.between!, hidden.between!),
      'Workspace has no off-grid dot',
    ).toBeLessThan(5)
    await showGrid.check()
    await expect(save).toBeDisabled()
  }
  await checkWorkspacePixels()
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect(actualSize).toHaveText('110%')
  await expect(save).toBeDisabled()
  await checkWorkspacePixels()
  const beforeScroll = await surface(page)
  await viewport.evaluate((el) => el.scrollTo(73, 89))
  await expect
    .poll(() => viewport.evaluate((el) => [el.scrollLeft, el.scrollTop]))
    .toEqual([73, 89])
  await expect.poll(async () => (await surface(page)).x).toBeCloseTo(beforeScroll.x - 73, 1)
  await expect.poll(async () => (await surface(page)).y).toBeCloseTo(beforeScroll.y - 89, 1)
  await checkWorkspacePixels()
  await actualSize.click()
  await page.getByRole('button', { name: 'Return to canvas origin', exact: true }).click()
  await expect(actualSize).toHaveText('100%')
  await expect(page.getByRole('button', { name: 'Fit', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect.poll(() => viewport.evaluate((el) => [el.scrollLeft, el.scrollTop])).toEqual([0, 0])
  await expect.poll(async () => (await surface(page)).x).toBeCloseTo(initial.x, 1)
  await expect.poll(async () => (await surface(page)).y).toBeCloseTo(initial.y, 1)
  await expect(page.locator('[data-dashboard-origin]')).toBeVisible()
  await expect(save).toBeDisabled()
  expect(api.layouts.get('personal')!.widgets).toEqual(widgets)
  expect(api.requests.filter((request) => String(request.action).startsWith('save'))).toHaveLength(
    0,
  )
})
