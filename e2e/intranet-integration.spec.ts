import { expect, test, type Page } from './helpers/test.js'
import { createJobsFixture, createJobDashboardFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { sampleContent } from '../src/features/intranet/__tests__/fixtures.js'
import { readFileSync } from 'node:fs'
import type { IntranetContent } from '../src/features/intranet/content.js'
const actualPath = process.env.PHASE2_INTRANET_CONTENT_FILE
const content: IntranetContent = actualPath ? JSON.parse(readFileSync(actualPath, 'utf8')) : {
  ...sampleContent(), resources: [...sampleContent().resources, ...Array.from({ length: 26 }, (_, index) => ({
    id: 'sds-' + index, title: 'Synthetic SDS ' + index, category: 'SDS' as const, kind: 'SDS', keywords: '', filename: '',
  }))],
  forms: [{ id: 'foreman-source-b14', title: 'Synthetic damage report', paragraphs: [], fields: [{ label: 'Date of Damage', type: 'text', required: true, signature: false }] },
    { id: 'foreman-source-b15', title: 'Synthetic theft report', paragraphs: [], fields: [{ label: 'JOB NAME', type: 'text', required: true, signature: false }, ...['Item Description', 'Phase 2 Number', 'Serial Number', 'Value of Item'].map(label => ({ label: 'Item 1 - ' + label, type: 'text', required: false, signature: false }))] }],
}
async function setup(page: Page, reader = false, denied = false, path = '/company-library', uploadedReference = false, missingPackage = false) {
  await page.addInitScript(() => { window.__PHASE2_FORM_SERVER__ = true })
  const actions: string[] = []
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
  await page.route('**/sdsWorkspace', async route => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return }
    const data = route.request().postDataJSON().data
    actions.push(data.action)
    let result: unknown = { ok: true }
    if (data.action === 'load') result = { version: 1, folders: [{ id: 'safety', name: 'Safety', parentId: '', order: 0 }], sheets: [], binder: { version: 0, selections: [] } }
    if (data.action === 'page') result = { sheets: data.search === 'Phase2 intranet content' ? [{ id: 'content', name: 'Private content package', originalName: 'Phase2 intranet content.txt', extension: 'txt', archived: false, revisionId: 'r1', folderId: 'safety', order: 0 }] : [], after: '', scanned: 1 }
    if (data.action === 'page' && missingPackage) result = { sheets: [], after: '', scanned: 0 }
    if (data.action === 'page' && uploadedReference && data.search === content.resources.find(item => item.category === 'Safety')!.title) {
      const resource = content.resources.find(item => item.category === 'Safety')!
      result = { sheets: [{ id: 'uploaded-document', name: resource.title, originalName: resource.filename, extension: 'pdf', archived: false, revisionId: 'r1', folderId: 'safety', order: 0, manufacturer: '', productCode: '' }], after: '', scanned: 1 }
    }
    if (data.action === 'openSheet') result = { url: 'https://service.invalid/download?ticket=' + 'a'.repeat(64), extension: 'txt' }
    await route.fulfill({ json: { result }, headers })
  })
  await page.route('**/formTemplates', route => route.fulfill({ json: { result: { templates: [] } }, headers }))
  await page.route('**/sds-file?*', route => route.fulfill(denied ? { status: 403, body: 'Denied' } : { json: content, headers: { 'cache-control': 'private, no-store' } }))
  await gotoPhase2App(page, path, reader ? createJobDashboardFixture() : createJobsFixture())
  return actions
}
async function openBuilderFormsPanel(page: Page, width: number) {
  if (width <= 900) await page.getByRole('navigation', { name: 'Builder panels' }).getByRole('button', { name: 'Forms', exact: true }).click()
}
for (const width of [390, 1280]) test('existing library reads supplied content at ' + width + 'px', async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  const actions = await setup(page)
  await expect(page.getByRole('button', { name: 'Company intranet', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Upload document', exact: true })).toBeEnabled()
  const sdsCount = content.resources.filter(item => item.category === 'SDS').length
  expect(sdsCount).toBeGreaterThan(25)
  await expect(page.locator('.reference-row')).toHaveCount(0)
  await page.getByRole('searchbox', { name: 'Search files' }).fill('SDS')
  await expect(page.locator('.reference-note')).toContainText(sdsCount + ' supplied references')
  await expect(page.locator('.reference-note')).toContainText('original files omitted')
  await expect(page.locator('.reference-row')).toHaveCount(25)
  await page.getByRole('button', { name: 'Next references', exact: true }).click()
  await expect(page.locator('.reference-pages')).toContainText('2 /')
  await page.getByRole('button', { name: 'Previous references', exact: true }).click()
  await expect(page.locator('.reference-pages')).toContainText('1 /')
  await expect(page.getByRole('navigation', { name: 'Library categories' })).toHaveCount(0)
  const resource = content.resources.find(item => item.category === 'Safety')!
  await page.getByRole('searchbox', { name: 'Search files' }).fill(resource.title)
  await page.locator('.reference-row').filter({ hasText: resource.title }).first().click()
  await expect(page.getByText(/source file was omitted from the ZIP/)).toBeVisible()
  for (const inspection of content.inspections) {
    await page.getByRole('searchbox', { name: 'Search files' }).fill(inspection.title)
    await page.locator('.reference-row').filter({ hasText: inspection.title }).first().click()
    await page.getByLabel('Reading language').selectOption('bi')
    await expect(page.locator('.supplied-reference ol > li')).toHaveCount(inspection.paragraphs.length)
    await expect(page.locator('.supplied-reference [lang=es]')).toHaveCount(inspection.paragraphs.filter(row => row.es).length)
    await expect(page.locator('.supplied-reference [lang=en]')).toHaveText(inspection.paragraphs.map(row => row.en))
    await expect(page.locator('.supplied-reference [lang=es]')).toHaveText(inspection.paragraphs.filter(row => row.es).map(row => row.es!))
  }
  await page.getByRole('searchbox', { name: 'Search files' }).fill('New-to-job orientation')
  await page.locator('.reference-row').filter({ hasText: 'New-to-job orientation' }).click()
  await expect(page.locator('.supplied-reference ol > li')).toHaveCount(content.orientation.length)
  await expect(page.locator('.supplied-reference [lang=en]')).toHaveText(content.orientation.map(row => row.en))
  await page.getByRole('searchbox', { name: 'Search files' }).fill('nonexistent-qzx')
  await expect(page.locator('.reference-row')).toHaveCount(0)
  expect(actions.filter(action => !['load', 'page', 'openSheet'].includes(action))).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})

test('supplied forms stay read-only within existing Reports search', async ({ page }) => {
  const actions = await setup(page, false, false, '/reports')
  await expect(page.locator('details')).toHaveCount(content.forms.length)
  for (const form of content.forms) {
    const row = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: form.title }) })
    await row.locator('summary').click()
    await expect(row.locator('.supplied-reference ol > li')).toHaveCount(form.fields.length)
    for (const paragraph of form.paragraphs) await expect(row.getByText(paragraph, { exact: true }).first()).toBeVisible()
    await expect(row.locator('input,textarea,iframe,script,img')).toHaveCount(0)
  }
  await page.getByRole('searchbox', { name: 'Search reports' }).fill('nonexistent-qzx')
  await expect(page.locator('details')).toHaveCount(0)
  expect(actions.filter(action => !['page', 'openSheet'].includes(action))).toEqual([])
})

test('reader has no upload controls and sees private content errors', async ({ page }) => {
  const actions = await setup(page, true, true)
  await expect(page.getByRole('button', { name: 'Upload document', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'New folder', exact: true })).toHaveCount(0)
  await expect(page.getByRole('alert')).toContainText('private content file could not be read')
  expect(actions.filter(action => !['load', 'page', 'openSheet'].includes(action))).toEqual([])
})

test('Admin picker cancel and failed upload never save a document', async ({ page }) => {
  const actions = await setup(page)
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Upload document', exact: true }).click()
  await (await chooser).setFiles([])
  expect(actions).not.toContain('saveSheet')
  await page.getByLabel('Add file', { exact: true }).setInputFiles({ name: 'synthetic-upload.txt', mimeType: 'text/plain', buffer: Buffer.from('Synthetic transport error test') })
  await expect(page.getByRole('alert')).toContainText('Sign in before uploading a file.')
  await expect(page.getByRole('button', { name: 'Upload document', exact: true })).toBeEnabled()
  expect(actions).not.toContain('saveSheet')
})

test('a missing-document reference opens the existing upload editor without creating a file', async ({ page }) => {
  const actions = await setup(page)
  await expect(page.getByRole('navigation', { name: 'Library categories' })).toHaveCount(0)
  const resource = content.resources.find(item => item.category === 'Safety')!
  await page.getByRole('searchbox', { name: 'Search files' }).fill(resource.title)
  await page.locator('.reference-row').filter({ hasText: resource.title }).first().click()
  await page.getByRole('button', { name: 'Upload file for this reference', exact: true }).click()
  const editor = page.locator('.sds-editor')
  await expect(editor.getByLabel('File name', { exact: true })).toHaveValue(resource.title.slice(0, 160))
  await expect(editor.getByLabel('File', { exact: true })).toBeVisible()
  expect(actions).not.toContain('saveSheet')
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(editor).toHaveCount(0)
  expect(actions).not.toContain('saveSheet')
})

test('an uploaded document takes precedence over its supplied reference in existing search', async ({ page }) => {
  const actions = await setup(page, false, false, '/company-library', true)
  await expect(page.getByRole('navigation', { name: 'Library categories' })).toHaveCount(0)
  const resource = content.resources.find(item => item.category === 'Safety')!
  await page.getByRole('searchbox', { name: 'Search files' }).fill(resource.title)
  await expect(page.locator('.tree-file').filter({ hasText: resource.title })).toBeVisible()
  await expect(page.locator('.reference-row')).toHaveCount(0)
  expect(actions).not.toContain('saveSheet')
})

test('supplied ideas become editable drafts in the existing builder, with repeat items and no publication', async ({ page }) => {
  await setup(page, false, false, '/reports')
  const calls: { action: string; definition?: { title: string; recipients: string[]; access: { respondentRoles: string[] }; fields: { kind: string; fields?: unknown[] }[] } }[] = []
  const templates: unknown[] = []
  await page.route('**/formTemplates', async route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return }
    const data = route.request().postDataJSON().data; calls.push(data)
    let result: unknown = { templates }
    if (data.action === 'save') { result = { id: data.id, draft: data.definition, revision: 1, latestVersion: 0, archived: false, used: false }; templates.push(result) }
    await route.fulfill({ json: { result }, headers })
  })
  const damage = content.forms.find(form => form.id === 'foreman-source-b14')!
  const theft = content.forms.find(form => form.id === 'foreman-source-b15')!
  const source = page.locator('details').filter({ hasText: damage.title })
  await source.locator('summary').click()
  await source.getByRole('link', { name: 'Prepare an editable draft in Form Builder', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/forms$/)
  await page.getByRole('button', { name: damage.title + ' draft', exact: true }).click()
  await expect(page.getByText(/Prepared an unsaved Admin-only draft/)).toBeVisible()
  await page.getByLabel('Form title', { exact: true }).fill('Locally reviewed damage')
  await page.getByRole('button', { name: 'Save to local server', exact: true }).click()
  await expect(page.getByText('Draft saved to the local server.', { exact: true })).toBeVisible()
  expect(calls.filter(call => call.action === 'save')[0]!.definition).toMatchObject({ title: 'Locally reviewed damage', recipients: [], access: { respondentRoles: ['admin'] } })
  await page.getByRole('button', { name: theft.title + ' draft', exact: true }).click()
  await page.getByRole('navigation', { name: 'Builder modes' }).getByRole('button', { name: 'Preview', exact: true }).click()
  const preview = page.getByRole('region', { name: 'Full-page form preview', exact: true })
  await preview.getByLabel(/^JOB NAME(?:\s*\*)?$/).fill('Synthetic test job')
  await preview.getByLabel('Item Description', { exact: true }).fill('Synthetic item A')
  await preview.getByRole('button', { name: 'Add another Missing items', exact: true }).click()
  await expect(preview.getByRole('heading', { name: /^Missing items \d+$/ })).toHaveCount(2)
  await expect(preview.getByLabel('Item Description', { exact: true }).first()).toHaveValue('Synthetic item A')
  await preview.getByRole('button', { name: 'Remove Missing items', exact: true }).last().click()
  await expect(preview.getByRole('heading', { name: /^Missing items \d+$/ })).toHaveCount(1)
  await preview.getByRole('button', { name: 'Check required fields', exact: true }).click()
  await expect(preview.getByText('Preview only. No submission or email is created.', { exact: true })).toBeVisible()
  await page.getByRole('navigation', { name: 'Builder modes' }).getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('button', { name: 'Save to local server', exact: true }).click()
  await expect(page.getByText('Draft saved to the local server.', { exact: true })).toBeVisible()
  expect(calls.filter(call => call.action === 'save')).toHaveLength(2)
  expect(calls.filter(call => !['list', 'save'].includes(call.action))).toEqual([])
  const repeat = calls.filter(call => call.action === 'save')[1]!.definition!.fields.find(field => field.kind === 'repeat')!
  expect(repeat.fields).toHaveLength(4)
})

for (const width of [390, 1280]) test('keyboard and native layout review at ' + width + 'px', async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  const actions = await setup(page)
  await expect(page.getByRole('navigation', { name: 'Library categories' })).toHaveCount(0)
  const resource = content.resources.find(item => item.category === 'Safety')!
  const search = page.getByRole('searchbox', { name: 'Search files' })
  await search.focus(); await page.keyboard.insertText(resource.title)
  const reference = page.locator('.reference-row').filter({ hasText: resource.title }).first()
  await reference.focus(); await page.keyboard.press('Enter')
  await expect(reference).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText(/source file was omitted from the ZIP/)).toBeVisible()
  const upload = page.getByRole('button', { name: 'Upload file for this reference', exact: true })
  await upload.focus(); await page.keyboard.press('Enter')
  const editor = page.locator('.sds-editor')
  await expect(editor.getByLabel('File name', { exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(editor.getByRole('combobox', { name: 'Folder', exact: true })).toBeFocused()
  await editor.getByRole('button', { name: 'Cancel', exact: true }).focus(); await page.keyboard.press('Enter')
  await expect(upload).toBeFocused()
  expect(actions).not.toContain('saveSheet')
  await page.screenshot({ path: 'evidence/library-review-' + width + '.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  // Reports remains an existing route; its redundant global sidebar link was removed.
  await page.goto('/reports')
  const form = content.forms.find(item => item.id === 'foreman-source-b14')!
  const row = page.locator('details').filter({ has: page.locator('summary').filter({ hasText: form.title }) })
  await row.locator('summary').focus(); await page.keyboard.press('Enter')
  await expect(row).toHaveAttribute('open', '')
  const builderLink = row.getByRole('link', { name: 'Prepare an editable draft in Form Builder', exact: true })
  await builderLink.focus(); await page.keyboard.press('Enter')
  await openBuilderFormsPanel(page, width)
  const starter = page.getByRole('button', { name: form.title + ' draft', exact: true })
  await starter.focus(); await page.keyboard.press('Enter')
  await expect(page.getByLabel('Form title', { exact: true })).toBeVisible()
  await expect(page.getByText(/Prepared an unsaved Admin-only draft/)).toBeVisible()
  const titleBox = await page.locator('.form-builder-header h1').boundingBox()
  expect(titleBox!.height).toBeLessThan(40)
  await page.screenshot({ path: 'evidence/builder-review-' + width + '.png', fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})

test('missing private source leaves existing uploads usable and makes no completion claims', async ({ page }) => {
  const actions = await setup(page, false, false, '/company-library', false, true)
  await expect(page.getByText(/No supplied references have been uploaded/)).toBeVisible()
  await expect(page.getByText(/Documents omitted from the ZIP remain unavailable/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Upload document', exact: true })).toBeEnabled()
  await expect(page.locator('.reference-row')).toHaveCount(0)
  expect(actions).not.toContain('saveSheet')
})

for (const width of [390, 1280]) test('reference errors never obstruct Form settings at ' + width + 'px', async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  await setup(page, false, true, '/admin/forms')
  await openBuilderFormsPanel(page, width)
  await page.getByRole('button', { name: 'New form', exact: true }).click()
  if (width <= 900) await page.getByRole('navigation', { name: 'Builder panels' }).getByRole('button', { name: 'Editor', exact: true }).click()
  const tools = page.locator('details.builder-library-tools')
  await expect(page.getByText(/private content file could not be read/)).toBeAttached()
  const formTab = page.getByRole('tab', { name: 'Form', exact: true })
  await formTab.click({ timeout: 3000 })
  await expect(page.locator('#form-settings-panel-form')).toBeVisible()
  await expect(tools).not.toHaveAttribute('open', '')
  await tools.locator('summary').focus(); await page.keyboard.press('Enter')
  await expect(tools.getByRole('button', { name: 'Retry references', exact: true })).toBeVisible()
  await formTab.click({ timeout: 3000 })
  await expect(page.locator('#form-settings-panel-form')).toBeVisible()
  await tools.locator('summary').focus(); await page.keyboard.press('Enter')
  await expect(tools).not.toHaveAttribute('open', '')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})
