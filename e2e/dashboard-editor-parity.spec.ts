import { expect, test, type Page } from './helpers/test.js'
import { mockDashboard } from './helpers/dashboardFixture.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import type { SharedDashboardWidget } from '../functions/src/sharedDashboardModel.js'
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
      { ...panel('team-resources', 'tabs'), title: 'Team resources', placement:{x:0,y:0,w:24,h:16} },
      {
        ...widgets[0]!,
        title: 'Welcome',
        parentId: 'team-resources',
        region: '0',
        placement:{x:0,y:1,w:24,h:8},
        devices: { phone: { x: 0, y: 1, w: 24, h: 8 } },
      },
      {
        ...widgets[2]!,
        parentId: 'team-resources',
        region: '1',
        placement:{x:0,y:1,w:24,h:8},
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
    await page.screenshot({ path: `.security-work/dashboard-parity-editor-${width}.png`, animations:'disabled' })
    await page.getByRole('button', { name: 'Cancel edits', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Second', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Edit notes', exact: true })).toBeVisible()
    await page.screenshot({ path: `.security-work/dashboard-parity-runtime-${width}.png`, animations:'disabled' })
  })
