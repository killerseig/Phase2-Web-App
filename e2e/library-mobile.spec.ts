import { expect, test } from './helpers/test'
import { createJobsFixture, gotoPhase2App, openLibraryFiles, selectLibraryFile } from './helpers/phase2AppFixture'
test.use({ isMobile: true, hasTouch: true })
const growSpans = [35, 40, 50, 60, 70, 80, 90, 100], shrinkSpans = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10]
function gestureSpans(grow: boolean) { return grow ? growSpans : shrinkSpans }
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
for (const viewport of [{ width: 320, height: 740 }, { width: 390, height: 844 }, { width: 768, height: 900 }, { width: 844, height: 390 }]) {
  test('Library keeps the document full width with a keyboard/touch file drawer at ' + viewport.width + 'px', async ({ page }) => {
    await page.setViewportSize(viewport)
    const writes: string[] = []
    let resultPages = 0
    await page.route('**/sds-file?*', route => route.fulfill({ path: 'e2e/fixtures/sds-preview.pdf', contentType: 'application/pdf' }))
    await page.route('**/sdsWorkspace', async route => {
      if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return }
      const data = route.request().postDataJSON().data
      if (!['load', 'page', 'openSheet'].includes(data.action)) writes.push(data.action)
      if (data.action === 'page' && data.search !== 'Phase2 intranet content') resultPages++
      const sheets = data.search === 'Phase2 intranet content' ? [] : [{ id: 'plan', name: 'Synthetic safety plan', folderId: 'folder', revisionId: 'r1', extension: 'pdf', archived: false }]
      const result = data.action === 'openSheet' ? { url: 'https://example.invalid/document?ticket=plan', extension: 'pdf', revisionId: 'r1' } : { version: 1, folders: [{ id: 'folder', name: 'Safety files', parentId: '', order: 0 }], sheets, after: '', binder: { version: 0, selections: [] } }
      await route.fulfill({ headers, json: { result } })
    })
    await gotoPhase2App(page, '/company-library', createJobsFixture())
    await expect(page.getByRole('region', { name: 'Company Library widget', exact: true })).toHaveAttribute('aria-busy', 'false')
    const open = page.getByRole('button', { name: 'Open files', exact: true }), sidebar = page.locator('.document-explorer__sidebar'), viewer = page.getByRole('region', { name: 'File viewer', exact: true })
    await expect(open).toBeVisible(); await expect(open).toHaveAttribute('aria-expanded', 'false')
    expect(await open.evaluate(el => !!el.closest('.viewer-toolbar') && getComputedStyle(el).position === 'static')).toBe(true)
    await expect(sidebar).toHaveAttribute('inert', '')
    await expect(sidebar).toHaveAttribute('aria-hidden', 'true')
    const widths = await viewer.evaluate(el => ({ viewer: el.clientWidth, workspace: el.parentElement!.clientWidth }))
    expect(Math.abs(widths.viewer - widths.workspace)).toBeLessThanOrEqual(1)
    await open.focus(); await page.keyboard.press('Enter')
    await expect(open).toHaveAttribute('aria-expanded', 'true')
    await expect(sidebar).toBeVisible()
    const search = page.getByRole('searchbox', { name: 'Search files', exact: true })
    await expect(search).toBeFocused()
    const beforeSearch = resultPages
    await search.fill('safety plan')
    await expect.poll(() => resultPages).toBeGreaterThan(beforeSearch)
    await expect(page.getByRole('button', { name: 'Synthetic safety plan', exact: true })).toBeVisible()
    const beforeClear = resultPages
    await search.fill('')
    await expect.poll(() => resultPages).toBeGreaterThan(beforeClear)
    await expect(page.locator('.document-explorer__folder-content')).toHaveAttribute('aria-busy', 'false')
    await page.getByRole('button', { name: 'Root folder actions', exact: true }).click()
    await expect(page.getByRole('menuitem', { name: 'Upload document here', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(open).toHaveAttribute('aria-expanded', 'true')
    await page.keyboard.press('Escape')
    await expect(open).toHaveAttribute('aria-expanded', 'false'); await expect(open).toBeFocused()
    await openLibraryFiles(page)
    await page.screenshot({ path: 'evidence/library-mobile-menu-' + viewport.width + '.png' })
    await selectLibraryFile(page, 'Synthetic safety plan')
    await expect(open).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('region', { name: 'Document preview', exact: true })).toHaveAttribute('aria-busy', 'false')
    await expect(page.getByRole('img', { name: 'PDF page 1 of 2', exact: true })).toBeVisible()
    await expect(page.getByRole('group', { name: 'File actions', exact: true })).toBeVisible()
    await expect(page.locator('.pdf-surface')).toHaveCSS('scrollbar-width', 'thin')
    expect(await viewer.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toHaveCount(0)
    expect((await page.locator('.viewer-toolbar').boundingBox())!.height).toBeLessThanOrEqual(45)
    await openLibraryFiles(page)
    await page.getByRole('button', { name: 'Close files', exact: true }).click()
    await expect(open).toBeFocused()
    await expect(page.getByRole('img', { name: 'PDF page 1 of 2', exact: true })).toBeVisible()
    await expect(page.getByText('100% of fit', { exact: true })).toHaveCount(1)
    await page.screenshot({ path: 'evidence/library-mobile-document-' + viewport.width + '.png' })
    await openLibraryFiles(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(open).toHaveCount(0); await expect(sidebar).not.toHaveAttribute('inert')
    await expect(sidebar).toBeVisible(); await expect(page.getByRole('button', { name: 'Synthetic safety plan', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible()
    await page.setViewportSize(viewport)
    await expect(open).toHaveAttribute('aria-expanded', 'false')
    expect(writes).toEqual([])
  })
}

test('native mobile browser pinch works over PDF, image and scriptless Word previews', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const files = [
    { id: 'pdf', extension: 'pdf', fixture: 'sds-preview.pdf', mime: 'application/pdf' },
    { id: 'image', extension: 'png', fixture: 'site.png', mime: 'image/png' },
    { id: 'word', extension: 'docx', fixture: 'docx-pages.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  ]
  await page.route('**/sds-file?*', route => {
    const file = files.find(file => file.id === new URL(route.request().url()).searchParams.get('ticket'))!
    return route.fulfill({ path: 'e2e/fixtures/' + file.fixture, contentType: file.mime })
  })
  await page.route('**/sdsWorkspace', async route => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ headers, status: 204 }); return }
    const data = route.request().postDataJSON().data
    if (!['load', 'page', 'openSheet'].includes(data.action)) throw new Error('No fixture writes allowed')
    const file = files.find(file => file.id === data.id)
    const result = data.action === 'openSheet' ? { url: 'https://example.invalid/document?ticket=' + file!.id, extension: file!.extension, revisionId: 'r1' }
      : { version: 1, folders: [], sheets: data.search === 'Phase2 intranet content' ? [] : files.map(file => ({ ...file, name: 'Pinch ' + file.id, revisionId: 'r1', folderId: '', archived: false })), after: '', binder: { version: 0, selections: [] } }
    await route.fulfill({ headers, json: { result } })
  })
  await gotoPhase2App(page, '/company-library', createJobsFixture())
  await expect(page.getByRole('region', { name: 'Company Library widget', exact: true })).toHaveAttribute('aria-busy', 'false')
  const cdp = await page.context().newCDPSession(page)
  const scale = () => page.evaluate(() => window.visualViewport!.scale)
  async function pinch(center: { x: number; y: number }, grow: boolean) {
    const points = (span: number) => [{ x: center.x - span, y: center.y, id: 1 }, { x: center.x + span, y: center.y, id: 2 }]
    const spans = gestureSpans(grow)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(spans[0]!) })
    for (const span of spans.slice(1)) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(span) })
      await page.evaluate(() => new Promise(requestAnimationFrame))
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  for (const file of files) {
    await selectLibraryFile(page, 'Pinch ' + file.id)
    const preview = page.getByRole('region', { name: 'Document preview', exact: true })
    await expect(preview).toHaveAttribute('aria-busy', 'false')
    const box = await preview.boundingBox()
    const center = { x: box!.x + box!.width / 2, y: box!.y + Math.min(box!.height / 2, 250) }
    await expect.poll(scale).toBeCloseTo(1, 1)
    await pinch(center, true)
    await expect.poll(scale).toBeGreaterThan(1.3)
    await pinch(center, false)
    await expect.poll(scale).toBeCloseTo(1, 1)
  }
  const word = page.frameLocator('iframe.docx-pages').locator('html')
  await expect(word).toHaveCSS('scrollbar-width', 'thin')
  const fill = await word.evaluate(el => ({ usable: el.clientWidth, page: el.querySelector('section.docx')!.getBoundingClientRect().width, pageX: el.querySelector('section.docx')!.getBoundingClientRect().x }))
  expect(Math.abs(fill.usable - fill.page)).toBeLessThanOrEqual(1)
  expect(Math.abs(fill.pageX)).toBeLessThanOrEqual(1)
  await page.locator('iframe.docx-pages').hover(); await page.mouse.wheel(0, 900)
  await expect.poll(() => word.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
  const position = await word.evaluate(el => el.scrollTop)
  await openLibraryFiles(page)
  await page.getByRole('button', { name: 'Close files', exact: true }).click()
  expect(await word.evaluate(el => el.scrollTop)).toBe(position)
  await page.screenshot({ path: 'evidence/library-mobile-word.png' })
  await cdp.detach()
})

