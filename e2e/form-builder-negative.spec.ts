import { expect, test } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

test('invalid recipients block retained versions without discarding edits', async ({ page }) => {
  await gotoPhase2App(page, '/admin/forms', createJobsFixture())
  await page.getByRole('button', { name: 'Committee audit starter', exact: true }).click()
  await page.getByLabel('Recipients', { exact: true }).fill('bad address')
  await page.getByRole('button', { name: 'Keep local version', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('valid recipient email')
  await expect(page.getByLabel('Recipients', { exact: true })).toHaveValue('bad address')
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('form-builder-local:')),
    ),
  ).toEqual([])
  await page.getByLabel('Recipients', { exact: true }).fill('dan@example.com')
  await page.getByRole('button', { name: 'Keep local version', exact: true }).click()
  await expect(page.getByLabel('Form library')).toContainText('1 retained versions')
})

test('cancelled delete preserves a draft; confirmed repeated creation/deletion leaves no duplicates', async ({
  page,
}) => {
  await gotoPhase2App(page, '/admin/forms', createJobsFixture())
  await page.getByRole('button', { name: 'New form', exact: true }).click()
  await page.getByRole('button', { name: 'Save local draft', exact: true }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Untitled form', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete form', exact: true }).click()
  await page.getByRole('button', { name: 'New form', exact: true }).click()
  await page.getByRole('button', { name: 'Save local draft', exact: true }).click()
  await page.getByRole('button', { name: 'Save local draft', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Untitled form', exact: true })).toHaveCount(1)
})

test('corrupt stored library is preserved and blocks overwrite', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('form-builder-local:v1:admin-e2e', '{bad json'),
  )
  await gotoPhase2App(page, '/admin/forms', createJobsFixture())
  await expect(page.getByRole('alert')).toContainText('They have been preserved')
  await expect(page.getByRole('button', { name: 'New form', exact: true })).toBeDisabled()
  expect(await page.evaluate(() => localStorage.getItem('form-builder-local:v1:admin-e2e'))).toBe(
    '{bad json',
  )
})
