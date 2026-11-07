import { expect, test, type Page } from './helpers/test.js'
import { mockDashboard } from './helpers/dashboardFixture.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import type { SharedDashboardWidget } from '../functions/src/sharedDashboardModel.js'

const widgets: SharedDashboardWidget[] = [
  {
    id: 'a',
    type: 'text',
    title: 'Alpha',
    text: 'First',
    span: 6,
    placement: { x: 2.25, y: 3, w: 6, h: 6 },
  },
  {
    id: 'b',
    type: 'text',
    title: 'Beta',
    text: 'Second',
    span: 6,
    placement: { x: 11.25, y: 4, w: 6, h: 6 },
  },
]
const scopes = [
  { key: 'personal', url: '/dashboards/personal', tools: [] },
  {
    key: 'role-admin',
    url: '/dashboards/role-home',
    tools: [
      {
        id: 'tools',
        type: 'jobs',
        title: 'Required jobs',
        text: '',
        span: 12,
        placement: { x: 0, y: 20, w: 24, h: 5 },
      },
    ],
  },
  {
    key: 'all-jobs',
    url: '/dashboards/job-home/job-1',
    tools: [
      {
        id: 'tools',
        type: 'workflows',
        title: 'Required tools',
        text: '',
        span: 12,
        placement: { x: 0, y: 20, w: 24, h: 5 },
      },
    ],
  },
] satisfies { key: string; url: string; tools: SharedDashboardWidget[] }[]
const article = (page: Page, id = 'a') => page.locator(`[data-widget-id="${id}"]`)
const outline = (page: Page) => page.getByRole('group', { name: 'On this dashboard', exact: true })
const undo = (page: Page) => page.getByRole('button', { name: 'Undo template edit', exact: true })
const save = (page: Page) => page.getByRole('button', { name: 'Save template', exact: true })
const selectedFrame = (page: Page) => page.getByRole('group', { name: /^Selected widgets? frame$/ })
async function setup(page: Page, entries = widgets, scope = scopes[0]!) {
  await page.setViewportSize({ width: 1600, height: 1000 })
  const api = await mockDashboard(page)
  api.layouts.set(scope.key, { version: 1, widgets: structuredClone([...entries, ...scope.tools]) })
  await gotoPhase2App(page, scope.url, createJobsFixture())
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  return api
}
async function shiftRight(page: Page, target = article(page)) {
  const before = (await article(page).boundingBox())!
  await target.focus()
  await page.keyboard.press('Shift+ArrowRight')
  await expect.poll(async () => (await article(page).boundingBox())!.x - before.x).toBeCloseTo(1, 1)
  await undo(page).click()
  await expect(save(page)).toBeDisabled()
}

for (const scope of scopes) {
  test(`${scope.key} uses precise keyboard moves across devices and retains off-grid offsets`, async ({
    page,
  }) => {
    const api = await setup(page, widgets, scope)
    for (const device of ['Desktop', 'Tablet', 'Phone']) {
      await page.getByRole('button', { name: device, exact: true }).click()
      await page.getByRole('button', { name: 'Fit content', exact: true }).click()
      await shiftRight(page)
      await shiftRight(
        page,
        page.getByRole('button', { name: 'Move selected widget', exact: true }),
      )
    }
    await page.getByRole('button', { name: 'Desktop', exact: true }).click()
    await article(page).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByLabel('Left column', { exact: true })).toHaveValue('3.25')
    await undo(page).click()
    await page.getByRole('button', { name: 'Cancel edits', exact: true }).click()
    expect(api.requests.filter((r) => String(r.action).startsWith('save'))).toHaveLength(0)
  })
}

test('keyboard selection and blank-canvas dismissal do not edit the layout', async ({ page }) => {
  await setup(page)
  await article(page).focus()
  await page.keyboard.press('Escape')
  await expect(selectedFrame(page)).toHaveCount(0)
  await article(page, 'b').focus()
  await page.keyboard.press('Enter')
  await expect(article(page, 'b')).toHaveClass(/is-selected/)
  await article(page).focus()
  await page.keyboard.press('Shift+Space')
  await expect(selectedFrame(page)).toHaveAccessibleName('Selected widgets frame')
  await page.keyboard.press('Shift+Space')
  await expect(article(page)).not.toHaveClass(/is-selected/)
  const canvas = page.getByLabel('Dashboard canvas', { exact: true })
  const box = (await canvas.boundingBox())!
  await page.mouse.click(box.x + box.width - 15, box.y + box.height - 15)
  await expect(selectedFrame(page)).toHaveCount(0)
  await expect(save(page)).toBeDisabled()
  await expect(undo(page)).toBeDisabled()
})

test('a locked group cannot move through the focused widget instead of its disabled grip', async ({
  page,
}) => {
  await setup(page, [widgets[0]!, { ...widgets[1]!, positionLocked: true }])
  await outline(page).getByRole('button', { name: 'Alpha', exact: true }).click()
  await outline(page)
    .getByRole('button', { name: 'Beta', exact: true })
    .click({ modifiers: ['Control'] })
  await expect(
    page.getByRole('button', { name: 'Move selected widgets', exact: true }),
  ).toBeDisabled()
  const before = (await article(page).boundingBox())!
  await article(page).focus()
  await page.keyboard.press('ArrowRight')
  expect((await article(page).boundingBox())!.x).toBeCloseTo(before.x, 1)
  await page.mouse.move(before.x + 35, before.y + 35)
  await page.mouse.down()
  await page.mouse.move(before.x + 95, before.y + 55, { steps: 5 })
  await page.mouse.up()
  expect((await article(page).boundingBox())!.x).toBeCloseTo(before.x, 1)
  await expect(save(page)).toBeDisabled()
  await expect(undo(page)).toBeDisabled()
})

test('nested selection uses its own column width for precise move, resize and group gestures', async ({
  page,
}) => {
  const panel: SharedDashboardWidget = {
    id: 'panel',
    type: 'container',
    title: 'Panel',
    text: '',
    span: 12,
    placement: { x: 1, y: 1, w: 20, h: 18 },
    container: {
      kind: 'panel',
      labels: ['Content'],
      direction: 'row',
      ratio: 50,
      collapsed: false,
    },
  }
  const api = await setup(page, [
    panel,
    ...widgets.map((w) => ({ ...w, parentId: 'panel', region: '0' })),
  ])
  await outline(page).getByRole('button', { name: 'Alpha', exact: true }).click()
  await page.getByRole('button', { name: 'Actual size', exact: true }).click()
  await shiftRight(page)
  const before = (await article(page).boundingBox())!
  await selectedFrame(page)
    .getByRole('button', { name: 'Resize Alpha from e', exact: true })
    .focus()
  await page.keyboard.press('Shift+ArrowRight')
  expect((await article(page).boundingBox())!.width - before.width).toBeCloseTo(1, 1)
  expect((await article(page).boundingBox())!.x).toBeCloseTo(before.x, 1)
  await undo(page).click()
  await outline(page)
    .getByRole('button', { name: 'Beta', exact: true })
    .click({ modifiers: ['Control'] })
  const beta = (await article(page, 'b').boundingBox())!
  await page
    .getByRole('button', { name: 'Move selected widgets', exact: true })
    .focus()
  await page.keyboard.press('Shift+ArrowRight')
  expect((await article(page).boundingBox())!.x - before.x).toBeCloseTo(1, 1)
  expect((await article(page, 'b').boundingBox())!.x - beta.x).toBeCloseTo(1, 1)
  await undo(page).click()
  await page.getByRole('button', { name: 'Phone', exact: true }).click()
  await page.getByRole('button', { name: 'Fit content', exact: true }).click()
  await outline(page).getByRole('button', { name: 'Alpha', exact: true }).click()
  await article(page).focus()
  await page.keyboard.press('Shift+ArrowRight')
  await save(page).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  const saved = api.layouts.get('personal')!.widgets
  expect(saved.find((w) => w.id === 'panel')).toEqual(panel)
  expect(saved.find((w) => w.id === 'a')!.placement).toEqual(widgets[0]!.placement)
  expect(saved.find((w) => w.id === 'a')!.devices?.phone?.x).toBeGreaterThan(
    widgets[0]!.placement!.x,
  )
  expect(saved.find((w) => w.id === 'b')!.devices).toBeUndefined()
})

test('blocked legacy nudges and inherited locks do not create placements or history', async ({
  page,
}) => {
  await setup(page, [{ ...widgets[0]!, span: 12, placement: undefined }])
  await article(page).focus()
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('Shift+ArrowUp')
  await expect(save(page)).toBeDisabled()
  await expect(undo(page)).toBeDisabled()
  await page.getByRole('button', { name: 'Cancel edits', exact: true }).click()
  await setup(page, [
    {
      id: 'panel',
      type: 'container',
      title: 'Panel',
      text: '',
      span: 12,
      positionLocked: true,
      placement: { x: 0, y: 0, w: 24, h: 18 },
      container: {
        kind: 'panel',
        labels: ['Content'],
        direction: 'row',
        ratio: 50,
        collapsed: false,
      },
    },
    { ...widgets[0]!, parentId: 'panel', region: '0' },
  ])
  await outline(page).getByRole('button', { name: 'Alpha', exact: true }).click()
  await article(page).focus()
  await page.keyboard.press('Shift+ArrowRight')
  await expect(save(page)).toBeDisabled()
  await expect(undo(page)).toBeDisabled()
})

test('Escape respects menus, text controls and active move cancellation before dismissing pegs', async ({
  page,
}) => {
  await setup(page)
  await article(page).focus()
  await page.keyboard.press('Shift+F10')
  await expect(page.getByRole('menu', { name: 'Widget actions' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(selectedFrame(page)).toBeVisible()
  const input = page.getByLabel('Title', { exact: true })
  await input.focus()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Shift+ArrowRight')
  await expect(selectedFrame(page)).toBeVisible()
  await expect(save(page)).toBeDisabled()
  const move = page.getByRole('button', {
    name: 'Move selected widget',
    exact: true,
  })
  await move.focus()
  const before = (await article(page).boundingBox())!,
    grip = (await move.boundingBox())!
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(grip.x + 90, grip.y + 40, { steps: 6 })
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(selectedFrame(page)).toBeVisible()
  expect((await article(page).boundingBox())!.x).toBeCloseTo(before.x, 1)
  await expect(save(page)).toBeDisabled()
  await move.focus()
  await page.keyboard.press('Escape')
  await expect(selectedFrame(page)).toHaveCount(0)
  await expect(page.getByLabel('Dashboard canvas', { exact: true })).toBeFocused()
})

test('Enter and Space cannot change selection during a group drag or background gesture', async ({
  page,
}) => {
  await setup(page)
  await outline(page).getByRole('button', { name: 'Alpha', exact: true }).click()
  await outline(page)
    .getByRole('button', { name: 'Beta', exact: true })
    .click({ modifiers: ['Control'] })
  await article(page).focus()
  const before = (await article(page).boundingBox())!
  // Use the content, not a fixed inset that can land on wrapped header actions.
  const content = (await article(page).locator('.shared-variable-text').boundingBox())!
  await page.mouse.move(content.x + 10, content.y + content.height / 2)
  await page.mouse.down()
  await page.mouse.move(content.x + 70, content.y + content.height / 2 + 20, { steps: 5 })
  await expect(page.locator('.shared-drag-ghost')).toBeVisible()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Shift+Space')
  await expect(selectedFrame(page)).toHaveAccessibleName('Selected widgets frame')
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(selectedFrame(page)).toHaveAccessibleName('Selected widgets frame')
  expect((await article(page).boundingBox())!.x).toBeCloseTo(before.x, 1)
  const canvas = (await page.getByLabel('Dashboard canvas', { exact: true }).boundingBox())!
  await page.mouse.move(canvas.x + canvas.width - 15, canvas.y + canvas.height - 15)
  await page.mouse.down()
  await page.mouse.move(canvas.x + canvas.width - 80, canvas.y + canvas.height - 50, { steps: 4 })
  await page.keyboard.press('Enter')
  await expect(selectedFrame(page)).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(selectedFrame(page)).toHaveAccessibleName('Selected widgets frame')
  await expect(save(page)).toBeDisabled()
})

test('clicking empty space inside a container clears child selection without changing content', async ({
  page,
}) => {
  await setup(page, [
    {
      id: 'panel',
      type: 'container',
      title: 'Panel',
      text: '',
      span: 12,
      placement: { x: 0, y: 0, w: 16, h: 18 },
      container: {
        kind: 'panel',
        labels: ['Content'],
        direction: 'row',
        ratio: 50,
        collapsed: false,
      },
    },
    { ...widgets[0]!, parentId: 'panel', region: '0' },
  ])
  await outline(page).getByRole('button', { name: 'Alpha', exact: true }).click()
  const surface = page.locator('[data-widget-surface="panel"]')
  const box = (await surface.boundingBox())!
  await page.mouse.click(box.x + 10, box.y + 10)
  await expect(selectedFrame(page)).toHaveCount(0)
  await expect(save(page)).toBeDisabled()
  await expect(undo(page)).toBeDisabled()
})
