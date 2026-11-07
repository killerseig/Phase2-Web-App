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
  placement: { x: 1, y: 2, w: 8, h: 6 },
  devices: { phone: { x: 0, y: 2, w: 12, h: 6 } },
}
const beta: Widget = {
  ...alpha,
  id: 'b',
  title: 'Beta',
  placement: { x: 12, y: 2, w: 8, h: 6 },
  positionLocked: true,
}
const parent: Widget = {
  ...alpha,
  id: 'panel',
  title: 'Panel',
  type: 'container',
  placement: { x: 0, y: 0, w: 24, h: 20 },
  container: {
    kind: 'tabs',
    labels: ['One', 'Two'],
    direction: 'row',
    ratio: 50,
    collapsed: false,
  },
}
const outline = (page: Page) => page.getByRole('group', { name: 'On this dashboard', exact: true })
const lock = (page: Page, axis = 'position') =>
  page.getByRole('checkbox', { name: `Lock ${axis}`, exact: true })
const undo = (page: Page) => page.getByRole('button', { name: 'Undo template edit', exact: true })
const save = (page: Page) => page.getByRole('button', { name: 'Save template', exact: true })
async function select(page: Page, names: string[]) {
  await outline(page).getByRole('button', { name: names[0]!, exact: true }).click()
  for (const name of names.slice(1))
    await outline(page)
      .getByRole('button', { name, exact: true })
      .click({ modifiers: ['Control'] })
}
const scopes = [
  { key: 'personal', url: '/dashboards/personal', tools: [] },
  {
    key: 'role-admin',
    url: '/dashboards/role-home',
    tools: [
      {
        ...alpha,
        id: 'tools',
        title: 'Required tools',
        type: 'jobs',
        placement: { x: 0, y: 25, w: 24, h: 5 },
      },
    ],
  },
  {
    key: 'all-jobs',
    url: '/dashboards/job-home/job-1',
    tools: [
      {
        ...alpha,
        id: 'tools',
        title: 'Required tools',
        type: 'workflows',
        placement: { x: 0, y: 25, w: 24, h: 5 },
      },
    ],
  },
] satisfies { key: string; url: string; tools: Widget[] }[]
async function setup(page: Page, widgets: Widget[] = [alpha, beta], scope = scopes[0]!) {
  await page.setViewportSize({ width: 1600, height: 1000 })
  const api = await mockDashboard(page)
  api.layouts.set(scope.key, { version: 1, widgets: structuredClone([...widgets, ...scope.tools]) })
  await gotoPhase2App(page, scope.url, createJobsFixture())
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  return api
}

test('mixed selection locks expose mixed state regardless of primary widget', async ({ page }) => {
  await setup(page)
  await select(page, ['Alpha', 'Beta'])
  await expect(lock(page)).toBeChecked({ indeterminate: true })
  await expect(lock(page)).toHaveAttribute('aria-checked', 'mixed')
  await select(page, ['Beta', 'Alpha'])
  await expect(lock(page)).toBeChecked({ indeterminate: true })
  await lock(page).focus()
  await page.keyboard.press('Space')
  await expect(lock(page)).toBeChecked()
  await expect(lock(page)).toHaveAttribute('aria-checked', 'true')
  await undo(page).click()
  await expect(lock(page)).toBeChecked({ indeterminate: true })
  await expect(save(page)).toBeDisabled()
})

test('locking a parent plus child preserves the child independent flags', async ({ page }) => {
  const child = { ...alpha, parentId: 'panel', region: '0' }
  const api = await setup(page, [parent, child])
  await select(page, ['Panel', 'Alpha'])
  await lock(page).check()
  await save(page).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  expect(api.layouts.get('personal')!.widgets.find((w) => w.id === 'panel')!.positionLocked).toBe(
    true,
  )
  expect(api.layouts.get('personal')!.widgets.find((w) => w.id === 'a')).toEqual(child)
})

test('inherited locks are visible and disabled in inspector and context menu', async ({ page }) => {
  await setup(page, [
    { ...parent, positionLocked: true },
    { ...alpha, parentId: 'panel', region: '0' },
  ])
  await select(page, ['Alpha'])
  await expect(lock(page)).toBeChecked()
  await expect(lock(page)).toBeDisabled()
  await expect(lock(page)).toHaveAccessibleDescription(/Panel/)
  await expect(lock(page, 'size')).toBeEnabled()
  await page.locator('[data-widget-id="a"]').focus()
  await page.keyboard.press('Shift+F10')
  await expect(
    page.getByRole('menuitem', { name: 'Position locked by container', exact: true }),
  ).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(save(page)).toBeDisabled()
  await expect(undo(page)).toBeDisabled()
})

test('an unchanged unlock does not add a false flag or dirty history', async ({ page }) => {
  await setup(page, [alpha])
  await select(page, ['Alpha'])
  await lock(page).dispatchEvent('change')
  await expect(save(page)).toBeDisabled()
  await expect(undo(page)).toBeDisabled()
})

for (const scope of scopes)
  for (const device of ['Desktop', 'Tablet', 'Phone']) {
    test(`${scope.key} ${device} locks and unlocks selected roots atomically without changing geometry`, async ({
      page,
    }) => {
      const api = await setup(page, [alpha, beta], scope)
      await page.getByRole('button', { name: device, exact: true }).click()
      await select(page, ['Alpha', 'Beta'])
      await lock(page).click()
      await expect(lock(page)).toHaveAttribute('aria-checked', 'true')
      await expect(
        page.getByRole('button', { name: 'Move selected widgets', exact: true }),
      ).toBeDisabled()
      await lock(page).click()
      await expect(lock(page)).not.toBeChecked()
      await expect(lock(page)).toHaveAttribute('aria-checked', 'false')
      await undo(page).click()
      await expect(lock(page)).toBeChecked()
      await undo(page).click()
      await expect(lock(page)).toBeChecked({ indeterminate: true })
      await expect(save(page)).toBeDisabled()
      await page.getByRole('button', { name: 'Redo template edit', exact: true }).click()
      await lock(page, 'size').check()
      await save(page).click()
      await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
      const result = api.layouts.get(scope.key)!.widgets
      expect(result[0]).toEqual({ ...alpha, positionLocked: true, sizeLocked: true })
      expect(result[1]).toEqual({ ...beta, sizeLocked: true })
      expect(result.slice(2)).toEqual(scope.tools)
    })
  }

test('mixed inherited selection blocks only the affected lock axis and explains both origins', async ({
  page,
}) => {
  await setup(page, [
    { ...parent, positionLocked: true },
    { ...alpha, parentId: 'panel' },
    { ...beta, positionLocked: false },
  ])
  await select(page, ['Alpha', 'Beta'])
  await expect(lock(page)).toBeChecked({ indeterminate: true })
  await expect(lock(page)).toBeDisabled()
  await expect(lock(page)).toHaveAccessibleDescription(/0 of 2.*1 inherit.*Panel/)
  await lock(page, 'size').check()
  await expect(lock(page, 'size')).toBeChecked()
  await undo(page).click()
  await expect(save(page)).toBeDisabled()
})

test('cross-region roots can change lock metadata without enabling a group transform', async ({
  page,
}) => {
  const api = await setup(page, [
    parent,
    { ...alpha, parentId: 'panel', region: '0' },
    { ...beta, parentId: 'panel', region: '1' },
  ])
  await select(page, ['Alpha', 'Beta'])
  await expect(
    page.getByRole('group', { name: 'Selected widgets frame', exact: true }),
  ).toHaveCount(0)
  await lock(page, 'size').check()
  await save(page).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  const widgets = api.layouts.get('personal')!.widgets
  expect(widgets[0]).toEqual(parent)
  expect(widgets.slice(1).map((w) => [w.region, w.sizeLocked])).toEqual([
    ['0', true],
    ['1', true],
  ])
})

test('context menu explicitly selects its clicked widget and shares inspector lock state', async ({
  page,
}) => {
  const api = await setup(page)
  await select(page, ['Alpha', 'Beta'])
  await page.locator('[data-widget-id="a"]').focus()
  await page.keyboard.press('Shift+F10')
  await expect(page.locator('[data-widget-id].is-selected')).toHaveCount(1)
  await page.getByRole('menuitem', { name: 'Lock position', exact: true }).click()
  await expect(page.locator('[data-widget-id="a"]')).toBeFocused()
  await expect(lock(page)).toBeChecked()
  await page.keyboard.press('Shift+F10')
  await page.getByRole('menuitem', { name: 'Unlock position', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(lock(page)).not.toBeChecked()
  await undo(page).click()
  await undo(page).click()
  await expect(save(page)).toBeDisabled()
  expect(api.layouts.get('personal')!.widgets).toEqual([alpha, beta])
})

test('stale context menu and detached inspector inputs cannot change the new selection', async ({
  page,
}) => {
  await setup(page)
  await select(page, ['Alpha'])
  const oldInput = await lock(page).elementHandle()
  await page.locator('[data-widget-id="a"]').focus()
  await page.keyboard.press('Shift+F10')
  const oldAction = await page
    .getByRole('menuitem', { name: 'Lock size', exact: true })
    .elementHandle()
  await outline(page)
    .getByRole('button', { name: 'Beta', exact: true })
    .evaluate((el) => (el as HTMLElement).click())
  await expect(page.getByRole('menu')).toHaveCount(0)
  await oldAction!.evaluate((el) => (el as HTMLElement).click())
  await oldInput!.evaluate((el) => {
    const input = el as HTMLInputElement
    input.checked = true
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect(lock(page, 'size')).not.toBeChecked()
  await expect(save(page)).toBeDisabled()
  await expect(undo(page)).toBeDisabled()
})

test('locks and menus remain unavailable during an interrupted drag', async ({ page }) => {
  await setup(page, [alpha])
  await select(page, ['Alpha'])
  const box = (await page.locator('[data-widget-id="a"]').boundingBox())!
  await page.mouse.move(box.x + 20, box.y + box.height - 20)
  await page.mouse.down()
  await page.mouse.move(box.x + 60, box.y + box.height, { steps: 4 })
  await lock(page).evaluate((el) => {
    const input = el as HTMLInputElement
    input.checked = true
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.locator('[data-widget-id="a"]').focus()
  await page.keyboard.press('Shift+F10')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(lock(page)).not.toBeChecked()
  await expect(save(page)).toBeDisabled()
})

async function finishPan(page: Page, ending: string) {
  if (ending === 'cancel') await page.keyboard.press('Escape')
  await page.mouse.up({ button: 'middle' })
}

for (const ending of ['release', 'cancel']) {
  test(`lock controls recover immediately after background pan ${ending}`, async ({ page }) => {
    await setup(page, [alpha])
    await select(page, ['Alpha'])
    const canvas = page.getByLabel('Dashboard canvas', { exact: true })
    const box = (await canvas.boundingBox())!
    await page.mouse.move(box.x + box.width - 40, box.y + box.height - 60)
    await page.mouse.down({ button: 'middle' })
    await page.mouse.move(box.x + box.width - 90, box.y + box.height - 100, { steps: 5 })
    await expect(lock(page)).toBeDisabled()
    await finishPan(page, ending)
    await expect(lock(page)).toBeEnabled()
    await expect(lock(page, 'size')).toBeEnabled()
    await expect(save(page)).toBeDisabled()
  })
}

test('pending Cut confirmation blocks lock changes and cancellation restores controls', async ({
  page,
}) => {
  await setup(page, [alpha])
  await select(page, ['Alpha'])
  await page.locator('[data-widget-id="a"]').focus()
  await page.keyboard.press('Control+x')
  await expect(page.getByRole('dialog')).toBeVisible()
  await lock(page).evaluate((el) => {
    const input = el as HTMLInputElement
    input.checked = true
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await expect(lock(page)).toBeDisabled()
  await expect(lock(page)).not.toBeChecked()
  await page.keyboard.press('Escape')
  await expect(lock(page)).toBeEnabled()
  await expect(save(page)).toBeDisabled()
})
