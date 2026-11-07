import { expect, test, type Page } from './helpers/test.js'
import { mockDashboard } from './helpers/dashboardFixture.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import type { SharedDashboardWidget as Widget } from '../functions/src/sharedDashboardModel.js'

const alpha: Widget = {
  id: 'a',
  type: 'text',
  title: 'Alpha',
  text: 'First',
  span: 6,
  placement: { x: 1, y: 2, w: 4, h: 6 },
  devices: { phone: { x: 0, y: 5, w: 24, h: 8 } },
}
const panel: Widget = {
  id: 'panel',
  type: 'container',
  title: 'Panel',
  text: '',
  span: 12,
  placement: { x: 9, y: 1, w: 15, h: 18 },
  container: {
    kind: 'panel',
    labels: ['One', 'Two'],
    direction: 'row',
    ratio: 50,
    collapsed: false,
  },
}
const scopes = [
  { key: 'personal', path: '/dashboards/personal', tools: [] },
  {
    key: 'role-admin',
    path: '/dashboards/role-home',
    tools: [{ ...alpha, id: 'tools', type: 'jobs', placement: { x: 0, y: 40, w: 24, h: 8 } }],
  },
  {
    key: 'all-jobs',
    path: '/dashboards/job-home/job-1',
    tools: [{ ...alpha, id: 'tools', type: 'workflows', placement: { x: 0, y: 40, w: 24, h: 8 } }],
  },
] satisfies { key: string; path: string; tools: Widget[] }[]
const save = (page: Page) => page.getByRole('button', { name: 'Save template', exact: true })
const undo = (page: Page) => page.getByRole('button', { name: 'Undo template edit', exact: true })
const redo = (page: Page) => page.getByRole('button', { name: 'Redo template edit', exact: true })
const widget = (page: Page, id: string) => page.locator(`[data-widget-id="${id}"]`)
const surface = (page: Page, id: string, region = '0') =>
  page.locator(`[data-widget-surface="${id}"][data-region="${region}"]`)
const ghost = (page: Page) => page.locator('.shared-drag-ghost')
async function setup(page: Page, widgets: Widget[] = [alpha, panel], scope = scopes[0]!) {
  await page.setViewportSize({ width: 1600, height: 1000 })
  const api = await mockDashboard(page)
  api.layouts.set(scope.key, { version: 1, widgets: structuredClone([...widgets, ...scope.tools]) })
  await gotoPhase2App(page, scope.path, createJobsFixture())
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  return api
}
async function select(page: Page, names: string[]) {
  const outline = page.getByRole('group', { name: 'On this dashboard', exact: true })
  for (const [i, name] of names.entries())
    await outline
      .getByRole('button', { name, exact: true })
      .click(i ? { modifiers: ['Control'] } : {})
}
async function startMove(page: Page, id: string) {
  const start = (await widget(page, id).boundingBox())!
  await page.mouse.move(start.x + 20, start.y + start.height - 20)
  await page.mouse.down()
}
async function toRegion(page: Page, parent: string, region = '0', x = 0.4, y = 120) {
  const destination = (await surface(page, parent, region).boundingBox())!
  await page.mouse.move(destination.x + destination.width * x, destination.y + y, { steps: 12 })
}
async function dragToRegion(page: Page, id: string, parent: string, region = '0') {
  await startMove(page, id)
  await toRegion(page, parent, region)
}
async function parentOf(page: Page, id: string) {
  return widget(page, id).evaluate(
    (el) => el.parentElement?.closest<HTMLElement>('[data-widget-surface]')?.dataset.widgetSurface,
  )
}
async function finishSave(page: Page) {
  await save(page).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
}

for (const scope of scopes)
  test(`${scope.key}: root to container preserves geometry and identity through undo, redo and reload`, async ({
    page,
  }) => {
    const api = await setup(page, [alpha, panel], scope)
    const before = (await widget(page, 'a').boundingBox())!
    await dragToRegion(page, 'a', 'panel')
    await expect(ghost(page)).toContainText('Panel')
    await expect(surface(page, 'panel')).toHaveClass(/is-drop-target/)
    const preview = await surface(page, 'panel')
      .locator(':scope > [data-widget-placement-preview]')
      .boundingBox()
    await page.mouse.up()
    await expect.poll(() => parentOf(page, 'a')).toBe('panel')
    const after = (await widget(page, 'a').boundingBox())!
    expect(after.width).toBeCloseTo(before.width, 0)
    expect(after.height).toBeCloseTo(before.height, 0)
    expect(preview).not.toBeNull()
    expect(after.x).toBeCloseTo(preview!.x, 0)
    expect(after.y).toBeCloseTo(preview!.y, 0)
    await undo(page).click()
    await expect.poll(() => parentOf(page, 'a')).toBe('shared-dashboard')
    await expect(undo(page)).toBeDisabled()
    await redo(page).click()
    await finishSave(page)
    const stored = api.layouts.get(scope.key)!.widgets
    expect(stored.find((w) => w.id === 'a')).toMatchObject({
      parentId: 'panel',
      region: '0',
      devices: alpha.devices,
      text: alpha.text,
    })
    expect(stored.find((w) => w.id === 'panel')).toEqual(panel)
    for (const tool of scope.tools) expect(stored.find((w) => w.id === tool.id)).toEqual(tool)
    await page.reload()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await expect.poll(() => parentOf(page, 'a')).toBe('panel')
    // Moving out uses the root's visible left-hand area, beyond the parent bounds.
    await startMove(page, 'a')
    await toRegion(page, 'shared-dashboard', '0', 0.15, 300)
    await expect(ghost(page)).toContainText('Dashboard root')
    await page.mouse.up()
    await finishSave(page)
    expect(api.layouts.get(scope.key)!.widgets.find((w) => w.id === 'a')!.parentId).toBeUndefined()
  })

test('a selected group moves atomically and keeps relative spacing', async ({ page }) => {
  const beta = { ...alpha, id: 'b', title: 'Beta', placement: { x: 1, y: 9, w: 4, h: 4 } }
  const api = await setup(page, [alpha, beta, panel])
  await select(page, ['Alpha', 'Beta'])
  const beforeA = (await widget(page, 'a').boundingBox())!,
    beforeB = (await widget(page, 'b').boundingBox())!
  const handle = page.getByRole('button', { name: 'Move selected widgets', exact: true })
  await expect
    .poll(() =>
      handle.evaluate((el) => {
        const r = el.getBoundingClientRect()
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
      }),
    )
    .toBe(true)
  const grip = (await handle.boundingBox())!
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await toRegion(page, 'panel', '0', 0.55, 250)
  await expect(ghost(page)).toContainText('Move 2 widgets')
  await page.mouse.up()
  await expect.poll(() => parentOf(page, 'a')).toBe('panel')
  await expect.poll(() => parentOf(page, 'b')).toBe('panel')
  const afterA = (await widget(page, 'a').boundingBox())!,
    afterB = (await widget(page, 'b').boundingBox())!
  expect(afterB.y - afterA.y).toBeCloseTo(beforeB.y - beforeA.y, 0)
  expect(afterB.x - afterA.x).toBeCloseTo(beforeB.x - beforeA.x, 0)
  await undo(page).click()
  await expect.poll(() => parentOf(page, 'b')).toBe('shared-dashboard')
  await expect(undo(page)).toBeDisabled()
  await redo(page).click()
  await finishSave(page)
  expect(
    api.layouts
      .get('personal')!
      .widgets.filter((w) => ['a', 'b'].includes(w.id))
      .map((w) => w.parentId),
  ).toEqual(['panel', 'panel'])
})

test('split regions and active nested tabs are independent destinations', async ({ page }) => {
  const split = {
    ...panel,
    placement: { x: 0, y: 0, w: 24, h: 24 },
    container: { ...panel.container!, kind: 'split' as const },
  }
  const child = { ...alpha, parentId: 'panel', region: '0' }
  const tabs: Widget = {
    ...panel,
    id: 'tabs',
    title: 'Tabs',
    parentId: 'panel',
    region: '1',
    placement: { x: 0, y: 8, w: 24, h: 12 },
    container: { ...panel.container!, kind: 'tabs' },
  }
  const hidden = {
    ...alpha,
    id: 'hidden',
    title: 'Hidden',
    parentId: 'tabs',
    region: '0',
    placement: undefined,
  }
  const api = await setup(page, [split, child, tabs, hidden])
  await dragToRegion(page, 'a', 'panel', '1')
  await expect(surface(page, 'panel', '1')).toHaveClass(/is-drop-target/)
  await expect(surface(page, 'panel', '0')).not.toHaveClass(/is-drop-target/)
  await page.mouse.up()
  await widget(page, 'tabs').getByRole('tab', { name: 'Two', exact: true }).click()
  await dragToRegion(page, 'a', 'tabs', '1')
  await expect(ghost(page)).toContainText('Tabs / Two')
  await page.mouse.up()
  await finishSave(page)
  expect(api.layouts.get('personal')!.widgets.find((w) => w.id === 'a')).toMatchObject({
    parentId: 'tabs',
    region: '1',
  })
  expect(api.layouts.get('personal')!.widgets.find((w) => w.id === 'hidden')).toEqual(hidden)
})

async function cancelMove(page: Page, change: string) {
  if (change === 'Escape') await page.keyboard.press('Escape')
  if (change === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  if (change === 'pointercancel')
    await page.evaluate(() =>
      window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 })),
    )
  if (change === 'resize') await page.setViewportSize({ width: 1500, height: 950 })
  if (change === 'outside') await page.mouse.move(1, 1)
  if (change === 'header') {
    const b = (await widget(page, 'panel').boundingBox())!
    await page.mouse.move(b.x + b.width / 2, b.y + 15)
    await expect(ghost(page)).toContainText('visible canvas region')
  }
  if (change === 'device')
    await page
      .getByRole('button', { name: 'Tablet', exact: true })
      .evaluate((el: HTMLButtonElement) => el.click())
}
for (const change of ['Escape', 'blur', 'pointercancel', 'resize', 'outside', 'header', 'device'])
  test(`${change} cancels or rejects a pending reparent without history`, async ({ page }) => {
    await setup(page)
    await dragToRegion(page, 'a', 'panel')
    await expect(ghost(page)).toContainText('Panel')
    await cancelMove(page, change)
    await page.mouse.up()
    await expect.poll(() => parentOf(page, 'a')).toBe('shared-dashboard')
    await expect(undo(page)).toBeDisabled()
  })

for (const device of ['Tablet', 'Phone'])
  test(`${device} keeps hierarchy shared and offers within-region moves only`, async ({ page }) => {
    const api = await setup(page, [{ ...alpha, devices: undefined }, panel])
    await page.getByRole('button', { name: device, exact: true }).click()
    await select(page, ['Alpha'])
    await expect(page.getByLabel('Container', { exact: true })).toBeDisabled()
    await dragToRegion(page, 'a', 'panel')
    await expect(ghost(page)).toContainText('Switch to Desktop')
    await expect(surface(page, 'panel')).toHaveClass(/is-drop-invalid/)
    await page.mouse.up()
    await expect(undo(page)).toBeDisabled()
    await startMove(page, 'a')
    await toRegion(page, 'shared-dashboard', '0', 0.2, 180)
    await page.mouse.up()
    await finishSave(page)
    const saved = api.layouts.get('personal')!.widgets[0]!
    expect(saved.parentId).toBeUndefined()
    expect(saved.placement).toEqual(alpha.placement)
    expect(saved.devices?.[device.toLowerCase() as 'tablet' | 'phone']).toBeDefined()
  })

test('invalid size and destination locks reject drop before mutation', async ({ page }) => {
  await setup(page, [alpha, { ...panel, positionLocked: true }])
  await dragToRegion(page, 'a', 'panel')
  await expect(ghost(page)).toContainText('position locked')
  await page.mouse.up()
  await expect(undo(page)).toBeDisabled()
  await select(page, ['Panel'])
  await page.getByLabel('Lock position', { exact: true }).uncheck()
  await select(page, ['Alpha'])
  await page.getByLabel('Width in columns', { exact: true }).fill('20')
  await page.getByLabel('Width in columns', { exact: true }).press('Tab')
  await dragToRegion(page, 'a', 'panel')
  await expect(ghost(page)).toContainText('does not fit')
  await page.mouse.up()
  await expect.poll(() => parentOf(page, 'a')).toBe('shared-dashboard')
})

test('inspector assigns the selected roots with one undo and keeps unrelated hidden flow intact', async ({
  page,
}) => {
  const tabs = { ...panel, container: { ...panel.container!, kind: 'tabs' as const } }
  const hidden = {
    ...alpha,
    id: 'hidden',
    title: 'Hidden',
    parentId: 'panel',
    region: '1',
    placement: undefined,
  }
  const beta = { ...alpha, id: 'b', title: 'Beta', placement: { x: 1, y: 9, w: 4, h: 4 } }
  const api = await setup(page, [alpha, beta, tabs, hidden])
  await select(page, ['Alpha', 'Beta'])
  await page.getByLabel('Container', { exact: true }).selectOption('panel')
  await expect.poll(() => parentOf(page, 'a')).toBe('panel')
  await expect.poll(() => parentOf(page, 'b')).toBe('panel')
  await undo(page).click()
  await expect(undo(page)).toBeDisabled()
  await redo(page).click()
  await finishSave(page)
  const saved = api.layouts.get('personal')!.widgets
  expect(saved.find((w) => w.id === 'a')!.placement).toEqual(alpha.placement)
  expect(saved.find((w) => w.id === 'b')!.placement).toEqual(beta.placement)
  expect(saved.find((w) => w.id === 'hidden')).toEqual(hidden)
})

test('resize stays on its original surface and does not author hidden flow', async ({ page }) => {
  const tabs = { ...panel, container: { ...panel.container!, kind: 'tabs' as const } }
  const hidden = {
    ...alpha,
    id: 'hidden',
    title: 'Hidden',
    parentId: 'panel',
    region: '1',
    placement: undefined,
  }
  const api = await setup(page, [alpha, tabs, hidden])
  await select(page, ['Alpha'])
  const grip = (await page
    .getByRole('button', { name: 'Resize Alpha', exact: true })
    .boundingBox())!
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await toRegion(page, 'panel')
  await page.mouse.up()
  await finishSave(page)
  const saved = api.layouts.get('personal')!.widgets
  expect(saved[0]!.parentId).toBeUndefined()
  expect(saved[0]!.placement).not.toEqual(alpha.placement)
  expect(saved.find((w) => w.id === 'hidden')).toEqual(hidden)
})

test('bordered scrolled destinations use local content coordinates and scroll while dragging', async ({
  page,
}) => {
  const far = {
    ...alpha,
    id: 'far',
    title: 'Far',
    parentId: 'panel',
    region: '0',
    placement: { x: 15, y: 20, w: 4, h: 5 },
  }
  const api = await setup(page, [alpha, panel, far])
  const target = surface(page, 'panel')
  await page.addStyleTag({
    content:
      '[data-widget-surface="panel"] { border: 6px solid blue !important; height: 240px !important; max-height: 240px !important; min-height: 0 !important; overflow-y: scroll !important; }',
  })
  await target.evaluate((el) => {
    el.scrollTop = 100
  })
  await dragToRegion(page, 'a', 'panel')
  const b = (await target.boundingBox())!
  await page.mouse.move(b.x + b.width * 0.6, b.y + b.height - 15, { steps: 5 })
  await expect.poll(() => target.evaluate((el) => el.scrollTop)).toBeGreaterThan(100)
  // Leave the edge so the preview settles before checking its committed position.
  await page.mouse.move(b.x + b.width * 0.6, b.y + b.height / 2, { steps: 5 })
  await expect(ghost(page)).toContainText('Panel')
  const preview = (await target.locator(':scope > [data-widget-placement-preview]').boundingBox())!
  await page.mouse.up()
  await expect.poll(() => parentOf(page, 'a')).toBe('panel')
  const box = (await widget(page, 'a').boundingBox())!
  expect(box.x).toBeCloseTo(preview.x, 0)
  expect(box.y).toBeCloseTo(preview.y, 0)
  await finishSave(page)
  expect(api.layouts.get('personal')!.widgets.find((w) => w.id === 'far')).toEqual(far)
})

test('a flowing destination pins its existing children instead of moving them', async ({
  page,
}) => {
  const flow = {
    ...alpha,
    id: 'flow',
    title: 'Flow',
    parentId: 'panel',
    region: '0',
    placement: undefined,
    text: 'Existing content. '.repeat(100),
  }
  const api = await setup(page, [alpha, panel, flow])
  const before = (await widget(page, 'flow').boundingBox())!
  await dragToRegion(page, 'a', 'panel')
  await expect(ghost(page)).toContainText('Move 1 widget')
  await page.mouse.up()
  const after = (await widget(page, 'flow').boundingBox())!
  for (const key of ['x', 'y', 'width', 'height'] as const)
    expect(after[key]).toBeCloseTo(before[key], 0)
  await finishSave(page)
  expect(api.layouts.get('personal')!.widgets.find((w) => w.id === 'flow')!.placement).toBeDefined()
})
