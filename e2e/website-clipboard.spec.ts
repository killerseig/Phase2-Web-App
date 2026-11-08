import { expect, test, type Page } from './helpers/test.js'
import { mockDashboard } from './helpers/dashboardFixture.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { routeWebsiteBuilderFixture } from './helpers/websiteCallableFixture.js'
import type { WebsitePage, WebsiteSection, WebsiteSite } from '../src/features/website/types.js'

function textWidget(id: string, title: string, x = 2, y = 3): WebsiteSection {
  return {
    id,
    type: 'text',
    title,
    text: `${title} content`,
    imageId: '',
    alt: '',
    linkLabel: '',
    linkUrl: '',
    hidden: false,
    items: [],
    layout: { x, y, w: 6, h: 4, z: 1 },
  }
}
function websitePage(id: string, sections: WebsiteSection[]): WebsitePage {
  return {
    id,
    title: id === 'home' ? 'Home' : 'About',
    slug: id,
    description: '',
    chrome: 'widgets',
    inNavigation: true,
    sections,
  }
}
function website(sections = [textWidget('alpha', 'Alpha')]): WebsiteSite {
  return { name: 'Clipboard rehearsal', accent: '#174878', pages: [websitePage('home', sections)] }
}
const canvas = (page: Page) => page.getByLabel('Website grid workspace', { exact: true })
const frames = (page: Page) => page.locator('.preview-frame [data-widget-id]')
const widget = (page: Page, id: string) => page.locator(`.preview-frame [data-widget-id="${id}"]`)
const outline = (page: Page) => page.getByRole('complementary', { name: 'Website structure' })
const confirmation = (page: Page) => page.locator('.builder-confirm[open]')
const undo = (page: Page) => page.getByRole('button', { name: 'Undo', exact: true })

async function setup(page: Page, content = website(), width = 1600) {
  let draft = structuredClone(content)
  let version = 0
  const actions: string[] = []
  await page.setViewportSize({ width, height: 1000 })
  await page.addInitScript(() => sessionStorage.setItem('website-editor-mode', 'design'))
  // The global announcement dialog must use this rehearsal's empty synthetic workspace.
  await mockDashboard(page)
  await routeWebsiteBuilderFixture(page, (request) => {
    actions.push(request.action)
    if (request.action === 'load')
      return { draft: structuredClone(draft), version, publishedAt: null, hasPrevious: false }
    if (request.action === 'save') {
      draft = structuredClone(request.site)
      return { version: ++version }
    }
    if (request.action === 'listRevisions') return { revisions: [], activity: [] }
    if (request.action === 'listImages') return { images: [], nextCursor: null }
    throw new Error(`Unexpected Website clipboard fixture action: ${request.action}`)
  })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await expect(
    page
      .getByRole('group', { name: 'Editor mode', exact: true })
      .getByRole('button', { name: 'Design', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toBeEnabled()
  await expect(widget(page, content.pages[0]!.sections[0]!.id)).toBeVisible()
  return { draft: () => draft, actions }
}

async function select(page: Page, id: string, additive = false) {
  const row = outline(page).locator(`.widget-outline-row[data-widget-id="${id}"]`)
  await row
    .getByRole('button')
    .filter({ has: page.locator('small') })
    .click(additive ? { modifiers: ['Shift'] } : {})
  await widget(page, id).focus()
}

async function save(page: Page) {
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
}

async function selectedPosition(page: Page) {
  return page
    .locator('.preview-frame .grid-selected')
    .first()
    .evaluate((element) => ({
      x: Number.parseFloat((element as HTMLElement).style.left) / 45,
      y: Number.parseFloat((element as HTMLElement).style.top) / 32,
    }))
}

async function beginOutlineGesture(page: Page, drag: boolean) {
  const grip = outline(page).getByRole('button', { name: 'Drag outline widget 1', exact: true })
  await grip.scrollIntoViewIfNeeded()
  const bounds = (await grip.boundingBox())!
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  if (drag) await page.mouse.move(bounds.x + 70, bounds.y + 60, { steps: 5 })
}

async function requestRemoval(page: Page, entry: 'keyboard' | 'menu', action: 'cut' | 'delete') {
  if (entry === 'keyboard') await page.keyboard.press(action === 'cut' ? 'Control+x' : 'Delete')
  else {
    await widget(page, 'beta').click({ button: 'right' })
    await page
      .getByRole('menu', { name: 'Widget actions' })
      .getByRole('menuitem', {
        name: action === 'cut' ? 'Cut widgets' : 'Remove selection',
        exact: true,
      })
      .click()
  }
  await expect(confirmation(page)).toBeVisible()
}

async function zoomCanvas(page: Page) {
  const controls = page.getByRole('group', { name: 'Canvas controls', exact: true })
  await controls.getByRole('button', { name: 'Reset zoom', exact: true }).click()
  for (let step = 0; step < 4; step++)
    await controls.getByRole('button', { name: 'Zoom out', exact: true }).click()
  await expect(controls.getByRole('button', { name: 'Reset zoom', exact: true })).toHaveText('60%')
}

async function openBlankCanvasMenu(page: Page, x = 14, y = 9) {
  const point = await page.locator('.preview-frame .grid-surface').evaluate(
    (element, point) => {
      const rect = element.getBoundingClientRect()
      const scale = rect.width / (element as HTMLElement).offsetWidth
      const clientX = Math.round(rect.left + point.x * 45 * scale)
      const clientY = Math.round(rect.top + point.y * 32 * scale)
      const hit = document.elementFromPoint(clientX, clientY)
      if (!hit || !element.contains(hit) || hit.closest('[data-widget-id]'))
        throw new Error('The intended menu point must hit visible blank canvas.')
      return {
        clientX,
        clientY,
        x: (clientX - rect.left) / (45 * scale),
        y: (clientY - rect.top) / (32 * scale),
      }
    },
    { x, y },
  )
  await page.mouse.click(point.clientX, point.clientY, { button: 'right' })
  await expect(page.getByRole('menu', { name: 'Widget actions' })).toBeVisible()
  return point
}

async function pasteFromMenu(page: Page) {
  await page
    .getByRole('menu', { name: 'Widget actions' })
    .getByRole('menuitem', { name: 'Paste widgets', exact: true })
    .click()
}

async function beginLayerGesture(page: Page, drag: boolean) {
  const panel = page.getByRole('region', { name: 'Page layers', exact: true })
  const grip = panel.getByRole('button', { name: 'Drag Beta layer', exact: true })
  await grip.scrollIntoViewIfNeeded()
  const bounds = (await grip.boundingBox())!
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  if (drag) {
    const target = (await panel.locator('[data-layer-id="alpha"]').boundingBox())!
    await page.mouse.move(target.x + target.width / 2, target.y + 4, { steps: 5 })
    await expect(panel.locator('[data-layer-id="beta"]')).toHaveClass(/is-dragging/)
  }
}

test('repeated Paste advances from the copied position and Duplicate remains distinct', async ({
  page,
}) => {
  const api = await setup(page)
  await select(page, 'alpha')
  await page.keyboard.press('Control+c')
  for (const offset of [1, 2, 3]) {
    await page.keyboard.press('Control+v')
    await expect(frames(page)).toHaveCount(offset + 1)
    await expect.poll(() => selectedPosition(page)).toEqual({ x: 2 + offset, y: 3 + offset })
  }
  await page.keyboard.press('Control+d')
  await expect(frames(page)).toHaveCount(5)
  await expect.poll(() => selectedPosition(page)).toEqual({ x: 6, y: 7 })
  await undo(page).click()
  await expect(frames(page)).toHaveCount(4)
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(frames(page)).toHaveCount(5)
  await save(page)
  const sections = api.draft().pages[0]!.sections
  expect(sections.map((entry) => [entry.layout!.x, entry.layout!.y])).toEqual([
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 7],
  ])
  expect(new Set(sections.map((entry) => entry.id)).size).toBe(5)
  expect(api.actions).not.toContain('publish')
})

test('held, composing and unsupported modified shortcuts do not duplicate, remove or replace the clipboard', async ({
  page,
}) => {
  await setup(page, website([textWidget('alpha', 'Alpha'), textWidget('beta', 'Beta', 12)]))
  await select(page, 'alpha')
  await page.keyboard.press('Control+c')
  await select(page, 'beta')
  for (const modifier of [
    { repeat: true },
    { isComposing: true },
    { altKey: true },
    { shiftKey: true },
  ]) {
    for (const key of ['c', 'v', 'd', 'x']) {
      await widget(page, 'beta').dispatchEvent('keydown', {
        key,
        ctrlKey: true,
        bubbles: true,
        ...modifier,
      })
      await expect(frames(page)).toHaveCount(2)
      await expect(confirmation(page)).toHaveCount(0)
    }
  }
  for (const modifier of [
    { repeat: true },
    { isComposing: true },
    { altKey: true },
    { ctrlKey: true },
  ]) {
    await widget(page, 'beta').dispatchEvent('keydown', {
      key: 'Delete',
      bubbles: true,
      ...modifier,
    })
    await expect(confirmation(page)).toHaveCount(0)
    await expect(frames(page)).toHaveCount(2)
  }
  await canvas(page).focus()
  await page.keyboard.press('Control+v')
  await expect(frames(page)).toHaveCount(3)
  await expect(page.locator('.preview-frame .grid-selected')).toHaveAttribute(
    'aria-label',
    'Select Alpha widget',
  )
})

test('native inputs, unrelated controls, menus, dialogs and non-Design modes keep their own keyboard actions', async ({
  page,
}) => {
  await setup(page)
  await select(page, 'alpha')
  await page.keyboard.press('Control+c')
  await page
    .getByRole('navigation', { name: 'Workspace tools' })
    .getByRole('button', { name: 'Widgets', exact: true })
    .click()
  const search = page.getByLabel('Find widgets', { exact: true })
  await search.fill('Text')
  await search.focus()
  await page.keyboard.press('Control+d')
  await page.keyboard.press('Delete')
  await expect(frames(page)).toHaveCount(1)
  await expect(confirmation(page)).toHaveCount(0)
  await expect(search).toBeFocused()
  await outline(page).getByRole('button', { name: 'Page settings', exact: true }).focus()
  await page.keyboard.press('Control+d')
  await expect(frames(page)).toHaveCount(1)
  await widget(page, 'alpha').click({ button: 'right' })
  await expect(page.getByRole('menu', { name: 'Widget actions' })).toBeVisible()
  await page.keyboard.press('Control+d')
  await page.keyboard.press('Delete')
  await expect(frames(page)).toHaveCount(1)
  await expect(confirmation(page)).toHaveCount(0)
  await page.keyboard.press('Escape')
  await canvas(page).focus()
  await page.keyboard.press('Delete')
  await expect(confirmation(page)).toBeVisible()
  for (const key of ['Control+d', 'Control+v', 'Control+x', 'Delete'])
    await page.keyboard.press(key)
  await expect(frames(page)).toHaveCount(1)
  await expect(confirmation(page)).toHaveCount(1)
  await confirmation(page).getByRole('button', { name: 'Cancel', exact: true }).click()
  const modes = page.getByRole('group', { name: 'Editor mode', exact: true })
  for (const name of ['Content', 'Code']) {
    await modes.getByRole('button', { name, exact: true }).click()
    await canvas(page).focus()
    for (const key of ['Control+d', 'Control+v', 'Control+x', 'Delete'])
      await page.keyboard.press(key)
    await expect(frames(page)).toHaveCount(1)
    await expect(confirmation(page)).toHaveCount(0)
  }
  await modes.getByRole('button', { name: 'Design', exact: true }).click()
  await canvas(page).focus()
  await page.keyboard.press('Control+v')
  await expect(frames(page)).toHaveCount(2)
})

test('pending pointer and active drag reject clipboard commands until cancellation', async ({
  page,
}) => {
  const api = await setup(page)
  await select(page, 'alpha')
  await page.keyboard.press('Control+c')
  for (const drag of [false, true]) {
    await beginOutlineGesture(page, drag)
    for (const key of ['Control+d', 'Control+v', 'Control+x', 'Delete'])
      await page.keyboard.press(key)
    await expect(frames(page)).toHaveCount(1)
    await expect(confirmation(page)).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.mouse.up()
  }
  await select(page, 'alpha')
  await page.keyboard.press('Control+d')
  await expect(frames(page)).toHaveCount(2)
  await undo(page).click()
  await save(page)
  expect(api.draft().pages[0]!.sections).toHaveLength(1)
  expect(api.draft().pages[0]!.sections[0]!.layout).toMatchObject({ x: 2, y: 3 })
})

for (const entry of ['keyboard', 'menu'] as const) {
  test(`${entry} Cut cancellation preserves the clipboard; confirmed Cut and Delete each undo atomically`, async ({
    page,
  }) => {
    const api = await setup(
      page,
      website([textWidget('alpha', 'Alpha'), textWidget('beta', 'Beta', 12)]),
    )
    await select(page, 'alpha')
    await page.keyboard.press('Control+c')
    await select(page, 'beta')
    await requestRemoval(page, entry, 'cut')
    await expect(frames(page)).toHaveCount(2)
    await confirmation(page).getByRole('button', { name: 'Cancel', exact: true }).click()
    await canvas(page).focus()
    await page.keyboard.press('Control+v')
    await expect(frames(page)).toHaveCount(3)
    await expect(page.locator('.preview-frame .grid-selected')).toHaveAttribute(
      'aria-label',
      'Select Alpha widget',
    )
    await undo(page).click()
    await select(page, 'beta')
    await requestRemoval(page, entry, 'cut')
    await confirmation(page).getByRole('button', { name: 'Cut widgets', exact: true }).click()
    await expect(widget(page, 'beta')).toHaveCount(0)
    await expect(frames(page)).toHaveCount(1)
    // Destructive actions restore keyboard focus inside the canvas before another command.
    await expect(canvas(page)).toBeFocused()
    await page.keyboard.press('Control+v')
    await expect(frames(page)).toHaveCount(2)
    await expect(page.locator('.preview-frame .grid-selected')).toHaveAttribute(
      'aria-label',
      'Select Beta widget',
    )
    await undo(page).click()
    await expect(frames(page)).toHaveCount(1)
    await undo(page).click()
    await expect(widget(page, 'beta')).toBeVisible()
    await select(page, 'alpha')
    await select(page, 'beta', true)
    await expect(page.locator('.preview-frame .grid-selected')).toHaveCount(2)
    await requestRemoval(page, entry, 'delete')
    await expect(frames(page)).toHaveCount(2)
    await confirmation(page).getByRole('button', { name: 'Remove widgets', exact: true }).click()
    await expect(frames(page)).toHaveCount(0)
    await expect(canvas(page)).toBeFocused()
    await undo(page).click()
    await expect(frames(page)).toHaveCount(2)
    await save(page)
    expect(api.draft().pages[0]!.sections.map((section) => section.id)).toEqual(['alpha', 'beta'])
  })
}

test('nested copies remap descendants, keep responsive content and preserve layout locks', async ({
  page,
}) => {
  const group: WebsiteSection = {
    ...textWidget('group', 'Group'),
    type: 'container',
    locked: true,
    container: { direction: 'column', gap: 12 },
    layout: { x: 2, y: 3, w: 12, h: 12, z: 1 },
    devices: { mobile: { container: { direction: 'column', gap: 6 }, appearance: { padding: 8 } } },
  }
  const inner: WebsiteSection = {
    ...textWidget('inner', 'Inner'),
    type: 'container',
    parentId: 'group',
    container: { direction: 'row', gap: 4 },
    devices: { tablet: { appearance: { padding: 16 } } },
  }
  const child: WebsiteSection = {
    ...textWidget('child', 'Child'),
    parentId: 'inner',
    type: 'cards',
    devices: { mobile: { appearance: { color: '#123456' }, sizing: { basis: 90 } } },
    items: [
      {
        id: 'card-item',
        title: 'Nested card',
        text: 'Nested copy content',
        imageId: '',
        alt: '',
        linkLabel: '',
        linkUrl: '',
      },
    ],
  }
  const api = await setup(page, website([group, inner, child]))
  await select(page, 'group')
  await expect(page.getByRole('button', { name: 'Bring to front', exact: true })).toBeDisabled()
  await page.keyboard.press('Control+c')
  await page.keyboard.press('Control+v')
  await expect(frames(page)).toHaveCount(6)
  await expect(page.locator('.preview-frame .contained-widget')).toHaveCount(4)
  await page.keyboard.press('Control+d')
  await expect(frames(page)).toHaveCount(9)
  await save(page)
  const sections = api.draft().pages[0]!.sections
  for (const original of [group, inner, child])
    expect(sections.find((section) => section.id === original.id)).toMatchObject(original)
  const groups = sections.filter((section) => section.title === 'Group')
  expect(groups.map((section) => [section.layout!.x, section.layout!.y])).toEqual([
    [2, 3],
    [3, 4],
    [4, 5],
  ])
  for (const copied of groups.slice(1)) {
    expect(copied.locked).toBe(true)
    expect(copied.devices).toEqual(group.devices)
    const copiedInner = sections.find((section) => section.parentId === copied.id)!
    expect(copiedInner.devices).toEqual(inner.devices)
    const copiedChild = sections.find((section) => section.parentId === copiedInner.id)!
    expect(copiedChild.devices).toEqual(child.devices)
    expect(copiedChild.items[0]).toMatchObject({
      title: 'Nested card',
      text: 'Nested copy content',
    })
    expect(copiedChild.items[0]!.id).not.toBe('card-item')
  }
  expect(new Set(sections.map((section) => section.id)).size).toBe(9)
  await canvas(page).focus()
  await page.keyboard.press('Control+x')
  await confirmation(page).getByRole('button', { name: 'Cut widgets', exact: true }).click()
  await expect(frames(page)).toHaveCount(6)
  await undo(page).click()
  await expect(frames(page)).toHaveCount(9)
})

test('page and shared-layout paste stays scoped and a required page slot cannot replace the clipboard', async ({
  page,
}) => {
  const content = website()
  content.pages.push(websitePage('about', [textWidget('about-note', 'About note')]))
  content.sharedLayout = {
    ...websitePage('site-layout', [
      { ...textWidget('slot', 'Page content'), type: 'page-content', locked: true },
      textWidget('decoration', 'Decoration', 14),
    ]),
    title: 'Site layout',
    inNavigation: false,
  }
  const api = await setup(page, content)
  await select(page, 'alpha')
  await page.keyboard.press('Control+c')
  await outline(page).getByRole('button', { name: 'About /about', exact: true }).click()
  await canvas(page).focus()
  await page.keyboard.press('Control+v')
  await expect(page.getByLabel('Select Alpha widget', { exact: true })).toBeVisible()
  await outline(page).getByRole('button', { name: 'Site layout', exact: true }).click()
  // The required slot renders the nested page, so its selectable control is in the outline.
  const slot = outline(page).getByRole('button', { name: 'Page content Page content', exact: true })
  await slot.click()
  await expect(slot).toBeFocused()
  await expect(slot).toHaveClass(/active/)
  await select(page, 'decoration', true)
  await expect(slot).toHaveClass(/active/)
  await expect(
    outline(page).getByRole('button', { name: 'Decoration Text', exact: true }),
  ).toHaveClass(/active/)
  for (const key of ['Control+c', 'Control+x', 'Control+d', 'Delete']) {
    await page.keyboard.press(key)
    await expect(confirmation(page)).toHaveCount(0)
    await expect(outline(page).locator('.widget-outline-row')).toHaveCount(2)
  }
  await canvas(page).focus()
  await page.keyboard.press('Control+v')
  await expect(outline(page).locator('.widget-outline-row')).toHaveCount(3)
  await save(page)
  expect(api.draft().pages[0]!.sections).toHaveLength(1)
  expect(api.draft().pages[1]!.sections.map((section) => section.title)).toEqual([
    'About note',
    'Alpha',
  ])
  expect(api.draft().sharedLayout!.sections.map((section) => section.title)).toEqual([
    'Page content',
    'Decoration',
    'Alpha',
  ])
  expect(api.draft().sharedLayout!.sections.find((section) => section.id === 'slot')).toMatchObject(
    { type: 'page-content', locked: true },
  )
})

test('the thirty-widget limit rejects a complete subtree and retains its clipboard after making room', async ({
  page,
}) => {
  const group: WebsiteSection = {
    ...textWidget('group', 'Group'),
    type: 'container',
    container: { direction: 'column', gap: 8 },
  }
  const child: WebsiteSection = { ...textWidget('child', 'Child'), parentId: 'group' }
  const content = website([
    group,
    child,
    ...Array.from({ length: 27 }, (_, index) =>
      textWidget(`spare-${index}`, `Spare ${index}`, 14, index * 5),
    ),
  ])
  const api = await setup(page, content)
  await select(page, 'group')
  await page.keyboard.press('Control+c')
  await page.keyboard.press('Control+v')
  await page.keyboard.press('Control+d')
  await expect(frames(page)).toHaveCount(29)
  await expect(undo(page)).toBeDisabled()
  await select(page, 'spare-0')
  await page.keyboard.press('Delete')
  await confirmation(page).getByRole('button', { name: 'Remove widgets', exact: true }).click()
  await expect(frames(page)).toHaveCount(28)
  await page.keyboard.press('Control+v')
  await expect(frames(page)).toHaveCount(30)
  await expect(page.locator('.preview-frame .contained-widget')).toHaveCount(2)
  await save(page)
  expect(api.draft().pages[0]!.sections).toHaveLength(30)
  expect(
    api.draft().pages[0]!.sections.filter((section) => section.title === 'Child'),
  ).toHaveLength(2)
})

test('phone, tablet and desktop previews retain copied settings at narrow zoom without page overflow', async ({
  page,
}) => {
  const alpha = {
    ...textWidget('alpha', 'Alpha'),
    devices: {
      mobile: { appearance: { color: '#123456', padding: 8 } },
      tablet: { appearance: { color: '#654321', padding: 12 } },
    },
  }
  const api = await setup(page, website([alpha]))
  await select(page, 'alpha')
  await page.keyboard.press('Control+c')
  await page.setViewportSize({ width: 390, height: 844 })
  await page
    .getByRole('navigation', { name: 'Builder panels' })
    .getByRole('button', { name: 'Canvas', exact: true })
    .click()
  const controls = page.getByRole('group', { name: 'Canvas controls', exact: true })
  await controls.getByRole('button', { name: 'Phone', exact: true }).click()
  await controls.getByRole('button', { name: 'Fit', exact: true }).click()
  await canvas(page).focus()
  await page.keyboard.press('Control+v')
  await expect(frames(page)).toHaveCount(2)
  for (const device of ['Phone', 'Tablet', 'Desktop']) {
    await controls.getByRole('button', { name: device, exact: true }).click()
    await controls.getByRole('button', { name: 'Fit', exact: true }).click()
    await expect(frames(page)).toHaveCount(2)
    await expect
      .poll(() =>
        page.locator('.preview-frame').evaluate((element) => element.getBoundingClientRect().width),
      )
      .toBeLessThan(390)
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true)
  }
  await controls.getByRole('button', { name: 'Zoom out', exact: true }).click()
  await canvas(page).focus()
  await page.keyboard.press('Control+v')
  await expect(frames(page)).toHaveCount(3)
  await save(page)
  const sections = api.draft().pages[0]!.sections
  expect(sections.map((section) => section.devices)).toEqual([
    alpha.devices,
    alpha.devices,
    alpha.devices,
  ])
  expect(sections.map((section) => [section.layout!.x, section.layout!.y])).toEqual([
    [2, 3],
    [3, 4],
    [4, 5],
  ])
})

test('blank-canvas menu Paste uses the visible grid point at manual zoom', async ({ page }) => {
  const api = await setup(page)
  await select(page, 'alpha')
  await page.keyboard.press('Control+c')
  await zoomCanvas(page)
  const point = await openBlankCanvasMenu(page)
  await pasteFromMenu(page)
  await expect(frames(page)).toHaveCount(2)
  await expect
    .poll(async () => Math.abs((await selectedPosition(page)).x - point.x))
    .toBeLessThan(0.01)
  await expect
    .poll(async () => Math.abs((await selectedPosition(page)).y - point.y))
    .toBeLessThan(0.01)
  await expect(page.locator('.preview-frame .grid-selected')).toBeInViewport()
  await save(page)
  const sections = api.draft().pages[0]!.sections
  expect(sections[0]!.layout).toMatchObject({ x: 2, y: 3 })
  expect(sections[1]!.layout!.x).toBeCloseTo(point.x, 2)
  expect(sections[1]!.layout!.y).toBeCloseTo(point.y, 2)
})

test('scrolled, off-surface and resized menu anchors fall back to distinct copied positions', async ({
  page,
}) => {
  const api = await setup(
    page,
    website([textWidget('alpha', 'Alpha'), textWidget('far', 'Far note', 18, 60)]),
  )
  await select(page, 'alpha')
  await page.keyboard.press('Control+c')
  await zoomCanvas(page)
  await openBlankCanvasMenu(page)
  // Focus/layout can scroll without a wheel event. Keep the menu open so the
  // command must recheck its captured surface rectangle at the moment of Paste.
  const viewport = page.locator('.preview-viewport')
  await viewport.evaluate((element) => {
    element.scrollTop = 96
  })
  await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await expect(page.getByRole('menu', { name: 'Widget actions' })).toBeVisible()
  await pasteFromMenu(page)
  await expect(frames(page)).toHaveCount(3)
  await expect.poll(() => selectedPosition(page)).toEqual({ x: 3, y: 4 })
  // An outline coordinate is not a canvas point, even when an earlier menu had one.
  await outline(page)
    .locator('.widget-outline-row[data-widget-id="alpha"]')
    .click({ button: 'right' })
  await pasteFromMenu(page)
  await expect(frames(page)).toHaveCount(4)
  await expect.poll(() => selectedPosition(page)).toEqual({ x: 4, y: 5 })
  await openBlankCanvasMenu(page)
  await page.setViewportSize({ width: 1450, height: 1000 })
  await expect(page.getByRole('menu', { name: 'Widget actions' })).toHaveCount(0)
  await canvas(page).focus()
  await page.keyboard.press('Control+v')
  await expect(frames(page)).toHaveCount(5)
  await expect.poll(() => selectedPosition(page)).toEqual({ x: 5, y: 6 })
  await save(page)
  const sections = api.draft().pages[0]!.sections
  expect(
    sections
      .filter((section) => section.title === 'Alpha')
      .map((section) => [section.layout!.x, section.layout!.y]),
  ).toEqual([
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
  ])
  expect(sections.find((section) => section.id === 'far')!.layout).toMatchObject({ x: 18, y: 60 })
})

test('layer-grip pending and active pointers block clipboard until release without reordering', async ({
  page,
}) => {
  const alpha = textWidget('alpha', 'Alpha')
  const beta = textWidget('beta', 'Beta', 12)
  const api = await setup(page, website([alpha, beta]))
  await select(page, 'alpha')
  await page.keyboard.press('Control+c')
  await page
    .getByRole('navigation', { name: 'Workspace tools' })
    .getByRole('button', { name: 'Layers', exact: true })
    .click()
  const panel = page.getByRole('region', { name: 'Page layers', exact: true })
  await panel.getByRole('button', { name: 'Select layer Beta', exact: true }).click()
  const order = () =>
    panel
      .locator('[data-layer-id]')
      .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-layer-id')))
  const before = await order()
  for (const drag of [false, true]) {
    await beginLayerGesture(page, drag)
    for (const key of ['Control+c', 'Control+v', 'Control+d', 'Control+x', 'Delete'])
      await page.keyboard.press(key)
    await expect(frames(page)).toHaveCount(2)
    await expect(confirmation(page)).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.keyboard.press('Control+v')
    await expect(frames(page)).toHaveCount(2)
    await page.mouse.up()
    await expect.poll(order).toEqual(before)
  }
  await panel.getByRole('button', { name: 'Select layer Beta', exact: true }).focus()
  await page.keyboard.press('Control+v')
  await expect(frames(page)).toHaveCount(3)
  await expect(page.locator('.preview-frame .grid-selected')).toHaveAttribute(
    'aria-label',
    'Select Alpha widget',
  )
  await save(page)
  for (const original of [alpha, beta])
    expect(
      api.draft().pages[0]!.sections.find((section) => section.id === original.id)!.layout,
    ).toEqual(original.layout)
})
