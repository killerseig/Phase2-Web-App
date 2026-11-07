import { expect, test, type Page } from './helpers/test.js'
import { mockDashboard } from './helpers/dashboardFixture.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import type { SharedDashboardWidget } from '../functions/src/sharedDashboardModel.js'

const text: SharedDashboardWidget = {
  id: 'a',
  type: 'text',
  title: 'Alpha',
  text: 'First',
  span: 6,
  placement: { x: 2.25, y: 3, w: 6, h: 5 },
}
const outline = (page: Page) => page.getByRole('group', { name: 'On this dashboard', exact: true })
const undo = (page: Page) => page.getByRole('button', { name: 'Undo template edit', exact: true })
async function setup(page: Page, entries = [text]) {
  await page.setViewportSize({ width: 1600, height: 1000 })
  const api = await mockDashboard(page)
  api.layouts.set('personal', { version: 1, widgets: structuredClone(entries) })
  await gotoPhase2App(page, '/dashboards/personal', createJobsFixture())
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  return api
}

test('successive paste keeps the original offset and advances without exact stacking', async ({
  page,
}) => {
  await setup(page)
  await page.getByRole('button', { name: 'Copy selection', exact: true }).click()
  await page.getByRole('button', { name: 'Paste widgets', exact: true }).click()
  await expect(page.getByLabel('Left column', { exact: true })).toHaveValue('3.25')
  await page.getByRole('button', { name: 'Paste widgets', exact: true }).click()
  await expect(page.getByLabel('Left column', { exact: true })).toHaveValue('4.25')
  await expect(page.locator('[data-widget-id]')).toHaveCount(3)
  await undo(page).click()
  await expect(page.locator('[data-widget-id]')).toHaveCount(2)
  await page.getByRole('button', { name: 'Redo template edit', exact: true }).click()
  await expect(page.locator('[data-widget-id]')).toHaveCount(3)
})

test('duplicate shortcut works for the selected widget and does not repeat while held', async ({
  page,
}) => {
  await setup(page)
  await page.locator('[data-widget-id="a"]').focus()
  await page.keyboard.press('Control+d')
  await expect(page.locator('[data-widget-id]')).toHaveCount(2)
  await page.getByLabel('Dashboard canvas', { exact: true }).dispatchEvent('keydown', {
    key: 'd',
    ctrlKey: true,
    repeat: true,
    bubbles: true,
  })
  await expect(page.locator('[data-widget-id]')).toHaveCount(2)
  await expect(outline(page).getByRole('button', { name: 'Alpha copy', exact: true })).toBeVisible()
})

test('multi-selection duplicate and confirmed Delete are atomic and restore through Undo', async ({
  page,
}) => {
  await setup(page, [
    text,
    { ...text, id: 'b', title: 'Beta', placement: { x: 12.25, y: 5, w: 6, h: 5 } },
  ])
  await outline(page).getByRole('button', { name: 'Alpha', exact: true }).click()
  await outline(page)
    .getByRole('button', { name: 'Beta', exact: true })
    .click({ modifiers: ['Control'] })
  await page.keyboard.press('Control+d')
  await expect(page.locator('[data-widget-id]')).toHaveCount(4)
  await expect(page.locator('[data-widget-id].is-selected')).toHaveCount(2)
  await page.keyboard.press('Delete')
  await expect(page.getByRole('dialog')).toContainText('Remove selected widgets?')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.locator('[data-widget-id]')).toHaveCount(4)
  await page.keyboard.press('Backspace')
  await page.getByRole('dialog').getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(page.locator('[data-widget-id]')).toHaveCount(2)
  await expect(page.getByLabel('Dashboard canvas', { exact: true })).toBeFocused()
  await undo(page).click()
  await expect(page.locator('[data-widget-id]')).toHaveCount(4)
  await undo(page).click()
  await expect(page.locator('[data-widget-id]')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Save template', exact: true })).toBeDisabled()
})

test('Cut cancellation keeps the previous clipboard; confirmed Cut preserves saved private records', async ({
  page,
}) => {
  const note = {
    ...text,
    id: 'note',
    title: 'Notes',
    type: 'notes' as const,
    text: 'Legacy private',
    placement: { x: 12, y: 3, w: 6, h: 6 },
  }
  const api = await setup(page, [text, note])
  api.contents.set('personal', { notes: { note: 'Saved private note' }, events: [], version: 1 })
  await page.locator('[data-widget-id="a"]').focus()
  await page.keyboard.press('Control+c')
  await outline(page).getByRole('button', { name: 'Notes', exact: true }).click()
  await page.locator('[data-widget-id="note"]').focus()
  await page.keyboard.press('Control+x')
  await expect(page.getByRole('dialog')).toContainText('saved notes')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.keyboard.press('Control+v')
  await expect(outline(page).getByRole('button', { name: 'Alpha', exact: true })).toHaveCount(2)
  await undo(page).click()
  await outline(page).getByRole('button', { name: 'Notes', exact: true }).click()
  await page.locator('[data-widget-id="note"]').focus()
  await page.keyboard.press('Control+x')
  await page.getByRole('dialog').getByRole('button', { name: 'Cut settings', exact: true }).click()
  await expect(page.locator('[data-widget-id="note"]')).toHaveCount(0)
  await page.keyboard.press('Control+v')
  await expect(page.locator('[data-widget-id]')).toHaveCount(2)
  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  const pasted = api.layouts.get('personal')!.widgets.find((w) => w.type === 'notes')!
  expect(pasted.id).not.toBe('note')
  expect(pasted.text).toBe('')
  expect(api.contents.get('personal')!.notes).toEqual({ note: 'Saved private note' })
  expect(
    api.requests.filter((r) =>
      ['save-notes', 'save-calendar', 'save-tasks'].includes(String(r.action)),
    ),
  ).toHaveLength(0)
})

test('clipboard shortcuts do not hijack typing, inspector buttons, menus or active gestures', async ({
  page,
}) => {
  await setup(page)
  const title = page.getByLabel('Title', { exact: true })
  await title.focus()
  await page.keyboard.press('Control+d')
  await page.keyboard.press('Delete')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('[data-widget-id]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Copy selection', exact: true }).focus()
  await page.keyboard.press('Control+d')
  await expect(page.locator('[data-widget-id]')).toHaveCount(1)
  const widget = page.locator('[data-widget-id="a"]')
  await widget.focus()
  await page.keyboard.press('Shift+F10')
  await page.keyboard.press('Delete')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.keyboard.press('Escape')
  const box = (await widget.boundingBox())!
  await page.mouse.move(box.x + 12, box.y + box.height - 12)
  await page.mouse.down()
  await page.mouse.move(box.x + 45, box.y + box.height + 8, { steps: 4 })
  expect(
    await widget.evaluate((el) => {
      const event = new KeyboardEvent('keydown', {
        key: 'd',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
      el.dispatchEvent(event)
      return event.defaultPrevented
    }),
  ).toBe(true)
  await page.keyboard.press('Control+d')
  await page.keyboard.press('Control+x')
  await page.keyboard.press('Delete')
  await expect(page.locator('[data-widget-id]')).toHaveCount(1)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.mouse.up()
})

test('required descendants block a mixed selection without partial removal or clipboard loss', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  const api = await mockDashboard(page)
  api.layouts.set('role-admin', {
    version: 1,
    widgets: [
      text,
      {
        ...text,
        id: 'panel',
        title: 'Panel',
        type: 'container',
        placement: { x: 10, y: 0, w: 14, h: 20 },
        container: {
          kind: 'panel',
          labels: ['Content'],
          direction: 'row',
          ratio: 50,
          collapsed: false,
        },
      },
      {
        id: 'jobs',
        type: 'jobs',
        title: 'Required jobs',
        text: '',
        span: 12,
        parentId: 'panel',
        region: '0',
      },
    ],
  })
  await gotoPhase2App(page, '/dashboards/role-home', createJobsFixture())
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.locator('[data-widget-id="a"]').focus()
  await page.keyboard.press('Control+c')
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Control+x')
  await page.keyboard.press('Delete')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.shared-editor-announcement')).toContainText('required tool')
  await expect(page.locator('[data-widget-id]')).toHaveCount(3)
  await page.keyboard.press('Control+v')
  await expect(page.locator('[data-widget-id]')).toHaveCount(4)
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Alpha')
})

test('nested phone paste keeps local parents, offsets overrides, and preserves original geometry', async ({
  page,
}) => {
  const panel: SharedDashboardWidget = {
    ...text,
    id: 'panel',
    title: 'Panel',
    type: 'container',
    placement: { x: 0, y: 0, w: 24, h: 30 },
    container: {
      kind: 'panel',
      labels: ['Content'],
      direction: 'row',
      ratio: 50,
      collapsed: false,
    },
  }
  const child = {
    ...text,
    parentId: 'panel',
    region: '0',
    devices: { phone: { x: 1, y: 4, w: 20, h: 5 } },
  }
  const api = await setup(page, [panel, child])
  await page.getByRole('button', { name: 'Phone', exact: true }).click()
  await outline(page).getByRole('button', { name: 'Alpha', exact: true }).click()
  await page.locator('[data-widget-id="a"]').focus()
  await page.keyboard.press('Control+c')
  await page.keyboard.press('Control+v')
  await expect(page.getByLabel('Left column', { exact: true })).toHaveValue('2')
  await page.keyboard.press('Control+v')
  await expect(page.getByLabel('Left column', { exact: true })).toHaveValue('3')
  await expect(page.getByLabel('Container', { exact: true })).toHaveValue('panel')
  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  const saved = api.layouts.get('personal')!.widgets
  expect(saved.find((w) => w.id === 'a')).toEqual(child)
  expect(saved.find((w) => w.id === 'panel')).toEqual(panel)
  expect(saved.filter((w) => w.parentId === 'panel')).toHaveLength(3)
})

test('the 12-widget limit rejects paste without consuming the copied settings', async ({
  page,
}) => {
  const entries = Array.from({ length: 12 }, (_, i) => ({
    ...text,
    id: `item-${i}`,
    title: `Item ${i}`,
  }))
  await setup(page, entries)
  await page.locator('[data-widget-id="item-0"]').focus()
  await page.keyboard.press('Control+c')
  await page.keyboard.press('Control+v')
  await expect(page.locator('.shared-editor-announcement')).toContainText('12-widget limit')
  await expect(page.locator('[data-widget-id]')).toHaveCount(12)
  await expect(page.getByRole('button', { name: 'Save template', exact: true })).toBeDisabled()
  await page.keyboard.press('Delete')
  await page.getByRole('dialog').getByRole('button', { name: 'Remove', exact: true }).click()
  await page.keyboard.press('Control+v')
  await expect(page.locator('[data-widget-id]')).toHaveCount(12)
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Item 0')
})

test('singleton conflicts fail atomically and leave a copied tool available after removal', async ({
  page,
}) => {
  const dates: SharedDashboardWidget = { ...text, id: 'dates', type: 'dates', title: 'Calendar' }
  await setup(page, [dates])
  await page.locator('[data-widget-id="dates"]').focus()
  await page.keyboard.press('Control+c')
  await page.keyboard.press('Control+v')
  await expect(page.locator('[data-widget-id]')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Save template', exact: true })).toBeDisabled()
  await expect(page.locator('.shared-editor-announcement')).not.toBeEmpty()
  await page.keyboard.press('Delete')
  await page.getByRole('dialog').getByRole('button', { name: 'Remove', exact: true }).click()
  await page.keyboard.press('Control+v')
  await expect(page.locator('[data-widget-id]')).toHaveCount(1)
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Calendar')
})

test('role switching detaches an external parent even when its ID also exists in the destination', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  const api = await mockDashboard(page)
  const entries: SharedDashboardWidget[] = [
    {
      ...text,
      id: 'panel',
      type: 'container',
      title: 'Panel',
      placement: { x: 0, y: 0, w: 24, h: 25 },
      container: {
        kind: 'panel',
        labels: ['Content'],
        direction: 'row',
        ratio: 50,
        collapsed: false,
      },
    },
    { ...text, parentId: 'panel', region: '0' },
    {
      id: 'jobs',
      type: 'jobs',
      title: 'Jobs',
      text: '',
      span: 12,
      placement: { x: 0, y: 30, w: 24, h: 5 },
    },
  ]
  api.layouts.set('role-admin', { version: 1, widgets: structuredClone(entries) })
  api.layouts.set('role-foreman', {
    version: 1,
    widgets: structuredClone(entries.filter((w) => w.id !== 'a')),
  })
  await gotoPhase2App(page, '/dashboards/role-home', createJobsFixture())
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await outline(page).getByRole('button', { name: 'Alpha', exact: true }).click()
  await page.locator('[data-widget-id="a"]').focus()
  await page.keyboard.press('Control+c')
  await page.getByLabel('Shared layout for', { exact: true }).selectOption('foreman')
  await expect(page.locator('[data-widget-id="a"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Paste widgets', exact: true }).click()
  await expect(page.getByLabel('Container', { exact: true })).toHaveValue('')
  await page.getByRole('button', { name: 'Save template', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible()
  expect(
    api.layouts.get('role-foreman')!.widgets.find((w) => w.type === 'text'),
  ).not.toHaveProperty('parentId')
  expect(api.layouts.get('role-admin')!.widgets).toEqual(entries)
})

test('an unavailable destination type rejects paste and keeps the clipboard for its allowed role', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  const api = await mockDashboard(page)
  const jobs: SharedDashboardWidget = {
    id: 'jobs',
    type: 'jobs',
    title: 'Jobs',
    text: '',
    span: 12,
    placement: { x: 0, y: 14, w: 24, h: 5 },
  }
  api.layouts.set('role-admin', {
    version: 1,
    widgets: [
      {
        ...text,
        type: 'form',
        title: 'Form',
        form: { templateId: 'test', version: 1, presentation: 'launcher' },
      },
      jobs,
    ],
  })
  api.layouts.set('role-payroll', { version: 1, widgets: [jobs] })
  await gotoPhase2App(page, '/dashboards/role-home', createJobsFixture())
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.locator('[data-widget-id="a"]').focus()
  await page.keyboard.press('Control+c')
  await page.getByLabel('Shared layout for', { exact: true }).selectOption('payroll')
  await expect(page.locator('[data-widget-id]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Paste widgets', exact: true }).click()
  await expect(page.locator('.shared-editor-announcement')).toContainText('unavailable')
  await expect(page.getByRole('button', { name: 'Save template', exact: true })).toBeDisabled()
  await page.getByLabel('Shared layout for', { exact: true }).selectOption('admin')
  await expect(page.locator('[data-widget-id]')).toHaveCount(2)
  await page.getByRole('button', { name: 'Paste widgets', exact: true }).click()
  await expect(page.locator('[data-widget-id]')).toHaveCount(3)
  expect(api.requests.filter((r) => String(r.action).startsWith('save'))).toHaveLength(0)
})
