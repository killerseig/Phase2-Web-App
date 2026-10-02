import { expect, test } from './helpers/test.js'
import { setupFormServer } from './helpers/formFixture.js'
import { choiceDefinition } from './helpers/choiceFormFixture.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
async function addRequiredControl(page: import('@playwright/test').Page, kind: string) {
  await page.getByRole('button', { name: 'Add ' + kind, exact: true }).click()
  await page.getByLabel('Selected field label', { exact: true }).fill(kind)
  await page.getByLabel('Selected field required', { exact: true }).check()
  if (kind !== 'checkbox')
    await page.getByLabel('Selected field options', { exact: true }).fill('North\nSouth\nWest')
}
async function chooseAreas(page: import('@playwright/test').Page) {
  const combo = page.getByRole('combobox', { name: /Work areas/ })
  await combo.focus()
  await combo.press('ArrowDown')
  await page.getByRole('option', { name: 'North', exact: true }).click()
  await page.getByRole('option', { name: 'South', exact: true }).click()
  await combo.press('Escape')
}

test('new control definitions and retained versions roundtrip through the editor and preview', async ({
  page,
}) => {
  const fixture = createJobsFixture()
  await gotoPhase2App(page, '/admin/forms', fixture)
  await page.getByRole('button', { name: 'New form', exact: true }).click()
  for (const kind of ['checkbox', 'radio', 'multiselect']) await addRequiredControl(page, kind)
  await page.getByRole('button', { name: 'Keep local version', exact: true }).click()
  await page.getByRole('button', { name: 'Save local draft', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Untitled form', exact: true }).click()
  await page.getByRole('button', { name: 'Full-page preview', exact: true }).click()
  await page.getByRole('button', { name: 'Check required fields', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('checkbox is required')
  await expect(page.getByRole('checkbox', { name: /checkbox/ })).toBeFocused()
  await page.getByRole('checkbox', { name: /checkbox/ }).press('Space')
  await page.getByRole('radio', { name: 'North', exact: true }).check()
  const combo = page.getByRole('combobox', { name: /multiselect/ })
  await combo.focus()
  await combo.press('ArrowDown')
  await page.getByRole('option', { name: 'South', exact: true }).click()
  await combo.press('Escape')
  await page.getByRole('button', { name: 'Check required fields', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  const versions = await page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem(
          Object.keys(localStorage).find((key) => key.startsWith('form-builder-local:'))!,
        )!,
      ).templates[0].versions,
  )
  expect(versions[0].fields.map((field: { kind: string }) => field.kind)).toEqual([
    'checkbox',
    'radio',
    'multiselect',
  ])
})

test('false and empty drafts resume; required states focus the proper checkbox radio and multiselect', async ({
  page,
}) => {
  const server = await setupFormServer(page, { definition: choiceDefinition })
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  await page.getByRole('button', { name: 'Save progress', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Progress saved' })).toContainText(
    'Progress saved',
  )
  expect([...server.records.values()][0]!.answers).toMatchObject({
    ack: false,
    followup: false,
    areas: [],
    extras: [],
  })
  await page.reload()
  await page.getByRole('button', { name: /Resume draft/ }).click()
  await expect(page.getByRole('checkbox', { name: /Optional follow-up/ })).not.toBeChecked()
  await page.getByRole('button', { name: 'Submit form', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Acknowledgement is required')
  const ack = page.getByRole('checkbox', { name: /Acknowledgement/ })
  await expect(ack).toBeFocused()
  await expect(ack).toHaveAttribute('aria-describedby', /help-ack.*form-validation-message/)
  await ack.press('Space')
  await page.getByRole('button', { name: 'Submit form', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Schedule is required')
  const daily = page.getByRole('radio', { name: 'Daily', exact: true })
  await expect(daily).toBeFocused()
  await daily.press('ArrowDown')
  await expect(page.getByRole('radio', { name: 'Weekly', exact: true })).toBeChecked()
  await page.getByRole('button', { name: 'Submit form', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Work areas is required')
  await expect(page.getByRole('combobox', { name: /Work areas/ })).toBeFocused()
  await expect(page.getByRole('combobox', { name: /Work areas/ })).toHaveAttribute(
    'aria-describedby',
    /help-areas.*form-validation-message/,
  )
  await chooseAreas(page)
  await page.getByRole('button', { name: 'Save progress', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Progress saved' })).toContainText(
    'Progress saved',
  )
  await page.reload()
  await page.getByRole('button', { name: /Resume draft/ }).click()
  await expect(ack).toBeChecked()
  await expect(page.getByRole('radio', { name: 'Weekly', exact: true })).toBeChecked()
  expect([...server.records.values()][0]!.answers).toMatchObject({
    ack: true,
    followup: false,
    schedule: 'Weekly',
    areas: ['North', 'South'],
    extras: [],
  })
  await page.getByRole('button', { name: 'Submit form', exact: true }).click()
  await expect(page.getByText('Record status: submitted', { exact: false })).toBeVisible()
  await expect(ack).toBeDisabled()
  await expect(page.getByRole('combobox', { name: /Work areas/ })).toBeDisabled()
})

test('submitted choice snapshots retain values and original options after a later template change', async ({
  page,
}) => {
  const server = await setupFormServer(page, { definition: choiceDefinition })
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  await page.getByRole('checkbox', { name: /Acknowledgement/ }).check()
  await page.getByRole('radio', { name: 'Daily', exact: true }).check()
  await chooseAreas(page)
  await page.getByRole('button', { name: 'Submit form', exact: true }).click()
  await expect(page.getByText('Record status: submitted', { exact: false })).toBeVisible()
  const saved = JSON.stringify([...server.records.values()][0])
  server.issueNextVersion({
    ...choiceDefinition,
    title: 'Later choices',
    fields: choiceDefinition.fields.map((field) =>
      field.id === 'areas' ? { ...field, options: ['East', 'West'] } : field,
    ),
  })
  await page.reload()
  await page.getByRole('button', { name: /View submitted form/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Choice controls · version 1', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Daily', exact: true })).toBeChecked()
  expect(JSON.stringify([...server.records.values()][0])).toBe(saved)
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Later choices · version 2', exact: true }),
  ).toBeVisible()
  const combo = page.getByRole('combobox', { name: /Work areas/ })
  await combo.focus()
  await combo.press('ArrowDown')
  await expect(page.getByRole('option', { name: 'East', exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'North', exact: true })).toHaveCount(0)
})

for (const width of [390, 768])
  test(
    'choice controls support keyboard and pointer within the ' + width + 'px pane',
    async ({ page }) => {
      await page.setViewportSize({ width, height: 844 })
      await setupFormServer(page, { definition: choiceDefinition })
      await page.getByRole('button', { name: 'Start draft', exact: true }).click()
      const ack = page.getByRole('checkbox', { name: /Acknowledgement/ })
      await ack.focus()
      await ack.press('Space')
      await expect(ack).toBeChecked()
      await page.getByRole('radio', { name: 'Daily', exact: true }).check()
      const combo = page.getByRole('combobox', { name: /Work areas/ })
      await combo.focus()
      await combo.press('ArrowDown')
      await combo.press('Home')
      await combo.press('Enter')
      await expect(page.getByRole('option', { name: 'North', exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      await combo.press('ArrowDown')
      await combo.press('Enter')
      await expect(page.getByRole('option', { name: 'South', exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      await combo.press('Escape')
      await expect(page.getByRole('listbox')).toHaveCount(0)
      await expect
        .poll(() =>
          page.locator('.app-shell__content').evaluate((el) => el.scrollWidth - el.clientWidth),
        )
        .toBeLessThanOrEqual(1)
      await page
        .locator('.form-fields')
        .screenshot({ path: test.info().outputPath('choice-controls.png') })
      await page.getByRole('button', { name: 'Save progress', exact: true }).click()
      await expect(page.getByRole('status').filter({ hasText: 'Progress saved' })).toContainText(
        'Progress saved',
      )
    },
  )
