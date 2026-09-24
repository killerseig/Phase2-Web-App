import { expect, test } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

test('previews images, text, CSV, Word and Excel locally and explicitly excludes nonprintable files from books', async ({
  page,
}) => {
  const formats = [
    { id: 'photo', name: 'Site photo', extension: 'png', fixture: 'site.png', mime: 'image/png' },
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
    if (data.action === 'load')
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
  await gotoPhase2App(page, '/dashboards/personal', createJobsFixture())
  await page.getByRole('button', { name: 'Site photo', exact: true }).click()
  const photo = page.getByRole('img', { name: 'Site photo', exact: true })
  await expect(photo).toBeVisible()
  expect(await photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(400)
  await page.getByRole('button', { name: 'Text notes', exact: true }).click()
  await expect(page.locator('pre')).toContainText('Review delivery schedule.')
  await expect(page.locator('pre')).toContainText('<script>window.previewInjected=true</script>')
  await page.getByRole('button', { name: 'Materials CSV', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'First floor, west', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Word notes', exact: true }).click()
  await expect(page.locator('pre')).toContainText('Review the delivery schedule.')
  await expect(page.locator('pre')).toContainText('<script>window.previewInjected=true</script>')
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
