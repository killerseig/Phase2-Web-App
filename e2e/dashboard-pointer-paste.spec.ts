import { expect, test, type Page } from './helpers/test.js'
import { mockDashboard } from './helpers/dashboardFixture.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import type { SharedDashboardWidget as Widget } from '../functions/src/sharedDashboardModel.js'

const text: Widget = {
  id: 'a',
  type: 'text',
  title: 'Alpha',
  text: 'First',
  span: 6,
  placement: { x: 2.25, y: 3, w: 6, h: 5 },
}
const canvas = (page: Page) => page.getByLabel('Dashboard canvas', { exact: true })
const undo = (page: Page) => page.getByRole('button', { name: 'Undo template edit', exact: true })
const scopes = [
  { key: 'personal', url: '/dashboards/personal', tools: [] },
  {
    key: 'role-admin',
    url: '/dashboards/role-home',
    tools: [
      {
        ...text,
        id: 'tools',
        type: 'jobs',
        title: 'Jobs',
        placement: { x: 0, y: 25, w: 24, h: 5 },
      },
    ],
  },
  {
    key: 'all-jobs',
    url: '/dashboards/job-home/job-1',
    tools: [
      {
        ...text,
        id: 'tools',
        type: 'workflows',
        title: 'Tools',
        placement: { x: 0, y: 25, w: 24, h: 5 },
      },
    ],
  },
] satisfies { key: string; url: string; tools: Widget[] }[]
async function setup(page: Page, entries: Widget[] = [text], scope = scopes[0]!) {
  await page.setViewportSize({ width: 1600, height: 1000 })
  const api = await mockDashboard(page)
  api.layouts.set(scope.key, { version: 1, widgets: structuredClone([...entries, ...scope.tools]) })
  await gotoPhase2App(page, scope.url, createJobsFixture())
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page
    .getByRole('group', { name: 'On this dashboard', exact: true })
    .getByRole('button', { name: 'Alpha', exact: true })
    .click()
  await page.locator('[data-widget-id="a"]').focus()
  await page.keyboard.press('Control+c')
  return api
}
async function hoverAt(
  page: Page,
  x: number,
  y: number,
  parent = 'shared-dashboard',
  region = '0',
) {
  const point = await page
    .locator(`[data-widget-surface="${parent}"][data-region="${region}"]`)
    .evaluate(
      (el, p) => {
        const element = el as HTMLElement,
          rect = element.getBoundingClientRect(),
          scale = rect.width / element.offsetWidth
        return {
          x:
            rect.left +
            (element.clientLeft + (element.clientWidth * p.x) / 24 - element.scrollLeft) * scale,
          y: rect.top + (element.clientTop + p.y * 32 - element.scrollTop) * scale,
        }
      },
      { x, y },
    )
  await page.mouse.move(point.x, point.y)
  return point
}

test('paste follows the pointer while Duplicate keeps its separate offset', async ({ page }) => {
  await setup(page)
  await hoverAt(page, 15, 12.25)
  // Native scroll delivery may lag behind an already fresh pointermove.
  await canvas(page).dispatchEvent('scroll')
  await page.keyboard.press('Control+v')
  await expect(page.getByLabel('Left column', { exact: true })).toHaveValue('12')
  await expect(page.getByLabel('Top row', { exact: true })).toHaveValue('10')
  await page.keyboard.press('Control+v')
  await expect(page.getByLabel('Left column', { exact: true })).toHaveValue('13')
  await expect(page.getByLabel('Top row', { exact: true })).toHaveValue('11')
  await undo(page).click()
  await undo(page).click()
  await page.locator('[data-widget-id="a"]').focus()
  await page.keyboard.press('Enter')
  await hoverAt(page, 15, 12.25)
  await page.keyboard.press('Control+d')
  await expect(page.getByLabel('Left column', { exact: true })).toHaveValue('3.25')
  await expect(page.getByLabel('Top row', { exact: true })).toHaveValue('4')
  await undo(page).click()
  await expect(page.getByRole('button', { name: 'Save template', exact: true })).toBeDisabled()
  await canvas(page).focus()
})

for (const scope of scopes)
  for (const device of ['Desktop', 'Tablet', 'Phone']) {
    test(`${scope.key} ${device} anchors using that device and retains all authored sizes`, async ({
      page,
    }) => {
      const source = {
        ...text,
        devices: { tablet: { x: 3, y: 2, w: 10, h: 7 }, phone: { x: 4, y: 2, w: 8, h: 6 } },
      }
      const api = await setup(page, [source], scope)
      await page.getByRole('button', { name: device, exact: true }).click()
      await canvas(page).focus()
      await hoverAt(page, 14, 8.25)
      await page.keyboard.press('Control+v')
      await expect(page.getByLabel('Left column', { exact: true })).toHaveValue(
        device === 'Desktop' ? '11' : device === 'Tablet' ? '9' : '10',
      )
      await expect(page.getByLabel('Top row', { exact: true })).toHaveValue(
        device === 'Desktop' ? '6' : '5',
      )
      await page.getByRole('button', { name: 'Save template', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
      const widgets = api.layouts.get(scope.key)!.widgets,
        copy = widgets.at(-1)!
      expect(widgets[0]).toEqual(source)
      expect(copy.placement!.w).toBe(6)
      expect(copy.devices!.tablet!.w).toBe(10)
      expect(copy.devices!.phone!.w).toBe(8)
      expect(copy.devices!.phone!.x - source.devices.phone.x).toBeCloseTo(
        copy.placement!.x - source.placement!.x,
        8,
      )
      expect(copy.devices!.tablet!.y - source.devices.tablet.y).toBeCloseTo(
        copy.placement!.y - source.placement!.y,
        8,
      )
    })
  }

const invalidations: Record<
  string,
  (page: Page, point: { x: number; y: number }) => Promise<unknown>
> = {
  leave: (page) => page.mouse.move(50, 50),
  blur: (page) => page.evaluate(() => window.dispatchEvent(new Event('blur'))),
  resize: (page) => page.setViewportSize({ width: 1500, height: 900 }),
  scroll: (page) =>
    canvas(page).evaluate((el) => {
      el.scrollTop = 50
    }),
  zoom: (page) =>
    page
      .getByRole('button', { name: 'Zoom out', exact: true })
      .evaluate((el) => (el as HTMLElement).click()),
  device: (page) =>
    page
      .getByRole('button', { name: 'Phone', exact: true })
      .evaluate((el) => (el as HTMLElement).click()),
  touch: (page, point) =>
    canvas(page).dispatchEvent('pointermove', {
      clientX: point.x,
      clientY: point.y,
      pointerType: 'touch',
      isPrimary: true,
    }),
  cancel: (page) => canvas(page).dispatchEvent('pointercancel'),
  gesture: async (page, point) => {
    await page.mouse.down()
    await page.mouse.move(point.x - 50, point.y - 25, { steps: 3 })
    await page.keyboard.press('Control+v')
    await expect(page.locator('[data-widget-id]')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await page.mouse.up()
  },
}

for (const [change, invalidate] of Object.entries(invalidations)) {
  test(`stale pointer after ${change} falls back without changing source`, async ({ page }) => {
    await setup(page)
    const point = await hoverAt(page, 15, 12.25)
    await invalidate(page, point)
    await canvas(page).focus()
    await page.keyboard.press('Control+v')
    await expect(page.getByLabel('Left column', { exact: true })).toHaveValue('3.25')
    await expect(page.getByLabel('Top row', { exact: true })).toHaveValue('4')
    await undo(page).click()
    await expect(page.getByRole('button', { name: 'Save template', exact: true })).toBeDisabled()
  })
}

test('fresh pointer accounts for fractional zoom, editor pan and native scrolling', async ({
  page,
}) => {
  await setup(page)
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click()
  const point = await hoverAt(page, 20, 12.25)
  await page.mouse.down()
  await page.mouse.move(point.x - 35, point.y - 45, { steps: 4 })
  await page.mouse.up()
  await canvas(page).evaluate((el) => {
    el.scrollTop = 40
  })
  await canvas(page).focus()
  await hoverAt(page, 15, 12.25)
  await page.keyboard.press('Control+v')
  await expect(page.getByLabel('Left column', { exact: true })).toHaveValue('12')
  await expect(page.getByLabel('Top row', { exact: true })).toHaveValue('10')
})

const panel: Widget = {
  ...text,
  id: 'panel',
  type: 'container',
  title: 'Panel',
  span: 12,
  placement: { x: 1, y: 1, w: 20, h: 18 },
  container: {
    kind: 'tabs',
    labels: ['One', 'Two'],
    direction: 'row',
    ratio: 50,
    collapsed: false,
  },
}

test('nested native scroll and borders use the matching region without reparenting', async ({
  page,
}) => {
  await setup(page, [panel, { ...text, parentId: 'panel', region: '0' }])
  const surface = page.locator('[data-widget-surface="panel"][data-region="0"]')
  await surface.evaluate((el) => {
    const node = el as HTMLElement
    node.style.minHeight = '0'
    node.style.height = '300px'
    node.style.border = '5px solid transparent'
    const spacer = document.createElement('div')
    spacer.style.height = '1000px'
    spacer.style.width = '1200px'
    spacer.style.pointerEvents = 'none'
    node.append(spacer)
    node.scrollTop = 160
    node.scrollLeft = 40
  })
  await canvas(page).focus()
  await hoverAt(page, 15, 10.25, 'panel')
  await page.keyboard.press('Control+v')
  await expect(page.getByLabel('Left column', { exact: true })).toHaveValue('12')
  await expect(page.getByLabel('Top row', { exact: true })).toHaveValue('8')
  await expect(page.getByLabel('Container', { exact: true })).toHaveValue('panel')
  await expect(
    page.locator('[data-widget-surface="panel"][data-region="0"] [data-widget-id]'),
  ).toHaveCount(2)
})

test('hidden tab hover cannot revive after switching away and back', async ({ page }) => {
  await setup(page, [panel, { ...text, parentId: 'panel', region: '0' }])
  await hoverAt(page, 15, 8.25, 'panel')
  await page
    .getByRole('tab', { name: 'Two', exact: true })
    .evaluate((el) => (el as HTMLElement).click())
  await expect(page.locator('[data-widget-surface="panel"][data-region="0"]')).toBeHidden()
  await page
    .getByRole('tab', { name: 'One', exact: true })
    .evaluate((el) => (el as HTMLElement).click())
  await canvas(page).focus()
  await page.keyboard.press('Control+v')
  await expect(page.getByLabel('Left column', { exact: true })).toHaveValue('3.25')
  await expect(page.getByLabel('Top row', { exact: true })).toHaveValue('4')
})

test('growing a tab canvas retains the stationary pointer for repeated paste', async ({ page }) => {
  await setup(page, [panel, { ...text, parentId: 'panel', region: '0' }])
  await hoverAt(page, 15, 8.25, 'panel')
  await page.keyboard.press('Control+v')
  await expect(page.getByLabel('Left column', { exact: true })).toHaveValue('12')
  await expect(page.getByLabel('Top row', { exact: true })).toHaveValue('6')
  await page.keyboard.press('Control+v')
  await expect(page.getByLabel('Left column', { exact: true })).toHaveValue('13')
  await expect(page.getByLabel('Top row', { exact: true })).toHaveValue('7')
})

test('keyboard Cut cancellation invalidates pre-confirmation pointer', async ({ page }) => {
  await setup(page)
  await hoverAt(page, 15, 12.25)
  await page.keyboard.press('Control+x')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await canvas(page).focus()
  await page.keyboard.press('Control+v')
  await expect(page.getByLabel('Left column', { exact: true })).toHaveValue('3.25')
  await expect(page.getByLabel('Top row', { exact: true })).toHaveValue('4')
})

test('hovering a different container or clipped canvas content does not reparent root copies', async ({
  page,
}) => {
  await setup(page, [text, { ...panel, placement: { x: 12, y: 0, w: 12, h: 18 } }])
  await hoverAt(page, 12, 6, 'panel')
  await page.keyboard.press('Control+v')
  await expect(page.getByLabel('Container', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Left column', { exact: true })).toHaveValue('3.25')
  await undo(page).click()
  await canvas(page).focus()
  // The full surface extends behind the inspector; a hit there is not a canvas hover.
  const box = (await canvas(page).boundingBox())!
  await page.mouse.move(box.x + box.width + 30, box.y + 200)
  await page.keyboard.press('Control+v')
  await expect(page.getByLabel('Left column', { exact: true })).toHaveValue('3.25')
})

test('hovering a flow-only surface preserves existing flow layout', async ({ page }) => {
  const api = await setup(page, [{ ...text, placement: undefined }])
  const box = (await page.locator('[data-widget-id="a"]').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.keyboard.press('Control+v')
  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  expect(api.layouts.get('personal')!.widgets.every((w) => !w.placement && !w.devices)).toBe(true)
})
