import { expect, test, type Page } from './helpers/test.js'
import type { Locator } from '@playwright/test'
import { createDailyLogsFixture, createJobDashboardFixture, createJobsFixture, createShopOrdersFixture, createTimecardsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

const devices = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 1000 },
] as const
const longJobName = 'North Campus Classroom Renovation and Administration Building Addition'

test.beforeEach(async ({ page }) => {
  // Later fixture handlers may fulfill specific synthetic calls. Unhandled
  // requests must never fall through to the saved preview or its services.
  await page.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:5196' ? route.continue() : route.abort())
})

async function pageFits(page: Page) {
  expect(await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }))).toMatchObject({ width: page.viewportSize()!.width })
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
}
async function controlsFit(controls: Locator) {
  const sizes = await controls.evaluateAll(elements => elements.flatMap(element => {
    const box = element.getBoundingClientRect()
    if (!box.width || !box.height || getComputedStyle(element).visibility === 'hidden') return []
    return [{ label: element.getAttribute('aria-label') || element.getAttribute('data-testid') || element.textContent?.trim().slice(0, 45), left: box.left, right: box.right, width: innerWidth, over: element.matches('input,textarea') ? 0 : element.scrollWidth - element.clientWidth }]
  }))
  expect(sizes.length).toBeGreaterThan(0)
  expect(sizes.filter(box => box.left < -1 || box.right > box.width + 1 || box.over > 1)).toEqual([])
}
async function buttonWordsStayTogether(buttons: Locator) {
  const brokenWords = await buttons.evaluateAll(elements => elements.flatMap(element => {
    const failures: string[] = []
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (const word of (node.textContent ?? '').matchAll(/\b[A-Za-z]{3,12}\b/g)) {
        const range = document.createRange()
        range.setStart(node, word.index); range.setEnd(node, word.index + word[0].length)
        const lines = new Set([...range.getClientRects()].filter(rect => rect.width && rect.height).map(rect => Math.round(rect.top)))
        if (lines.size > 1) failures.push(word[0])
      }
    }
    return failures
  }))
  expect(brokenWords).toEqual([])
}
async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: test.info().outputPath(name + '.png'), fullPage: false })
}
async function chooseWeek(page: Page) {
  const date = page.getByTestId('timecards-week-ending')
  await date.fill('2026-06-06'); await date.dispatchEvent('change')
  await expect(page.locator('.timecards-canvas__item')).toHaveCount(1)
}
async function selectExportTab(page: Page, name: string) {
  const tab = page.getByRole('tab', { name, exact: true })
  if (await tab.isVisible()) { await tab.focus(); await page.keyboard.press('Enter') }
}
async function openShopOrder(page: Page) {
  const openOrder = page.getByTestId('shoporder-view-order')
  if (await openOrder.isVisible()) {
    await openOrder.click()
    await expect(page.getByRole('dialog', { name: 'Your Order', exact: true })).toHaveCSS('transform', 'none')
  }
}
async function waitForShopCatalog(page: Page) {
  if (await page.getByTestId('shoporder-view-order').isVisible()) {
    // The compact breakpoint closes the initially mounted workspace through
    // a transition; capture the resting catalog rather than the moving drawer.
    await expect(page.locator('#shop-order-drawer')).toBeHidden()
  }
}
async function checkPrintScroll(page: Page, narrow: boolean) {
  const preview = page.getByTestId('timecard-export-print-document')
  if (!narrow) return
  await expect(preview).toHaveAttribute('tabindex', '0')
  expect(await preview.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true)
  await preview.focus(); await page.keyboard.press('ArrowRight')
  await expect.poll(() => preview.evaluate(el => el.scrollLeft)).toBeGreaterThan(0)
  await preview.evaluate(el => { el.scrollLeft = 0 })
  expect((await page.locator('.timecard-print-view__page').boundingBox())!.x).toBeGreaterThanOrEqual(0)
}
function galleryFixture() {
  const fixture = createDailyLogsFixture()
  fixture.publicDailyLogGalleries = { 'responsive-review': {
    jobName: longJobName, jobCode: 'TEST', logDate: '2026-06-04', sequenceNumber: 1,
    foremanName: 'Synthetic foreman', submittedAt: '2026-06-04T12:00:00Z',
    attachments: [{ name: 'site.png', type: 'photo', url: '/e2e/fixtures/site.png', description: 'North entrance installation progress and access route.' }],
  } }
  return fixture
}

for (const device of devices) test.describe('legacy ' + device.name, () => {
  test.use({ viewport: { width: device.width, height: device.height }, hasTouch: device.name !== 'desktop' })

  test('Jobs keeps browsing and editing controls contained with searchable empty results', async ({ page }) => {
    const fixture = createJobsFixture(); fixture.jobs[0]!.name = longJobName
    await gotoPhase2App(page, '/jobs', fixture)
    await expect(page.getByTestId('job-card-1A')).toBeVisible()
    await pageFits(page)
    await controlsFit(page.locator('.jobs-workspace main button:visible, .jobs-workspace main input:visible'))
    await screenshot(page, 'jobs-browse')
    await page.getByTestId('jobs-search').fill('no-matching-job')
    await expect(page.getByTestId('jobs-empty')).toBeVisible()
    await page.getByTestId('jobs-search').fill('')
    await page.getByTestId('jobs-edit-mode').click()
    await page.getByTestId('job-card-1A').click()
    await expect(page.getByLabel('Job Name', { exact: true })).toHaveValue(longJobName)
    await controlsFit(page.locator('.jobs-detail input:visible, .jobs-detail select:visible, .jobs-detail button:visible'))
    await page.getByLabel('Job Number', { exact: true }).fill('')
    await page.getByTestId('job-card-2B').click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await controlsFit(dialog.locator('button'))
    await screenshot(page, 'jobs-dirty-confirmation')
    await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click()
    await expect(page.getByLabel('Job Number', { exact: true })).toHaveValue('')
    await pageFits(page)
  })

  test('dashboard job administration reuses readable compact job setup controls', async ({ page }) => {
    await gotoPhase2App(page, '/dashboards/jobs/manage?jobAction=create&fromDashboard=personal', createJobsFixture())
    await expect(page.getByTestId('jobs-create-name')).toBeVisible()
    await page.getByTestId('jobs-create-name').fill('Unsubmitted job setup')
    await controlsFit(page.locator('.jobs-detail input:visible, .jobs-detail select:visible, .jobs-detail button:visible'))
    await pageFits(page); await screenshot(page, 'job-administration')
    await page.getByTestId('job-card-1A').click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click()
    await expect(page.getByTestId('jobs-create-name')).toHaveValue('Unsubmitted job setup')
  })

  test('legacy role dashboard keeps foreman job shortcuts readable and keyboard accessible', async ({ page }) => {
    const fixture = createJobDashboardFixture(); fixture.jobs[0]!.name = longJobName
    await gotoPhase2App(page, '/dashboard', fixture)
    const dashboard = page.getByTestId('role-dashboard-page')
    await expect(dashboard).toBeVisible()
    await controlsFit(dashboard.locator('a:visible'))
    await pageFits(page); await screenshot(page, 'role-dashboard')
    const job = dashboard.locator('a[href="/jobs/job-e2e"]').first()
    await job.focus(); await expect(job).toBeFocused(); await page.keyboard.press('Enter')
    await expect(page.getByTestId('job-dashboard-page')).toBeVisible()
  })

  test('Job Dashboard keeps module links visible with a long project title', async ({ page }) => {
    const fixture = createJobDashboardFixture(); fixture.jobs[0]!.name = longJobName
    await gotoPhase2App(page, '/jobs/job-e2e', fixture)
    const dashboard = page.getByTestId('job-dashboard-page')
    await expect(dashboard).toBeVisible()
    await controlsFit(dashboard.locator('a:visible'))
    const retry = dashboard.getByRole('button', { name: 'Retry forms', exact: true })
    await expect(retry).toHaveClass(/app-button/)
    expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(32)
    await controlsFit(retry)
    await pageFits(page); await screenshot(page, 'job-dashboard')
    const logs = page.getByTestId('job-dashboard-module-daily-logs')
    await logs.focus(); await page.keyboard.press('Enter')
    await expect(page.getByTestId('daily-logs-page')).toBeVisible()
  })

  test('Daily Logs keeps editable rows and recovery dialog within the viewport', async ({ page }) => {
    const fixture = createDailyLogsFixture(); fixture.jobs[0]!.name = longJobName
    fixture.delays = { dailyLogUpdateMs: 400 }
    await gotoPhase2App(page, '/jobs/job-e2e/daily-logs', fixture)
    const trade = page.getByRole('textbox', { name: 'Trade', exact: true }).first()
    await expect(trade).toBeVisible()
    await controlsFit(page.locator('.daily-logs-header button:visible, .daily-log-manpower-card input:visible, .daily-log-climate-card input:visible'))
    await pageFits(page); await screenshot(page, 'daily-logs')
    await trade.fill('Saved crew update')
    await page.getByRole('button', { name: 'Save Draft', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Saving...', exact: true })).toBeDisabled()
    await expect.poll(() => page.evaluate(() => window.__PHASE2_E2E_STATE__?.dailyLogs?.[0]?.payload.manpowerLines[0]?.trade)).toBe('Saved crew update')
    await trade.fill('Retain this manpower change')
    await page.evaluate(() => Object.defineProperty(window.__PHASE2_E2E_STATE__!.dailyLogs!, '0', { writable: false, configurable: true }))
    await page.getByTestId('dailylog-date-search').fill('2026-06-03')
    const dialog = page.getByRole('dialog', { name: 'Keep unsaved daily log changes?' })
    await expect(dialog).toBeVisible(); await controlsFit(dialog.locator('button'))
    await screenshot(page, 'daily-log-save-error')
    await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click()
    await expect(trade).toHaveValue('Retain this manpower change')
    await expect(page.getByTestId('dailylog-date-search')).toHaveValue('2026-06-04')
  })

  test('timecard workbook and its tools fit while retaining native workbook proportions', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e/timecards', createTimecardsFixture({ seededCard: true }))
    await expect(page.getByTestId('timecards-week-ending')).toHaveValue('2026-06-06')
    await chooseWeek(page)
    await controlsFit(page.locator('.timecards-toolbar button:visible, .timecards-toolbar input:visible'))
    await buttonWordsStayTogether(page.locator('.timecards-toolbar button:visible'))
    await controlsFit(page.locator('.timecards-canvas__item-header button:visible'))
    const status = page.locator('.job-timecard-status-bar__strip')
    await expect(status.locator('.timecard-toolbar-signal')).toHaveCount(4)
    // Date range, submission status, card count and save state must all be
    // readable without a hidden scroll gesture or clipped centered content.
    expect(await status.evaluate(strip => {
      const parent = strip.getBoundingClientRect()
      return [...strip.children].every(signal => {
        const bounds = signal.getBoundingClientRect()
        return bounds.left >= parent.left - 1 && bounds.right <= parent.right + 1
          && signal.scrollWidth <= signal.clientWidth + 1
      })
    })).toBe(true)
    await pageFits(page); await screenshot(page, 'timecard-workbook')
    await page.getByRole('button', { name: 'Collapse Card', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Expand Card', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Expand Card', exact: true }).click()
    await expect(page.getByTestId('timecard-job-number-0')).toBeVisible()
    await selectExportTab(page, 'Actions')
    await controlsFit(page.locator('#timecards-toolbar-panel-actions button:visible'))
    await buttonWordsStayTogether(page.locator('#timecards-toolbar-panel-actions button:visible'))
  })

  test('payroll export filters and actions stay reachable alongside the workbook', async ({ page }) => {
    const fixture = createTimecardsFixture({ seededCard: true })
    fixture.auth.profile.role = 'payroll'; fixture.timecardWeeks[0]!.status = 'submitted'
    await gotoPhase2App(page, '/exports/timecards', fixture)
    await expect(page.getByTestId('timecard-export-page')).toBeVisible()
    await selectExportTab(page, 'Weeks')
    const week = page.locator('#timecard-export-panel-weeks input[type="date"]')
    await week.fill('2026-06-06'); await week.dispatchEvent('change')
    await expect(page.locator('.timecards-canvas__item')).toHaveCount(1)
    await controlsFit(page.locator('.timecards-toolbar button:visible, .timecards-toolbar input:visible'))
    await pageFits(page); await screenshot(page, 'timecard-export')
    await selectExportTab(page, 'Actions')
    const action = page.getByRole('button', { name: 'Export PDF', exact: true })
    await expect(action).toBeVisible(); await action.focus(); await expect(action).toBeFocused()
    await controlsFit(page.locator('#timecard-export-panel-actions button:visible'))
    await buttonWordsStayTogether(page.locator('#timecard-export-panel-actions button:visible'))
    await screenshot(page, 'timecard-export-actions')
  })

  test('print preview contains a full landscape page in an intentional keyboard scroll area', async ({ page }) => {
    const fixture = createTimecardsFixture({ seededCard: true }); fixture.auth.profile.role = 'payroll'
    const card = { ...fixture.timecardCards[0]!, exportWeekId: 'week-e2e', exportWeekStartDate: '2026-05-31', exportWeekEndDate: '2026-06-06', exportWeekStatus: 'submitted', exportJobId: 'job-e2e', exportJobCode: '9411', exportJobName: longJobName, exportForemanName: 'Synthetic foreman', exportBurden: 0.33 }
    await page.addInitScript(card => {
      window.print = () => {}
      sessionStorage.setItem('phase2-timecard-pdf-exports', JSON.stringify({ 'responsive-print': { exportId: 'responsive-print', title: 'Timecard export', subtitle: 'North Campus Classroom Renovation and Administration Building Addition', generatedAt: Date.now(), cards: [card] } }))
    }, card)
    await gotoPhase2App(page, '/exports/timecards/print?exportId=responsive-print', fixture)
    const preview = page.getByTestId('timecard-export-print-document')
    await expect(preview).toBeVisible()
    await controlsFit(page.locator('.timecard-print-view__screen-toolbar button'))
    await pageFits(page); await screenshot(page, 'timecard-print')
    const sheet = page.locator('.timecard-print-view__page')
    expect((await sheet.boundingBox())!.width).toBeCloseTo(1056, 0)
    await checkPrintScroll(page, device.width < 1100)
  })

  test('Shop Orders retains compact catalog controls and editable order details', async ({ page }) => {
    const fixture = createShopOrdersFixture()
    fixture.shopCatalogItems[0]!.description = 'Extra long construction supply description for the north entrance work area'
    await gotoPhase2App(page, '/jobs/job-e2e/shop-orders', fixture)
    await expect(page.getByTestId('shoporder-new-order')).toBeVisible()
    await waitForShopCatalog(page)
    await controlsFit(page.locator('.shop-orders-tree-pane__header button:visible, .shop-orders-tree-pane input:visible'))
    await pageFits(page); await screenshot(page, 'shop-orders-catalog')
    await openShopOrder(page)
    await expect(page.getByTestId('shoporder-comments')).toBeVisible()
    await controlsFit(page.locator('.shop-order-meta-form input:visible, .shop-order-meta-form textarea:visible'))
    await page.getByTestId('shoporder-comments').fill('Keep these delivery instructions')
    await page.getByTestId('shoporder-comments').blur()
    await expect.poll(() => page.evaluate(() => window.__PHASE2_E2E_STATE__?.shopOrders?.find(order => order.id === 'order-draft')?.comments)).toBe('Keep these delivery instructions')
    await screenshot(page, 'shop-order-details')
    await pageFits(page)
  })

  test('public Daily Log gallery and full-size photo remain contained and keyboard operable', async ({ page }) => {
    await gotoPhase2App(page, '/daily-log-gallery/responsive-review', galleryFixture())
    await expect(page.getByRole('heading', { name: longJobName + ' (#TEST)' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Photo gallery content', exact: true })).toHaveAttribute('aria-busy', 'false')
    await pageFits(page); await screenshot(page, 'daily-log-gallery')
    const opener = page.getByRole('button', { name: 'View site.png', exact: true })
    await opener.focus(); await expect(opener).toBeFocused(); await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('region', { name: 'Full-size photo', exact: true })).toHaveAttribute('aria-busy', 'false')
    await controlsFit(dialog.locator('button:visible'))
    const image = await dialog.getByRole('img', { name: 'site.png', exact: true }).boundingBox()
    expect(image!.x).toBeGreaterThanOrEqual(0); expect(image!.y).toBeGreaterThanOrEqual(0)
    expect(image!.x + image!.width).toBeLessThanOrEqual(device.width + 1)
    expect(image!.y + image!.height).toBeLessThanOrEqual(device.height + 1)
    await screenshot(page, 'daily-log-photo')
    await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); await expect(opener).toBeFocused()
  })

  test('legacy error and empty states remain readable at the device size', async ({ page }) => {
    await gotoPhase2App(page, '/daily-log-gallery/legacy/job-e2e/daily-log-1', createDailyLogsFixture())
    await expect(page.getByRole('alert')).toContainText('older photo link is no longer available')
    await pageFits(page); await screenshot(page, 'gallery-legacy-link-error')
    await page.goto('/daily-log-gallery/missing-gallery')
    await expect(page.getByRole('alert')).toBeVisible(); await pageFits(page)
    await page.goto('/jobs/missing-job')
    // A foreman cannot open a job outside their assignments; the route returns
    // them to their job directory instead of exposing the missing job.
    await expect(page).toHaveURL(/\/jobs$/)
    await expect(page.getByTestId('job-card-1A')).toBeVisible(); await pageFits(page)
  })
})
