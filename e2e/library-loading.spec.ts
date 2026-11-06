import { expect, test, type Page } from './helpers/test'
import { observeLoadingFade, expectSingleLoadingFade } from './helpers/loadingObservation'
import { createJobsFixture, gotoPhase2App, openLibraryFiles } from './helpers/phase2AppFixture'

function gate() {
  let release!: () => void
  const ready = new Promise<void>(resolve => { release = resolve })
  return { ready, release }
}
async function setup(page: Page, failure: '' | 'references' | 'documents' = '') {
  const references = gate(), documents = gate(), search = gate()
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
  let fail = failure
  await page.route('**/sdsWorkspace', async route => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return }
    const data = route.request().postDataJSON().data
    const isReference = data.action === 'page' && data.search === 'Phase2 intranet content'
    if (isReference) await references.ready
    else await documents.ready
    if (data.search === 'new') await search.ready
    const failed = (isReference && fail === 'references') || (data.action === 'load' && fail === 'documents')
    if (failed) {
      fail = ''
      await route.fulfill({ status: 403, headers, json: { error: { status: 'PERMISSION_DENIED', message: 'Synthetic access unavailable' } } })
      return
    }
    const result = data.action === 'load'
      ? { version: 1, folders: [], sheets: [], binder: { version: 0, selections: [] } }
      : { sheets: [], after: '', scanned: 0 }
    await route.fulfill({ headers, json: { result } })
  })
  await gotoPhase2App(page, '/company-library', createJobsFixture())
  return { references, documents, search }
}
const root = (page: Page) => page.locator('.company-library-widget')
const overlay = (page: Page) => page.locator('.company-library-widget > .app-loading-overlay')

for (const width of [390, 1440]) {
  test.describe(width + 'px', () => {
    test.use({ viewport: { width, height: 900 } })
    for (const first of ['references', 'documents'] as const) {
      test('waits for both loads when ' + first + ' finishes first, then fades out', async ({ page }) => {
        const pending = await setup(page)
        await expect(overlay(page)).toBeVisible()
        await expect(root(page)).toHaveAttribute('aria-busy', 'true')
        await expect(page.getByRole('button', { name: 'Cancel loading' })).toHaveCount(0)
        const center = await overlay(page).evaluate(element => {
          const box = element.getBoundingClientRect()
          const indicator = element.querySelector('.app-loading-indicator')!.getBoundingClientRect()
          return { x: Math.abs(box.x + box.width / 2 - indicator.x - indicator.width / 2), y: Math.abs(box.y + box.height / 2 - indicator.y - indicator.height / 2) }
        })
        expect(center.x).toBeLessThanOrEqual(1)
        expect(center.y).toBeLessThanOrEqual(1)
        expect(await overlay(page).locator('.app-loading-indicator__wheel').evaluate(element => getComputedStyle(element).animationName)).not.toBe('none')
        await page.screenshot({ path: 'evidence/library-loading-' + width + '.png' })
        pending[first].release()
        await expect(root(page)).toHaveAttribute('aria-busy', 'true')
        await expect(overlay(page)).toBeVisible()
        await overlay(page).evaluate(element => {
          const target = window as unknown as { loadingFade: string[]; loadingFadeDuration: string[] }
          target.loadingFade = []; target.loadingFadeDuration = []
          element.addEventListener('transitionrun', event => { target.loadingFade.push((event as TransitionEvent).propertyName); target.loadingFadeDuration.push(getComputedStyle(element).transitionDuration) })
        })
        await observeLoadingFade(page, '.company-library-widget')
        pending.references.release(); pending.documents.release()
        await expect(root(page)).toHaveAttribute('aria-busy', 'false')
        await expect(overlay(page)).toHaveCount(0)
        await expectSingleLoadingFade(page)
        expect(await page.evaluate(() => (window as unknown as { loadingFade: string[] }).loadingFade)).toContain('opacity')
        expect(await page.evaluate(() => (window as unknown as { loadingFadeDuration: string[] }).loadingFadeDuration)).toContain('0.4s')
        await openLibraryFiles(page)

        await expect(page.getByRole('searchbox', { name: 'Search files' })).toBeEnabled()
        await expect(page.getByText('Select a file to preview it.', { exact: true })).toBeVisible()
        await page.screenshot({ path: 'evidence/library-ready-' + width + '.png' })
        pending.search.release()
      })
    }
  })
}

for (const failure of ['references', 'documents'] as const) {
  test('reveals ' + failure + ' errors and allows retry without a stuck overlay', async ({ page }) => {
    const pending = await setup(page, failure)
    pending.references.release(); pending.documents.release(); pending.search.release()
    await expect(overlay(page)).toHaveCount(0)
    await expect(page.getByRole('alert')).toContainText('Synthetic access unavailable')
    await page.getByRole('button', { name: failure === 'references' ? 'Retry references' : 'Retry', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(root(page)).toHaveAttribute('aria-busy', 'false')
    await expect(overlay(page)).toHaveCount(0)
    await openLibraryFiles(page)

    await expect(page.getByRole('searchbox', { name: 'Search files' })).toBeEnabled()
  })
}

test('a later search keeps its input focused while only the document area loads', async ({ page }) => {
  const pending = await setup(page)
  pending.references.release(); pending.documents.release()
  await expect(root(page)).toHaveAttribute('aria-busy', 'false')
  await expect(overlay(page)).toHaveCount(0)
  await openLibraryFiles(page)
  const search = page.getByRole('searchbox', { name: 'Search files' })
  await search.fill('new')
  await expect(search).toBeFocused()
  await expect(search).toHaveValue('new')
  const region = page.locator('.document-explorer__body')
  await expect(region).toHaveAttribute('aria-busy', 'true')
  await expect(region.locator('.app-loading-overlay')).toBeVisible()
  await expect(search).toBeFocused()
  await expect(overlay(page)).toHaveCount(0)
  pending.search.release()
  await expect(region).toHaveAttribute('aria-busy', 'false')
  await expect(region.locator('.app-loading-overlay')).toHaveCount(0)
  await expect(search).toBeFocused()
})

test('respects reduced motion and removes the overlay after loading', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const pending = await setup(page)
  await expect(overlay(page)).toBeVisible()
  expect(await overlay(page).locator('.app-loading-indicator__wheel').evaluate(element => getComputedStyle(element).animationName)).toBe('none')
  pending.references.release(); pending.documents.release(); pending.search.release()
  await expect(overlay(page)).toHaveCount(0)
  await expect(root(page)).toHaveAttribute('aria-busy', 'false')
})
