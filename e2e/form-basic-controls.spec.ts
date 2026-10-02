import { expect, test } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { setupFormServer } from './helpers/formFixture.js'

test('email, phone and time definitions roundtrip through the existing editor and preview', async ({
  page,
}) => {
  await gotoPhase2App(page, '/admin/forms', createJobsFixture())
  await page.getByRole('button', { name: 'New form', exact: true }).click()
  for (const kind of ['email', 'phone', 'time']) {
    await page.getByRole('button', { name: 'Add ' + kind, exact: true }).click()
    await page.getByLabel('Selected field label', { exact: true }).fill(kind)
    await page.getByLabel('Selected field required', { exact: true }).check()
  }
  await page.getByRole('button', { name: 'Save local draft', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Untitled form', exact: true }).click()
  await page.getByRole('button', { name: 'Full-page preview', exact: true }).click()
  for (const [id, value, type] of [
    ['email', 'employee@example.com', 'email'],
    ['phone', '+1 (555) 010-0200', 'tel'],
    ['time', '14:30', 'time'],
  ]) {
    const input = page.getByLabel('Full-page form preview').getByLabel(id, { exact: false })
    await expect(input).toHaveAttribute('type', type!)
    await expect(input).toHaveAttribute('aria-required', 'true')
    await input.fill(value!)
  }
  await page.getByRole('button', { name: 'Check required fields', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByLabel('email', { exact: false }).fill('bad')
  await page.getByRole('button', { name: 'Check required fields', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('email: enter a valid email address')
})

test('dedicated basics save, resume and submit with typed server validation', async ({ page }) => {
  const server = await setupFormServer(page)
  server.definition = {
    title: 'Practical basics',
    description: '',
    recipients: [],
    fields: ['email', 'phone', 'time'].map((kind) => ({
      id: kind,
      kind: kind as 'email' | 'phone' | 'time',
      label: kind,
      required: true,
      options: [],
    })),
  }
  // A template version is immutable: issue the configured version through the server fixture.
  await page.evaluate(async () => {
    await fetch('https://us-central1-demo-phase2-local.cloudfunctions.net/formTemplates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: { action: 'issue' } }),
    })
  })
  await page.reload()
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  await page.getByLabel('email', { exact: false }).fill('bad')
  await page.getByRole('button', { name: 'Submit form', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('email: enter a valid email address')
  for (const [id, value] of [
    ['email', 'employee@example.com'],
    ['phone', '+1 (555) 010-0200'],
    ['time', '14:30'],
  ])
    await page.getByLabel(id!, { exact: false }).fill(value!)
  await page.getByRole('button', { name: 'Save progress', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Progress saved')
  await page.reload()
  await page.getByRole('button', { name: /Resume draft/ }).click()
  await expect(page.getByLabel('time', { exact: false })).toHaveValue('14:30')
  await page.getByRole('button', { name: 'Submit form', exact: true }).click()
  await expect(page.getByText('Record status: submitted', { exact: false })).toBeVisible()
  expect(server.submitted).toBe(1)
  await expect(page.getByLabel('email', { exact: false })).toBeDisabled()
})
