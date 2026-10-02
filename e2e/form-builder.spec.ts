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
  await page
    .getByRole('navigation', { name: 'Form settings tabs' })
    .getByRole('button', { name: 'Form', exact: true })
    .click()
  await page.getByLabel('Form title', { exact: true }).fill('Dan committee audit')
  await page
    .getByRole('navigation', { name: 'Form settings tabs' })
    .getByRole('button', { name: 'Form', exact: true })
    .click()
  await page.getByLabel('Recipients', { exact: true }).fill('dan@example.com, safety@example.com')
  await page.getByRole('button', { name: 'Save local draft', exact: true }).click()
  await page.getByRole('button', { name: 'Save local draft', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Dan committee audit', exact: true }).click()
  await expect(page.getByLabel('Recipients', { exact: true })).toHaveValue(
    'dan@example.com, safety@example.com',
  )
  await expect(page.locator('.form-canvas .form-field > label')).toHaveCount(41)
})

test('keyboard and drag ordering share the definition used by full-page preview', async ({
  page,
}) => {
  await gotoPhase2App(page, '/admin/forms', createJobsFixture())
  await page.getByRole('button', { name: 'Committee audit starter', exact: true }).click()
  await page.getByRole('button', { name: 'Move Date of inspection down', exact: true }).click()
  await expect(page.locator('.form-canvas .form-field > label').first()).toContainText('Job name')
  await page.setViewportSize({ width: 1440, height: 1600 })
  const handle = page.getByRole('button', { name: 'Drag Job name', exact: true })
  const destination = page.getByRole('article', { name: 'Field 2', exact: true })
  await handle.hover()
  const to = (await destination.boundingBox())!,
    from = (await handle.boundingBox())!
  const hit = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.getAttribute('aria-label'),
    { x: from.x + 8, y: from.y + 8 },
  )
  expect(hit).toBe('Drag Job name')
  await page.mouse.move(from.x + 8, from.y + 8)
  await page.mouse.down()
  expect(to.y + to.height - 10).toBeLessThan(1600)
  await page.mouse.move(to.x + 20, to.y + to.height - 10, { steps: 12 })
  await expect(page.locator('.form-drag-ghost')).toBeVisible()
  await page.mouse.up()
  await expect(page.locator('.form-canvas .form-field > label').nth(1)).toContainText('Job name')
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
  await page
    .getByRole('navigation', { name: 'Form settings tabs' })
    .getByRole('button', { name: 'Form', exact: true })
    .click()
  await page.getByLabel('Form title', { exact: true }).fill('Unsaved audit title')
  await page.getByRole('button', { name: 'New form', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByLabel('Form title', { exact: true })).toHaveValue('Unsaved audit title')
  await page.getByRole('button', { name: 'Save local draft', exact: true }).click()
  await page
    .getByRole('navigation', { name: 'Form palette' })
    .getByRole('button', { name: 'Library', exact: true })
    .click()
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click()
  await page.getByRole('button', { name: 'Save local draft', exact: true }).click()
  await expect(page.getByLabel('Form library')).toContainText('0 retained versions')
  await page
    .getByRole('navigation', { name: 'Form palette' })
    .getByRole('button', { name: 'Library', exact: true })
    .click()
  await page.getByRole('button', { name: 'Unsaved audit title', exact: true }).click()
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
  await expect(page.getByRole('status').filter({ hasText: 'Saved on this device.' })).toHaveText(
    'Saved on this device.',
  )
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
  await page
    .getByRole('navigation', { name: 'Form settings tabs' })
    .getByRole('button', { name: 'Form', exact: true })
    .click()
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

test('leaving unsaved template edits requires an explicit discard; cancel preserves fields and recipients', async ({
  page,
}) => {
  await gotoPhase2App(page, '/admin/forms', createJobsFixture())
  await page.getByRole('button', { name: 'New form', exact: true }).click()
  await page
    .getByRole('navigation', { name: 'Form settings tabs' })
    .getByRole('button', { name: 'Form', exact: true })
    .click()
  await page.getByLabel('Form title', { exact: true }).fill('Unsaved navigation draft')
  await page
    .getByRole('navigation', { name: 'Form settings tabs' })
    .getByRole('button', { name: 'Form', exact: true })
    .click()
  await page.getByLabel('Recipients', { exact: true }).fill('review@example.com')
  await page.getByRole('button', { name: 'Add text', exact: true }).click()
  await page.getByLabel('Selected field label', { exact: true }).fill('Keep this field')
  await page.evaluate(async () => {
    const { default: router } = await import('/src/router/index.ts')
    void router.push('/dashboards/personal')
  })
  await expect(page.getByRole('dialog')).toContainText('Leave unsaved form edits?')
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page).toHaveURL(new RegExp('admin/forms$'))
  await expect(page.locator('.form-canvas .form-field > label')).toContainText('Keep this field')
  await expect(page.getByLabel('Recipients', { exact: true })).toHaveValue('review@example.com')
  expect(
    await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }),
  ).toBe(true)
  await page.evaluate(async () => {
    const { default: router } = await import('/src/router/index.ts')
    void router.push('/dashboards/personal')
  })
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Leave without saving', exact: true })
    .click()
  await expect(page).toHaveURL(new RegExp('dashboards/personal$'))
})

test('saved template leaves without an unsaved warning and browser reload warning is cleared', async ({
  page,
}) => {
  await gotoPhase2App(page, '/admin/forms', createJobsFixture())
  await page.getByRole('button', { name: 'New form', exact: true }).click()
  await page.getByRole('button', { name: 'Add text', exact: true }).click()
  await page.getByRole('button', { name: 'Save local draft', exact: true }).click()
  expect(
    await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }),
  ).toBe(false)
  await page.evaluate(async () => {
    const { default: router } = await import('/src/router/index.ts')
    void router.push('/dashboards/personal')
  })
  await expect(page).toHaveURL(new RegExp('dashboards/personal$'))
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
