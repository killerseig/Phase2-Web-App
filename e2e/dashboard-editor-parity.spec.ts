import { expect, test, type Page } from './helpers/test.js'
import { mockDashboard } from './helpers/dashboardFixture.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { createRequire } from 'node:module'
import type { SharedDashboardWidget } from '../functions/src/sharedDashboardModel.js'
const { defaultDashboardViewport } = createRequire(import.meta.url)(
  '../functions/lib/sharedDashboardModel.js',
) as typeof import('../functions/src/sharedDashboardModel')
const widgets: SharedDashboardWidget[] = [
  {
    id: 'a',
    type: 'text',
    span: 6,
    title: 'Alpha',
    text: 'First',
    placement: { x: 1, y: 2, w: 6, h: 8 },
  },
  {
    id: 'b',
    type: 'text',
    span: 6,
    title: 'Beta',
    text: 'Second',
    placement: { x: 10, y: 5, w: 6, h: 8 },
  },
  {
    id: 'c',
    type: 'notes',
    span: 6,
    title: 'Notes',
    text: '',
    placement: { x: 2, y: 15, w: 10, h: 8 },
  },
]
async function setup(page: Page, entries = widgets, edit = true) {
  await page.setViewportSize({ width: 1600, height: 1000 })
  const api = await mockDashboard(page)
  api.layouts.set('personal', { version: 1, widgets: structuredClone(entries) })
  await gotoPhase2App(page, '/dashboards/personal', createJobsFixture())
  if (edit) await page.getByRole('button', { name: 'Edit', exact: true }).click()
  return api
}
const outline = (page: Page) => page.getByRole('group', { name: 'On this dashboard', exact: true })

for (const scope of [
  { name: 'personal', key: 'personal', url: '/dashboards/personal' },
  { name: 'role', key: 'role-admin', url: '/dashboards/role-home' },
  { name: 'job', key: 'all-jobs', url: '/dashboards/job-home/job-1' },
]) {
  test(`${scope.name} saves linked grid, major accents and starting view with free camera panning`, async ({
    page,
  }) => {
    const api = await mockDashboard(page)
    const entries = structuredClone(widgets)
    if (scope.name !== 'personal')
      entries.push({
        id: 'required',
        type: scope.name === 'job' ? 'workflows' : 'jobs',
        title: 'Required tools',
        text: '',
        span: 12,
        placement: { x: 0, y: 30, w: 24, h: 8 },
      })
    api.layouts.set(scope.key, { version: 1, widgets: entries })
    await page.setViewportSize({ width: 1600, height: 1000 })
    await gotoPhase2App(page, scope.url, createJobsFixture())
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    const x = page.getByLabel('Horizontal grid spacing', { exact: true })
    const y = page.getByLabel('Vertical grid spacing', { exact: true })
    await page.getByLabel('Link spacing', { exact: true }).check()
    await y.fill('0.5')
    await y.press('Tab')
    await expect(x).toHaveValue('0.5')
    await x.fill('1.25')
    await x.press('Tab')
    await expect(y).toHaveValue('1.25')
    await page.getByLabel('Link spacing', { exact: true }).uncheck()
    await y.fill('0.5')
    await y.press('Tab')
    await expect(x).toHaveValue('1.25')
    await page.getByLabel('Link spacing', { exact: true }).check()
    await expect(y).toHaveValue('1.25')
    await page.getByLabel('Major grid interval', { exact: true }).fill('8')
    const grid = page.locator('[data-widget-surface="shared-dashboard"]')
    await expect
      .poll(() => grid.evaluate((el) => getComputedStyle(el).getPropertyValue('--grid-major-y')))
      .toBe('320px')
    await expect(grid).toHaveCSS('background-position', '-2px -2px, -2px -2px')
    await page.locator('.dashboard-view-settings summary').click()
    await page.getByLabel('Runtime layout', { exact: true }).selectOption('fixed')
    await page.getByLabel('Runtime panning', { exact: true }).selectOption('free')
    await page.getByLabel('Canvas width', { exact: true }).fill('800')
    await page.getByLabel('Frame bounds', { exact: true }).selectOption('custom')
    await page.getByLabel('Frame height', { exact: true }).fill('500')
    await page.getByLabel('Starting zoom', { exact: true }).fill('0.75')
    await page.getByLabel('Starting X (columns)', { exact: true }).fill('-2')
    await page.getByLabel('Starting Y (rows)', { exact: true }).fill('3.25')
    await page.getByRole('button', { name: 'Save template', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
    expect(api.layouts.get(scope.key)!.widgets).toEqual(entries)
    expect(api.layouts.get(scope.key)!.viewport).toMatchObject({
      start: { x: -2, y: 3.25 },
      grid: { x: 1.25, y: 1.25, linked: true, majorEvery: 8 },
    })
    const viewport = page.getByLabel('Dashboard canvas', { exact: true })
    const frame = page.locator('.shared-preview-frame')
    const start = (await frame.boundingBox())!
    await expect(frame).toHaveCSS('top', '-78px')
    await viewport.focus()
    await page.keyboard.press('ArrowLeft')
    await expect.poll(async () => (await frame.boundingBox())!.x - start.x).toBeCloseTo(40, 1)
    const screen = (await viewport.boundingBox())!
    // Empty background remains pannable far beyond the content, without a scroll-bound wall.
    await page.getByRole('button', { name: 'Pan', exact: true }).click()
    for (let i = 0; i < 4; i++) {
      await page.mouse.move(screen.x + 100, screen.y + screen.height - 30)
      await page.mouse.down()
      await page.mouse.move(screen.x + 450, screen.y + screen.height - 30, { steps: 5 })
      await page.mouse.up()
    }
    await expect.poll(async () => (await frame.boundingBox())!.x - start.x).toBeGreaterThan(1300)
    await page.mouse.move(screen.x + 200, screen.y + 100)
    await page.mouse.wheel(0, 200)
    await expect.poll(async () => (await frame.boundingBox())!.y).toBeLessThan(start.y - 100)
    await page.getByRole('button', { name: 'Reset view', exact: true }).click()
    await expect.poll(async () => (await frame.boundingBox())!.x).toBeCloseTo(start.x, 1)
    await expect(frame).toHaveCSS('top', '-78px')
    expect(api.requests.filter((r) => r.action === 'save-template')).toHaveLength(1)
    await page.getByRole('button', { name: 'Refresh', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await expect(page.getByLabel('Link spacing', { exact: true })).toBeChecked()
    await expect(page.getByLabel('Major grid interval', { exact: true })).toHaveValue('8')
  })
}

test('locked and overflow views preserve distinct pan policies and editor panning is reversible', async ({
  page,
}) => {
  const api = await mockDashboard(page)
  const config = {
    ...defaultDashboardViewport(),
    mode: 'fixed' as const,
    width: 1600,
    height: 500,
    frame: 'custom' as const,
    pan: 'locked' as const,
    start: { x: -2, y: 4 },
  }
  api.layouts.set('personal', { version: 1, widgets: structuredClone(widgets), viewport: config })
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/dashboards/personal', createJobsFixture())
  const frame = page.locator('.shared-preview-frame'),
    viewport = page.getByLabel('Dashboard canvas', { exact: true })
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  await expect(frame).toHaveCSS('top', '-128px')
  const initial = await frame.boundingBox()
  await viewport.focus()
  await page.keyboard.press('PageDown')
  const screen = (await viewport.boundingBox())!
  await page.mouse.move(screen.x + 80, screen.y + 60)
  await page.mouse.wheel(0, 400)
  await expect.poll(() => frame.boundingBox()).toEqual(initial)
  await expect(page.getByRole('button', { name: 'Pan', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('button', { name: 'Pan', exact: true }).click()
  const editorInitial = (await frame.boundingBox())!,
    area = (await viewport.boundingBox())!
  await page.mouse.move(area.x + 100, area.y + 80)
  await page.mouse.down()
  await page.mouse.move(area.x + 300, area.y + 180, { steps: 5 })
  await expect
    .poll(async () => (await frame.boundingBox())!.x)
    .toBeGreaterThan(editorInitial.x + 190)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect.poll(async () => (await frame.boundingBox())!.x).toBeCloseTo(editorInitial.x, 1)
  await page.locator('.dashboard-view-settings summary').click()
  await page.getByLabel('Runtime panning', { exact: true }).selectOption('overflow')
  await page.getByLabel('Starting X (columns)', { exact: true }).fill('2')
  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  await expect.poll(() => viewport.evaluate((el) => el.scrollLeft)).toBeCloseTo(1600 / 12, 0)
  await expect.poll(() => viewport.evaluate((el) => el.scrollTop)).toBe(128)
})

test('grid presets, eight handles and independent locks apply to pointer and keyboard edits', async ({
  page,
}) => {
  const api = await setup(page)
  await outline(page).getByRole('button', { name: 'Alpha', exact: true }).click()
  const alpha = page.locator('[data-widget-id="a"]')
  await expect(alpha.locator('.shared-widget-resize')).toHaveCount(8)
  await page.getByLabel('Grid preset', { exact: true }).selectOption('2')
  await alpha.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByLabel('Left column', { exact: true })).toHaveValue('4')
  await page.getByLabel('Lock position', { exact: true }).check()
  await expect(alpha.getByRole('button', { name: 'Move Alpha', exact: true })).toBeDisabled()
  await expect(page.getByLabel('Left column', { exact: true })).toBeDisabled()
  await alpha.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByLabel('Left column', { exact: true })).toHaveValue('4')
  await expect(
    alpha.getByRole('button', { name: 'Resize Alpha from nw', exact: true }),
  ).toBeDisabled()
  await expect(alpha.getByRole('button', { name: 'Resize Alpha', exact: true })).toBeEnabled()
  await page.getByLabel('Lock size', { exact: true }).check()
  await expect(alpha.getByRole('button', { name: 'Resize Alpha', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  expect(api.layouts.get('personal')!.widgets[0]).toMatchObject({
    positionLocked: true,
    sizeLocked: true,
    placement: { x: 4 },
  })
  expect(api.layouts.get('personal')!.viewport?.grid).toMatchObject({ x: 2, y: 2 })
})

test('unfinished numeric drafts stay undoable and outline reveal recovers a panned-away widget', async ({
  page,
}) => {
  const api = await setup(page)
  const major = page.getByLabel('Major grid interval', { exact: true })
  await major.fill('')
  await major.fill('8')
  await page.getByRole('button', { name: 'Undo template edit', exact: true }).click()
  await expect(major).toHaveValue('')
  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(
    page.getByText('Invalid dashboard viewport settings.', { exact: true }),
  ).toBeVisible()
  expect(api.requests.filter((r) => r.action === 'save-template')).toHaveLength(0)
  await page.getByRole('button', { name: 'Redo template edit', exact: true }).click()
  await expect(major).toHaveValue('8')
  await major.fill('6')
  await page.getByRole('button', { name: 'Undo template edit', exact: true }).click()
  await expect(major).toHaveValue('8')
  await page.getByRole('button', { name: 'Pan', exact: true }).click()
  const view = (await page.getByLabel('Dashboard canvas', { exact: true }).boundingBox())!
  for (let i = 0; i < 4; i++) {
    await page.mouse.move(view.x + 400, view.y + 60)
    await page.mouse.down()
    await page.mouse.move(view.x + 50, view.y + 60, { steps: 5 })
    await page.mouse.up()
  }
  await outline(page).getByRole('button', { name: 'Alpha', exact: true }).dblclick()
  const alpha = (await page.locator('[data-widget-id="a"]').boundingBox())!
  expect(alpha.x + alpha.width).toBeGreaterThan(view.x)
  expect(alpha.x).toBeLessThan(view.x + view.width)
  expect(alpha.y + alpha.height).toBeGreaterThan(view.y)
  expect(alpha.y).toBeLessThan(view.y + view.height)
})

test('multi-selection aligns, groups, copies configuration, and preserves nested notes drafts', async ({
  page,
}) => {
  const api = await setup(page)
  await outline(page).getByRole('button', { name: 'Alpha', exact: true }).click()
  await outline(page)
    .getByRole('button', { name: 'Beta', exact: true })
    .click({ modifiers: ['Control'] })
  await page.getByRole('button', { name: 'Align top', exact: true }).click()
  await page.getByRole('button', { name: 'Group in container', exact: true }).click()
  await expect(page.locator('.shared-dashboard-widget.is-container')).toHaveCount(1)
  await page.getByRole('button', { name: 'Copy selection', exact: true }).click()
  await page.getByRole('button', { name: 'Paste widgets', exact: true }).click()
  await expect(page.locator('.shared-dashboard-widget.is-container')).toHaveCount(2)
  await page.getByRole('button', { name: 'Undo template edit', exact: true }).click()
  await expect(page.locator('.shared-dashboard-widget.is-container')).toHaveCount(1)
  await outline(page).getByRole('button', { name: 'Notes', exact: true }).click()
  const parent = page.getByLabel('Container', { exact: true })
  const groupId = await parent.locator('option').last().getAttribute('value')
  await parent.selectOption(groupId!)
  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  const saved = api.layouts.get('personal')!.widgets
  expect(saved.find((w) => w.id === 'a')!.parentId).toBe(groupId)
  expect(saved.find((w) => w.id === 'b')!.placement!.y).toBe(0)
  expect(saved.find((w) => w.id === 'c')!.parentId).toBe(groupId)
  await page.getByRole('button', { name: 'Edit notes', exact: true }).click()
  await page.getByLabel('Your notes', { exact: true }).fill('Keep this nested draft')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Discard unsaved changes')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByLabel('Your notes', { exact: true })).toHaveValue('Keep this nested draft')
})

test('tablet placement overrides and runtime display save without dirtying the layout when zooming', async ({
  page,
}) => {
  const api = await setup(page)
  await page.getByRole('button', { name: 'Tablet', exact: true }).click()
  await outline(page).getByRole('button', { name: 'Alpha', exact: true }).click()
  await page.getByLabel('Left column', { exact: true }).fill('5')
  await page.getByLabel('Left column', { exact: true }).press('Tab')
  await page.getByRole('button', { name: 'Desktop', exact: true }).click()
  await expect(page.getByLabel('Left column', { exact: true })).toHaveValue('1')
  await page.locator('.dashboard-view-settings summary').click()
  await page.getByLabel('Runtime layout', { exact: true }).selectOption('scale')
  await page.getByLabel('Frame bounds', { exact: true }).selectOption('custom')
  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  expect(api.layouts.get('personal')!.widgets[0]!.devices?.tablet?.x).toBe(5)
  expect(api.layouts.get('personal')!.widgets[1]!.devices).toBeUndefined()
  await page.getByRole('button', { name: 'Zoom dashboard in', exact: true }).click()
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
})

test('all eight pointer handles anchor the opposite edge and escape cancels a live move', async ({
  page,
}) => {
  await setup(page)
  await outline(page).getByRole('button', { name: 'Alpha', exact: true }).click()
  const alpha = page.locator('[data-widget-id="a"]')
  for (const direction of ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']) {
    const before = await alpha.boundingBox()
    expect(before).toBeTruthy()
    const handle = alpha.locator('.resize-' + direction),
      h = await handle.boundingBox()
    expect(h).toBeTruthy()
    await page.mouse.move(h!.x + h!.width / 2, h!.y + h!.height / 2)
    await page.mouse.down()
    await page.mouse.move(h!.x + h!.width / 2 + 20, h!.y + h!.height / 2 + 20, { steps: 5 })
    await page.mouse.up()
    const after = await alpha.boundingBox()
    expect(after).toBeTruthy()
    expect(
      Math.abs(after!.x - before!.x + (direction.includes('w') ? after!.width - before!.width : 0)),
    ).toBeLessThan(2)
    expect(
      Math.abs(
        after!.y - before!.y + (direction.includes('n') ? after!.height - before!.height : 0),
      ),
    ).toBeLessThan(2)
    expect(after).not.toEqual(before)
    await page.getByRole('button', { name: 'Undo template edit', exact: true }).click()
  }
  const before = await alpha.boundingBox(),
    move = await alpha.getByRole('button', { name: 'Move Alpha', exact: true }).boundingBox()
  await page.mouse.move(move!.x + 10, move!.y + 10)
  await page.mouse.down()
  await page.mouse.move(move!.x + 60, move!.y + 50, { steps: 5 })
  await page.keyboard.press('Escape')
  await page.mouse.up()
  expect(await alpha.boundingBox()).toEqual(before)
})

const panel = (
  id: string,
  kind: 'panel' | 'tabs' | 'split' | 'collapsible' = 'panel',
): SharedDashboardWidget => ({
  id,
  type: 'container',
  span: 12,
  title: id,
  text: '',
  container: { kind, labels: ['First', 'Second'], direction: 'row', ratio: 50, collapsed: false },
  placement: { x: 0, y: 0, w: 24, h: 24 },
})

test('saving and cancelling one note preserves another container draft', async ({ page }) => {
  const entries = [
    panel('group'),
    {
      ...widgets[2]!,
      id: 'nested',
      parentId: 'group',
      region: '0',
      placement: { x: 0, y: 0, w: 22, h: 10 },
    },
    { ...widgets[2]!, id: 'root', placement: { x: 0, y: 26, w: 22, h: 10 } },
  ]
  await setup(page, entries, false)
  const nested = page.locator('[data-widget-id="nested"]'),
    root = page.locator('[data-widget-id="root"]')
  await nested.getByRole('button', { name: 'Edit notes', exact: true }).click()
  await nested.getByLabel('Your notes', { exact: true }).fill('Nested unsaved draft')
  await root.getByRole('button', { name: 'Edit notes', exact: true }).click()
  await root.getByLabel('Your notes', { exact: true }).fill('Root note saved')
  await root.getByRole('button', { name: 'Save notes', exact: true }).click()
  await expect(root).toContainText('Root note saved')
  await expect(nested.getByLabel('Your notes', { exact: true })).toHaveValue('Nested unsaved draft')
  await root.getByRole('button', { name: 'Edit notes', exact: true }).click()
  await root.getByRole('button', { name: 'Cancel notes', exact: true }).click()
  await expect(nested.getByLabel('Your notes', { exact: true })).toHaveValue('Nested unsaved draft')
})

test('tab keyboard navigation, outline reveal, safe type conversion and pan do not lose widgets', async ({
  page,
}) => {
  const api = await setup(page, [
    panel('group', 'tabs'),
    { ...widgets[0]!, parentId: 'group', region: '0' },
    { ...widgets[1]!, parentId: 'group', region: '1' },
  ])
  await page.getByRole('tab', { name: 'First', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Second', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByRole('button', { name: 'Undo template edit', exact: true })).toBeDisabled()
  await outline(page).getByRole('button', { name: 'Alpha', exact: true }).dblclick()
  await expect(page.locator('[data-widget-id="a"]')).toBeVisible()
  await outline(page).getByRole('button', { name: 'group', exact: true }).click()
  await page.getByLabel('Container type', { exact: true }).selectOption('panel')
  await expect(page.locator('[data-widget-id="b"]')).toBeVisible()
  const before = await page.locator('[data-widget-id="a"]').getAttribute('style')
  await page.getByRole('button', { name: 'Pan', exact: true }).click()
  const body = await page.locator('[data-widget-id="a"] .shared-variable-text').boundingBox()
  await page.mouse.move(body!.x + 15, body!.y + 10)
  await page.mouse.down()
  await page.mouse.move(body!.x + 70, body!.y + 45, { steps: 5 })
  await page.mouse.up()
  await expect(page.locator('[data-widget-id="a"]')).toHaveAttribute('style', before!)
  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  expect(api.layouts.get('personal')!.widgets.find((w) => w.id === 'b')!.region).toBe('0')
})

test('split ungroup keeps the two visible regions separate and device overrides survive grouping', async ({
  page,
}) => {
  const api = await setup(page, [
    panel('group', 'split'),
    { ...widgets[0]!, parentId: 'group', region: '0', placement: { x: 0, y: 0, w: 20, h: 10 } },
    { ...widgets[1]!, parentId: 'group', region: '1', placement: { x: 0, y: 0, w: 20, h: 10 } },
  ])
  await outline(page).getByRole('button', { name: 'group', exact: true }).click()
  await page.getByRole('button', { name: 'Ungroup container', exact: true }).click()
  const a = await page.locator('[data-widget-id="a"]').boundingBox(),
    b = await page.locator('[data-widget-id="b"]').boundingBox()
  expect(b!.x).toBeGreaterThan(a!.x + a!.width)
  await page.getByRole('button', { name: 'Phone', exact: true }).click()
  await outline(page).getByRole('button', { name: 'Alpha', exact: true }).click()
  await page.getByLabel('Left column', { exact: true }).fill('3')
  await page.getByLabel('Left column', { exact: true }).press('Tab')
  await page.getByRole('button', { name: 'Desktop', exact: true }).click()
  await outline(page)
    .getByRole('button', { name: 'Beta', exact: true })
    .click({ modifiers: ['Control'] })
  await page.getByRole('button', { name: 'Group in container', exact: true }).click()
  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  const saved = api.layouts.get('personal')!.widgets
  expect(saved.find((w) => w.id === 'a')!.devices?.phone).toBeTruthy()
  expect(saved.find((w) => w.type === 'container')!.devices?.phone).toBeTruthy()
})

test('marquee selection moves and resizes widgets together without moving the surrounding container', async ({
  page,
}) => {
  await setup(page, [
    panel('group'),
    { ...widgets[0]!, parentId: 'group', region: '0' },
    { ...widgets[1]!, parentId: 'group', region: '0' },
  ])
  const group = page.locator('[data-widget-id="group"]'),
    surface = page.locator('[data-widget-surface="group"]')
  const beforeGroup = await group.getAttribute('style'),
    area = await surface.boundingBox()
  const a = page.locator('[data-widget-id="a"]'),
    b = page.locator('[data-widget-id="b"]'),
    beforeA = await a.boundingBox(),
    beforeB = await b.boundingBox()
  await page.keyboard.down('Shift')
  await page.mouse.move(area!.x + 2, area!.y + 2)
  await page.mouse.down()
  await page.mouse.move(beforeB!.x + beforeB!.width + 3, beforeB!.y + beforeB!.height + 3, {
    steps: 8,
  })
  await page.mouse.up()
  await page.keyboard.up('Shift')
  await expect(a).toHaveClass(/is-selected/)
  await expect(b).toHaveClass(/is-selected/)
  await expect(group).toHaveAttribute('style', beforeGroup!)
  const handle = await a.getByRole('button', { name: 'Move Alpha', exact: true }).boundingBox()
  await page.mouse.move(handle!.x + 8, handle!.y + 8)
  await page.mouse.down()
  await page.mouse.move(handle!.x + 35, handle!.y + 30, { steps: 5 })
  await page.mouse.up()
  const movedA = await a.boundingBox(),
    movedB = await b.boundingBox()
  expect(Math.abs(movedB!.x - movedA!.x - (beforeB!.x - beforeA!.x))).toBeLessThan(2)
  expect(movedA!.x).toBeGreaterThan(beforeA!.x)
  const resize = await b.getByRole('button', { name: 'Resize Beta', exact: true }).boundingBox()
  await page.mouse.move(resize!.x + 8, resize!.y + 8)
  await page.mouse.down()
  await page.mouse.move(resize!.x + 38, resize!.y + 35, { steps: 5 })
  await page.mouse.up()
  expect((await a.boundingBox())!.width).toBeGreaterThan(movedA!.width)
  expect((await b.boundingBox())!.width).toBeGreaterThan(movedB!.width)
  await expect(group).toHaveAttribute('style', beforeGroup!)
})

for (const width of [1600, 820, 390])
  test(`container editor and runtime remain reachable at ${width}px`, async ({ page }) => {
    await setup(page, [
      {
        ...panel('team-resources', 'tabs'),
        title: 'Team resources',
        placement: { x: 0, y: 0, w: 24, h: 16 },
      },
      {
        ...widgets[0]!,
        title: 'Welcome',
        parentId: 'team-resources',
        region: '0',
        placement: { x: 0, y: 1, w: 24, h: 8 },
        devices: { phone: { x: 0, y: 1, w: 24, h: 8 } },
      },
      {
        ...widgets[2]!,
        parentId: 'team-resources',
        region: '1',
        placement: { x: 0, y: 1, w: 24, h: 8 },
        devices: { phone: { x: 0, y: 1, w: 24, h: 8 } },
      },
    ])
    await page.setViewportSize({ width, height: 1000 })
    await page.getByRole('button', { name: 'Phone', exact: true }).click()
    await expect(page.locator('[data-widget-id="a"]')).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    expect(overflow).toBe(false)
    await page.screenshot({
      path: `.security-work/dashboard-parity-editor-${width}.png`,
      animations: 'disabled',
    })
    await page.getByRole('button', { name: 'Cancel edits', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Second', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Edit notes', exact: true })).toBeVisible()
    await page.screenshot({
      path: `.security-work/dashboard-parity-runtime-${width}.png`,
      animations: 'disabled',
    })
  })
