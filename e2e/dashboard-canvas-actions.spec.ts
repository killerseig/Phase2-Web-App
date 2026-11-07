import type { Locator } from '@playwright/test'
import { expect, test, type Page } from './helpers/test.js'
import { mockDashboard } from './helpers/dashboardFixture.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import type { SharedDashboardWidget } from '../functions/src/sharedDashboardModel.js'

const text = (id: string, extra: Partial<SharedDashboardWidget> = {}): SharedDashboardWidget => ({
  id,
  type: 'text',
  span: 6,
  title: id,
  text: `${id} content`,
  ...extra,
})
const widget = (page: Page, id: string) => page.locator(`[data-widget-id="${id}"]`)
const outline = (page: Page) => page.getByRole('group', { name: 'On this dashboard', exact: true })
const menu = (page: Page) => page.getByRole('menu', { name: 'Widget actions', exact: true })

test('legacy nested selection follows scrolling and respects the container clip', async ({
  page,
}) => {
  await open(page, [
    {
      id: 'panel',
      type: 'container',
      title: 'Panel',
      text: '',
      span: 12,
      placement: { x: 1, y: 1, w: 19, h: 20 },
      container: {
        kind: 'panel',
        labels: ['Content'],
        direction: 'row',
        ratio: 50,
        collapsed: false,
      },
    },
    text('Long note', {
      parentId: 'panel',
      region: '0',
      span: 12,
      text: 'Long note. '.repeat(100),
    }),
    text('Below', { parentId: 'panel', region: '0', span: 12, text: 'Other note. '.repeat(200) }),
  ])
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await outline(page).getByRole('button', { name: 'Long note', exact: true }).click()
  const source = page.locator('[data-widget-surface="panel"]')
  await source.locator(':scope > [data-widget-id]').evaluateAll((elements) =>
    elements.forEach((element) => {
      ;(element as HTMLElement).style.minHeight = '400px'
    }),
  )
  await source.evaluate((element) =>
    Object.assign((element as HTMLElement).style, {
      height: '240px',
      minHeight: '0',
      maxHeight: '240px',
      overflowY: 'scroll',
    }),
  )
  const frame = page.getByRole('group', { name: 'Selected widget frame', exact: true })
  await source.evaluate((element) => {
    element.scrollTop = 70
    ;(element as HTMLElement).style.width = '99%'
  })
  expect(await source.evaluate((element) => element.scrollTop)).toBe(70)
  await expect
    .poll(async () =>
      Math.abs((await frame.boundingBox())!.y - (await widget(page, 'Long note').boundingBox())!.y),
    )
    .toBeLessThan(1)
  await expect
    .poll(async () =>
      Math.abs(
        (await frame.boundingBox())!.width - (await widget(page, 'Long note').boundingBox())!.width,
      ),
    )
    .toBeLessThan(1)
  const peg = frame.locator('[data-selection-control="nw"]')
  await expect
    .poll(() =>
      peg.evaluate((element) => {
        const r = element.getBoundingClientRect()
        return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === element
      }),
    )
    .toBe(false)
  await peg.focus()
  await expect(peg).not.toBeFocused()
  await frame.locator('[data-selection-control="e"]').focus()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByLabel('Dashboard canvas', { exact: true })).toBeFocused()
  await source.evaluate((element) => {
    element.scrollTop = 0
  })
  await expect
    .poll(async () =>
      Math.abs((await frame.boundingBox())!.y - (await widget(page, 'Long note').boundingBox())!.y),
    )
    .toBeLessThan(1)
  await expect(peg).not.toHaveAttribute('inert')
  await peg.focus()
  await expect(peg).toBeFocused()
  await source.evaluate((element) => {
    element.scrollTop = 70
  })
  await expect(page.getByLabel('Dashboard canvas', { exact: true })).toBeFocused()
})

for (const zoom of ['fit', 'half'] as const)
  test(`nested selection pegs escape ancestor layers at ${zoom} zoom`, async ({ page }) => {
    await open(page, [
      {
        id: 'panel',
        type: 'container',
        title: 'Panel',
        text: '',
        span: 12,
        placement: { x: 1, y: 1, w: 19, h: 20 },
        container: {
          kind: 'panel',
          labels: ['Content'],
          direction: 'row',
          ratio: 50,
          collapsed: false,
        },
      },
      text('Alpha', { parentId: 'panel', region: '0', placement: { x: 2, y: 2, w: 8, h: 5 } }),
      text('Beta', { parentId: 'panel', region: '0', placement: { x: 11, y: 2, w: 8, h: 5 } }),
      text('Front', { placement: { x: 0, y: 0, w: 22, h: 14 } }),
    ])
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await applyZoom(page, zoom)
    await outline(page).getByRole('button', { name: 'Alpha', exact: true }).click()
    const frame = page.getByRole('group', { name: 'Selected widget frame', exact: true })
    const pegs = frame.getByRole('button', { name: /^Resize Alpha/ })
    await expect(pegs).toHaveCount(8)
    for (const peg of await pegs.all()) {
      await expect
        .poll(() =>
          peg.evaluate((element) => {
            const r = element.getBoundingClientRect()
            return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === element
          }),
        )
        .toBe(true)
      expect((await peg.boundingBox())!.width).toBeCloseTo(24, 0)
    }
    const source = page.locator('[data-widget-surface="panel"]')
    const sourceBox = (await source.boundingBox())!
    const scale = await source.evaluate(
      (element) => element.getBoundingClientRect().width / (element as HTMLElement).offsetWidth,
    )
    const before = (await widget(page, 'Alpha').boundingBox())!,
      frontBefore = (await widget(page, 'Front').boundingBox())!
    await drag(
      page,
      frame.getByRole('button', { name: 'Resize Alpha', exact: true }),
      (sourceBox.width / 24) * 2,
      scale * 32 * 2,
    )
    expect((await widget(page, 'Alpha').boundingBox())!.width - before.width).toBeCloseTo(
      (sourceBox.width / 24) * 2,
      0,
    )
    expect(await widget(page, 'Front').boundingBox()).toEqual(frontBefore)
    await page.getByRole('button', { name: 'Undo template edit', exact: true }).click()
    await selectPair(page, 'Alpha', 'Beta')
    await drag(
      page,
      page.getByRole('button', { name: 'Move selected widgets', exact: true }),
      (sourceBox.width / 24) * 2,
      scale * 32 * 2,
      true,
    )
    expect(await widget(page, 'Alpha').boundingBox()).toEqual(before)
    await drag(
      page,
      page.getByRole('button', { name: 'Move selected widgets', exact: true }),
      (sourceBox.width / 24) * 2,
      scale * 32 * 2,
    )
    expect((await widget(page, 'Alpha').boundingBox())!.x - before.x).toBeCloseTo(
      (sourceBox.width / 24) * 2,
      0,
    )
    expect(
      await widget(page, 'Alpha').evaluate(
        (element) => element.parentElement?.dataset.widgetSurface,
      ),
    ).toBe('panel')
    await page.getByRole('button', { name: 'Undo template edit', exact: true }).click()
    await outline(page).getByRole('button', { name: 'Panel', exact: true }).click()
    await page.getByLabel('Lock position', { exact: true }).check()
    await outline(page).getByRole('button', { name: 'Alpha', exact: true }).click()
    await expect(
      page.getByRole('button', { name: 'Move selected widget', exact: true }),
    ).toBeDisabled()
    await expect(
      frame.getByRole('button', { name: 'Resize Alpha from nw', exact: true }),
    ).toBeDisabled()
    await page.screenshot({ path: test.info().outputPath(`nested-pegs-${zoom}.png`) })
  })
async function open(page: Page, entries: SharedDashboardWidget[], scope = 'personal') {
  await page.setViewportSize({ width: 1600, height: 1000 })
  const api = await mockDashboard(page)
  api.layouts.set(scope === 'role' ? 'role-admin' : 'personal', {
    version: 1,
    widgets: structuredClone(entries),
  })
  await gotoPhase2App(
    page,
    scope === 'role' ? '/dashboards/role-home' : '/dashboards/personal',
    createJobsFixture(),
  )
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  return api
}
async function context(page: Page, id: string) {
  await widget(page, id).click({ button: 'right', position: { x: 30, y: 40 } })
  await expect(menu(page)).toBeVisible()
  return menu(page)
}
async function selectPair(page: Page, first: string, second: string) {
  await outline(page).getByRole('button', { name: first, exact: true }).click()
  await outline(page)
    .getByRole('button', { name: second, exact: true })
    .click({ modifiers: ['Control'] })
}
async function drag(page: Page, handle: Locator, dx: number, dy: number, cancel = false) {
  const box = (await handle.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 5 })
  if (cancel) await page.keyboard.press('Escape')
  await page.mouse.up()
}
async function rootMetrics(page: Page) {
  return page.locator('[data-widget-surface="shared-dashboard"]').evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      column: rect.width / 24,
      row: (32 * rect.width) / (element as HTMLElement).offsetWidth,
    }
  })
}

test('widget context actions support keyboard focus and preserve legacy positions through layer save and undo', async ({
  page,
}) => {
  const api = await open(page, [text('Alpha'), text('Beta'), text('Gamma', { span: 12 })])
  const beta = widget(page, 'Beta')
  const prevented = await beta.evaluate((element) => {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    element.dispatchEvent(event)
    return event.defaultPrevented
  })
  expect(prevented, 'Runtime retains its native context menu').toBe(false)
  await expect(menu(page)).toHaveCount(0)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const outlineBeta = outline(page).getByRole('button', { name: 'Beta', exact: true })
  await expect(outlineBeta).toHaveAttribute('aria-keyshortcuts', 'Shift+F10')
  await outlineBeta.click({ button: 'right' })
  await expect(menu(page)).toBeVisible()
  await expect(menu(page)).toHaveCSS('background-color', 'rgb(23, 43, 58)')
  await page.keyboard.press('Escape')
  await expect(menu(page)).toHaveCount(0)
  await expect(outlineBeta).toBeFocused()
  await page.keyboard.press('Shift+F10')
  await expect(menu(page)).toBeVisible()
  await expect(menu(page).getByRole('menuitem', { name: 'Edit widget', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu(page)).toHaveCount(0)
  await expect(outlineBeta).toBeFocused()
  await page.keyboard.press('Shift+F10')
  await expect(menu(page)).toBeVisible()
  await page
    .getByRole('complementary', { name: 'Dashboard library', exact: true })
    .evaluate((element) => {
      element.scrollTop -= 20
    })
  await expect(menu(page)).toHaveCount(0)
  await beta.focus()
  await page.keyboard.press('Shift+F10')
  await expect(menu(page)).toBeVisible()
  await expect(menu(page).getByRole('menuitem', { name: 'Edit widget', exact: true })).toBeFocused()
  await page.keyboard.press('End')
  await expect(
    menu(page).getByRole('menuitem', { name: 'Remove widget', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Home')
  await page.keyboard.press('ArrowDown')
  await expect(
    menu(page).getByRole('menuitem', { name: 'Duplicate widget', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu(page)).toHaveCount(0)
  await expect(beta).toBeFocused()
  await context(page, 'Beta')
  await page.getByLabel('Find a widget', { exact: true }).click()
  await expect(menu(page)).toHaveCount(0)
  await expect(page.getByLabel('Find a widget', { exact: true })).toBeFocused()

  const before = {
    alpha: (await widget(page, 'Alpha').boundingBox())!,
    beta: (await beta.boundingBox())!,
  }
  await (await context(page, 'Beta'))
    .getByRole('menuitem', { name: 'Send to back', exact: true })
    .click()
  const roots = page.locator('[data-widget-surface="shared-dashboard"] > [data-widget-id]')
  await expect
    .poll(() =>
      roots.evaluateAll((items) => items.map((item) => item.getAttribute('data-widget-id'))),
    )
    .toEqual(['Beta', 'Alpha', 'Gamma'])
  const after = {
    alpha: (await widget(page, 'Alpha').boundingBox())!,
    beta: (await beta.boundingBox())!,
  }
  for (const id of ['alpha', 'beta'] as const) {
    expect(after[id].x).toBeCloseTo(before[id].x, 0)
    expect(after[id].y).toBeCloseTo(before[id].y, 0)
  }
  await page.getByRole('button', { name: 'Undo template edit', exact: true }).click()
  await expect
    .poll(() =>
      roots.evaluateAll((items) => items.map((item) => item.getAttribute('data-widget-id'))),
    )
    .toEqual(['Alpha', 'Beta', 'Gamma'])
  await page.getByRole('button', { name: 'Redo template edit', exact: true }).click()
  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect
    .poll(() =>
      roots.evaluateAll((items) => items.map((item) => item.getAttribute('data-widget-id'))),
    )
    .toEqual(['Beta', 'Alpha', 'Gamma'])
  expect(api.layouts.get('personal')!.widgets.map((entry) => entry.id)).toEqual([
    'Beta',
    'Alpha',
    'Gamma',
  ])
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await (await context(page, 'Beta'))
    .getByRole('menuitem', { name: 'Copy widget', exact: true })
    .click()
  await expect(page.getByRole('button', { name: 'Paste widgets', exact: true })).toBeEnabled()
  await (await context(page, 'Beta'))
    .getByRole('menuitem', { name: 'Duplicate widget', exact: true })
    .click()
  await expect(roots).toHaveCount(4)
  await page.getByRole('button', { name: 'Undo template edit', exact: true }).click()
  await expect(roots).toHaveCount(3)
})

test('nested layer actions affect siblings and selecting a covered widget does not raise it', async ({
  page,
}) => {
  const entries: SharedDashboardWidget[] = [
    {
      id: 'panel',
      type: 'container',
      title: 'Panel',
      text: '',
      span: 12,
      placement: { x: 1, y: 1, w: 19, h: 20 },
      container: {
        kind: 'panel',
        labels: ['Content'],
        direction: 'row',
        ratio: 50,
        collapsed: false,
      },
    },
    text('Alpha', { parentId: 'panel', region: '0', placement: { x: 1, y: 2, w: 10, h: 8 } }),
    text('Beta', { parentId: 'panel', region: '0', placement: { x: 6, y: 4, w: 10, h: 8 } }),
    text('Outside', { placement: { x: 21, y: 1, w: 3, h: 8 } }),
  ]
  const api = await open(page, entries)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await outline(page).getByRole('button', { name: 'Alpha', exact: true }).click()
  const alpha = (await widget(page, 'Alpha').boundingBox())!,
    beta = (await widget(page, 'Beta').boundingBox())!
  const point = { x: Math.max(alpha.x, beta.x) + 20, y: Math.max(alpha.y, beta.y) + 30 }
  const topWidget = () =>
    page.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-widget-id]')?.dataset.widgetId,
      point,
    )
  await expect.poll(topWidget).toBe('Beta')
  await (await context(page, 'Alpha'))
    .getByRole('menuitem', { name: 'Bring to front', exact: true })
    .click()
  await expect.poll(topWidget).toBe('Alpha')
  await (
    await context(page, 'Alpha')
  )
    .getByRole('menuitem', { name: 'Bring forward', exact: true })
    .isDisabled()
    .then((disabled) => expect(disabled).toBe(true))
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  const saved = api.layouts.get('personal')!.widgets
  expect(saved.map((entry) => entry.id)).toEqual(['panel', 'Beta', 'Alpha', 'Outside'])
  expect(saved.find((entry) => entry.id === 'Outside')).toEqual(entries[3])
  expect(saved.filter((entry) => entry.parentId === 'panel').map((entry) => entry.id)).toEqual([
    'Beta',
    'Alpha',
  ])
})

test('selection frame moves and resizes the entire group with keyboard and cancellable pointer gestures', async ({
  page,
}) => {
  await open(page, [
    text('Alpha', { placement: { x: 1, y: 2, w: 6, h: 8 } }),
    text('Beta', { placement: { x: 10, y: 5, w: 6, h: 8 } }),
  ])
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await selectPair(page, 'Alpha', 'Beta')
  const frame = page.getByRole('group', { name: 'Selected widgets frame', exact: true })
  await expect(frame).toBeVisible()
  await expect(frame.getByRole('button', { name: /^Resize selected widgets from / })).toHaveCount(8)
  const move = page.getByRole('button', { name: 'Move selected widgets', exact: true })
  const metrics = await rootMetrics(page)
  const before = [
    (await widget(page, 'Alpha').boundingBox())!,
    (await widget(page, 'Beta').boundingBox())!,
  ]
  await drag(page, move, 2 * metrics.column, metrics.row)
  for (const [i, id] of ['Alpha', 'Beta'].entries()) {
    const after = (await widget(page, id).boundingBox())!
    expect(after.x - before[i]!.x).toBeCloseTo(2 * metrics.column, 0)
    expect(after.y - before[i]!.y).toBeCloseTo(metrics.row, 0)
  }
  await page.getByRole('button', { name: 'Undo template edit', exact: true }).click()
  const initialFrame = (await frame.boundingBox())!
  await drag(
    page,
    frame.getByRole('button', { name: 'Resize selected widgets from se', exact: true }),
    2 * metrics.column,
    2 * metrics.row,
  )
  const resized = (await frame.boundingBox())!
  expect(resized.x).toBeCloseTo(initialFrame.x, 0)
  expect(resized.y).toBeCloseTo(initialFrame.y, 0)
  expect(resized.width).toBeGreaterThan(initialFrame.width + metrics.column)
  expect(resized.height).toBeGreaterThan(initialFrame.height + metrics.row)
  expect((await widget(page, 'Alpha').boundingBox())!.width).toBeGreaterThan(before[0]!.width)
  expect((await widget(page, 'Beta').boundingBox())!.width).toBeGreaterThan(before[1]!.width)
  await page.getByRole('button', { name: 'Undo template edit', exact: true }).click()
  await move.focus()
  await page.keyboard.press('ArrowRight')
  for (const [i, id] of ['Alpha', 'Beta'].entries())
    expect((await widget(page, id).boundingBox())!.x - before[i]!.x).toBeCloseTo(metrics.column, 0)
  await page.getByRole('button', { name: 'Undo template edit', exact: true }).click()
  await frame.getByRole('button', { name: 'Resize selected widgets from e', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  expect((await frame.boundingBox())!.width).toBeGreaterThan(initialFrame.width)
  await page.getByRole('button', { name: 'Undo template edit', exact: true }).click()
  await drag(page, move, metrics.column * 3, metrics.row * 2, true)
  for (const [i, id] of ['Alpha', 'Beta'].entries()) {
    const after = (await widget(page, id).boundingBox())!
    expect(after.x).toBeCloseTo(before[i]!.x, 0)
    expect(after.y).toBeCloseTo(before[i]!.y, 0)
  }
})

test('context and selection controls honor locks and protect required role tools', async ({
  page,
}) => {
  await open(
    page,
    [
      text('Alpha', {
        placement: { x: 1, y: 2, w: 6, h: 8 },
        positionLocked: true,
        sizeLocked: true,
      }),
      {
        id: 'required',
        type: 'jobs',
        title: 'Required jobs',
        text: '',
        span: 6,
        placement: { x: 10, y: 2, w: 12, h: 8 },
      },
    ],
    'role',
  )
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await (
    await context(page, 'required')
  )
    .getByRole('menuitem', { name: 'Remove widget', exact: true })
    .isDisabled()
    .then((disabled) => expect(disabled).toBe(true))
  await page.keyboard.press('Escape')
  await selectPair(page, 'Alpha', 'Required jobs')
  const frame = page.getByRole('group', { name: 'Selected widgets frame', exact: true })
  await expect(
    page.getByRole('button', { name: 'Move selected widgets', exact: true }),
  ).toBeDisabled()
  for (const handle of await frame
    .getByRole('button', { name: /^Resize selected widgets from / })
    .all())
    await expect(handle).toBeDisabled()
  await outline(page).getByRole('button', { name: 'Alpha', exact: true }).click()
  await (await context(page, 'Alpha'))
    .getByRole('menuitem', { name: 'Unlock position', exact: true })
    .click()
  await expect(page.getByLabel('Lock position', { exact: true })).not.toBeChecked()
  await (await context(page, 'Alpha'))
    .getByRole('menuitem', { name: 'Unlock size', exact: true })
    .click()
  await expect(page.getByLabel('Lock size', { exact: true })).not.toBeChecked()
  await (await context(page, 'Alpha'))
    .getByRole('menuitem', { name: 'Remove widget', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toContainText('Remove widget?')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(widget(page, 'Alpha')).toBeVisible()
  await expect(widget(page, 'required')).toBeVisible()
})

test('duplicating a nested container preserves its region, remaps children and retains inherited locks', async ({
  page,
}) => {
  const entries: SharedDashboardWidget[] = [
    {
      id: 'outer',
      type: 'container',
      title: 'Outer tabs',
      text: '',
      span: 12,
      placement: { x: 0, y: 0, w: 24, h: 28 },
      positionLocked: true,
      sizeLocked: true,
      container: {
        kind: 'tabs',
        labels: ['First', 'Second'],
        direction: 'row',
        ratio: 50,
        collapsed: false,
      },
    },
    {
      id: 'inner',
      type: 'container',
      title: 'Nested panel',
      text: '',
      span: 12,
      parentId: 'outer',
      region: '1',
      placement: { x: 1, y: 1, w: 20, h: 16 },
      container: {
        kind: 'panel',
        labels: ['Content'],
        direction: 'row',
        ratio: 50,
        collapsed: false,
      },
    },
    text('Child', { parentId: 'inner', region: '0', placement: { x: 1, y: 2, w: 20, h: 8 } }),
  ]
  const api = await open(page, entries)
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await outline(page).getByRole('button', { name: 'Nested panel', exact: true }).click()
  await widget(page, 'inner').focus()
  await page.keyboard.press('Shift+F10')
  await menu(page).getByRole('menuitem', { name: 'Duplicate widget', exact: true }).click()

  const copied = page.locator('[data-widget-id].is-selected')
  await expect(copied).toHaveCount(1)
  await expect(copied).toHaveClass(/is-container/)
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Nested panel copy')
  const copyId = (await copied.getAttribute('data-widget-id'))!
  expect(copyId).not.toBe('inner')
  await expect(page.getByLabel('Container', { exact: true })).toHaveValue('outer')
  await expect(page.getByLabel('Container region', { exact: true })).toHaveValue('1')
  await expect(page.getByLabel('Container', { exact: true })).toBeDisabled()
  await expect(
    copied.getByRole('button', { name: 'Move Nested panel copy', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Resize Nested panel copy', exact: true }),
  ).toBeDisabled()
  const copiedChild = page.locator(`[data-widget-surface="${copyId}"] > [data-widget-id]`)
  await expect(copiedChild).toHaveCount(1)
  const childId = (await copiedChild.getAttribute('data-widget-id'))!
  expect(childId).not.toBe('Child')
  await expect(copiedChild.getByRole('button', { name: 'Move Child', exact: true })).toBeDisabled()
  await copiedChild.getByRole('button', { name: 'Edit Child', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Resize Child', exact: true })).toBeDisabled()

  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  const saved = api.layouts.get('personal')!.widgets
  expect(saved).toHaveLength(5)
  expect(saved.find((entry) => entry.id === 'outer')).toEqual(entries[0])
  expect(saved.find((entry) => entry.id === 'inner')).toEqual(entries[1])
  expect(saved.find((entry) => entry.id === 'Child')).toEqual(entries[2])
  expect(saved.find((entry) => entry.id === copyId)).toMatchObject({
    type: 'container',
    title: 'Nested panel copy',
    parentId: 'outer',
    region: '1',
  })
  expect(saved.find((entry) => entry.id === childId)).toMatchObject({
    type: 'text',
    title: 'Child',
    parentId: copyId,
    region: '0',
    placement: entries[2]!.placement,
  })
  expect(saved.find((entry) => entry.id === copyId)!.positionLocked).toBeUndefined()
  expect(saved.find((entry) => entry.id === copyId)!.sizeLocked).toBeUndefined()
  expect(saved.find((entry) => entry.id === childId)!.positionLocked).toBeUndefined()
  expect(saved.find((entry) => entry.id === childId)!.sizeLocked).toBeUndefined()
})

for (const zoom of ['fit', 'half'] as const) {
  test(`single-selection pegs stay clickable above overlapping widgets at ${zoom} zoom`, async ({
    page,
  }) => {
    await open(page, [
      text('Behind', { placement: { x: 0, y: 0, w: 8, h: 6 } }),
      text('Front', { placement: { x: 0, y: 0, w: 8, h: 6 } }),
    ])
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await applyZoom(page, zoom)
    await outline(page).getByRole('button', { name: 'Behind', exact: true }).click()
    const frame = page.getByRole('group', { name: 'Selected widget frame', exact: true })
    const pegs = frame.getByRole('button', { name: /^Resize Behind/ })
    await expect(pegs).toHaveCount(8)
    const viewBounds = (await page.getByLabel('Dashboard canvas', { exact: true }).boundingBox())!
    const moveBounds = (await page
      .getByRole('button', { name: 'Move selected widget', exact: true })
      .boundingBox())!
    expect(moveBounds.y + moveBounds.height).toBeLessThanOrEqual(viewBounds.y)
    expect(moveBounds.x).toBeGreaterThanOrEqual(viewBounds.x)
    for (const peg of await pegs.all()) {
      const box = (await peg.boundingBox())!
      expect(box.width).toBeCloseTo(24, 0)
      expect(box.height).toBeCloseTo(24, 0)
      expect(
        await peg.evaluate((element) => {
          const rect = element.getBoundingClientRect()
          return (
            document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === element
          )
        }),
      ).toBe(true)
    }
    const front = widget(page, 'Front')
    const frontBefore = (await front.boundingBox())!
    expect(
      await front.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        return document
          .elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
          ?.closest('[data-widget-id]')
          ?.getAttribute('data-widget-id')
      }),
    ).toBe('Front')
    const behind = widget(page, 'Behind')
    const before = (await behind.boundingBox())!
    const units = await rootMetrics(page)
    await drag(
      page,
      frame.getByRole('button', { name: 'Resize Behind', exact: true }),
      units.column * 2,
      units.row * 2,
    )
    const resized = (await behind.boundingBox())!
    expect(resized.width - before.width).toBeCloseTo(units.column * 2, 0)
    expect(resized.height - before.height).toBeCloseTo(units.row * 2, 0)
    expect(await front.boundingBox()).toEqual(frontBefore)
    await page.getByRole('button', { name: 'Undo template edit', exact: true }).click()
    await frame.getByRole('button', { name: 'Resize Behind from e', exact: true }).focus()
    await page.keyboard.press('ArrowRight')
    expect((await behind.boundingBox())!.width - before.width).toBeCloseTo(units.column, 0)
    await page.getByLabel('Lock position', { exact: true }).check()
    await expect(
      page.getByRole('button', { name: 'Move selected widget', exact: true }),
    ).toBeDisabled()
    await expect(
      frame.getByRole('button', { name: 'Resize Behind from nw', exact: true }),
    ).toBeDisabled()
    await frame.getByRole('button', { name: 'Resize Behind from e', exact: true }).focus()
    await page.keyboard.press('ArrowRight')
    expect((await behind.boundingBox())!.x).toBeCloseTo(before.x, 0)
    expect((await behind.boundingBox())!.width - before.width).toBeCloseTo(units.column * 2, 0)
    await page.screenshot({ path: test.info().outputPath(`single-pegs-${zoom}.png`) })
  })
}

async function applyZoom(page: Page, zoom: 'fit' | 'half') {
  if (zoom !== 'half') return
  await page.getByRole('button', { name: 'Actual size', exact: true }).click()
  for (let index = 0; index < 5; index++)
    await page.getByRole('button', { name: 'Zoom out', exact: true }).click()
}
