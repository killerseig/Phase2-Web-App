import { expect, test, type Page } from './helpers/test.js'
import { mockDashboard } from './helpers/dashboardFixture.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { createRequire } from 'node:module'
import { setupFormServer } from './helpers/formFixture.js'
import type { SharedDashboardWidget as Widget } from '../functions/src/sharedDashboardModel.js'
const { defaultDashboardViewport } = createRequire(import.meta.url)(
  '../functions/lib/sharedDashboardModel.js',
) as typeof import('../functions/src/sharedDashboardModel')
const card = (type: Widget['type'], width = 240, extra: Partial<Widget> = {}): Widget => ({
  id: type,
  type,
  title: 'Safety updates and site coordination',
  text: 'Representative widget content.',
  span: 12,
  placement: { x: 0, y: 0, w: (width / 1100) * 24, h: 22 },
  ...extra,
})
async function setup(
  page: Page,
  widgets: Widget[],
  options: { browserWidth?: number; flow?: boolean } = {},
) {
  await page.setViewportSize({ width: options.browserWidth || 1600, height: 1000 })
  const api = await mockDashboard(page)
  api.layouts.set('personal', {
    version: 1,
    widgets,
    viewport: options.flow
      ? defaultDashboardViewport()
      : { ...defaultDashboardViewport(), mode: 'fixed', width: 1100 },
  })
  api.contents.set('personal', {
    version: 1,
    notes: { notes: 'Coordinate deliveries and review the inspection schedule. '.repeat(8) },
    events: [
      {
        id: 'inspection',
        title: 'Review the upcoming inspection and required documentation',
        date: '2026-11-09',
      },
    ],
    tasks: [{ id: 'task', title: 'Review the plans for the upcoming inspection', done: false }],
    announcementDrafts: [
      {
        id: 'draft',
        title: 'Upcoming inspection coordination',
        body: 'Review the plans and coordinate deliveries.',
        audience: 'everyone',
      },
    ],
  })
  await page.route('**/sdsWorkspace', async (route) => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    await route.fulfill({
      headers,
      json: {
        result: {
          version: 1,
          resources: [],
          folders: [],
          sheets: [],
          binder: { version: 0, selections: [] },
        },
      },
    })
  })
  await gotoPhase2App(page, '/dashboards/personal', createJobsFixture())
  await expect(
    page.getByRole('region', { name: 'Dashboard content', exact: true }),
  ).toHaveAttribute('aria-busy', 'false')
  return api
}

test('narrow shared headers keep the title readable beside locks and editing actions', async ({
  page,
}) => {
  await setup(page, [card('text', 240, { positionLocked: true, sizeLocked: true })])
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const title = page.locator('[data-widget-id="text"] > header h2')
  await page.screenshot({ path: test.info().outputPath('narrow-header.png') })
  expect(await title.evaluate((el) => (el as HTMLElement).offsetWidth)).toBeGreaterThan(150)
})

test('narrow task editing retains a usable input and reachable actions', async ({ page }) => {
  await setup(page, [card('tasks')])
  await page.getByRole('button', { name: 'Edit tasks', exact: true }).click()
  await page.screenshot({ path: test.info().outputPath('narrow-tasks.png') })
  expect(
    await page
      .getByLabel('Task 1', { exact: true })
      .evaluate((el) => (el as HTMLElement).offsetWidth),
  ).toBeGreaterThan(140)
})

test('a narrow Documents card uses its drawer in a desktop browser', async ({ page }) => {
  await setup(page, [card('documents', 320)])
  await expect(page.locator('.company-library-widget')).toHaveAttribute('aria-busy', 'false')
  await page.screenshot({ path: test.info().outputPath('narrow-documents.png') })
  await expect(page.getByRole('button', { name: 'Open files', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Open files', exact: true }).click()
  await expect(page.getByText('No files in this collection.', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Open files', exact: true })).toBeFocused()
})

test('narrow resource editing keeps inputs and actions inside the card', async ({ page }) => {
  await setup(page, [card('resources')])
  await page.getByRole('button', { name: 'Add resource', exact: true }).click()
  await page.screenshot({ path: test.info().outputPath('narrow-resources.png') })
  const resource = page.locator('.role-resources')
  expect(await resource.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
  expect(
    await resource
      .getByLabel('Title', { exact: true })
      .evaluate((el) => (el as HTMLElement).offsetWidth),
  ).toBeGreaterThan(130)
})

test('narrow inline forms stack their heading and full-page action', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  const api = await mockDashboard(page)
  api.layouts.set('personal', {
    version: 1,
    widgets: [
      card('form', 320, {
        form: { templateId: 'audit-e2e', version: 1, presentation: 'inline' },
      }),
    ],
    viewport: { ...defaultDashboardViewport(), mode: 'fixed', width: 1100 },
  })
  await setupFormServer(page, {
    definition: {
      title: 'Inspection coordination and review',
      description: '',
      recipients: [],
      fields: [{ id: 'notes', label: 'Review notes', kind: 'text', required: false, options: [] }],
    },
    initialPath: '/dashboards/personal',
  })
  const header = page.locator('.form-presentation__header')
  await expect(header).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Dashboard content', exact: true }),
  ).toHaveAttribute('aria-busy', 'false')
  await page.screenshot({ path: test.info().outputPath('narrow-form.png') })
  expect(await header.evaluate((el) => getComputedStyle(el).flexDirection)).toBe('column')
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  await page.getByLabel('Review notes', { exact: false }).fill('Review the delivery schedule.')
  expect(
    await page.locator('[data-widget-id="form"]').evaluate((el) => el.scrollWidth - el.clientWidth),
  ).toBeLessThanOrEqual(1)
})

const batches: Widget['type'][][] = [
  ['text', 'jobs', 'job-info', 'workflows'],
  ['dates', 'notes', 'announcements', 'tasks'],
  ['announcement-drafts', 'resources', 'form', 'documents'],
]
const scenarios = [
  { name: 'desktop flow', browserWidth: 1600, flow: true },
  { name: 'tablet flow', browserWidth: 820, flow: true },
  { name: 'phone flow', browserWidth: 390, flow: true },
  { name: '240px root', width: 240 },
  { name: '320px root', width: 320 },
  { name: '240px nested', width: 240, nested: true },
]
async function auditCatalog(
  page: Page,
  types: Widget['type'][],
  scenario: (typeof scenarios)[number],
) {
  const nested = 'nested' in scenario && scenario.nested
  const width = 'width' in scenario ? scenario.width : 320
  const widgets = types.map((type, index) =>
    card(type, width, {
      ...(nested ? { parentId: 'panel', region: '0' } : {}),
      placement:
        'flow' in scenario
          ? undefined
          : { x: 0, y: index * 24, w: nested ? 24 : (width / 1100) * 24, h: 22 },
    }),
  )
  if (nested)
    widgets.unshift(
      card('container', width + 38, {
        id: 'panel',
        title: 'Shared coordination panel',
        placement: { x: 0, y: 0, w: ((width + 38) / 1100) * 24, h: 100 },
        container: {
          kind: 'panel',
          labels: ['Content'],
          direction: 'row',
          ratio: 50,
          collapsed: false,
        },
      }),
    )
  const api = await setup(page, widgets, scenario)
  if (types.includes('job-info'))
    await page
      .getByRole('combobox', { name: 'Choose job for information', exact: true })
      .selectOption('job-1')
  if (types.includes('workflows')) {
    await page
      .getByRole('combobox', { name: 'Choose job for tools', exact: true })
      .selectOption('job-1')
    await expect(
      page.getByText('No published forms are available to your account.', { exact: true }),
    ).toBeVisible()
  }
  if (types.includes('documents'))
    await expect(page.locator('.company-library-widget')).toHaveAttribute('aria-busy', 'false')
  for (const type of types) {
    const widget = page.locator(`[data-widget-id="${type}"]`)
    await expect(widget).toBeVisible()
    expect(
      await widget.evaluate((el) => el.scrollWidth - el.clientWidth),
      `${type} runtime overflow`,
    ).toBeLessThanOrEqual(2)
    const titleWidth = await widget
      .locator(':scope > header h2')
      .evaluate((el) => (el as HTMLElement).offsetWidth)
    expect(titleWidth, `${type} title width`).toBeGreaterThan(150)
    if (scenario.name === '320px root')
      await widget.screenshot({ path: test.info().outputPath(`${type}.png`) })
  }
  // Private content editors stay usable without changing the saved layout.
  for (const [type, label, cancel] of [
    ['tasks', 'Edit tasks', 'Cancel tasks'],
    ['dates', 'Edit calendar', 'Cancel calendar'],
    ['notes', 'Edit notes', 'Cancel notes'],
    ['announcement-drafts', 'Edit announcement drafts', 'Cancel announcement drafts'],
  ])
    if (types.includes(type as Widget['type'])) {
      const widget = page.locator(`[data-widget-id="${type}"]`)
      await widget.getByRole('button', { name: label, exact: true }).click()
      expect(
        await widget.evaluate((el) => el.scrollWidth - el.clientWidth),
        `${type} content editor overflow`,
      ).toBeLessThanOrEqual(2)
      await widget.getByRole('button', { name: cancel, exact: true }).click()
    }
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  if ((scenario.browserWidth || 1600) <= 900)
    await page
      .getByRole('navigation', { name: 'Builder panels' })
      .getByRole('button', { name: 'Canvas', exact: true })
      .click()
  for (const type of types) {
    const widget = page.locator(`[data-widget-id="${type}"]`)
    expect(
      await widget.evaluate((el) => el.scrollWidth - el.clientWidth),
      `${type} layout editor overflow`,
    ).toBeLessThanOrEqual(2)
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1)
  return api
}
for (const scenario of scenarios)
  for (const [batchIndex, types] of batches.entries()) {
    test(
      'catalog ' + (batchIndex + 1) + ' remains readable in ' + scenario.name,
      async ({ page }) => {
        const api = await auditCatalog(page, types, scenario)
        expect(
          api.requests.filter((request) => String(request.action).startsWith('save')),
        ).toHaveLength(0)
      },
    )
  }

test('long container tab labels stay inside their widget and remain keyboard reachable', async ({
  page,
}) => {
  const labels = [
    'CoordinationAndScheduling'.repeat(2),
    'Site safety review',
    'Deliveries',
    'Permits',
    'People',
    'Notes',
  ]
  await setup(page, [
    card('container', 240, {
      container: { kind: 'tabs', labels, direction: 'row', ratio: 50, collapsed: false },
    }),
  ])
  const tabs = page.getByRole('tablist')
  expect(await tabs.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
  await tabs.getByRole('tab').first().focus()
  await page.keyboard.press('End')
  await expect(tabs.getByRole('tab').last()).toBeFocused()
})

test('tiny authored cards retain readable content through keyboard-accessible local scrolling', async ({
  page,
}) => {
  await setup(page, [card('tasks', 120)])
  const widget = page.locator('[data-widget-id="tasks"]')
  expect(
    await widget.locator(':scope > header').evaluate((el) => (el as HTMLElement).offsetWidth),
  ).toBeGreaterThanOrEqual(160)
  await widget.focus()
  await expect(widget).toBeFocused()
  const before = await widget.evaluate((el) => el.scrollLeft)
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => widget.evaluate((el) => el.scrollLeft)).toBeGreaterThan(before)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1)
})

test('narrow Documents keeps preview, zoom, file actions and drawer focus available', async ({
  page,
}) => {
  await setup(page, [card('documents', 320)])
  await page.route('**/sds-file?*', (route) =>
    route.fulfill({ path: 'e2e/fixtures/site.png', contentType: 'image/png' }),
  )
  await page.route('**/sdsWorkspace', async (route) => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const { action } = route.request().postDataJSON().data
    const result =
      action === 'openSheet'
        ? {
            url: 'https://us-central1-phase2-website.cloudfunctions.net/downloadSdsFile?ticket=photo',
            extension: 'png',
          }
        : {
            version: 1,
            folders: [],
            binder: { version: 0, selections: [] },
            sheets: [
              {
                id: 'photo',
                name: 'Inspection coordination reference photo with a long name',
                folderId: '',
                revisionId: 'r1',
                revisionDate: '',
                manufacturer: '',
                productCode: '',
                language: 'English',
                order: 0,
                archived: false,
                extension: 'png',
              },
            ],
          }
    await route.fulfill({ headers, json: { result } })
  })
  await page.reload()
  await expect(page.locator('.company-library-widget')).toHaveAttribute('aria-busy', 'false')
  await expect(
    page.getByRole('region', { name: 'Dashboard content', exact: true }),
  ).toHaveAttribute('aria-busy', 'false')
  const files = page.getByRole('button', { name: 'Open files', exact: true })
  await files.click()
  await page
    .getByRole('button', {
      name: 'Inspection coordination reference photo with a long name',
      exact: true,
    })
    .click()
  await expect(
    page.getByRole('img', {
      name: 'Inspection coordination reference photo with a long name',
      exact: true,
    }),
  ).toBeVisible()
  const viewer = page.getByRole('region', { name: 'File viewer', exact: true })
  await expect(viewer.getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible()
  await viewer.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await viewer.getByRole('button', { name: 'Fit file width', exact: true }).click()
  await expect(viewer.locator('.viewer-loading-region')).toHaveAttribute('aria-busy', 'false')
  expect(
    await viewer.locator('.viewer-toolbar').evaluate((el) => el.scrollWidth - el.clientWidth),
  ).toBeLessThanOrEqual(1)
  await page
    .locator('[data-widget-id="documents"]')
    .screenshot({ path: test.info().outputPath('narrow-photo.png') })
  await files.click()
  await page.getByRole('button', { name: 'Root folder actions', exact: true }).click()
  await expect(page.getByRole('menu')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Root folder actions', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(files).toBeFocused()
})

for (const width of [240, 320])
  test(`published form rows remain usable in ${width}px Job tools`, async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 })
    const api = await mockDashboard(page)
    api.layouts.set('personal', {
      version: 1,
      widgets: [card('workflows', width)],
      viewport: { ...defaultDashboardViewport(), mode: 'fixed', width: 1100 },
    })
    const title = 'Inspection coordination and delivery schedule review'
    const server = await setupFormServer(page, {
      definition: {
        title,
        description: '',
        recipients: [],
        fields: [{ id: 'notes', label: 'Notes', kind: 'text', required: false, options: [] }],
      },
      initialPath: '/dashboards/personal',
    })
    await expect(
      page.getByRole('region', { name: 'Dashboard content', exact: true }),
    ).toHaveAttribute('aria-busy', 'false')
    await page
      .getByRole('combobox', { name: 'Choose job for tools', exact: true })
      .selectOption('job-1')
    const row = page
      .getByRole('list', { name: 'Available forms', exact: true })
      .getByRole('button', { name: title, exact: true })
    await expect(row).toBeVisible()
    expect(await row.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
    expect(
      await row.locator('strong').evaluate((el) => (el as HTMLElement).offsetWidth),
    ).toBeGreaterThan(65)
    await row.focus()
    await expect(row).toBeFocused()
    expect(server.created).toBe(0)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === '/forms/audit-e2e' &&
        url.searchParams.get('dashboardJob') === 'job-1' &&
        url.searchParams.get('dashboard') === 'personal',
    )
    await expect(page.getByLabel('Notes', { exact: true })).toBeEditable()
    expect(server.created).toBe(1)
    expect([...server.records.values()][0]!.jobId).toBe('job-1')
    expect(server.submitted).toBe(0)
    expect(server.emailRetries).toBe(0)
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

test('narrow resources keep loading, failure, retry and populated content contained', async ({
  page,
}) => {
  await setup(page, [card('resources')])
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  let failed = true
  await page.route('**/sdsWorkspace', async (route) => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    await pending
    await route.fulfill({
      headers,
      status: failed ? 503 : 200,
      json: failed
        ? {
            error: {
              status: 'UNAVAILABLE',
              message: 'Resources are temporarily unavailable. Try again.',
            },
          }
        : {
            result: {
              resources: [
                {
                  id: 'guide',
                  title: 'Inspection coordination and site safety reference',
                  description: 'Review the schedule and coordinate deliveries.',
                  url: '/company-library',
                },
              ],
            },
          },
    })
  })
  await page.reload()
  const widget = page.locator('[data-widget-id="resources"]')
  await expect(
    widget.getByRole('region', { name: 'Shared resources', exact: true }),
  ).toHaveAttribute('aria-busy', 'true')
  release()
  await expect(widget.getByRole('alert')).toBeVisible()
  expect(await widget.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
  failed = false
  await widget.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(
    widget.getByRole('link', {
      name: 'Inspection coordination and site safety reference',
      exact: true,
    }),
  ).toBeVisible()
  expect(await widget.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
})

async function expectTitleUncovered(page: Page, id: string) {
  const title = page.locator(`[data-widget-id="${id}"] > header h2`)
  await expect
    .poll(() =>
      title.evaluate((element) => {
        const viewport = element.closest('[data-widget-scroll]')!.getBoundingClientRect()
        const range = document.createRange()
        range.selectNodeContents(element)
        const points = [...range.getClientRects()]
          .flatMap((rect) =>
            [0.1, 0.5, 0.9].map((fraction) => ({
              x: rect.left + rect.width * fraction,
              y: rect.top + rect.height / 2,
            })),
          )
          .filter(
            (point) =>
              point.x > viewport.left &&
              point.x < viewport.right &&
              point.y > viewport.top &&
              point.y < viewport.bottom,
          )
        return (
          points.length > 0 &&
          points.every((point) => element.contains(document.elementFromPoint(point.x, point.y)))
        )
      }),
    )
    .toBe(true)
}
async function auditUncoveredSelection(page: Page, browserWidth: number, nested: boolean) {
  const entries = [
    card('text', 240, {
      title: 'Common choice control smoke',
      placement: { x: 0, y: 0, w: nested ? 22 : 6, h: 6 },
      devices: { phone: { x: 0, y: 0, w: 22, h: 6 } },
      ...(nested ? { parentId: 'panel', region: '0' } : {}),
    }),
  ]
  if (nested)
    entries.unshift(
      card('container', 400, {
        id: 'panel',
        title: 'Coordination',
        placement: { x: 0, y: 0, w: 14, h: 20 },
        devices: { phone: { x: 0, y: 0, w: 24, h: 20 } },
        container: {
          kind: 'panel',
          labels: ['Content'],
          direction: 'row',
          ratio: 50,
          collapsed: false,
        },
      }),
    )
  if (nested)
    entries.push(
      card('text', 240, {
        id: 'second',
        title: 'Second widget',
        parentId: 'panel',
        region: '0',
        placement: { x: 0, y: 7, w: 22, h: 4 },
      }),
    )
  const api = await setup(page, entries, { browserWidth })
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  if (browserWidth === 390) await page.getByRole('button', { name: 'Phone', exact: true }).click()
  else {
    await page.getByRole('button', { name: 'Actual size', exact: true }).click()
    for (let index = 0; index < 5; index++)
      await page.getByRole('button', { name: 'Zoom out', exact: true }).click()
  }
  const first = page.locator('[data-widget-id="text"]')
  await first.focus()
  await page.keyboard.press('Enter')
  await expectTitleUncovered(page, 'text')
  if (nested) {
    await page.locator('[data-widget-id="second"]').focus()
    await page.keyboard.press('Control+Enter')
    await page
      .getByLabel('Dashboard canvas', { exact: true })
      .evaluate((element) => (element.scrollTop = 0))
    await page
      .locator('[data-widget-surface="panel"]')
      .evaluate((element) => (element.scrollTop = 0))
  }
  const dock = page.getByRole('group', { name: 'Selection actions', exact: true })
  const move = dock.getByRole('button', { name: /^Move selected widgets?$/ })
  await expect(move).toBeEnabled()
  await expectTitleUncovered(page, 'text')
  const viewBox = (await page.getByLabel('Dashboard canvas', { exact: true }).boundingBox())!
  const moveBox = (await move.boundingBox())!
  expect(moveBox.y + moveBox.height).toBeLessThanOrEqual(viewBox.y)
  expect(
    await move.evaluate((element) => {
      const box = element.getBoundingClientRect()
      return element.contains(
        document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
      )
    }),
  ).toBe(true)
  await expect(page.locator('.dashboard-selection-frame__resize')).toHaveCount(8)
  for (const peg of await page.locator('.dashboard-selection-frame__resize').all())
    expect((await peg.boundingBox())!.width).toBeCloseTo(24, 0)
  await page.screenshot({ path: test.info().outputPath('uncovered-selection.png') })
  const before = (await first.boundingBox())!
  await move.focus()
  await page.keyboard.press('Shift+ArrowRight')
  expect((await first.boundingBox())!.x - before.x).toBeCloseTo(1, 0)
  await page.getByRole('button', { name: 'Undo template edit', exact: true }).click()
  await expectTitleUncovered(page, 'text')
  await page
    .getByLabel('Dashboard canvas', { exact: true })
    .evaluate((element) => (element.scrollTop = 100))
  expect((await move.boundingBox())!.y).toBeCloseTo(moveBox.y, 0)
  await expect(move).toBeEnabled()
  return api
}
for (const browserWidth of [1600, 390])
  for (const nested of [false, true])
    test(`selection controls leave actual title text uncovered at ${browserWidth}px ${nested ? 'nested group' : 'root'}`, async ({
      page,
    }) => {
      const api = await auditUncoveredSelection(page, browserWidth, nested)
      expect(
        api.requests.filter((request) => String(request.action).startsWith('save')),
      ).toHaveLength(0)
    })

test('toolbar moves preserve small selections and reject outside drops while Pan keeps precedence', async ({
  page,
}) => {
  const api = await setup(page, [
    card('text', 120, { title: 'Short title', placement: { x: 1, y: 1, w: 3, h: 4 } }),
  ])
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const widget = page.locator('[data-widget-id="text"]')
  await widget.focus()
  await page.keyboard.press('Enter')
  const move = page
    .getByRole('group', { name: 'Selection actions', exact: true })
    .getByRole('button', { name: 'Move selected widget', exact: true })
  const undo = page.getByRole('button', { name: 'Undo template edit', exact: true })
  const start = async () => {
    const box = (await move.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }
  const before = (await widget.boundingBox())!
  let origin = await start()
  await page.mouse.move(origin.x + 60, origin.y, { steps: 6 })
  await expect(page.locator('.shared-drag-ghost')).toBeVisible()
  await page.mouse.up()
  expect((await widget.boundingBox())!.x).toBeGreaterThan(before.x + 20)
  await undo.click()
  await expect(undo).toBeDisabled()
  origin = await start()
  const stage = (await page
    .getByRole('main', { name: 'Dashboard page', exact: true })
    .boundingBox())!
  await page.mouse.move(stage.x - 8, origin.y + 25, { steps: 6 })
  await page.mouse.up()
  await expect(undo).toBeDisabled()
  expect((await widget.boundingBox())!.x).toBeCloseTo(before.x, 0)
  origin = await start()
  await page.mouse.move(origin.x + 60, origin.y, { steps: 6 })
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await page.mouse.up()
  await expect(undo).toBeDisabled()
  const style = await widget.getAttribute('style')
  await page.getByRole('button', { name: 'Pan', exact: true }).click()
  origin = await start()
  await page.mouse.move(origin.x + 50, origin.y + 25, { steps: 6 })
  await page.mouse.up()
  await expect(widget).toHaveAttribute('style', style!)
  expect(Math.abs((await widget.boundingBox())!.x - before.x)).toBeGreaterThan(20)
  await expect(undo).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Save template', exact: true })).toBeDisabled()
  expect(api.requests.filter((request) => String(request.action).startsWith('save'))).toHaveLength(
    0,
  )
})
