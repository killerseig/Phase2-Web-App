import { expect, test } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { setupFormServer } from './helpers/formFixture.js'

test('output defaults, picker, escaping, omissions and deleted-field errors survive save and undo', async ({
  page,
}) => {
  await gotoPhase2App(page, '/admin/forms', createJobsFixture())
  await page.getByRole('button', { name: 'New form', exact: true }).click()
  await page.getByLabel('Form title', { exact: true }).fill('Output review')
  await page.getByRole('button', { name: 'Add text', exact: true }).click()
  await page.getByLabel('Selected field label', { exact: true }).fill('Job name')
  await page.getByRole('button', { name: 'Add textarea', exact: true }).click()
  await page.getByLabel('Selected field label', { exact: true }).fill('Full notes')
  await page.getByRole('button', { name: 'Output / issues', exact: true }).click()
  await expect(page.getByLabel('Require login', { exact: true })).toBeChecked()
  await page.getByLabel('Require login', { exact: true }).uncheck()
  await expect(page.getByRole('status').filter({ hasText: 'Anyone with this link' })).toBeVisible()
  await page.getByLabel('Attach completed form PDF', { exact: true }).check()
  await page.getByLabel('Custom email template', { exact: true }).fill('Report <script>\nName: ')
  await page.getByLabel('Insert field', { exact: true }).selectOption({ label: 'Job name' })
  await page.getByRole('button', { name: 'Insert selected field', exact: true }).click()
  const key = await page.getByLabel('Custom email template', { exact: true }).inputValue()
  expect(key).toMatch(/Name: {{[A-Za-z0-9_-]+}}$/)
  await expect(
    page.getByLabel('Output issues').getByText(/Warning: Custom output omits Full notes/),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Preview output', exact: true }).click()
  const preview = page.frameLocator('iframe[title="Completed form email preview"]')
  await expect(preview.getByText('Report <script>', { exact: false })).toBeVisible()
  await expect(preview.getByText('Sample Job name', { exact: false })).toBeVisible()
  await expect(preview.locator('script')).toHaveCount(0)
  await page.getByRole('button', { name: 'Save local draft', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Output review', exact: true }).click()
  await page.getByRole('button', { name: 'Output / issues', exact: true }).click()
  await expect(page.getByLabel('Require login', { exact: true })).not.toBeChecked()
  await expect(page.getByLabel('Attach completed form PDF', { exact: true })).toBeChecked()
  await expect(page.getByLabel('Custom email template', { exact: true })).toHaveValue(key)
  await page.getByRole('article', { name: 'Field 1', exact: true }).click()
  await page.getByRole('button', { name: 'Delete selected Job name', exact: true }).click()
  await page.getByRole('button', { name: 'Output / issues', exact: true }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'nonexistent or deleted field' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await page.getByRole('button', { name: 'Output / issues', exact: true }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'nonexistent or deleted field' }),
  ).toHaveCount(0)
  await expect(page.getByLabel('Custom email template', { exact: true })).toHaveValue(key)
})

test('familiar pane positions and sticky Fit survive device, mode, output and edits; manual zoom opts out', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await gotoPhase2App(page, '/admin/forms', createJobsFixture())
  await page.getByRole('button', { name: 'New form', exact: true }).click()
  await page.getByRole('button', { name: 'Add email', exact: true }).click()
  const fit = page.getByRole('button', { name: 'Fit', exact: true })
  await expect(fit).toHaveAttribute('aria-pressed', 'true')
  const palette = (await page.getByLabel('Field palette', { exact: true }).boundingBox())!,
    canvas = (await page.getByLabel('Form viewport', { exact: true }).boundingBox())!,
    settings = (await page.locator('.inspector-panel').boundingBox())!
  expect(palette.x + palette.width).toBeLessThan(canvas.x + 1)
  expect(canvas.x + canvas.width).toBeLessThan(settings.x + 1)
  expect((await page.locator('.form-builder-header').boundingBox())!.height).toBeLessThan(110)
  const devices = page.getByRole('group', { name: 'Preview device', exact: true })
  await devices.getByRole('button', { name: 'Phone', exact: true }).click()
  await expect(fit).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Full-page preview', exact: true }).click()
  await expect(fit).toHaveAttribute('aria-pressed', 'true')
  await devices.getByRole('button', { name: 'Tablet', exact: true }).click()
  await page.getByRole('button', { name: 'Edit fields', exact: true }).click()
  await page.getByLabel('Selected field label', { exact: true }).fill('Contact')
  await expect(fit).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click()
  const manual = await page.getByLabel('Zoom percentage', { exact: true }).textContent()
  await expect(fit).toHaveAttribute('aria-pressed', 'false')
  await devices.getByRole('button', { name: 'Desktop', exact: true }).click()
  await page.setViewportSize({ width: 1100, height: 1000 })
  await expect(page.getByLabel('Zoom percentage', { exact: true })).toHaveText(manual!)
  await fit.click()
  await expect(fit).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(() =>
      page
        .locator('.canvas-document')
        .evaluate(
          (el) =>
            el.getBoundingClientRect().width -
            document.querySelector('.viewport-scroll')!.clientWidth,
        ),
    )
    .toBeLessThanOrEqual(1)
  await page.screenshot({ path: test.info().outputPath('familiar-form-shell.png') })
})

test('scoped submission viewer shows full answers, photo navigation and denied entries without management grants', async ({
  page,
}) => {
  await setupFormServer(page)
  let revoked = false
  await page.route('**/formSubmissionViewer', async (route) => {
    const data = route.request().postDataJSON()?.data
    if (data.id !== 'entry-one' || data.token !== 'local-viewer-token' || revoked) {
      await route.fulfill({
        status: 400,
        json: {
          error: {
            status: 'PERMISSION_DENIED',
            message: 'This submission is unavailable or you do not have access.',
          },
        },
      })
      return
    }
    const result =
      data.action === 'photo'
        ? {
            contentType: 'image/png',
            base64:
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
          }
        : {
            id: 'entry-one',
            templateVersion: 1,
            submittedAt: 1790899200000,
            requireLogin: false,
            linkLifetimeDays: 30,
            canManage: false,
            definition: {
              title: 'Completed entry',
              description: 'Full question / answer view',
              version: 1,
              createdAt: '',
              recipients: [],
              fields: [
                {
                  id: 'notes',
                  kind: 'textarea',
                  label: 'Full notes',
                  required: false,
                  options: [],
                },
                { id: 'photo', kind: 'photo', label: 'Site photos', required: false, options: [] },
              ],
            },
            answers: { notes: 'First line\nSecond line', photo: ['photo-one', 'photo-two'] },
          }
    await route.fulfill({ json: { result } })
  })
  await page.goto('/form-submissions/entry-one#token=local-viewer-token')
  await expect(page.getByRole('heading', { name: 'Completed entry', exact: true })).toBeVisible()
  await expect(page.getByText('First line\nSecond line', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create share link', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'View Site photos 1', exact: true }).click()
  await expect(page.getByRole('img', { name: 'Site photos 1', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Next photo', exact: true }).click()
  await expect(page.getByRole('img', { name: 'Site photos 2', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close photo', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 900 })
  expect(
    await page.locator('main').evaluate((el) => el.scrollWidth - el.clientWidth),
  ).toBeLessThanOrEqual(1)
  revoked = true
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('unavailable')
  await expect(page.getByRole('heading', { name: 'Completed entry', exact: true })).toHaveCount(0)
  await page.goto('/form-submissions/another-entry#token=local-viewer-token')
  await expect(page.getByRole('alert')).toContainText('unavailable')
  await expect(page.getByText('First line\nSecond line', { exact: true })).toHaveCount(0)
})
