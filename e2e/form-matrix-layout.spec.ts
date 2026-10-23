import { expect, test, type Locator, type Page } from './helpers/test.js'
import { setupFormServer } from './helpers/formFixture.js'
import nearMissDefinition from '../functions/src/nearMissSafetyObservation.json' with { type: 'json' }
import type { FormDefinition } from '../functions/src/formModel'

const longOption = 'Strongly agree with this longer example option which wraps clearly onto several lines on narrow screens'
const longRow = 'A longer safety statement wraps without moving its choices apart, including this unbroken word: ' + 'Safety'.repeat(12)
function definition(): FormDefinition {
  const source = structuredClone(nearMissDefinition) as FormDefinition
  const matrix = source.fields.find(field => field.kind === 'matrix')!
  matrix.options.push(longOption); matrix.rows!.push({ id: 'long', label: longRow })
  return { ...source, access: { respondents: 'signed-in', identity: 'identified', respondentRoles: ['admin'], respondentUserIds: [], entryRoles: [], entryUserIds: [] }, fields: [...source.fields, { id: 'ack', kind: 'checkbox', label: 'Confirm review', required: false, options: [] }] }
}
async function setup(page: Page, preview: boolean) {
  await page.route('**/sdsWorkspace', route => route.fulfill({ json: { result: { sheets: [], after: '', scanned: 0 } }, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } }))
  return setupFormServer(page, { definition: definition(), ...(preview ? { initialPath: '/admin/forms' } : {}) })
}
async function assertLayout(matrix: Locator) {
  const measurements = await matrix.locator('label.radio-option').evaluateAll(labels => labels.map(label => {
    const input = label.querySelector('input')!, text = label.querySelector('.choice-option-label')!, i = input.getBoundingClientRect(), t = text.getBoundingClientRect(), l = label.getBoundingClientRect()
    return { radioWidth: parseFloat(getComputedStyle(input).width), radioHeight: parseFloat(getComputedStyle(input).height), gap: t.left - i.right, textRight: t.right, labelRight: l.right, minHeight: parseFloat(getComputedStyle(label).minHeight) }
  }))
  expect(measurements).toHaveLength(24)
  for (const item of measurements) {
    expect(item.radioWidth).toBe(20); expect(item.radioHeight).toBe(20)
    expect(item.gap).toBeGreaterThanOrEqual(0); expect(item.gap).toBeLessThan(18)
    expect(item.textRight).toBeLessThanOrEqual(item.labelRight + 1); expect(item.minHeight).toBeGreaterThanOrEqual(44)
  }
  expect(await matrix.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
}
async function canvasPanel(page: Page, width: number) {
  if (width <= 900) await page.getByRole('navigation', { name: 'Builder panels' }).getByRole('button', { name: 'Canvas', exact: true }).click()
}
async function choose(page: Page) {
  const first = page.getByRole('group', { name: 'Safety training is adequate.', exact: true })
  await first.getByRole('radio', { name: 'Neutral', exact: true }).check()
  await first.getByRole('radio', { name: 'Neutral', exact: true }).press('ArrowDown')
  await expect(first.getByRole('radio', { name: 'Agree', exact: true })).toBeChecked()
  const second = page.getByRole('group', { name: 'Management responds quickly to hazards.', exact: true })
  await second.getByRole('radio', { name: 'Strongly Agree', exact: true }).check()
  await page.getByRole('button', { name: 'Clear Safety training is adequate.', exact: true }).click()
  await expect(first.locator('input:checked')).toHaveCount(0); await expect(second.getByRole('radio', { name: 'Strongly Agree', exact: true })).toBeChecked()
  await first.getByRole('radio', { name: 'Agree', exact: true }).check()
  await page.getByRole('group', { name: longRow, exact: true }).getByRole('radio', { name: longOption, exact: true }).check()
  const observation = page.getByRole('radiogroup', { name: 'Type of Observation', exact: true })
  await observation.getByRole('radio', { name: 'Safe Act', exact: true }).check(); await observation.getByRole('radio', { name: 'Safe Act', exact: true }).press('ArrowDown')
  await expect(observation.getByRole('radio', { name: 'Unsafe Act', exact: true })).toBeChecked()
  await page.getByRole('checkbox', { name: 'Confirm review', exact: true }).focus(); await page.keyboard.press('Space'); await expect(page.getByRole('checkbox', { name: 'Confirm review', exact: true })).toBeChecked()
  await page.getByLabel('What Job are you on?', { exact: false }).fill('Synthetic job')
  await page.getByLabel('Please describe the safety observation or concern in detail.', { exact: false }).fill('Synthetic observation')
}

for (const width of [1600, 390]) {
  test('matrix canvas and interactive preview align choices at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 }); const server = await setup(page, true)
    await page.locator('[data-template-id="audit-e2e"] .library-target').click()
    await canvasPanel(page, width)
    const canvas = page.locator('[data-widget-id="agreement"] .matrix-rows'); await canvas.scrollIntoViewIfNeeded(); await assertLayout(canvas)
    await expect(canvas.locator('input').first()).toBeDisabled()
    await page.getByRole('navigation', { name: 'Builder modes' }).getByRole('button', { name: 'Preview', exact: true }).click()
    const matrix = page.getByRole('region', { name: 'Full-page form preview' }).locator('.matrix-rows'); await matrix.scrollIntoViewIfNeeded(); await assertLayout(matrix)
    await choose(page); await page.setViewportSize({ width: width === 390 ? 1280 : 390, height: 1000 }); await assertLayout(matrix)
    await expect(page.getByRole('group', { name: 'Safety training is adequate.', exact: true }).getByRole('radio', { name: 'Agree', exact: true })).toBeChecked()
    expect(server.actions.every(action => action === 'formTemplates:list')).toBe(true)
    await page.setViewportSize({ width, height: 1000 }); await matrix.scrollIntoViewIfNeeded(); await page.screenshot({ path: 'evidence/matrix-preview-verified-' + width + '.png', fullPage: false })
  })

  test('matrix actual filling saves and reloads selected rows at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 }); const server = await setup(page, false)
    await page.getByRole('button', { name: 'Start draft', exact: true }).click()
    const matrix = page.getByRole('region', { name: 'Current form record' }).locator('.matrix-rows'); await matrix.scrollIntoViewIfNeeded(); await assertLayout(matrix)
    await choose(page); await page.getByRole('button', { name: 'Save progress', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Progress saved' })).toBeVisible()
    const saved = [...server.records.values()][0]!
    expect(saved.answers).toMatchObject({ agreement: ['Agree', 'Strongly Agree', '', longOption], ack: true, 'observation-type': 'Unsafe Act', job: 'Synthetic job' })
    await page.reload(); await page.getByRole('button', { name: /Resume draft/ }).click()
    await expect(page.getByRole('group', { name: 'Safety training is adequate.', exact: true }).getByRole('radio', { name: 'Agree', exact: true })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: 'Confirm review', exact: true })).toBeChecked()
    await expect(page.getByLabel('What Job are you on?', { exact: false })).toHaveValue('Synthetic job')
    await matrix.scrollIntoViewIfNeeded(); await assertLayout(matrix); await page.screenshot({ path: 'evidence/matrix-filling-verified-' + width + '.png', fullPage: false })
    expect(server.submitted).toBe(0); expect(server.actions.some(action => /issue|submit|formEmail/.test(action))).toBe(false)
  })
}
