import { expect, test, type Page } from './helpers/test.js'
import { createAdminWorkspaceFixture, createTimecardsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import type { Phase2E2EState } from '../src/testing/e2eRuntime'

const cases = [
  { name: 'crew', open: async (page: Page) => {
    const fixture = createTimecardsFixture({ seededCard: true })
    await gotoPhase2App(page, '/jobs/job-e2e/timecards', { ...fixture, delays: { timecardUpdateMs: 350 } })
    await page.getByTestId('timecards-week-ending').fill('2026-06-06')
    await page.getByTestId('timecards-week-ending').dispatchEvent('change')
  } },
  { name: 'payroll export', open: async (page: Page) => {
    await gotoPhase2App(page, '/exports/timecards', { ...createAdminWorkspaceFixture(), delays: { timecardUpdateMs: 350 } })
    await page.getByTestId('timecard-export-week-search').fill('1A')
    await expect(page.locator('.timecards-canvas__item')).toHaveCount(1)
    await page.getByRole('button', { name: 'Edit Card', exact: true }).click()
  } },
]
async function savedNotes(page: Page) {
  return page.evaluate(() => (window.__PHASE2_E2E_STATE__ as Phase2E2EState).timecardCards?.map(card => card.notes))
}
for (const scenario of cases) {
  test(`${scenario.name}: immediate navigation flushes debounced edits`, async ({ page }) => {
    await scenario.open(page)
    await page.getByTestId('timecard-notes-input').fill('Preserve before leaving')
    await page.getByRole('link', { name: 'Jobs', exact: true }).click()
    await expect(page).toHaveURL(/\/jobs$/)
    expect(await savedNotes(page)).toContain('Preserve before leaving')
  })

  test(`${scenario.name}: sign-out waits for edits`, async ({ page }) => {
    await scenario.open(page)
    await page.getByTestId('timecard-notes-input').fill('Preserve before sign-out')
    await page.getByRole('button', { name: 'Sign Out', exact: true }).click()
    await expect(page).toHaveURL(/\/login/)
    expect(await savedNotes(page)).toContain('Preserve before sign-out')
  })

  test(`${scenario.name}: failed save keeps the draft after cancelled departure`, async ({ page }) => {
    await scenario.open(page)
    // Remove only the synthetic service record, retaining the loaded workbook.
    const records = await page.evaluate(() => {
      const state = window.__PHASE2_E2E_STATE__ as Phase2E2EState
      return state.timecardCards!.splice(0)
    })
    await page.getByTestId('timecard-notes-input').fill('Retry these changes')
    await page.getByRole('link', { name: 'Jobs', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Keep unsaved timecard changes?' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Keep editing' }).click()
    await expect(page.getByTestId('timecard-notes-input')).toHaveValue('Retry these changes')
    await page.evaluate(rows => { (window.__PHASE2_E2E_STATE__ as Phase2E2EState).timecardCards = rows }, records)
    await page.getByRole('link', { name: 'Jobs', exact: true }).click()
    await expect(page).toHaveURL(/\/jobs$/)
    expect(await savedNotes(page)).toContain('Retry these changes')
  })
}
