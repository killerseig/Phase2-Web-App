import { expect, test, type Page } from './helpers/test.js'
import { mockDashboard } from './helpers/dashboardFixture.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import type { SharedDashboardWidget as Widget } from '../functions/src/sharedDashboardModel.js'

const alpha: Widget = {
  id: 'a',
  type: 'text',
  title: 'Alpha',
  text: '',
  span: 6,
  placement: { x: 1.123456, y: 2.123456, w: 5.123456, h: 6.123456 },
}
const beta: Widget = {
  ...alpha,
  id: 'b',
  title: 'Beta',
  placement: { x: 12.234567, y: 10.234567, w: 8.234567, h: 7.234567 },
}
const panel: Widget = {
  ...alpha,
  id: 'panel',
  title: 'Panel',
  type: 'container',
  placement: { x: 0, y: 30, w: 24, h: 20 },
  container: {
    kind: 'tabs',
    labels: ['One', 'Two'],
    direction: 'row',
    ratio: 50,
    collapsed: false,
  },
}
const outline = (page: Page) => page.getByRole('group', { name: 'On this dashboard', exact: true })
const save = (page: Page) => page.getByRole('button', { name: 'Save template', exact: true })
const undo = (page: Page) => page.getByRole('button', { name: 'Undo template edit', exact: true })
const scopes = [
  { name: 'personal', key: 'personal', path: '/dashboards/personal', tools: [] },
  {
    name: 'role',
    key: 'role-admin',
    path: '/dashboards/role-home',
    tools: [
      {
        ...alpha,
        id: 'tools',
        title: 'Required tools',
        type: 'jobs',
        placement: { x: 0, y: 40, w: 24, h: 8 },
      },
    ],
  },
  {
    name: 'job',
    key: 'all-jobs',
    path: '/dashboards/job-home/job-1',
    tools: [
      {
        ...alpha,
        id: 'tools',
        title: 'Required tools',
        type: 'workflows',
        placement: { x: 0, y: 40, w: 24, h: 8 },
      },
    ],
  },
] satisfies { name: string; key: string; path: string; tools: Widget[] }[]
async function setup(page: Page, widgets: Widget[], scope = scopes[0]!) {
  await page.setViewportSize({ width: 1600, height: 1000 })
  const api = await mockDashboard(page)
  api.layouts.set(scope.key, { version: 1, widgets: structuredClone([...widgets, ...scope.tools]) })
  await gotoPhase2App(page, scope.path, createJobsFixture())
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  return api
}
async function select(page: Page, names: string[]) {
  await outline(page).getByRole('button', { name: names[0]!, exact: true }).click()
  for (const name of names.slice(1))
    await outline(page)
      .getByRole('button', { name, exact: true })
      .click({ modifiers: ['Control'] })
}
function devicePlacement(widget: Widget, device: string) {
  return device === 'Desktop'
    ? widget.placement
    : widget.devices?.[device.toLowerCase() as 'tablet' | 'phone']
}
async function changeArrangementContext(page: Page, change: string) {
  if (change === 'selection') await select(page, ['Beta', 'Gamma'])
  if (change === 'device') await page.getByRole('button', { name: 'Phone', exact: true }).click()
  if (change === 'layout') {
    await page.getByRole('button', { name: 'Align top', exact: true }).click()
    await undo(page).click()
  }
}

test('a position lock disables the whole alignment selection', async ({ page }) => {
  await setup(page, [
    panel,
    { ...alpha, parentId: 'panel' },
    { ...beta, parentId: 'panel' },
    { ...alpha, id: 'c', title: 'Gamma', parentId: 'panel', positionLocked: true },
  ])
  await select(page, ['Alpha', 'Beta', 'Gamma'])
  await expect(page.getByRole('button', { name: 'Align left', exact: true })).toBeDisabled()
})

const commands = [
  ['Align left', 'x', [1, 1, 1]],
  ['Center horizontally', 'x', [10.5, 10, 9.5]],
  ['Align right', 'x', [20, 19, 18]],
  ['Align top', 'y', [2, 2, 2]],
  ['Center vertically', 'y', [11.5, 10.5, 11]],
  ['Align bottom', 'y', [21, 19, 20]],
  ['Distribute horizontally', 'x', [1, 9, 18]],
  ['Distribute vertically', 'y', [2, 10, 20]],
  ['Match width', 'w', [5, 5, 5]],
  ['Match height', 'h', [7, 7, 7]],
] as const
async function geometry(page: Page, id: string) {
  return page.locator(`[data-widget-id="${id}"]`).evaluate((el) => {
    const style = (el as HTMLElement).style
    return {
      x: (parseFloat(style.left) * 24) / 100,
      y: parseFloat(style.top) / 32,
      w: (parseFloat(style.width) * 24) / 100,
      h: parseFloat(style.height) / 32,
    }
  })
}
for (const scope of scopes)
  for (const device of ['Desktop', 'Tablet', 'Phone'] as const) {
    test(`${scope.name} ${device} applies all ten arrangements with one undo step and preserves other views`, async ({
      page,
    }) => {
      const originals = [
        { ...alpha, placement: { x: 1, y: 2, w: 4, h: 5 } },
        { ...beta, placement: { x: 8, y: 8, w: 5, h: 7 } },
        { ...alpha, id: 'c', title: 'Gamma', placement: { x: 18, y: 20, w: 6, h: 6 } },
      ]
      const api = await setup(page, originals, scope)
      await page.getByRole('button', { name: device, exact: true }).click()
      await select(page, ['Alpha', 'Gamma', 'Beta'])
      for (const [name, key, values] of commands) {
        const button = page.getByRole('button', { name, exact: true })
        await button.focus()
        await page.keyboard.press('Enter')
        await expect(button).toBeFocused()
        for (let i = 0; i < originals.length; i++) {
          const expected = { ...originals[i]!.placement, [key]: values[i] }
          await expect
            .poll(async () => {
              const actual = await geometry(page, originals[i]!.id)
              return Object.keys(expected).every(
                (field) =>
                  Math.abs(
                    actual[field as keyof typeof actual] - expected[field as keyof typeof expected],
                  ) < 0.0001,
              )
            })
            .toBe(true)
        }
        await undo(page).click()
        await expect(save(page)).toBeDisabled()
        await expect(undo(page)).toBeDisabled()
        await page.getByRole('button', { name: 'Redo template edit', exact: true }).click()
        await expect(save(page)).toBeEnabled()
        await undo(page).click()
      }
      await page.getByRole('button', { name: 'Align left', exact: true }).click()
      await save(page).click()
      await expect.poll(() => api.layouts.get(scope.key)!.version).toBe(2)
      const saved = api.layouts.get(scope.key)!.widgets
      for (const [i, original] of originals.entries()) {
        const expected = { ...original.placement, x: 1 }
        const entry = saved.find((w) => w.id === original.id)!
        expect(entry).toEqual(
          device === 'Desktop'
            ? { ...original, placement: expected }
            : i === 0
              ? original
              : { ...original, devices: { [device.toLowerCase()]: expected } },
        )
      }
      expect(saved.slice(originals.length)).toEqual(scope.tools)
    })
  }

test('locks, different regions and too few roots expose matching accessible reasons', async ({
  page,
}) => {
  await setup(page, [
    { ...panel, positionLocked: true },
    { ...alpha, parentId: 'panel', region: '0' },
    { ...beta, parentId: 'panel', region: '0' },
    { ...alpha, id: 'hidden', title: 'Hidden', parentId: 'panel', region: '1' },
  ])
  await select(page, ['Alpha', 'Beta'])
  const align = page.getByRole('button', { name: 'Align left', exact: true })
  await expect(align).toBeDisabled()
  await expect(align).toHaveAccessibleDescription(/Unlock position/)
  await expect(page.getByRole('button', { name: 'Match height', exact: true })).toBeEnabled()
  await select(page, ['Alpha', 'Hidden'])
  await expect(align).toBeDisabled()
  await expect(align).toHaveAccessibleDescription(/same container region/)
  await select(page, ['Panel', 'Alpha'])
  await expect(align).toBeDisabled()
  await expect(align).toHaveAccessibleDescription(/at least 2 outermost/)
  await expect(save(page)).toBeDisabled()
})

test('position-locked size matching preserves origins and rejects a boundary violation atomically', async ({
  page,
}) => {
  const edge = { ...alpha, positionLocked: true, placement: { x: 21, y: 2, w: 3, h: 5 } }
  await setup(page, [edge, { ...beta, placement: { x: 2, y: 10, w: 6, h: 9 } }])
  await select(page, ['Alpha', 'Beta'])
  await page.getByRole('button', { name: 'Match width', exact: true }).click()
  await expect(page.locator('.shared-dashboard > [role="status"]')).toContainText(
    'does not fit the canvas',
  )
  await expect(save(page)).toBeDisabled()
  await page.getByRole('button', { name: 'Match height', exact: true }).click()
  expect(await geometry(page, 'a')).toEqual({ x: 21, y: 2, w: 3, h: 9 })
  await undo(page).click()
  await expect(save(page)).toBeDisabled()
})

for (const device of ['Desktop', 'Tablet', 'Phone'] as const) {
  test(`${device} converts only the measured flow surface and leaves hidden regions untouched`, async ({
    page,
  }) => {
    const hidden: Widget = {
      id: 'hidden',
      type: 'text',
      title: 'Hidden',
      text: '',
      span: 6,
      parentId: 'panel',
      region: '1',
    }
    const flow = [alpha, beta, { ...alpha, id: 'c', title: 'Gamma' }].map((w) => ({
      ...w,
      text: 'One\nTwo\nThree\nFour\nFive\nSix',
      parentId: 'panel',
      region: '0',
      placement: undefined,
    }))
    const api = await setup(page, [panel, ...flow, hidden])
    await page.getByRole('button', { name: device, exact: true }).click()
    await select(page, ['Alpha', 'Gamma'])
    const active = page.locator('[data-widget-surface="panel"][data-region="0"]')
    // Capture exact visible boxes before the region leaves flow.
    const before = await active.evaluate((surface) => {
      const host = surface as HTMLElement,
        box = host.getBoundingClientRect(),
        scale = box.width / host.offsetWidth
      return [...host.querySelectorAll<HTMLElement>(':scope > [data-widget-id]')].map((el) => {
        const p = el.getBoundingClientRect()
        return {
          id: el.dataset.widgetId!,
          x:
            (((p.left - box.left) / scale - host.clientLeft + host.scrollLeft) / host.clientWidth) *
            24,
          y: ((p.top - box.top) / scale - host.clientTop + host.scrollTop) / 32,
          w: (p.width / scale / host.clientWidth) * 24,
          h: p.height / scale / 32,
        }
      })
    })
    await page.getByRole('button', { name: 'Match width', exact: true }).click()
    // These flow siblings have equal widths: no-op must not materialize a box.
    await expect(save(page)).toBeDisabled()
    await page.getByRole('button', { name: 'Align top', exact: true }).click()
    await expect(save(page)).toBeEnabled()
    await save(page).click()
    await expect.poll(() => api.layouts.get('personal')!.version).toBe(2)
    const saved = api.layouts.get('personal')!.widgets
    expect(saved.find((w) => w.id === 'panel')).toEqual(panel)
    expect(saved.find((w) => w.id === 'hidden')).toEqual(hidden)
    for (const rect of before) {
      const entry = saved.find((w) => w.id === rect.id)!
      const p = devicePlacement(entry, device)
      const targetY = new Map([
        ['a', before[0]!.y],
        ['c', before[0]!.y],
      ])
      const expected = { x: rect.x, y: targetY.get(rect.id) ?? rect.y, w: rect.w, h: rect.h }
      expect(p).toEqual(expected)
    }
  })
}

test('matching parent widths uses the selected root when its child is primary', async ({
  page,
}) => {
  const child = {
    ...alpha,
    id: 'child',
    title: 'Child',
    parentId: 'panel',
    region: '0',
    placement: { x: 0, y: 0, w: 3, h: 5 },
  }
  const parent = { ...panel, placement: { x: 0, y: 0, w: 8, h: 20 } }
  const api = await setup(page, [
    parent,
    child,
    { ...beta, placement: { x: 12, y: 2, w: 6, h: 8 } },
  ])
  await select(page, ['Panel', 'Beta', 'Child'])
  await page.getByRole('button', { name: 'Match width', exact: true }).click()
  await save(page).click()
  await expect
    .poll(() => api.layouts.get('personal')!.widgets.find((w) => w.id === 'b')!.placement!.w)
    .toBe(8)
  expect(api.layouts.get('personal')!.widgets.find((w) => w.id === 'child')).toEqual(child)
})

test('alignment preserves unplaced widgets in hidden container regions', async ({ page }) => {
  const hidden: Widget = {
    id: 'hidden',
    type: 'text',
    title: 'Hidden',
    text: '',
    span: 6,
    parentId: 'panel',
    region: '1',
  }
  const api = await setup(page, [alpha, beta, panel, hidden])
  await select(page, ['Alpha', 'Beta'])
  await page.getByRole('button', { name: 'Align left', exact: true }).click()
  await save(page).click()
  await expect.poll(() => api.layouts.get('personal')!.version).toBe(2)
  expect(api.layouts.get('personal')!.widgets.find((w) => w.id === 'hidden')).toEqual(hidden)
})

test('already aligned fractional selection does not dirty its template', async ({ page }) => {
  await setup(page, [alpha, { ...beta, placement: { ...beta.placement!, x: alpha.placement!.x } }])
  await select(page, ['Alpha', 'Beta'])
  await page.getByRole('button', { name: 'Align left', exact: true }).click()
  await expect(save(page)).toBeDisabled()
  await expect(undo(page)).toBeDisabled()
})

test('keyboard Undo and Redo retain arrangement button focus', async ({ page }) => {
  await setup(page, [alpha, beta])
  await select(page, ['Alpha', 'Beta'])
  const button = page.getByRole('button', { name: 'Align left', exact: true })
  await button.focus()
  await page.keyboard.press('Enter')
  await expect(button).toBeFocused()
  await page.keyboard.press('Control+z')
  await expect(save(page)).toBeDisabled()
  await expect(button).toBeFocused()
  await page.keyboard.press('Control+Shift+z')
  await expect(save(page)).toBeEnabled()
  await expect(button).toBeFocused()
})

test('arranging a tight flow container preserves unselected geometry through conversion', async ({
  page,
}) => {
  const parent = { ...panel, placement: { x: 0, y: 0, w: 24, h: 10 } }
  const flow = [alpha, beta, { ...alpha, id: 'c', title: 'Gamma' }].map((w) => ({
    ...w,
    span: 4 as const,
    text: 'One\nTwo\nThree\nFour\nFive',
    parentId: 'panel',
    region: '0',
    placement: undefined,
  }))
  await setup(page, [parent, ...flow])
  await select(page, ['Alpha', 'Beta'])
  const surface = page.locator('[data-widget-surface="panel"][data-region="0"]')
  const before = await surface.evaluate((el) => {
    const s = el as HTMLElement,
      child = s.querySelector<HTMLElement>('[data-widget-id="c"]')!,
      box = s.getBoundingClientRect(),
      p = child.getBoundingClientRect(),
      scale = box.width / s.offsetWidth
    return {
      width: s.clientWidth,
      childWidth: p.width / scale,
      childX: (p.left - box.left) / scale,
    }
  })
  await page.getByRole('button', { name: 'Align left', exact: true }).click()
  await expect(save(page)).toBeEnabled()
  await expect
    .poll(() => surface.evaluate((el) => (el as HTMLElement).clientWidth))
    .toBe(before.width)
  const after = await surface.evaluate((el) => {
    const s = el as HTMLElement,
      child = s.querySelector<HTMLElement>('[data-widget-id="c"]')!,
      box = s.getBoundingClientRect(),
      p = child.getBoundingClientRect(),
      scale = box.width / s.offsetWidth
    return { childWidth: p.width / scale, childX: (p.left - box.left) / scale }
  })
  expect(after.childWidth).toBeCloseTo(before.childWidth, 1)
  expect(after.childX).toBeCloseTo(before.childX, 1)
  await undo(page).click()
  await expect(save(page)).toBeDisabled()
})

test('hidden flow selections fail visibly without materializing any widgets', async ({ page }) => {
  await setup(page, [
    panel,
    ...[alpha, beta].map((w) => ({
      ...w,
      text: 'One\nTwo\nThree\nFour\nFive\nSix',
      parentId: 'panel',
      region: '1',
      placement: undefined,
    })),
  ])
  await select(page, ['Alpha', 'Beta'])
  // Outline selection reveals its region; switch back without changing selection.
  await page.getByRole('tab', { name: 'One', exact: true }).click()
  await expect(page.locator('[data-widget-surface="panel"][data-region="1"]')).toBeHidden()
  await page.getByRole('button', { name: 'Align left', exact: true }).click()
  await expect(page.locator('.shared-dashboard > [role="status"]')).toContainText(
    'Open this container region',
  )
  await expect(save(page)).toBeDisabled()
  await expect(undo(page)).toBeDisabled()
})

test('keyboard history falls back to the canvas when Undo disables its arrangement action', async ({
  page,
}) => {
  await setup(
    page,
    [alpha, beta].map((w) => ({ ...w, positionLocked: true })),
  )
  await select(page, ['Alpha', 'Beta'])
  await page.getByRole('checkbox', { name: 'Lock position', exact: true }).uncheck()
  const button = page.getByRole('button', { name: 'Align left', exact: true })
  await button.click()
  await page.keyboard.press('Control+z')
  await expect(button).toBeFocused()
  await page.keyboard.press('Control+z')
  await expect(button).toBeDisabled()
  await expect(page.getByLabel('Dashboard canvas', { exact: true })).toBeFocused()
  await page.keyboard.press('Control+Shift+z')
  await expect(button).toBeEnabled()
  await expect(save(page)).toBeEnabled()
  await page.keyboard.press('Control+z')
  await expect(save(page)).toBeDisabled()
})

for (const change of ['selection', 'device', 'layout'] as const) {
  test(`an obsolete arrangement action cannot change widgets after ${change} changes`, async ({
    page,
  }) => {
    await setup(page, [alpha, beta, { ...alpha, id: 'c', title: 'Gamma' }])
    await select(page, ['Alpha', 'Beta'])
    const old = await page.getByRole('button', { name: 'Align left', exact: true }).elementHandle()
    await changeArrangementContext(page, change)
    await old!.evaluate((el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    await expect(save(page)).toBeDisabled()
    await expect(undo(page)).toBeDisabled()
  })
}

test('active pan and Cut confirmation guard arrangement and recover after cancellation', async ({
  page,
}) => {
  await setup(page, [alpha, beta])
  await select(page, ['Alpha', 'Beta'])
  const align = page.getByRole('button', { name: 'Align left', exact: true })
  const box = (await page.getByLabel('Dashboard canvas', { exact: true }).boundingBox())!
  await page.mouse.move(box.x + box.width - 30, box.y + box.height - 40)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(box.x + box.width - 70, box.y + box.height - 60)
  await expect(align).toBeDisabled()
  await align.evaluate((el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await page.keyboard.press('Escape')
  await page.mouse.up({ button: 'middle' })
  await expect(align).toBeEnabled()
  await expect(save(page)).toBeDisabled()
  await page.locator('[data-widget-id="b"]').focus()
  await page.keyboard.press('Control+x')
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(align).toBeDisabled()
  await align.evaluate((el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await page.keyboard.press('Escape')
  await expect(align).toBeEnabled()
  await expect(save(page)).toBeDisabled()
})

test('an interrupted widget drag cannot also apply an arrangement', async ({ page }) => {
  await setup(page, [alpha, beta])
  await select(page, ['Alpha', 'Beta'])
  const box = (await page.locator('[data-widget-id="a"]').boundingBox())!
  await page.mouse.move(box.x + 20, box.y + box.height - 20)
  await page.mouse.down()
  await page.mouse.move(box.x + 70, box.y + box.height, { steps: 4 })
  const align = page.getByRole('button', { name: 'Align left', exact: true })
  await expect(align).toBeDisabled()
  await align.evaluate((el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(align).toBeEnabled()
  await expect(save(page)).toBeDisabled()
})
