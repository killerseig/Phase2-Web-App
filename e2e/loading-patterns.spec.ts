import { expect, test, type Page } from './helpers/test'
import { observeLoadingFade, expectSingleLoadingFade } from './helpers/loadingObservation'
import { createJobsFixture, gotoPhase2App, openLibraryFiles } from './helpers/phase2AppFixture'
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
function gate() {
  let release!: () => void
  const ready = new Promise<void>(resolve => { release = resolve })
  return { ready, release }
}
async function forms(page: Page, failed = false) {
  await page.addInitScript(() => { window.__PHASE2_FORM_SERVER__ = true })
  const entries = gate(), references = gate()
  await page.route('**/sdsWorkspace', async route => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return }
    await references.ready
    await route.fulfill({ headers, json: { result: { sheets: [], after: '', scanned: 0 } } })
  })
  await page.route('**/formTemplates', async route => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return }
    await entries.ready
    if (failed) { failed = false; await route.fulfill({ status: 500, headers, json: { error: { status: 'INTERNAL', message: 'Synthetic forms unavailable' } } }); return }
    await route.fulfill({ headers, json: { result: { templates: [{ id: 'synthetic-form', latestVersion: 1, archived: false, definition: { title: 'Synthetic safety form', access: { respondentRoles: ['admin'] } } }] } } })
  })
  await gotoPhase2App(page, '/reports', createJobsFixture())
  return { entries, references }
}
for (const width of [390, 1440]) {
  test.describe(width + 'px', () => {
    test.use({ viewport: { width, height: 900 } })
    for (const first of ['entries', 'references'] as const) {
      test('centers Forms body loading when ' + first + ' finishes first', async ({ page }) => {
        const pending = await forms(page)
        const region = page.getByRole('region', { name: 'Forms workspace', exact: true })
        const overlay = region.locator(':scope > .app-loading-overlay')
        await expect(overlay).toBeVisible()
        const center = await overlay.evaluate(element => {
          const box = element.getBoundingClientRect(), spinner = element.querySelector('.app-loading-indicator')!.getBoundingClientRect()
          return { x: Math.abs(box.x + box.width / 2 - spinner.x - spinner.width / 2), y: Math.abs(box.y + box.height / 2 - spinner.y - spinner.height / 2), height: box.height }
        })
        expect(center.x).toBeLessThanOrEqual(1); expect(center.y).toBeLessThanOrEqual(1)
        expect(center.height).toBeGreaterThan(300)
        await expect(page.getByRole('heading', { name: 'Forms', exact: true })).toBeVisible()
        await expect(region.getByRole('status')).toHaveCount(1)
        await page.screenshot({ path: 'evidence/forms-loading-' + width + '.png' })
        pending[first].release()
        await expect(region).toHaveAttribute('aria-busy', 'true')
        await observeLoadingFade(page, '.company-reports__workspace')
        pending.entries.release(); pending.references.release()
        await expect(region).toHaveAttribute('aria-busy', 'false')
        await expect(overlay).toHaveCount(0)
        await expectSingleLoadingFade(page)
        await expect(page.getByRole('link', { name: 'Synthetic safety form', exact: true })).toBeVisible()
      })
    }

    test('load more uses a sidebar indicator while the viewer and search remain usable', async ({ page }) => {
      const more = gate()
      let requests = 0
      const sheet = (id: string) => ({ id, name: 'Synthetic document ' + id, extension: 'pdf', originalName: id + '.pdf', revisionId: 'r1', folderId: '', archived: false, order: 0, manufacturer: '', productCode: '', language: 'English' })
      await page.route('**/sdsWorkspace', async route => {
        if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return }
        const data = route.request().postDataJSON().data
        if (data.after) { requests++; await more.ready }
        const result = data.action === 'load' ? { version: 1, folders: [], sheets: [], binder: { version: 0, selections: [] } }
          : data.search === 'Phase2 intranet content' ? { sheets: [], after: '', scanned: 0 }
          : { sheets: [sheet(data.after ? 'second' : 'first')], after: data.after ? 'page-3' : 'page-2', scanned: 1 }
        await route.fulfill({ headers, json: { result } })
      })
      await gotoPhase2App(page, '/company-library', createJobsFixture())
      const region = page.getByRole('region', { name: 'Company Library widget', exact: true })
      await expect(region).toHaveAttribute('aria-busy', 'false')
      await expect(region.locator(':scope > .app-loading-overlay')).toHaveCount(0)
      await openLibraryFiles(page)
      await page.getByRole('button', { name: 'Root folder actions', exact: true }).click()
      await page.getByRole('menuitem', { name: 'Load more files', exact: true }).click()
      const local = page.locator('.document-explorer__folder-content')
      await expect(local).toHaveAttribute('aria-busy', 'true')
      await expect(local.getByRole('status')).toContainText('Loading more files')
      await expect(region.locator('.app-loading-indicator__wheel:visible')).toHaveCount(1)
      await expect(page.getByRole('region', { name: 'File viewer', exact: true })).toBeVisible()
      await expect(page.getByRole('searchbox', { name: 'Search files' })).toBeEnabled()
      await expect(region.locator(':scope > .app-loading-overlay')).toHaveCount(0)
      await page.screenshot({ path: 'evidence/element-loading-' + width + '.png' })
      more.release()
      await expect(local).toHaveAttribute('aria-busy', 'false')
      await expect(local.locator('.app-loading-overlay')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Synthetic document second', exact: true })).toBeVisible()
      expect(requests).toBe(1)
    })
  })
}

test('Forms failure releases the body and retry loads the directory', async ({ page }) => {
  const pending = await forms(page, true)
  pending.entries.release(); pending.references.release()
  const region = page.getByRole('region', { name: 'Forms workspace', exact: true })
  await expect(region).toHaveAttribute('aria-busy', 'false')
  await expect(region.locator(':scope > .app-loading-overlay')).toHaveCount(0)
  await expect(page.getByRole('alert')).toContainText('Synthetic forms unavailable')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Synthetic safety form', exact: true })).toBeVisible()
  await expect(region.locator(':scope > .app-loading-overlay')).toHaveCount(0)
})
