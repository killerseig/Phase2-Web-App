import { fillCommitteeAudit } from './helpers/formFixture.js'
import { expect, test } from './helpers/test.js'
import {
  createJobsFixture,
  createJobDashboardFixture,
  gotoPhase2App,
} from './helpers/phase2AppFixture.js'

test('opening the library creates nothing; repeated saves and reload retain local edits', async ({
  page,
}) => {
  await gotoPhase2App(page, '/admin/forms', createJobsFixture())
  await expect(page.getByRole('heading', { name: 'Form Builder', exact: true })).toBeVisible()
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('form-builder-local:')),
    ),
  ).toEqual([])
  await page.getByRole('button', { name: 'Committee audit starter', exact: true }).click()
  await page.getByLabel('Form title', { exact: true }).fill('Dan committee audit')
  await page.getByLabel('Recipients', { exact: true }).fill('dan@example.com, safety@example.com')
  await page.getByRole('button', { name: 'Save local draft', exact: true }).click()
  await page.getByRole('button', { name: 'Save local draft', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Dan committee audit', exact: true }).click()
  await expect(page.getByLabel('Recipients', { exact: true })).toHaveValue(
    'dan@example.com, safety@example.com',
  )
  await expect(page.getByLabel('Field label', { exact: true })).toHaveCount(41)
})

test('keyboard and drag ordering share the definition used by full-page preview', async ({
  page,
}) => {
  await gotoPhase2App(page, '/admin/forms', createJobsFixture())
  await page.getByRole('button', { name: 'Committee audit starter', exact: true }).click()
  await page.getByRole('button', { name: 'Move Date of inspection down', exact: true }).click()
  await expect(page.getByLabel('Field label', { exact: true }).first()).toHaveValue('Job name')
  await page
    .getByRole('button', { name: 'Drag Job name', exact: true })
    .dragTo(page.getByRole('article', { name: 'Field 3', exact: true }), {
      targetPosition: { x: 10, y: 10 },
    })
  await expect(page.getByLabel('Field label', { exact: true }).nth(2)).toHaveValue('Job name')
  await page.getByRole('button', { name: 'Full-page preview', exact: true }).click()
  await page.getByRole('button', { name: 'Check required fields', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Date of inspection is required.')

  await fillCommitteeAudit(page)

  await page.getByRole('button', { name: 'Check required fields', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('cancelled discard keeps unsaved edits, versioned forms archive and copies start fresh', async ({
  page,
}) => {
  await gotoPhase2App(page, '/admin/forms', createJobsFixture())
  await page.getByRole('button', { name: 'Committee audit starter', exact: true }).click()
  await page.getByRole('button', { name: 'Keep local version', exact: true }).click()
  await page.getByLabel('Form title', { exact: true }).fill('Unsaved audit title')
  await page.getByRole('button', { name: 'New form', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByLabel('Form title', { exact: true })).toHaveValue('Unsaved audit title')
  await page.getByRole('button', { name: 'Save local draft', exact: true }).click()
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click()
  await page.getByRole('button', { name: 'Save local draft', exact: true }).click()
  await expect(page.getByLabel('Form library')).toContainText('0 retained versions')
  await page.getByRole('button', { name: 'Archive', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Archive form', exact: true }).click()
  await expect(page.getByLabel('Form library')).toContainText('Archived')
  await expect(page.getByLabel('Form library')).toContainText('1 retained versions')
})

test('quota failure preserves unsaved editor work and a retry succeeds', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('form-builder-local:') && !sessionStorage.getItem('allow-form-save'))
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await gotoPhase2App(page, '/admin/forms', createJobsFixture())
  await page.getByRole('button', { name: 'Committee audit starter', exact: true }).click()
  await page.getByRole('button', { name: 'Save local draft', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Quota exceeded')
  await expect(page.getByLabel('Form title', { exact: true })).toHaveValue('Committee Site Audit')
  await page.evaluate(() => sessionStorage.setItem('allow-form-save', 'yes'))
  await page.getByRole('button', { name: 'Save local draft', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Saved on this device.')
})

test('conflicting local revision is rejected and reload recovers the saved library', async ({
  page,
}) => {
  await gotoPhase2App(page, '/admin/forms', createJobsFixture())
  await page.getByRole('button', { name: 'Committee audit starter', exact: true }).click()
  await page.getByRole('button', { name: 'Save local draft', exact: true }).click()
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((key) => key.startsWith('form-builder-local:'))!
    const value = JSON.parse(localStorage.getItem(key)!)
    value.revision++
    localStorage.setItem(key, JSON.stringify(value))
  })
  await page.getByLabel('Form title', { exact: true }).fill('Still unsaved')
  await page.getByRole('button', { name: 'Save local draft', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Another tab changed')
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Committee Site Audit', exact: true }),
  ).toBeVisible()
})

test('non-admin cannot open the Form Builder', async ({ page }) => {
  await gotoPhase2App(page, '/admin/forms', createJobDashboardFixture())
  await expect(page.getByRole('heading', { name: 'Form Builder', exact: true })).toHaveCount(0)
  await expect(page).not.toHaveURL(/admin\/forms/)
})
