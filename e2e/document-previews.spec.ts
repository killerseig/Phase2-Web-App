import { expect, test, type Page } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { mockDashboard } from './helpers/dashboardFixture.js'
import { sampleContent } from '../src/features/intranet/__tests__/fixtures.js'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'

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
  const downloads: Record<string, number> = {}, authorizations: string[] = []
  await page.route('**/sds-file?*', route => {
    const id = new URL(route.request().url()).searchParams.get('ticket')!.split('_')[0]
    const file = files.find(file => file.id === id)!
    downloads[id!] = (downloads[id!] || 0) + 1
    return route.fulfill({ path: `e2e/fixtures/${file.fixture}`, contentType: 'application/pdf' })
  })
  await page.route('**/sdsWorkspace', async route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const data = route.request().postDataJSON().data
    if (data.action === 'openSheet') authorizations.push(data.id)
    const result = data.action === 'openSheet' ? { url: `https://example.invalid/file?ticket=${data.id}_${authorizations.length}`, extension: 'pdf', revisionId: 'r1' } : {
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
  expect(authorizations).toEqual(['book', 'short', 'book'])
  expect(downloads.book).toBe(1)
  expect(await page.locator('.pdf-surface canvas').count()).toBeLessThanOrEqual(6)
  await openMobileNavigation(page, width)
  await page.getByRole('link', { name: 'Jobs', exact: true }).first().click()
  await expect.poll(stats).toEqual({ started: 1, terminated: 1 })
  await page.goBack()
  await page.getByRole('button', { name: 'Long SDS book', exact: true }).click()
  await expect(page.getByRole('img', { name: 'PDF page 1 of 387', exact: true })).toBeVisible()
  expect(await stats()).toEqual({ started: 2, terminated: 1 })
  expect(downloads.book).toBe(2)
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

test('cached Word and image previews reauthorize, invalidate revisions and discard denied bytes', async ({ page }) => {
  let revision = 'r1', allowed = true, wordDownloads = 0, wordAuthorizations = 0
  const files = [{ id: 'word', name: 'Revisioned Word', extension: 'docx' }, { id: 'photo', name: 'Revisioned photo', extension: 'png' }]
  await page.route('**/sds-file?*', route => {
    const word = new URL(route.request().url()).searchParams.get('ticket')!.startsWith('word')
    if (word) wordDownloads++
    return route.fulfill({ path: word ? 'e2e/fixtures/docx-pages.docx' : 'e2e/fixtures/site.png', contentType: word ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'image/png' })
  })
  await page.route('**/sdsWorkspace', async route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const data = route.request().postDataJSON().data
    if (data.action === 'openSheet' && !allowed) return route.fulfill({ status: 403, headers, json: { error: { status: 'PERMISSION_DENIED', message: 'Your access has changed.' } } })
    if (data.action === 'openSheet' && data.id === 'word') wordAuthorizations++
    return route.fulfill({ headers, json: { result: data.action === 'openSheet' ? { url: `https://example.invalid/file?ticket=${data.id}_${wordAuthorizations}`, extension: files.find(file => file.id === data.id)!.extension, revisionId: revision } : {
      version: 1, folders: [], binder: { version: 0, selections: [] }, after: '', sheets: files.map(file => ({ ...file, folderId: '', revisionId: revision, archived: false })),
    } } })
  })
  await mockDashboard(page); await gotoPhase2App(page, '/company-library', createJobsFixture())
  const word = page.frameLocator('iframe.docx-pages')
  const openWord = async () => {
    await page.getByRole('button', { name: 'Revisioned Word', exact: true }).click()
    await expect(word.getByRole('region', { name: 'Document page 2 of 2' })).toContainText('Second page heading')
  }
  const openPhoto = async () => {
    await page.getByRole('button', { name: 'Revisioned photo', exact: true }).click()
    await expect(page.getByRole('img', { name: 'Revisioned photo' })).toBeVisible()
  }
  await openWord(); await openPhoto(); await openWord()
  expect(wordAuthorizations).toBe(2); expect(wordDownloads).toBe(1)
  await page.getByRole('button', { name: 'Reload preview', exact: true }).click()
  await expect(word.getByRole('region', { name: 'Document page 2 of 2' })).toBeVisible()
  expect(wordDownloads).toBe(2)
  revision = 'r2'; await openPhoto(); await openWord()
  expect(wordDownloads).toBe(3)
  allowed = false
  await page.getByRole('button', { name: 'Reload preview', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('access has changed')
  await expect(page.locator('iframe.docx-pages')).toHaveCount(0)
  expect(wordDownloads).toBe(3)
  allowed = true
  await page.getByRole('button', { name: 'Reload preview', exact: true }).click()
  await expect(word.getByRole('region', { name: 'Document page 2 of 2' })).toBeVisible()
  expect(wordDownloads).toBe(4)
})

test('large PDFs use bounded authenticated ranges and retain full-download fallback', async ({ page }) => {
  const requireFunctions = createRequire(new URL('../functions/package.json', import.meta.url))
  const { PDFDocument, PDFName } = requireFunctions('pdf-lib')
  const { byteRange } = requireFunctions('./httpByteRange.js')
  const document = await PDFDocument.load(readFileSync('e2e/fixtures/sds-book-387.pdf'))
  // A valid unused embedded stream represents bytes not needed for page one.
  const padding = document.context.register(document.context.stream(new Uint8Array(4 * 1024 * 1024).fill(46)))
  document.catalog.set(PDFName.of('SyntheticLaterContent'), padding)
  const large = Buffer.from(await document.save({ useObjectStreams: false }))
  const small = readFileSync('e2e/fixtures/sds-preview.pdf')
  const transferred: Record<string, number> = {}, ranges: string[] = []
  const server = createServer((request, response) => {
    const id = new URL(request.url!, 'http://localhost').searchParams.get('ticket')!
    const bytes = id === 'warmup' ? small : large
    const part = byteRange(id === 'partial' ? request.headers.range : undefined, bytes.length)
    response.setHeader('Content-Type', 'application/pdf')
    response.setHeader('Cache-Control', 'private, no-store')
    response.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5196')
    response.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range')
    if (id === 'partial') response.setHeader('Accept-Ranges', 'bytes')
    response.statusCode = part.status
    response.setHeader('Content-Length', part.length)
    if (part.status === 206) { response.setHeader('Content-Range', `bytes ${part.start}-${part.end}/${bytes.length}`); ranges.push(request.headers.range!) }
    let position = part.start
    const send = () => {
      if (response.destroyed) return
      const end = Math.min(position + 64 * 1024, part.end + 1)
      response.write(bytes.subarray(position, end))
      transferred[id] = (transferred[id] || 0) + end - position; position = end
      if (position > part.end) response.end()
      else setTimeout(send, 5)
    }
    send()
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  try {
    await page.route('**/sds-file?*', route => route.continue({ url: `http://127.0.0.1:${address.port}/?${new URL(route.request().url()).searchParams}` }))
    await page.route('**/sdsWorkspace', async route => {
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
      const data = route.request().postDataJSON().data
      return route.fulfill({ headers, json: { result: data.action === 'openSheet' ? { url: `https://example.invalid/file?ticket=${data.id}`, extension: 'pdf' } : {
        version: 1, folders: [], binder: { version: 0, selections: [] }, after: '', sheets: ['warmup', 'full', 'partial'].map(id => ({ id, name: id, extension: 'pdf', folderId: '', revisionId: 'r1', archived: false })),
      } } })
    })
    await mockDashboard(page); await gotoPhase2App(page, '/company-library', createJobsFixture())
    await page.getByRole('button', { name: 'warmup', exact: true }).click()
    await expect(page.getByRole('img', { name: 'PDF page 1 of 2', exact: true })).toBeVisible()
    const timings: Record<string, number> = {}
    for (const id of ['full', 'partial']) {
      const start = performance.now()
      await page.getByRole('button', { name: id, exact: true }).click()
      await expect(page.getByRole('img', { name: 'PDF page 1 of 387', exact: true })).toBeVisible()
      timings[id] = Math.round(performance.now() - start)
    }
    expect(ranges.length).toBeGreaterThan(0)
    expect(transferred.partial!).toBeLessThan(large.length / 2)
    expect(transferred.full).toBe(large.length)
    expect(await page.locator('.pdf-surface canvas').count()).toBeLessThanOrEqual(6)
    test.info().annotations.push({ type: 'synthetic-range-measurement', description: JSON.stringify({ fileBytes: large.length, transferredAtFirstPage: { ...transferred }, timingsMs: timings, conditions: '64KiB chunks every 5ms, warmed worker, local fixture; not production latency' }) })
    const number = page.getByRole('spinbutton', { name: 'PDF page', exact: true })
    await number.fill('387'); await number.press('Tab')
    await expect(page.getByRole('img', { name: 'PDF page 387 of 387', exact: true })).toBeVisible()
  } finally {
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})

for (const outcome of ['renew', 'denied', 'switch', 'logout', 'changed']) test(`expired PDF ranges ${outcome} without stale state or authorization loops`, async ({ page }) => {
  const requireFunctions = createRequire(new URL('../functions/package.json', import.meta.url))
  const { PDFDocument } = requireFunctions('pdf-lib'), { byteRange } = requireFunctions('./httpByteRange.js')
  const document = await PDFDocument.load(readFileSync('e2e/fixtures/sds-book-387.pdf'))
  const padding = document.context.register(document.context.stream(new Uint8Array(3 * 1024 * 1024).fill(32)))
  document.getPage(386).node.addContentStream(padding)
  const large = Buffer.from(await document.save({ useObjectStreams: false })), small = readFileSync('e2e/fixtures/sds-preview.pdf')
  let expired = false, longAuthorizations = 0, renewedDownloads = 0
  let releaseRenewal!: () => void
  const renewalGate = new Promise<void>(resolve => { releaseRenewal = resolve })
  await page.route('**/sds-file?*', route => {
    const ticket = new URL(route.request().url()).searchParams.get('ticket')!
    if (expired && ticket === 'long_1') return route.fulfill({ status: 403, headers: { 'X-Document-Error': 'ticket-expired' }, body: 'Expired' })
    if (ticket === 'long_2') renewedDownloads++
    const bytes = ticket.startsWith('long') ? large : small
    const range = byteRange(route.request().headers().range, bytes.length)
    return route.fulfill({ status: range.status, headers: { 'Content-Type': 'application/pdf', 'Content-Length': String(range.length), 'Accept-Ranges': 'bytes', ...(range.status === 206 ? { 'Content-Range': `bytes ${range.start}-${range.end}/${bytes.length}` } : {}) }, body: bytes.subarray(range.start, range.end + 1) })
  })
  await page.route('**/sdsWorkspace', async route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const data = route.request().postDataJSON().data
    if (data.action === 'openSheet' && data.id === 'long') {
      longAuthorizations++
      if (longAuthorizations > 1) {
        await renewalGate
        if (outcome === 'denied') return route.fulfill({ status: 403, headers, json: { error: { status: 'PERMISSION_DENIED', message: 'Your access was revoked.' } } })
      }
    }
    return route.fulfill({ headers, json: { result: data.action === 'openSheet' ? { url: `https://example.invalid/file?ticket=${data.id}_${longAuthorizations}`, extension: 'pdf', revisionId: outcome === 'changed' && longAuthorizations > 1 ? 'r2' : 'r1' } : {
      version: 1, folders: [], binder: { version: 0, selections: [] }, after: '', sheets: ['long', 'short'].map(id => ({ id, name: id, extension: 'pdf', folderId: '', revisionId: 'r1', archived: false })),
    } } })
  })
  await mockDashboard(page); await gotoPhase2App(page, '/company-library', createJobsFixture())
  await page.getByRole('button', { name: 'long', exact: true }).click()
  await expect(page.getByRole('img', { name: 'PDF page 1 of 387', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  expired = true
  const number = page.getByRole('spinbutton', { name: 'PDF page', exact: true }), surface = page.getByRole('region', { name: 'PDF pages', exact: true })
  await number.fill('387'); await number.press('Tab')
  await expect.poll(() => longAuthorizations).toBe(2)
  await expect(page.getByText('Renewing document access…', { exact: true })).toBeVisible()
  const position = await surface.evaluate(element => element.scrollTop)
  const width = await page.locator('[data-pdf-page="387"]').evaluate(element => element.getBoundingClientRect().width)
  const finish = {
    renew: async () => {
      const start = performance.now(); releaseRenewal()
      await expect(page.getByRole('img', { name: 'PDF page 387 of 387', exact: true })).toBeVisible()
      await expect(number).toHaveValue('387')
      expect(await surface.evaluate(element => element.scrollTop)).toBeCloseTo(position, 0)
      expect(await page.locator('[data-pdf-page="387"]').evaluate(element => element.getBoundingClientRect().width)).toBeCloseTo(width, 0)
      expect(longAuthorizations).toBe(2); expect(renewedDownloads).toBeGreaterThan(0)
      expect(await page.locator('.pdf-surface canvas').count()).toBeLessThanOrEqual(6)
      test.info().annotations.push({ type: 'synthetic-renewal', description: JSON.stringify({ renewalToPageMs: Math.round(performance.now() - start), page: 387, zoomPreserved: true, scrollPreserved: true, authorizations: longAuthorizations }) })
    },
    denied: async () => { releaseRenewal(); await expect(page.getByRole('alert')).toContainText('revoked'); expect(longAuthorizations).toBe(2); expect(renewedDownloads).toBe(0); await expect(page.locator('.pdf-surface canvas')).toHaveCount(0) },
    changed: async () => { releaseRenewal(); await expect(page.getByRole('alert')).toContainText('version changed'); expect(longAuthorizations).toBe(2); expect(renewedDownloads).toBe(0) },
    switch: async () => {
      await page.getByRole('button', { name: 'short', exact: true }).click()
      await expect(page.getByRole('img', { name: 'PDF page 1 of 2', exact: true })).toBeVisible()
      releaseRenewal()
      await expect(page.getByRole('img', { name: 'PDF page 387 of 387', exact: true })).toHaveCount(0)
      expect(renewedDownloads).toBe(0)
    },
    logout: async () => {
      await page.getByRole('button', { name: 'Sign Out', exact: true }).click()
      await expect(page).toHaveURL(/\/login$/); releaseRenewal()
      expect(renewedDownloads).toBe(0)
    },
  }
  await finish[outcome as keyof typeof finish]()
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
