import { expect, test } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

for (const width of [1440, 820, 390]) {
  test(
    'canvas renders actual controls, selects through their surface and retains inspector edits at ' +
      width +
      'px',
    async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 })
      await gotoPhase2App(page, '/admin/forms', createJobsFixture())
      await page.getByRole('button', { name: 'New form', exact: true }).click()
      const kinds = [
        'text',
        'textarea',
        'email',
        'phone',
        'time',
        'date',
        'number',
        'choice',
        'checkbox',
        'radio',
        'multiselect',
        'photo',
      ]
      for (const kind of kinds) {
        await page.getByRole('button', { name: 'Add ' + kind, exact: true }).click()
        await page.getByLabel('Selected field label', { exact: true }).fill('Review ' + kind)
        await page.getByLabel('Selected field hint', { exact: true }).fill('Help for ' + kind)
        await page.getByLabel('Selected field required', { exact: true }).check()
        const card = page.getByRole('article', {
          name: 'Field ' + (kinds.indexOf(kind) + 1),
          exact: true,
        })
        await expect(card.locator('.form-field > label')).toContainText('Review ' + kind)
        await expect(card.locator('.hint').first()).toHaveText('Help for ' + kind)
        const selectors: Record<string, string> = {
          text: 'input[type="text"]',
          textarea: 'textarea',
          email: 'input[type="email"]',
          phone: 'input[type="tel"]',
          time: 'input[type="time"]',
          date: 'input[type="date"]',
          number: 'input[type="number"]',
          choice: 'select',
          checkbox: 'input[type="checkbox"]',
          radio: 'input[type="radio"]',
          multiselect: '.form-multiselect input[role="combobox"]',
          photo: 'input[type="file"]',
        }
        await expect(card.locator(selectors[kind]!).first()).toBeDisabled()
      }
      await expect(
        page.getByRole('article', { name: 'Field 10', exact: true }).locator('input[type="radio"]'),
      ).toHaveCount(2)
      await expect(page.getByLabel('Field label', { exact: true })).toHaveCount(0)
      const first = page.getByRole('article', { name: 'Field 1', exact: true })
      await first.scrollIntoViewIfNeeded()
      const input = first.locator('input[type="text"]'),
        bounds = (await input.boundingBox())!
      await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
      await expect(page.getByLabel('Selected field label', { exact: true })).toHaveValue(
        'Review text',
      )
      await page.getByLabel('Selected field label', { exact: true }).fill('Edited on inspector')
      await expect(first.locator('.form-field > label')).toContainText('Edited on inspector')
      await first.focus()
      await page.keyboard.press('Delete')
      await page.getByRole('button', { name: 'Undo', exact: true }).click()
      await expect(page.getByLabel('Selected field label', { exact: true })).toHaveValue(
        'Edited on inspector',
      )
      await page.getByRole('button', { name: 'Save local draft', exact: true }).click()
      await page.getByLabel('Form canvas').scrollIntoViewIfNeeded()
      await page.screenshot({ path: test.info().outputPath('canvas-controls-' + width + '.png') })
      expect(
        await page.getByLabel('Form editor').evaluate((el) => el.scrollWidth - el.clientWidth),
      ).toBeLessThanOrEqual(1)
      await page.getByRole('button', { name: 'Full-page preview', exact: true }).click()
      await expect(page.getByLabel('Edited on inspector', { exact: false })).toBeEnabled()
      await page.getByLabel('Edited on inspector', { exact: false }).fill('Trial answer')
      await page.getByRole('button', { name: 'Edit fields', exact: true }).click()
      await expect(
        page.getByRole('article', { name: 'Field 1', exact: true }).locator('input[type="text"]'),
      ).toHaveValue('')
      await page.reload()
      await page.getByRole('button', { name: 'Untitled form', exact: true }).click()
      await expect(page.getByLabel('Selected field label', { exact: true })).toHaveValue(
        'Edited on inspector',
      )
    },
  )
}
