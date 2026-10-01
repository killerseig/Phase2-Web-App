import { expect, test } from './helpers/test.js'
import { setupFormServer, fillCommitteeAudit } from './helpers/formFixture.js'

test('opening creates no record; explicit progress survives refresh and resume', async ({
  page,
}) => {
  const server = await setupFormServer(page)
  expect(server.created).toBe(0)
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  await page.getByLabel('Job name', { exact: false }).fill('Saved synthetic job')
  await page.getByRole('button', { name: 'Save progress', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Progress saved')
  await page.reload()
  await page.getByRole('button', { name: /Resume draft/ }).click()
  await expect(page.getByLabel('Job name', { exact: false })).toHaveValue('Saved synthetic job')
  expect(server.created).toBe(1)
  expect(server.submitted).toBe(0)
})

test('adverse rating needs notes and server rejection preserves answers', async ({ page }) => {
  const server = await setupFormServer(page)
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  await fillCommitteeAudit(page)
  await page.getByLabel('First impression rating', { exact: false }).selectOption('Unsatisfactory')
  await page.getByRole('button', { name: 'Submit form', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('First impression notes is required')
  await expect(page.getByLabel('Job name', { exact: false })).toHaveValue('Synthetic Job name')
  expect(server.submitted).toBe(0)
  await page
    .getByLabel('First impression notes', { exact: false })
    .fill('Synthetic follow-up required.')
  await page.getByRole('button', { name: 'Submit form', exact: true }).click()
  await expect(page.getByText('Record status: submitted', { exact: false })).toBeVisible()
  expect(server.submitted).toBe(1)
})

test('lost create and save responses reuse identifiers without duplicate drafts or lost edits', async ({
  page,
}) => {
  const server = await setupFormServer(page, { lostCreate: true, lostSave: true })
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  expect(server.created).toBe(1)
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  await page.getByLabel('Job name', { exact: false }).fill('Retry-safe draft')
  await page.getByRole('button', { name: 'Save progress', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByLabel('Job name', { exact: false })).toHaveValue('Retry-safe draft')
  await page.getByRole('button', { name: 'Save progress', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Progress saved')
  expect(server.created).toBe(1)
  expect(server.saveRequests[0]).toBe(server.saveRequests[1])
})

test('lost submit confirmation retries once and submitted answers become immutable', async ({
  page,
}) => {
  const server = await setupFormServer(page, { lostSubmit: true })
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  await fillCommitteeAudit(page)
  await page.getByRole('button', { name: 'Submit form', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  expect(server.submitted).toBe(1)
  await expect(page.getByLabel('Job name', { exact: false })).toBeDisabled()
  await page.getByRole('button', { name: 'Retry submission confirmation', exact: true }).click()
  await expect(page.getByText('Record status: submitted', { exact: false })).toBeVisible()
  expect(server.submitted).toBe(1)
  expect(server.submitRequests[0]).toBe(server.submitRequests[1])
  await expect(page.getByRole('button', { name: 'Submit form', exact: true })).toBeDisabled()
})

test('photo attachment is retained on the draft and can be read through its record', async ({
  page,
}) => {
  const server = await setupFormServer(page)
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  await page.getByLabel('Job name', { exact: false }).fill('Photo draft')
  await page
    .getByLabel('First impression photos', { exact: false })
    .setInputFiles({
      name: 'synthetic.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    })
  await page.getByRole('button', { name: 'View First impression photos', exact: true }).click()
  await expect(
    page.getByRole('img', { name: 'First impression photos', exact: true }),
  ).toBeVisible()
  expect([...server.records.values()][0]!.answers.jobName).toBe('Photo draft')
  expect([...server.records.values()][0]!.answers.photo_impression).toHaveLength(1)
})

test('email failure and retry leave the immutable submission untouched', async ({ page }) => {
  const server = await setupFormServer(page, { failedDelivery: true })
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  await fillCommitteeAudit(page)
  await page.getByRole('button', { name: 'Submit form', exact: true }).click()
  await expect(page.getByText('Email delivery: failed.', { exact: false })).toBeVisible()
  const snapshot = JSON.stringify([...server.records.values()][0])
  await page.getByRole('button', { name: 'Retry email delivery', exact: true }).click()
  await expect(page.getByText('Email delivery: sent.', { exact: false })).toBeVisible()
  expect(JSON.stringify([...server.records.values()][0])).toBe(snapshot)
  expect(server.submitted).toBe(1)
  expect(server.emailRetries).toBe(1)
})

test('later template edits and archiving preserve the older submitted version', async ({
  page,
}) => {
  const server = await setupFormServer(page)
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  await fillCommitteeAudit(page)
  await page.getByRole('button', { name: 'Submit form', exact: true }).click()
  await expect(page.getByText('Record status: submitted', { exact: false })).toBeVisible()
  const snapshot = JSON.stringify([...server.records.values()][0])
  server.definition = { ...server.definition, title: 'Later audit definition' }
  server.latestVersion = 2
  server.archived = true
  await page.reload()
  await page.getByRole('button', { name: /View submitted form/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Committee Site Audit · version 1', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start draft', exact: true })).toBeDisabled()
  expect(JSON.stringify([...server.records.values()][0])).toBe(snapshot)
})

test('another owner record is denied without exposing its answers', async ({ page }) => {
  const server = await setupFormServer(page)
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  const saved = [...server.records.values()][0]!
  saved.ownerUid = 'other-user'
  await page.reload()
  await page.getByRole('button', { name: /Resume draft/ }).click()
  await expect(page.getByRole('alert')).toContainText('belongs to another user')
  await expect(page.getByLabel('Job name', { exact: false })).toHaveCount(0)
})
