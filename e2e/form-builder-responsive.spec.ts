import { expect, test } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

for (const width of [1440, 390]) {
  test(
    'Form Builder and full-page preview stay contained at ' + width + 'px',
    async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 950 })
      await gotoPhase2App(page, '/admin/forms', createJobsFixture())
      await page.getByRole('button', { name: 'Committee audit starter', exact: true }).click()
      await expect(page.getByLabel('Form title', { exact: true })).toBeVisible()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true)
      await page.screenshot({
        path: testInfo.outputPath('form-editor-' + width + '.png'),
        fullPage: true,
      })
      await page.getByRole('button', { name: 'Full-page preview', exact: true }).click()
      await expect(page.getByLabel('Full-page form preview')).toBeVisible()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true)
      await page.screenshot({
        path: testInfo.outputPath('form-preview-' + width + '.png'),
        fullPage: true,
      })
    },
  )
}
