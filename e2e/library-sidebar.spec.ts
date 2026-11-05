import { expect, test, type Page } from './helpers/test'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture'
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
async function setup(page: Page, role: 'admin' | 'foreman') {
  const writes: string[] = []
  await page.route('**/sdsWorkspace', async route => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return }
    const data = route.request().postDataJSON().data
    if (!['load', 'page', 'openSheet'].includes(data.action)) writes.push(data.action)
    if (data.action === 'openSheet') { await route.fulfill({ headers, status: 403, json: { error: { status: 'PERMISSION_DENIED', message: 'Synthetic preview not requested' } } }); return }
    const folders = [{ id: 'parent', name: 'Project files', parentId: '', order: 0 }, { id: 'child', name: 'Inspection photos', parentId: 'parent', order: 0 }]
    const sheet = { id: 'doc-1', name: 'Synthetic safety plan', originalName: 'synthetic.pdf', folderId: 'child', extension: 'pdf', revisionId: 'r1', archived: false, order: 0, manufacturer: '', productCode: '', language: 'English' }
    const result = data.action === 'load' ? { version: 1, folders, sheets: [], binder: { version: 0, selections: [] } }
      : data.search === 'Phase2 intranet content' ? { sheets: [], after: '', scanned: 0 }
      : { sheets: [sheet], after: 'next-page', scanned: 1 }
    await route.fulfill({ headers, json: { result } })
  })
  const fixture = createJobsFixture(); fixture.auth.profile.role = role
  await gotoPhase2App(page, '/company-library', fixture)
  await expect(page.getByRole('region', { name: 'Company Library widget', exact: true })).toHaveAttribute('aria-busy', 'false')
  return writes
}
for (const width of [390, 1440]) {
  test.describe(width + 'px', () => {
    test.use({ viewport: { width, height: 900 }, hasTouch: width === 390 })

    test('sidebar search and contextual admin actions preserve destinations without uploads', async ({ page }) => {
      const writes = await setup(page, 'admin')
      await expect(page.locator('.document-explorer__header')).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Upload document', exact: true })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'New folder', exact: true })).toHaveCount(0)
      const sidebar = page.getByRole('region', { name: 'Library sidebar', exact: true })
      const search = sidebar.getByRole('searchbox', { name: 'Search files' }), root = sidebar.getByRole('button', { name: 'Root folder', exact: true })
      const searchBox = await search.boundingBox(), rootBox = await root.boundingBox()
      expect(searchBox!.y + searchBox!.height).toBeLessThanOrEqual(rootBox!.y)
      await root.click({ button: 'right' })
      await expect(page.getByRole('menuitem', { name: 'Upload document here', exact: true })).toBeVisible()
      await expect(page.getByRole('menuitem', { name: 'New folder', exact: true })).toBeVisible()
      await expect(page.getByRole('menuitem', { name: 'Bulk PDF import', exact: true })).toBeVisible()
      await expect(page.getByRole('menuitem', { name: 'Load more files', exact: true })).toBeVisible()
      await page.keyboard.press('Escape'); await expect(root).toBeFocused()
      const childActions = page.getByRole('button', { name: 'Actions for Inspection photos', exact: true })
      const touch = await childActions.boundingBox()
      expect(touch!.width).toBeGreaterThanOrEqual(32); expect(touch!.height).toBeGreaterThanOrEqual(32)
      await page.screenshot({ path: 'evidence/library-sidebar-' + width + '.png' })
      await childActions.click()
      await expect(page.getByRole('menu', { name: 'Inspection photos', exact: true })).toBeVisible()
      const waiting = page.waitForEvent('filechooser')
      await page.getByRole('menuitem', { name: 'Upload document here', exact: true }).click()
      const chooser = await waiting
      await chooser.setFiles([])
      expect(await chooser.element().evaluate(input => (input as HTMLInputElement).files!.length)).toBe(0)
      await page.getByRole('button', { name: 'Actions for Synthetic safety plan', exact: true }).click()
      await expect(page.getByRole('menuitem', { name: 'Upload new version', exact: true })).toBeVisible()
      await expect(page.getByRole('menuitem', { name: 'Download file', exact: true })).toBeVisible()
      await page.keyboard.press('Escape')
      await root.press('Shift+F10')
      await expect(page.getByRole('menu', { name: 'Root folder', exact: true })).toBeVisible()
      await page.keyboard.press('Escape'); await expect(root).toBeFocused()
      await childActions.click()
      await page.getByRole('menuitem', { name: 'New folder', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Add folder', exact: true })).toBeVisible()
      await expect(page.getByRole('combobox', { name: 'Folder', exact: true })).toHaveValue('child')
      expect(writes).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    })

    test('readers retain view and pagination actions without receiving admin actions', async ({ page }) => {
      const writes = await setup(page, 'foreman')
      const root = page.getByRole('button', { name: 'Root folder actions', exact: true })
      await root.click()
      await expect(page.getByRole('menuitem', { name: 'Load more files', exact: true })).toBeVisible()
      await expect(page.getByRole('menuitem', { name: 'Upload document here', exact: true })).toHaveCount(0)
      await expect(page.getByRole('menuitem', { name: 'New folder', exact: true })).toHaveCount(0)
      await expect(page.getByRole('menuitem', { name: 'Bulk PDF import', exact: true })).toHaveCount(0)
      await page.keyboard.press('Escape'); await expect(root).toBeFocused()
      await page.getByRole('button', { name: 'Actions for Synthetic safety plan', exact: true }).click()
      await expect(page.getByRole('menuitem', { name: 'Open PDF', exact: true })).toBeVisible()
      await expect(page.getByRole('menuitem', { name: 'Download file', exact: true })).toBeVisible()
      await expect(page.getByRole('menuitem', { name: 'Upload new version', exact: true })).toHaveCount(0)
      await expect(page.getByRole('menuitem', { name: 'Rename / move / edit file', exact: true })).toHaveCount(0)
      await page.keyboard.press('Escape')
      expect(writes).toEqual([])
    })
  })
}
