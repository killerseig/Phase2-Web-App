import { expect, test, type Page } from './helpers/test'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture'
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
async function setup(page: Page) {
  let entries = 0
  await page.addInitScript(() => { window.__PHASE2_FORM_SERVER__ = true })
  await page.route('**/sdsWorkspace', route => route.fulfill({ headers, json: { result: { sheets: [], after: '', scanned: 0 } } }))
  await page.route('**/formTemplates', route => route.fulfill({ headers, json: { result: { templates: Array.from({ length: 48 }, (_, index) => ({ id: 'form-' + index, latestVersion: 1, archived: false, definition: { title: 'Synthetic form ' + String(index).padStart(2, '0'), access: { respondentRoles: ['admin'] } } })) } } }))
  await page.route('**/formWorkspace', async route => { entries++; await route.fulfill({ headers, status: 403, json: { error: { status: 'PERMISSION_DENIED', message: 'Synthetic entry disabled' } } }) })
  return { created: () => entries }
}
async function metrics(page: Page, paneSelector: string, searchSelector: string, rowSelector: string) {
  return page.evaluate(({ paneSelector, searchSelector, rowSelector }) => {
    const pane = document.querySelector(paneSelector)!, search = document.querySelector(searchSelector)!, row = document.querySelector(rowSelector)!
    const paneStyle = getComputedStyle(pane), searchStyle = getComputedStyle(search), rowStyle = getComputedStyle(row)
    const paneBox = pane.getBoundingClientRect(), searchBox = search.getBoundingClientRect(), head = pane.querySelector('.app-pane-header')!.getBoundingClientRect()
    return { paneX: paneBox.x, paneWidth: paneBox.width, panePadding: paneStyle.padding, radius: paneStyle.borderRadius, searchHeight: searchBox.height, searchOffset: searchBox.y - head.bottom, searchFont: searchStyle.fontSize, rowPadding: rowStyle.padding, titleFont: getComputedStyle(row.querySelector('strong')!).fontSize }
  }, { paneSelector, searchSelector, rowSelector })
}
for (const width of [390, 1440]) {
  test('matches Jobs directory styling at ' + width + 'px while preserving Forms behavior', async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const fixture = createJobsFixture(), calls = await setup(page)
    await gotoPhase2App(page, '/jobs', fixture)
    await expect(page.locator('.jobs-browser__row').first()).toBeVisible()
    const jobs = await metrics(page, '.jobs-browser', '[data-testid="jobs-search"]', '.jobs-browser__row')
    await page.getByRole('searchbox', { name: 'Search jobs' }).focus()
    await page.keyboard.press('Tab')
    await expect(page.locator('.jobs-browser__row').first()).toBeFocused()
    const jobFocus = await page.locator('.jobs-browser__row').first().evaluate(element => getComputedStyle(element).outlineWidth)
    await page.screenshot({ path: 'evidence/jobs-directory-reference-' + width + '.png' })
    await page.goto('/reports')
    await expect(page.getByRole('region', { name: 'Forms workspace', exact: true })).toHaveAttribute('aria-busy', 'false')
    await expect(page.getByRole('heading', { name: 'Forms', exact: true })).toBeVisible()
    const rows = page.getByRole('list', { name: 'Available inspection forms' }).getByRole('link')
    await expect(rows).toHaveCount(48)
    const forms = await metrics(page, '.company-reports__directory', '.company-reports__body .app-search-input', '.company-reports__row')
    expect(forms.panePadding).toBe(jobs.panePadding)
    expect(forms.radius).toBe(jobs.radius)
    expect(forms.searchFont).toBe(jobs.searchFont)
    expect(forms.rowPadding).toBe(jobs.rowPadding)
    expect(forms.titleFont).toBe(jobs.titleFont)
    expect(Math.abs(forms.paneX - jobs.paneX)).toBeLessThanOrEqual(1)
    expect(Math.abs(forms.paneWidth - jobs.paneWidth)).toBeLessThanOrEqual(1)
    expect(Math.abs(forms.searchHeight - jobs.searchHeight)).toBeLessThanOrEqual(1)
    expect(Math.abs(forms.searchOffset - jobs.searchOffset)).toBeLessThanOrEqual(1)
    const search = page.getByRole('searchbox', { name: 'Search forms' })
    await search.focus(); await page.keyboard.press('Tab')
    await expect(rows.first()).toBeFocused()
    expect(await rows.first().evaluate(element => getComputedStyle(element).outlineWidth)).toBe(jobFocus)
    await expect(rows.first()).toHaveAttribute('href', '/forms/form-0')
    await expect(page.getByText('48 published', { exact: true })).toBeVisible()
    const scrolling = await page.locator('.company-reports__list').evaluate(element => ({ client: element.clientHeight, scroll: element.scrollHeight, bottom: element.getBoundingClientRect().bottom }))
    expect(scrolling.scroll).toBeGreaterThan(scrolling.client)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: 'evidence/forms-directory-' + width + '.png' })
    await search.fill('form 03')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toHaveText('Synthetic form 03')
    await expect(page.getByText('48 published', { exact: true })).toBeVisible()
    await expect(page.getByText('1 visible', { exact: true })).toBeVisible()
    await search.fill('no matching form')
    await expect(page.getByText('No published forms match your search and access.', { exact: false })).toBeVisible()
    expect(calls.created()).toBe(0)
  })
}
