import { expect, test, type Page } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import type { FormField, FormTemplate } from '../src/features/forms/model'

const key = 'form-builder-local:v1:admin-e2e'
function field(id: string, kind: FormField['kind'] = 'text'): FormField {
  return { id, kind, label: id, required: false, options: kind === 'radio' ? ['Yes', 'No'] : [] }
}
function forms(): FormTemplate[] {
  const rating = field('Rating', 'radio'), note = field('Explanation', 'textarea')
  note.requiredWhen = { fieldId: rating.id, values: ['No'] }
  const group = field('Visits', 'repeat')
  group.minInstances = 1; group.maxInstances = 5
  group.fields = [field('Condition', 'radio'), { ...field('Details', 'textarea'), requiredWhen: { fieldId: 'Condition', values: ['No'] } }, { ...field('Checklist', 'matrix'), rows: [{ id: 'row-one', label: 'One' }, { id: 'row-two', label: 'Two' }] }]
  const source: FormTemplate = { id: 'source-form', title: 'Source form', description: '', recipients: [], archived: false, fields: [rating, note, group], versions: [] }
  source.versions = [{ title: source.title, description: '', recipients: [], fields: structuredClone(source.fields), version: 1, createdAt: '2026-11-07T00:00:00.000Z' }]
  return [source, { ...structuredClone(source), id: 'target-form', title: 'Target form', fields: [field('Target')], versions: [] }]
}
async function open(page: Page, templates = forms()) {
  await page.addInitScript(({ key, templates }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ schema: 1, revision: 1, templates }))
  }, { key, templates })
  await gotoPhase2App(page, '/admin/forms', createJobsFixture())
  await page.getByRole('button', { name: templates[0]!.title, exact: true }).click()
}
const rows = (page: Page) => page.locator('.field-row')
async function choose(page: Page, index: number) {
  const row = rows(page).nth(index)
  await row.focus(); await page.keyboard.press('Enter')
  return row
}
async function stored(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!).templates as FormTemplate[], key)
}
function identities(field: FormField): string[] {
  return [field.id, ...(field.rows || []).map(row => row.id), ...(field.fields || []).flatMap(identities)]
}

test('field clipboard duplicates nested groups with fresh IDs, atomic history and retained versions after save/reload', async ({ page }) => {
  const original = forms()
  await open(page, original)
  await choose(page, 2)
  await page.keyboard.press('Control+c')
  await page.keyboard.press('Control+d')
  await expect(rows(page)).toHaveCount(4)
  const duplicate = await rows(page).nth(3).getAttribute('data-widget-id')
  await page.keyboard.press('Control+v')
  await expect(rows(page)).toHaveCount(5)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(rows(page)).toHaveCount(4)
  await expect(page.locator('.field-row.selected')).toHaveAttribute('data-widget-id', duplicate!)
  await rows(page).nth(3).focus()
  await page.keyboard.press('Alt+ArrowUp')
  await expect(rows(page).nth(2)).toHaveAttribute('data-widget-id', duplicate!)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(rows(page).nth(3)).toHaveAttribute('data-widget-id', duplicate!)
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await page.getByRole('button', { name: 'Save local draft', exact: true }).click()
  const saved = (await stored(page))[0]!
  expect(saved.versions).toEqual(original[0]!.versions)
  const copies = saved.fields.filter(item => item.kind === 'repeat')
  expect(copies).toHaveLength(2)
  const allIds = saved.fields.flatMap(identities)
  expect(new Set(allIds).size).toBe(allIds.length)
  const copy = copies.find(item => item.id === duplicate)!
  expect(copy.fields![1]!.requiredWhen).toEqual({ fieldId: copy.fields![0]!.id, values: ['No'] })
  expect(copy.fields![2]!.rows!.map(row => row.label)).toEqual(['One', 'Two'])
  await page.reload()
  await page.getByRole('button', { name: 'Source form', exact: true }).click()
  await expect(rows(page)).toHaveCount(4)
  await expect(rows(page).nth(2)).toHaveAttribute('data-widget-id', duplicate!)
})

test('cross-form paste preserves portable groups and rejects external required-note conditions without changing the destination', async ({ page }) => {
  await open(page)
  await choose(page, 1); await page.keyboard.press('Control+c')
  await page.getByRole('button', { name: 'Target form', exact: true }).click()
  await page.getByRole('button', { name: 'Paste field', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('required-note condition')
  await expect(rows(page)).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Source form', exact: true }).click()
  await choose(page, 2); await page.keyboard.press('Control+c')
  await page.getByRole('button', { name: 'Target form', exact: true }).click()
  await page.getByRole('button', { name: 'Paste field', exact: true }).click()
  await expect(rows(page)).toHaveCount(2)
  await page.getByRole('button', { name: 'Save local draft', exact: true }).click()
  const group = (await stored(page)).find(form => form.id === 'target-form')!.fields[1]!
  expect(group.fields![1]!.requiredWhen!.fieldId).toBe(group.fields![0]!.id)
})

test('field commands respect typing, an armed pointer and an unanswered confirmation', async ({ page }) => {
  await open(page)
  await choose(page, 0)
  const input = page.getByLabel('Selected field label', { exact: true })
  await input.fill('Typed rating')
  await input.press('Control+d')
  await expect(rows(page)).toHaveCount(3)
  const grip = page.getByRole('button', { name: 'Drag Typed rating', exact: true })
  await grip.scrollIntoViewIfNeeded()
  const bounds = (await grip.boundingBox())!
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.keyboard.press('Control+d')
  await page.keyboard.press('Alt+ArrowDown')
  await expect(rows(page)).toHaveCount(3)
  await expect(rows(page).first()).toHaveAttribute('data-widget-id', 'Rating')
  await page.mouse.up()
  await page.getByRole('button', { name: 'New form', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Control+d')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(rows(page)).toHaveCount(3)
  await choose(page, 0); await page.keyboard.press('Control+d')
  await expect(rows(page)).toHaveCount(4)
})

test('phone copy and paste actions remain available through the editor and canvas panels', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page)
  const panels = page.getByRole('navigation', { name: 'Builder panels' })
  await panels.getByRole('button', { name: 'Canvas', exact: true }).click()
  await choose(page, 0)
  const copy = page.getByRole('button', { name: 'Copy selected field', exact: true })
  await expect(copy).toBeVisible(); await copy.click()
  await panels.getByRole('button', { name: 'Canvas', exact: true }).click()
  const paste = page.getByRole('button', { name: 'Paste field', exact: true })
  await expect(paste).toBeVisible(); await paste.click()
  await expect(rows(page)).toHaveCount(4)
  const bounds = (await paste.boundingBox())!
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
})

test('duplicating a group at the total field limit refuses the entire command', async ({ page }) => {
  const template = forms()[0]!
  template.fields = [template.fields[2]!, ...Array.from({ length: 56 }, (_, index) => field('Field-' + index))]
  await open(page, [template])
  await choose(page, 0)
  await page.getByRole('button', { name: 'Duplicate selected field', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('60 fields')
  await expect(rows(page)).toHaveCount(57)
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
})
