import { expect, test, type Page } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { mockDashboard } from './helpers/dashboardFixture.js'
import { sampleContent } from '../src/features/intranet/__tests__/fixtures.js'

async function openMobileNavigation(page: Page, width: number) {
  if (width < 600) await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
}

test('previews PDF, images, text, CSV, Word and Excel locally and explicitly excludes nonprintable files from books', async ({
  page,
}) => {
  const formats = [
    { id: 'pdf', name: 'Synthetic PDF', extension: 'pdf', fixture: 'sds-preview.pdf', mime: 'application/pdf' },
    { id: 'photo', name: 'Site photo', extension: 'png', fixture: 'site.png', mime: 'image/png' },
    { id: 'jpg', name: 'Site JPG', extension: 'jpg', fixture: 'site.jpeg', mime: 'image/jpeg' },
    { id: 'jpeg', name: 'Site JPEG', extension: 'jpeg', fixture: 'site.jpeg', mime: 'image/jpeg' },
    { id: 'webp', name: 'Site WebP', extension: 'webp', fixture: 'site.webp', mime: 'image/webp' },
    { id: 'text', name: 'Text notes', extension: 'txt', fixture: 'notes.txt', mime: 'text/plain' },
    {
      id: 'csv',
      name: 'Materials CSV',
      extension: 'csv',
      fixture: 'materials.csv',
      mime: 'text/csv',
    },
    {
      id: 'word',
      name: 'Word notes',
      extension: 'docx',
      fixture: 'notes.docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
    {
      id: 'excel',
      name: 'Workbook',
      extension: 'xlsx',
      fixture: 'materials.xlsx',
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  ]
  const exports: Record<string, unknown>[] = []
  await page.route('**/sds-file?*', async (route) => {
    const file = formats.find(
      (file) => file.id === new URL(route.request().url()).searchParams.get('ticket'),
    )!
    await route.fulfill({ path: `e2e/fixtures/${file.fixture}`, contentType: file.mime })
  })
  await page.route('**/sdsWorkspace', async (route) => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const data = route.request().postDataJSON().data
    let result: unknown = {}
    if (data.action === 'load' || data.action === 'page')
      result = {
        version: 1,
        folders: [],
        binder: { version: 0, selections: [] },
        sheets: formats.map((file) => ({
          ...file,
          folderId: '',
          revisionId: 'r1',
          revisionDate: '',
          manufacturer: '',
          productCode: '',
          language: 'English',
          order: 0,
          archived: false,
        })),
      }
    if (data.action === 'openSheet') {
      const file = formats.find((file) => file.id === data.id)!
      result = {
        url: `https://us-central1-phase2-website.cloudfunctions.net/downloadSdsFile?ticket=${file.id}`,
        extension: file.extension,
      }
    }
    if (data.action === 'requestExport') {
      exports.push(data)
      result = { id: data.requestId }
    }
    if (data.action === 'exportStatus') result = { status: 'complete', pageCount: 3 }
    await route.fulfill({ json: { result }, headers })
  })
  await mockDashboard(page)
  await gotoPhase2App(page, '/dashboards/personal', createJobsFixture())
  await page.getByRole('button', { name: 'Synthetic PDF', exact: true }).click()
  const pdf = page.getByRole('img', { name: 'PDF page 1 of 2', exact: true })
  await expect(pdf).toBeVisible()
  expect(await pdf.evaluate((canvas: HTMLCanvasElement) => {
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
    return pixels.some((value, index) => index % 4 !== 3 && value < 100)
  })).toBe(true)
  await page.getByRole('button', { name: 'Site photo', exact: true }).click()
  const photo = page.getByRole('img', { name: 'Site photo', exact: true })
  await expect(photo).toBeVisible()
  expect(await photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(400)
  for (const name of ['Site JPG', 'Site JPEG', 'Site WebP']) {
    await page.getByRole('button', { name, exact: true }).click()
    const image = page.getByRole('img', { name, exact: true })
    await expect(image).toBeVisible()
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true)
  }
  await page.getByRole('button', { name: 'Text notes', exact: true }).click()
  await expect(page.locator('pre')).toContainText('Review delivery schedule.')
  await expect(page.locator('pre')).toContainText('<script>window.previewInjected=true</script>')
  await page.getByRole('button', { name: 'Materials CSV', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'First floor, west', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Word notes', exact: true }).click()
  const word = page.frameLocator('iframe.docx-pages')
  await expect(word.locator('body')).toContainText('Review the delivery schedule.')
  await expect(word.locator('body')).toContainText('<script>window.previewInjected=true</script>')
  expect(await page.evaluate(() => 'previewInjected' in window)).toBe(false)
  await page.getByRole('button', { name: 'Workbook', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'Drywall', exact: true })).toBeVisible()
  await page.getByLabel('Worksheet', { exact: true }).selectOption({ label: 'Deliveries' })
  await expect(page.getByRole('cell', { name: 'Monday delivery', exact: true })).toBeVisible()
  await page
    .getByTestId('sds-module')
    .screenshot({ path: '.security-work/document-workbook-preview.png' })
  await page.getByRole('button', { name: 'Current folder actions' }).click()
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('menuitem', { name: 'Make PDF / print book' }).click()
  expect(exports).toHaveLength(0)
  await page.getByRole('button', { name: 'Current folder actions' }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('menuitem', { name: 'Make PDF / print book' }).click()
  await expect(page.getByRole('button', { name: 'Download PDF', exact: true })).toBeVisible()
  expect(exports[0]?.printableOnly).toBe(true)
})

for (const width of [1280, 390]) test(`Word pages preserve images, scroll and recover on file switching at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 })
  const formats = [
    { id: 'pages', name: 'Paged Word', fixture: 'docx-pages.docx' },
    { id: 'poster', name: 'Image poster', fixture: 'docx-poster.docx' },
    { id: 'empty', name: 'Empty Word', fixture: 'docx-empty.docx' },
    { id: 'corrupt', name: 'Broken Word', fixture: '' },
  ]
  const external: string[] = []
  page.on('request', request => { if (request.url().startsWith('https://example.invalid/')) external.push(request.url()) })
  await page.route('**/sds-file?*', route => {
    const file = formats.find(file => file.id === new URL(route.request().url()).searchParams.get('ticket'))!
    return file.fixture ? route.fulfill({ path: `e2e/fixtures/${file.fixture}`, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }) : route.fulfill({ body: 'not a Word file' })
  })
  await page.route('**/sdsWorkspace', async route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const data = route.request().postDataJSON().data
    const result = data.action === 'openSheet' ? { url: `https://example.invalid/document?ticket=${data.id}`, extension: 'docx' } : {
      version: 1, folders: [], binder: { version: 0, selections: [] }, after: '',
      sheets: formats.map(file => ({ ...file, extension: 'docx', folderId: '', revisionId: 'r1', archived: false })),
    }
    return route.fulfill({ headers, json: { result } })
  })
  await mockDashboard(page)
  await gotoPhase2App(page, '/company-library', createJobsFixture())
  await page.getByRole('button', { name: 'Paged Word', exact: true }).click()
  const iframe = page.locator('iframe.docx-pages'), word = page.frameLocator('iframe.docx-pages')
  await expect(iframe).toBeVisible()
  await expect(iframe).toHaveAttribute('sandbox', '')
  await expect(word.getByRole('region', { name: 'Document page 2 of 2' })).toContainText('Second page heading')
  await expect.poll(() => word.locator('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  const dimensions = await word.locator('html').evaluate(element => ({ height: element.scrollHeight, viewport: element.clientHeight, width: element.scrollWidth, inner: window.innerWidth }))
  expect(dimensions.height).toBeGreaterThan(dimensions.viewport)
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.inner + 2)
  expect(dimensions.viewport).toBeGreaterThan(150)
  await iframe.screenshot({ path: test.info().outputPath(`word-pages-${width}.png`) })
  await iframe.hover(); await page.mouse.wheel(0, 1200)
  await expect.poll(() => word.locator('html').evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  await expect(word.locator('table')).toContainText('Inspection')
  expect(await word.locator('body').evaluate(() => (window as unknown as { previewInjected?: boolean }).previewInjected)).not.toBe(true)
  expect(external).toEqual([])
  await page.getByRole('button', { name: 'Image poster', exact: true }).click()
  await expect(iframe).toHaveAttribute('title', 'Image poster — document pages')
  await expect.poll(() => word.locator('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  await expect(word.locator('body')).not.toContainText('Second page heading')
  await page.getByRole('button', { name: 'Empty Word', exact: true }).click()
  await expect(iframe).toHaveCount(0)
  await expect(page.getByText('This document has no displayable text or images.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Broken Word', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('could not be previewed')
  await page.getByRole('button', { name: 'Paged Word', exact: true }).click()
  await expect(word.getByRole('region', { name: 'Document page 2 of 2' })).toContainText('Second page heading')
})

for (const width of [1280, 390]) test(`PDF wheel scrolling reaches later pages in a lazy 387-page book at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 })
  await page.addInitScript(() => {
    const state = { started: 0, terminated: 0 }
    Object.assign(window, { pdfWorkerStats: state })
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      private pdf: boolean
      private stopped = false
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        this.pdf = String(url).includes('pdf.worker')
        if (this.pdf) state.started++
      }
      terminate() {
        if (this.pdf && !this.stopped) { this.stopped = true; state.terminated++ }
        super.terminate()
      }
    }
  })
  const files = [{ id: 'book', name: 'Long SDS book', fixture: 'sds-book-387.pdf' }, { id: 'short', name: 'Short PDF', fixture: 'sds-preview.pdf' }]
  await page.route('**/sds-file?*', route => {
    const file = files.find(file => file.id === new URL(route.request().url()).searchParams.get('ticket'))!
    return route.fulfill({ path: `e2e/fixtures/${file.fixture}`, contentType: 'application/pdf' })
  })
  await page.route('**/sdsWorkspace', async route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const data = route.request().postDataJSON().data
    const result = data.action === 'openSheet' ? { url: `https://example.invalid/file?ticket=${data.id}`, extension: 'pdf' } : {
      version: 1, folders: [], binder: { version: 0, selections: [] }, after: '',
      sheets: files.map(file => ({ ...file, extension: 'pdf', folderId: '', revisionId: 'r1', archived: false })),
    }
    return route.fulfill({ headers, json: { result } })
  })
  await mockDashboard(page)
  await gotoPhase2App(page, '/company-library', createJobsFixture())
  await expect(page.getByRole('heading', { name: 'Company Library', exact: true })).toHaveCount(0)
  await expect(page.getByText('No supplied references have been uploaded.', { exact: false })).toHaveCount(0)
  await page.getByRole('button', { name: 'Long SDS book', exact: true }).click()
  const surface = page.getByRole('region', { name: 'PDF pages', exact: true }), number = page.getByRole('spinbutton', { name: 'PDF page', exact: true })
  await expect(page.getByRole('img', { name: 'PDF page 1 of 387', exact: true })).toBeVisible()
  await expect(page.locator('[data-pdf-page]')).toHaveCount(387)
  expect((await surface.boundingBox())!.height).toBeGreaterThan(337)
  expect(await page.locator('.pdf-surface canvas').count()).toBeLessThanOrEqual(6)
  const step = await page.locator('[data-pdf-page="1"]').evaluate(element => element.getBoundingClientRect().height + 12)
  await surface.hover(); await page.mouse.wheel(0, step)
  await expect(number).toHaveValue('2')
  const second = page.getByRole('img', { name: 'PDF page 2 of 387', exact: true })
  await expect(second).toBeInViewport()
  await page.mouse.wheel(0, step * 4)
  await expect(number).toHaveValue('6')
  const sixth = page.getByRole('img', { name: 'PDF page 6 of 387', exact: true })
  await expect(sixth).toBeInViewport()
  expect(await sixth.evaluate((canvas: HTMLCanvasElement) => canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 !== 3 && value < 100))).toBe(true)
  await expect(page.getByRole('img', { name: 'PDF page 1 of 387', exact: true })).toHaveCount(0)
  expect(await page.locator('.pdf-surface canvas').count()).toBeLessThanOrEqual(6)
  await number.fill('200'); await number.press('Tab')
  const distant = page.getByRole('img', { name: 'PDF page 200 of 387', exact: true })
  await expect(distant).toBeInViewport()
  const before = (await distant.boundingBox())!.width
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect.poll(async () => (await distant.boundingBox())?.width || 0).toBeGreaterThan(before)
  await expect(number).toHaveValue('200')
  await page.getByRole('button', { name: 'Fit page width', exact: true }).click()
  await expect.poll(async () => (await distant.boundingBox())?.width || 0).toBeCloseTo(before, 0)
  await number.fill('387'); await number.press('Tab')
  await expect(page.getByRole('img', { name: 'PDF page 387 of 387', exact: true })).toBeInViewport()
  expect(await page.locator('.pdf-surface canvas').count()).toBeLessThanOrEqual(6)
  await surface.screenshot({ path: test.info().outputPath(`pdf-continuous-${width}.png`) })
  await page.getByRole('button', { name: 'Short PDF', exact: true }).click()
  await expect(number).toHaveValue('1')
  await expect(page.locator('[data-pdf-page]')).toHaveCount(2)
  await expect(page.getByRole('img', { name: 'PDF page 1 of 2', exact: true })).toBeVisible()
  await surface.focus(); await page.keyboard.press('End')
  await expect(page.getByRole('img', { name: 'PDF page 2 of 2', exact: true })).toBeInViewport()
  await expect(page.getByRole('img', { name: 'PDF page 387 of 387', exact: true })).toHaveCount(0)
  // A fresh authorization/download still occurs on a repeat open, but the
  // explorer retains its worker. Leaving the library must terminate it.
  await page.getByRole('button', { name: 'Long SDS book', exact: true }).click()
  await expect(page.getByRole('img', { name: 'PDF page 1 of 387', exact: true })).toBeVisible()
  const stats = () => page.evaluate(() => (window as unknown as { pdfWorkerStats: { started: number; terminated: number } }).pdfWorkerStats)
  expect(await stats()).toEqual({ started: 1, terminated: 0 })
  expect(await page.locator('.pdf-surface canvas').count()).toBeLessThanOrEqual(6)
  await openMobileNavigation(page, width)
  await page.getByRole('link', { name: 'Jobs', exact: true }).first().click()
  await expect.poll(stats).toEqual({ started: 1, terminated: 1 })
  await page.goBack()
  await page.getByRole('button', { name: 'Long SDS book', exact: true }).click()
  await expect(page.getByRole('img', { name: 'PDF page 1 of 387', exact: true })).toBeVisible()
  expect(await stats()).toEqual({ started: 2, terminated: 1 })
  await openMobileNavigation(page, width)
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect.poll(stats).toEqual({ started: 2, terminated: 2 })
})

test('preloads PDF worker during authorization without requesting private bytes early', async ({ page }) => {
  let authorize!: () => void, downloads = 0
  const authorized = new Promise<void>(resolve => { authorize = resolve })
  await page.route('**/sds-file?*', route => {
    downloads++
    return route.fulfill({ path: 'e2e/fixtures/sds-preview.pdf', contentType: 'application/pdf' })
  })
  await page.route('**/sdsWorkspace', async route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const data = route.request().postDataJSON().data
    if (data.action === 'openSheet') await authorized
    return route.fulfill({ headers, json: { result: data.action === 'openSheet' ? { url: 'https://example.invalid/file?ticket=private', extension: 'pdf' } : {
      version: 1, folders: [], binder: { version: 0, selections: [] }, after: '',
      sheets: [{ id: 'private', name: 'Authorized PDF', extension: 'pdf', folderId: '', revisionId: 'r1', archived: false }],
    } } })
  })
  await mockDashboard(page)
  await gotoPhase2App(page, '/company-library', createJobsFixture())
  const workerStarted = page.waitForEvent('worker', worker => worker.url().includes('pdf.worker'))
  await page.getByRole('button', { name: 'Authorized PDF', exact: true }).click()
  await workerStarted
  expect(downloads).toBe(0)
  await expect(page.getByRole('img', { name: 'PDF page 1 of 2', exact: true })).toHaveCount(0)
  authorize()
  await expect(page.getByRole('img', { name: 'PDF page 1 of 2', exact: true })).toBeVisible()
  expect(downloads).toBe(1)
})

test('real library folders and cross-category search remain reachable without category shortcuts', async ({ page }) => {
  const folders = ['SDS', 'Safety', 'AHA'].map(name => ({ id: name.toLowerCase(), name, parentId: '', order: 0 }))
  const documents = folders.map(folder => ({ id: folder.id + '-file', name: folder.name + ' document', extension: 'pdf', folderId: folder.id, revisionId: 'r1', archived: false }))
  const content = sampleContent()
  content.resources.push({ id: 'sds-source', title: 'Synthetic SDS reference', category: 'SDS', kind: 'Reference', keywords: '', filename: 'sds.pdf' }, { id: 'aha-source', title: 'Synthetic AHA reference', category: 'AHA', kind: 'Reference', keywords: '', filename: 'aha.pdf' })
  const actions: string[] = []
  await page.route('**/sdsWorkspace', async route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const data = route.request().postDataJSON().data; actions.push(data.action)
    let result: unknown = { version: 1, folders, sheets: [], binder: { version: 0, selections: [] } }
    if (data.action === 'page') result = { sheets: data.search === 'Phase2 intranet content' ? [{ id: 'reference-package', name: 'Private source', originalName: 'Phase2 intranet content.txt', extension: 'txt', revisionId: 'r1', archived: false }] : documents.filter(file => !data.search || file.name.toLowerCase().includes(String(data.search).toLowerCase())), after: '' }
    if (data.action === 'openSheet') result = { url: `https://example.invalid/file?ticket=${data.id}`, extension: data.id === 'reference-package' ? 'txt' : 'pdf' }
    return route.fulfill({ headers, json: { result } })
  })
  await page.route('**/sds-file?*', route => new URL(route.request().url()).searchParams.get('ticket') === 'reference-package' ? route.fulfill({ json: content }) : route.fulfill({ path: 'e2e/fixtures/sds-preview.pdf', contentType: 'application/pdf' }))
  await mockDashboard(page)
  await gotoPhase2App(page, '/company-library', createJobsFixture())
  await expect(page.getByRole('navigation', { name: 'Library categories' })).toHaveCount(0)
  await expect(page.locator('.library-collections')).toHaveCount(0)
  const tree = page.getByRole('navigation', { name: 'Folders', exact: true })
  for (const folder of folders) {
    await expect(tree.getByRole('button', { name: folder.name, exact: true })).toBeVisible()
    await expect(tree.getByRole('button', { name: folder.name + ' document', exact: true })).toBeVisible()
  }
  expect((await tree.getByRole('button', { name: 'Root folder', exact: true }).boundingBox())!.y - (await tree.boundingBox())!.y).toBeLessThan(15)
  await tree.getByRole('button', { name: 'Safety document', exact: true }).click()
  await expect(page.getByRole('img', { name: 'PDF page 1 of 2', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Upload document', exact: true })).toBeEnabled()
  const search = page.getByRole('searchbox', { name: 'Search files', exact: true })
  await search.fill('AHA document')
  await expect(tree.getByRole('button', { name: 'AHA document', exact: true })).toBeVisible()
  await search.fill('Synthetic')
  await expect(page.locator('.reference-row')).toHaveCount(4)
  for (const title of ['Synthetic safety reference', 'Synthetic SDS reference', 'Synthetic AHA reference']) await expect(page.locator('.reference-row').filter({ hasText: title })).toBeVisible()
  await search.fill('')
  for (const document of documents) await expect(tree.getByRole('button', { name: document.name, exact: true })).toBeVisible()
  expect(actions.filter(action => !['load', 'page', 'openSheet'].includes(action))).toEqual([])
})
