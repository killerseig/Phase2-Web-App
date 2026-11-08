import { expect, test } from './helpers/test'
import { createJobsFixture, gotoPhase2App, selectLibraryFile } from './helpers/phase2AppFixture'
import { observeLoadingFade, expectSingleLoadingFade } from './helpers/loadingObservation'
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
function gate() { let release!: () => void; const ready = new Promise<void>(resolve => { release = resolve }); return { ready, release } }
for (const width of [390, 1440]) {
  const navigationRole = width <= 900 ? 'button' : 'searchbox'
  const navigationName = width <= 900 ? 'Open files' : 'Search files'

  test.describe(width + 'px', () => {
    test.use({ viewport: { width, height: 900 } })

    test('selected files keep one centered loader through authorization and rendering, with safe switching and errors', async ({ page }) => {
      const authorize = gate(), bytes = gate(), old = gate(), downloadStarted = gate()
      const files = [
        { id: 'pdf', name: 'Synthetic PDF', extension: 'pdf', fixture: 'sds-preview.pdf', mime: 'application/pdf' },
        { id: 'word', name: 'Synthetic Word', extension: 'docx', fixture: 'docx-pages.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        { id: 'image', name: 'Synthetic image', extension: 'png', fixture: 'site.png', mime: 'image/png' },
        { id: 'text', name: 'Synthetic text', extension: 'txt', fixture: 'notes.txt', mime: 'text/plain' },
        { id: 'old', name: 'Slow previous file', extension: 'pdf', fixture: 'sds-preview.pdf', mime: 'application/pdf' },
        { id: 'broken', name: 'Broken Word', extension: 'docx', fixture: '', mime: 'application/octet-stream' },
      ]
      const writes: string[] = []
      await page.route('**/sdsWorkspace', async route => {
        if (route.request().method() === 'OPTIONS') { await route.fulfill({ headers, status: 204 }); return }
        const data = route.request().postDataJSON().data
        if (!['load', 'page', 'openSheet'].includes(data.action)) writes.push(data.action)
        if (data.action === 'openSheet') {
          if (data.id === 'pdf') await authorize.ready
          if (data.id === 'old') await old.ready
          const file = files.find(file => file.id === data.id)!
          await route.fulfill({ headers, json: { result: { url: 'https://example.invalid/document?ticket=' + file.id, extension: file.extension, revisionId: 'r1' } } }); return
        }
        const sheets = data.search === 'Phase2 intranet content' ? [] : files.map(file => ({ ...file, folderId: '', revisionId: 'r1', archived: false, order: 0 }))
        await route.fulfill({ headers, json: { result: { version: 1, folders: [], sheets, after: '', binder: { version: 0, selections: [] } } } })
      })
      await page.route('**/sds-file?*', async route => {
        const file = files.find(file => file.id === new URL(route.request().url()).searchParams.get('ticket'))!
        if (file.id === 'pdf') { downloadStarted.release(); await bytes.ready }
        await route.fulfill(file.fixture ? { path: 'e2e/fixtures/' + file.fixture, contentType: file.mime } : { body: 'Invalid synthetic document' })
      })
      await gotoPhase2App(page, '/company-library', createJobsFixture())
      await expect(page.getByRole('region', { name: 'Company Library widget', exact: true })).toHaveAttribute('aria-busy', 'false')
      await selectLibraryFile(page, 'Synthetic PDF')
      const preview = page.getByRole('region', { name: 'Document preview', exact: true })
      await expect(preview).toHaveAttribute('aria-busy', 'true')
      await expect(preview.locator('.app-loading-indicator__wheel:visible')).toHaveCount(1)
      const center = await preview.evaluate(element => { const box = element.getBoundingClientRect(), wheel = element.querySelector('.app-loading-indicator')!.getBoundingClientRect(); return { x: Math.abs(box.x + box.width / 2 - wheel.x - wheel.width / 2), y: Math.abs(box.y + box.height / 2 - wheel.y - wheel.height / 2), height: box.height } })
      expect(center.height).toBeGreaterThan(180); expect(center.x).toBeLessThanOrEqual(1); expect(center.y).toBeLessThanOrEqual(1)
      const availableNavigation = page.getByRole(navigationRole, { name: navigationName, exact: true })
      await expect(availableNavigation).toBeEnabled()
      authorize.release(); await downloadStarted.ready
      await expect(preview).toHaveAttribute('aria-busy', 'true')
      await expect(preview.locator('.app-loading-indicator__wheel:visible')).toHaveCount(1)
      await page.screenshot({ path: 'evidence/library-file-loading-' + width + '.png' })
      await observeLoadingFade(page, '.viewer-loading-region')
      bytes.release()
      await expect(preview).toHaveAttribute('aria-busy', 'false')
      await expect(preview.getByRole('img', { name: 'PDF page 1 of 2', exact: true })).toBeVisible()
      await expectSingleLoadingFade(page)
      await selectLibraryFile(page, 'Synthetic Word')
      // The first Word preview also loads cold Vite modules for the renderer.
      // Keep a bounded readiness budget; the iframe/image/fit checks below still
      // require successful rendering rather than accepting an error as settled.
      await expect(preview).toHaveAttribute('aria-busy', 'false', { timeout: 15000 })
      const iframe = page.locator('iframe.docx-pages'), word = page.frameLocator('iframe.docx-pages')
      await expect(iframe).toBeVisible()
      await expect(word.locator('img')).toHaveJSProperty('complete', true)
      const fitted = () => word.locator('html').evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth, height: el.scrollHeight, viewport: el.clientHeight }))
      const pageFit = await word.locator('html').evaluate(el => { const page = el.querySelector<HTMLElement>('section.docx')!, rect = page.getBoundingClientRect(); return { usable: el.clientWidth, width: rect.width, left: rect.x, natural: page.offsetWidth, scrollbar: innerWidth - el.clientWidth } })
      expect(Math.abs(pageFit.width - Math.min(pageFit.usable, pageFit.natural))).toBeLessThanOrEqual(1)
      expect(pageFit.left).toBeGreaterThanOrEqual(-1)
      expect(pageFit.left + pageFit.width).toBeLessThanOrEqual(pageFit.usable + 1)
      await expect.poll(async () => { const size = await fitted(); return size.scroll - size.width }).toBeLessThanOrEqual(1)
      await expect(word.getByRole('region', { name: 'Document page 2 of 2', exact: true })).toHaveCount(1)
      await page.setViewportSize({ width: 1440, height: 900 })
      const zoom = page.getByRole('group', { name: 'Word document zoom', exact: true })
      const operations = page.getByRole('group', { name: 'File actions', exact: true })
      const viewBox = await zoom.boundingBox(), actionsBox = await operations.boundingBox()
      expect(actionsBox!.y > viewBox!.y + 1 || actionsBox!.x - viewBox!.x - viewBox!.width >= 8).toBe(true)
      expect(await page.locator('.viewer-toolbar').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
      await zoom.getByRole('button', { name: 'Zoom in', exact: true }).focus(); await page.keyboard.press('Enter')
      await expect(page.getByText('125% of fit', { exact: true })).toBeVisible()
      await zoom.getByRole('button', { name: 'Zoom in', exact: true }).click()
      await expect.poll(async () => { const size = await fitted(); return size.scroll - size.width }).toBeGreaterThan(1)
      await zoom.getByRole('button', { name: 'Zoom out', exact: true }).click()
      for (let i = 0; i < 7; i++) await zoom.getByRole('button', { name: 'Zoom in', exact: true }).click()
      await iframe.hover(); await page.mouse.wheel(0, 900)
      await expect.poll(() => word.locator('html').evaluate(el => el.scrollTop)).toBeGreaterThan(0)
      await zoom.getByRole('button', { name: 'Fit file width', exact: true }).click()
      await expect.poll(async () => { const size = await fitted(); return size.scroll - size.width }).toBeLessThanOrEqual(1)
      await page.screenshot({ path: 'evidence/library-word-fit-' + width + '.png' })
      await selectLibraryFile(page, 'Slow previous file')
      await expect(preview).toHaveAttribute('aria-busy', 'true')
      await selectLibraryFile(page, 'Synthetic image')
      await expect(preview).toHaveAttribute('aria-busy', 'false')
      await expect(preview.getByRole('img', { name: 'Synthetic image', exact: true })).toHaveJSProperty('naturalWidth', 400)
      old.release()
      await expect(preview.getByRole('img', { name: 'Synthetic image', exact: true })).toBeVisible()
      await selectLibraryFile(page, 'Synthetic text')
      await expect(preview).toHaveAttribute('aria-busy', 'false')
      await expect(preview.locator('pre')).toContainText('Review delivery schedule.')
      await selectLibraryFile(page, 'Broken Word')
      await expect(preview).toHaveAttribute('aria-busy', 'false')
      await expect(preview.getByRole('alert')).toContainText('could not be previewed')
      await expect(preview.locator('.app-loading-overlay')).toHaveCount(0)
      expect(writes).toEqual([])
    })
  })
}
