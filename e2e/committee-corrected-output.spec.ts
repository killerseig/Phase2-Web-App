import { expect, test } from './helpers/test.js'
import { setupFormServer } from './helpers/formFixture.js'
import committee from '../functions/src/committee-inspection-native.json' with { type: 'json' }
import type { FormDefinition } from '../functions/src/formModel'
for (const width of [390, 1280])
  test(`corrected Committee retains inspection date through saved answers at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 })
    const definition = structuredClone(committee) as FormDefinition
    // Synthetic signed-in audience exercises the intended workflow; no runtime policy is changed.
    definition.access = {
      respondents: 'signed-in',
      identity: 'identified',
      respondentRoles: ['admin'],
      respondentUserIds: [],
      entryRoles: [],
      entryUserIds: [],
    }
    const server = await setupFormServer(page, { definition })
    await page.getByRole('button', { name: 'Start draft', exact: true }).click()
    await expect(page.getByLabel('Date of Inspection', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Site Safety assistant', { exact: true })).toHaveCount(0)
    await expect(page.getByLabel('Signature', { exact: true })).toHaveCount(0)
    await expect(page.getByLabel('Date', { exact: true })).toHaveCount(0)
    await page.getByLabel('Date of Inspection', { exact: true }).fill('2026-10-20')
    await page.getByRole('button', { name: 'Save progress', exact: true }).click()
    await expect(page.getByText('Progress saved. This form has not been submitted.')).toBeVisible()
    expect([...server.records.values()][0]?.answers['committee-1']).toBe('2026-10-20')
    expect(server.submitted).toBe(0)
    expect(server.emailRetries).toBe(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    )
    await page.screenshot({ path: info.outputPath('committee.png'), fullPage: true })
  })
