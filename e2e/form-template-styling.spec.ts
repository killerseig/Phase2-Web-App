import { expect, test } from './helpers/test'
import { setupFormServer } from './helpers/formFixture'
const signature = JSON.stringify({ strokes: [[[.1, .2], [.4, .7], [.8, .3]]], signedAt: 1793000000000 })
const definition = { title: 'Synthetic completed inspection', description: 'Saved inspection answers.', recipients: [], fields: [
  { id: 'job', kind: 'text' as const, label: 'Job name', required: false, options: [] },
  { id: 'signature', kind: 'signature' as const, label: 'Attendee signature', required: false, options: [] },
  { id: 'photos', kind: 'photo' as const, label: 'Inspection photos', required: false, options: [] },
] }
for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'phone', width: 390, height: 844 }]) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('completed entry uses the app template and retains PDF/photo recovery', async ({ page }) => {
      const actions: string[] = [], errors: string[] = []; let pdfAttempts = 0
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/formSubmissionViewer', async route => {
        const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
        const data = route.request().postDataJSON().data; actions.push(data.action)
        if (data.action === 'get') return route.fulfill({ headers, json: { result: { id: 'synthetic-entry', templateVersion: 2, submittedAt: 1793000000000, requireLogin: true,
          definition: { ...definition, version: 2, createdAt: '' }, answers: { job: 'Synthetic site', signature, photos: ['synthetic-photo-one', 'synthetic-photo-two'] } } } })
        if (data.action === 'pdf') { pdfAttempts++; return route.fulfill({ status: pdfAttempts === 1 ? 500 : 200, headers, json: pdfAttempts === 1 ? { error: { status: 'INTERNAL', message: 'internal' } } : { result: { base64: 'JVBERg==', contentType: 'application/pdf', filename: 'synthetic-entry.pdf' } } }) }
        if (data.action === 'photo') return route.fulfill({ headers, json: { result: { contentType: 'image/png', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfL8AAAAASUVORK5CYII=' } } })
        throw new Error('Unexpected viewer action')
      })
      await setupFormServer(page, { definition, initialPath: '/form-submissions/synthetic-entry' })
      await expect(page.getByRole('heading', { name: definition.title, exact: true })).toBeVisible()
      await expect(page.locator('.app-shell--branded-content')).toHaveCount(1)
      await expect(page.locator('.form-presentation')).toHaveCount(1)
      await expect(page.getByRole('img', { name: 'Attendee signature', exact: true }).locator('path')).toHaveCount(1)
      await expect(page.getByRole('button', { name: /Clear signature/ })).toHaveCount(0)
      const download = page.getByRole('button', { name: 'Download original PDF with photos', exact: true })
      await expect(download).toHaveClass(/app-button--primary/); await download.click()
      await expect(page.getByRole('alert')).toContainText('Your saved report and photos are unchanged')
      await expect(page.getByRole('article', { name: 'Submitted answers' })).toContainText('Synthetic site')
      const downloaded = page.waitForEvent('download'); await download.click(); expect((await downloaded).suggestedFilename()).toBe('synthetic-entry.pdf')
      await expect(page.getByRole('alert')).toHaveCount(0)
      await page.getByRole('button', { name: 'View Inspection photos 1', exact: true }).focus(); await page.keyboard.press('Enter')
      const dialog = page.getByRole('dialog', { name: 'Submission photo' }); await expect(dialog).toBeVisible()
      await expect(dialog.locator('img')).toHaveJSProperty('naturalWidth', 1)
      await expect(dialog.getByRole('button', { name: 'Close photo' })).toHaveClass(/app-button/)
      await dialog.getByRole('button', { name: 'Next photo' }).click(); await expect(dialog.getByRole('img')).toHaveAttribute('alt', 'Inspection photos 2')
      await page.keyboard.press('Escape'); await expect(dialog).toBeHidden()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      expect(actions.every(action => ['get', 'pdf', 'photo'].includes(action))).toBe(true); expect(errors).toEqual([])
      await page.getByRole('heading', { name: definition.title, exact: true }).scrollIntoViewIfNeeded()
      await page.screenshot({ path: 'evidence/completed-entry-' + viewport.name + '.png', fullPage: true })
    })

    test('completed entries keep shared buttons, export actions and contained mobile scrolling', async ({ page }) => {
      const calls: string[] = []
      await page.route('**/sdsWorkspace', route => route.fulfill({ json: { result: { sheets: [], after: '', scanned: 0 } }, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } }))
      await page.route('**/formEntries', async route => {
        const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
        const action = route.request().postDataJSON().data.action; calls.push(action)
        if (action === 'list') return route.fulfill({ headers, json: { result: { entries: [{ id: 'synthetic-entry', title: definition.title, templateVersion: 2, submittedAt: 1793000000000, jobId: 'Synthetic site' }], nextCursor: null, snapshotBefore: 1793000000001 } } })
        if (action === 'export-all') return route.fulfill({ headers, json: { result: { base64: 'Y29sdW1uCg==', contentType: 'text/csv', filename: 'synthetic-entries.csv' } } })
        throw new Error('Unexpected entry action')
      })
      await setupFormServer(page, { definition, initialPath: '/admin/forms' })
      await page.locator('.form-selector .library-target').filter({ hasText: definition.title }).click()
      await page.getByRole('button', { name: 'View Entries', exact: true }).click()
      const entries = page.getByRole('region', { name: 'View Entries', exact: true })
      await expect(entries.getByRole('link', { name: definition.title, exact: false })).toBeVisible()
      await expect(entries.getByRole('button', { name: 'Refresh', exact: true })).toHaveClass(/app-button/)
      const downloaded = page.waitForEvent('download'); await entries.getByRole('button', { name: 'Export all entries to CSV', exact: true }).click(); expect((await downloaded).suggestedFilename()).toBe('synthetic-entries.csv')
      const table = page.getByRole('region', { name: 'Completed entries', exact: true }); await expect(table).toBeVisible()
      await table.focus(); await expect(table).toBeFocused()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      expect(calls).toEqual(['list', 'export-all'])
      await page.screenshot({ path: 'evidence/completed-entries-' + viewport.name + '.png', fullPage: true })
    })

    test('inspection directory uses shared search and bounded theme-aware rows without starting a record', async ({ page }) => {
      await page.route('**/sdsWorkspace', route => route.fulfill({ json: { result: { sheets: [], after: '', scanned: 0 } }, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } }))
      const context = await setupFormServer(page, { definition, initialPath: '/reports' })
      await expect(page.getByRole('heading', { name: 'Site Inspection Forms', exact: true })).toBeVisible()
      const list = page.getByRole('list', { name: 'Available inspection forms' }); await expect(list.getByRole('link')).toHaveClass(/app-link-card/)
      const search = page.getByRole('searchbox', { name: 'Search reports' }); await expect(search).toHaveClass(/app-search-input/)
      await search.fill('no matching result'); await expect(page.getByText('No published reports match your search and access.', { exact: false })).toBeVisible()
      await search.fill(''); await expect(list).toBeVisible(); expect(context.created).toBe(0); expect(context.submitted).toBe(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: 'evidence/inspection-directory-' + viewport.name + '.png', fullPage: true })
    })
  })
}
