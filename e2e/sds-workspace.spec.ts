import { expect, test, type Page } from './helpers/test.js'
import { mockDashboard } from './helpers/dashboardFixture.js'
import {
  createJobDashboardFixture,
  createJobsFixture,
  gotoPhase2App,
} from './helpers/phase2AppFixture.js'

async function mockSds(page: Page, fail = false) {
  await mockDashboard(page)
  await page.route('**/sds-file?*', (route) =>
    route.fulfill({
      path: 'e2e/fixtures/sds-preview.pdf',
      contentType: 'application/pdf',
    }),
  )
  let selections = [{ documentId: 'sheet-a', revisionId: 'rev-a' }]
  let version = 1
  let exports = 0
  const actions: string[] = []
  const requests: Record<string, unknown>[] = []
  await page.route('**/sdsWorkspace', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      })
      return
    }
    const data = route.request().postDataJSON().data
    actions.push(data.action)
    requests.push(data)
    let result: unknown = { ok: true }
    if (fail && data.action === 'load') {
      await route.fulfill({
        json: { error: { status: 'UNAVAILABLE', message: 'SDS service temporarily unavailable.' } },
        status: 503,
        headers: { 'access-control-allow-origin': '*' },
      })
      return
    }
    if (data.action === 'load')
      result = {
        version: 3,
        folders: [
          { id: 'materials', parentId: '', name: 'Materials', order: 1 },
          { id: 'adhesives', parentId: 'materials', name: 'Adhesives', order: 1 },
          { id: 'paints', parentId: '', name: 'Paints', order: 2 },
        ],
        sheets: [
          {
            id: 'sheet-a',
            name: 'Adhesive A',
            manufacturer: 'Example A',
            language: 'English',
            productCode: 'A-01',
            folderId: 'adhesives',
            revisionId: 'rev-a',
            revisionDate: '2026-09-01',
            order: 1,
            archived: false,
          },
          {
            id: 'sheet-b',
            name: 'Paint B',
            manufacturer: 'Example B',
            language: 'English',
            productCode: 'B-02',
            folderId: 'paints',
            revisionId: 'rev-b',
            revisionDate: '2026-09-02',
            order: 1,
            archived: false,
          },
        ],
        binder: { version, selections: data.jobId ? selections : [] },
      }
    if (data.action === 'saveSelection') {
      selections = data.selections
      version++
    }
    if (data.action === 'requestExport') {
      exports++
      result = { id: data.requestId }
    }
    if (data.action === 'exportStatus')
      result = { status: 'complete', pageCount: 7, url: 'https://example.invalid/sds-book.pdf' }
    if (data.action === 'openSheet')
      result = {
        url: `https://us-central1-phase2-website.cloudfunctions.net/downloadSdsFile?ticket=${data.id}`,
      }
    if (data.action === 'listResources')
      result = {
        resources: [
          {
            id: 'field-guide',
            title: 'Field guide',
            description: 'Shared field instructions.',
            url: '/safety/sds',
          },
        ],
      }
    await route.fulfill({ json: { result }, headers: { 'access-control-allow-origin': '*' } })
  })
  return { actions, requests, exports: () => exports }
}

test('personal SDS module saves only deliberate job selections and exports the saved book', async ({
  page,
}) => {
  const api = await mockSds(page)
  await gotoPhase2App(page, '/dashboards/personal?sdsJob=job-e2e', createJobDashboardFixture())
  await expect(page.getByTestId('sds-module')).toBeVisible()
  await expect(page.getByLabel('Collection or job', { exact: true })).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Current folder actions', exact: true }),
  ).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Paints', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Current folder actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Edit job selection', exact: true }).click()
  await page.getByRole('searchbox').fill('Paint')
  await page.getByRole('checkbox', { name: 'Include Paint B' }).check()
  await expect(page.getByText('2 files selected · Unsaved changes')).toBeVisible()
  await page.getByRole('button', { name: 'Current folder actions', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Make PDF / print book' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByText('No matching files. Try another search.')).toBeVisible()
  await page.getByRole('button', { name: 'Current folder actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Edit job selection', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Include Paint B' }).check()
  await page.getByRole('button', { name: 'Save selection' }).click()
  await expect(page.getByText('Job file selection saved.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Paint B', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Current folder actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Make PDF / print book' }).click()
  await expect(page.getByRole('button', { name: 'Download PDF', exact: true })).toBeVisible()
  expect(api.exports()).toBe(1)
  expect(api.actions.filter((a) => a === 'saveSelection')).toHaveLength(1)
  await page.getByRole('link', { name: 'Expand explorer' }).click()
  await expect(page.getByRole('searchbox')).toHaveValue('Paint')
  await expect(page).toHaveURL(/sdsJob=job-e2e/)
  await expect(page.getByRole('button', { name: 'Add file here', exact: true })).toHaveCount(0)
  await page.screenshot({ path: '.security-work/sds-desktop.png', fullPage: true })
  await page.goBack()
  await expect(page.getByRole('searchbox')).toHaveValue('Paint')
  await expect(page).toHaveURL(/sdsJob=job-e2e/)
})

test('role workspace uses the compact document widget and Admin can manage the master', async ({
  page,
}) => {
  await mockSds(page)
  await gotoPhase2App(page, '/dashboards/role', createJobsFixture())
  await expect(page.getByRole('main').getByRole('heading')).toHaveText(['Documents'])
  await expect(page.getByRole('region', { name: 'Role tools' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add resource', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Current folder actions', exact: true }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('menuitem', { name: 'Add file here', exact: true }).click()
  await (await chooser).setFiles([])
  await expect(page.getByLabel('File name', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Add file', { exact: true })).toHaveAttribute(
    'accept',
    '.pdf,.jpg,.jpeg,.png,.webp,.txt,.csv,.docx,.xlsx',
  )
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0)
})

test('failed SDS module leaves existing Jobs navigation and dashboard unchanged', async ({
  page,
}) => {
  await mockSds(page, true)
  await gotoPhase2App(page, '/dashboards/personal', createJobDashboardFixture())
  await expect(page.getByRole('alert')).toContainText('The document service could not be reached')
  await expect(page.getByText('No files in this collection.', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add file here', exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Jobs', exact: true }).click()
  await expect(page).toHaveURL(/\/jobs$/)
  await page.goto('/jobs/job-e2e')
  await expect(page.getByTestId('job-dashboard-module-timecards')).toBeVisible()
  await expect(page.getByTestId('job-dashboard-module-daily-logs')).toBeVisible()
  await expect(page.getByTestId('job-dashboard-module-shop-orders')).toBeVisible()
  await expect(page.getByTestId('sds-module')).toHaveCount(0)
})

test('SDS explorer works on a narrow phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockSds(page)
  await gotoPhase2App(page, '/safety/sds', createJobDashboardFixture())
  await page.getByRole('searchbox').fill('Adhesive')
  await page.getByRole('button', { name: 'Adhesive A', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Open PDF', exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: 'PDF page 1 of 2', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Actions for Adhesive A', exact: true }).click()
  const menu = page.getByRole('menu', { name: 'Adhesive A', exact: true })
  await expect(menu).toBeVisible()
  const bounds = await menu.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({ path: '.security-work/sds-mobile.png', fullPage: true })
})

test('split widget renders PDF pages, zooms, collapses folders and recovers a failed file request', async ({
  page,
}) => {
  const api = await mockSds(page)
  await gotoPhase2App(page, '/dashboards/personal', createJobDashboardFixture())
  const folders = page.getByRole('navigation', { name: 'Folders', exact: true })
  await folders.getByRole('button', { name: 'Materials', exact: true }).click()
  await expect(folders.getByRole('button', { name: 'Adhesive A', exact: true })).toHaveCount(0)
  await folders.getByRole('button', { name: 'Materials', exact: true }).click()
  await folders.getByRole('button', { name: 'Adhesive A', exact: true }).click()
  const first = page.getByRole('img', { name: 'PDF page 1 of 2', exact: true })
  await expect(first).toBeVisible()
  expect(
    await first.evaluate((canvas: HTMLCanvasElement) => {
      const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
      return pixels.some((value, index) => index % 4 !== 3 && value < 100)
    }),
  ).toBe(true)
  const body = page.locator('.document-explorer__body')
  expect((await body.boundingBox())!.height).toBeLessThanOrEqual(441)
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  const second = page.getByRole('img', { name: 'PDF page 2 of 2', exact: true })
  await expect(second).toBeVisible()
  const size = (await second.boundingBox())!.width
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect.poll(async () => (await second.boundingBox())?.width ?? 0).toBeGreaterThan(size)
  await page.getByRole('button', { name: 'Fit page width', exact: true }).click()
  await expect.poll(async () => (await second.boundingBox())?.width ?? 0).toBeCloseTo(size, 0)
  await page.getByTestId('sds-module').screenshot({ path: '.security-work/sds-split-desktop.png' })
  await page.route('**/sds-file?*', (route) =>
    route.fulfill({ status: 403, body: 'Expired ticket' }),
  )
  await page.getByRole('button', { name: 'Reload preview', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('The PDF could not be loaded')
  await page.route('**/sds-file?*', (route) =>
    route.fulfill({ path: 'e2e/fixtures/sds-preview.pdf', contentType: 'application/pdf' }),
  )
  await page.getByRole('button', { name: 'Reload preview', exact: true }).click()
  await expect(first).toBeVisible()
  expect(api.actions).not.toContain('saveSelection')
})

test('Admin context menus target the clicked folder and sheet and preserve canceled drafts', async ({
  page,
}) => {
  const api = await mockSds(page)
  await gotoPhase2App(page, '/safety/sds', createJobsFixture())
  const tree = page.getByRole('navigation', { name: 'Folders', exact: true })
  await tree.getByRole('button', { name: 'Adhesives', exact: true }).click({ button: 'right' })
  await expect(page.getByRole('menu', { name: 'Adhesives', exact: true })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Remove empty folder' })).toBeDisabled()
  await page.getByRole('menuitem', { name: 'New folder', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Folder', exact: true })).toHaveValue('adhesives')
  await page.getByLabel('Folder name', { exact: true }).fill('New child')
  await tree.getByRole('button', { name: 'Paints', exact: true }).click({ button: 'right' })
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('menuitem', { name: 'New folder', exact: true }).click()
  await expect(page.getByLabel('Folder name', { exact: true })).toHaveValue('New child')
  await expect(page.getByRole('combobox', { name: 'Folder', exact: true })).toHaveValue('adhesives')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('searchbox').fill('Paint')
  await page.getByRole('button', { name: 'Paint B', exact: true }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Rename / move / edit file' }).click()
  await expect(page.getByLabel('File name', { exact: true })).toHaveValue('Paint B')
  await page.getByLabel('File name', { exact: true }).fill('Paint renamed')
  await page.getByRole('combobox', { name: 'Folder', exact: true }).selectOption('materials')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Company documents updated.', { exact: true })).toBeVisible()
  expect(api.requests.find((request) => request.action === 'saveSheet')).toMatchObject({
    id: 'sheet-b',
    name: 'Paint renamed',
    folderId: 'materials',
  })
  await page.getByRole('button', { name: 'Paint B', exact: true }).click({ button: 'right' })
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('menuitem', { name: 'Archive file', exact: true }).click()
  await expect(page.getByText('File archived.', { exact: true })).toBeVisible()
  expect(api.requests.filter((request) => request.action === 'saveSheet').at(-1)).toMatchObject({
    id: 'sheet-b',
    archived: true,
  })
})

test('keyboard and background menus dismiss cleanly and job actions remain explicit drafts', async ({
  page,
}) => {
  const api = await mockSds(page)
  await gotoPhase2App(page, '/safety/sds', createJobDashboardFixture())
  const root = page
    .getByRole('navigation', { name: 'Folders', exact: true })
    .getByRole('button', { name: 'Root folder', exact: true })
  await expect(root).toBeEnabled()
  await root.focus()
  await root.press('Shift+F10')
  await expect(page.getByRole('menu')).toBeVisible()
  await page.keyboard.press('End')
  await expect(page.getByRole('menuitem', { name: 'Refresh', exact: true })).toBeFocused()
  await page.keyboard.press('Home')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(root).toBeFocused()
  await page
    .locator('.document-explorer__folders')
    .click({ button: 'right', position: { x: 8, y: 8 } })
  await expect(page.getByRole('menu', { name: 'Root folder', exact: true })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'New folder', exact: true })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Add file here', exact: true })).toHaveCount(0)
  await page.getByRole('searchbox').click()
  await expect(page.getByRole('menu')).toHaveCount(0)
  await page.goto('/safety/sds?sdsJob=job-e2e')
  await page.getByRole('searchbox').fill('Adhesive')
  await page.getByRole('button', { name: 'Adhesive A', exact: true }).click({ button: 'right' })
  await expect(page.getByRole('menuitem', { name: 'Archive file' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Rename / move / edit file' })).toHaveCount(0)
  await page.getByRole('menuitem', { name: 'Uncheck for job book' }).click()
  await expect(page.getByRole('checkbox', { name: 'Include Adhesive A' })).not.toBeChecked()
  expect(api.actions).not.toContain('saveSelection')
  await page.getByRole('button', { name: 'Save selection', exact: true }).click()
  await expect(page.getByText('Job file selection saved.', { exact: true })).toBeVisible()
  expect(api.requests.find((request) => request.action === 'saveSelection')).toMatchObject({
    jobId: 'job-e2e',
    selections: [],
  })
})
