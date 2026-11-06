import { mockDashboard } from './helpers/dashboardFixture.js'
import { expect, test } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

for (const action of ['switch', 'close', 'leave'] as const) test(`pending job edits are saved before ${action}`, async ({ page }) => {
  const fixture = createJobsFixture()
  fixture.delays = { jobUpdateMs: 500 }
  await gotoPhase2App(page, '/jobs?jobAction=edit&jobId=job-1', fixture)
  await page.getByLabel('Job Name', { exact: true }).fill('Pending job change')
  if (action === 'switch') await page.getByTestId('job-card-2B').click()
  else if (action === 'close') await page.getByTestId('jobs-edit-mode').click()
  else await page.getByRole('link', { name: 'Employees', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__PHASE2_E2E_STATE__?.jobs?.find(job => job.id === 'job-1')?.name)).toBe('Pending job change')
  expect(await page.evaluate(() => window.__PHASE2_E2E_STATE__?.jobs?.find(job => job.id === 'job-2')?.name)).toBe(fixture.jobs[1]!.name)
})

for (const width of [1280, 390]) test(`invalid job edits stay available until explicit discard at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 })
  const fixture = createJobsFixture()
  await gotoPhase2App(page, '/jobs?jobAction=edit&jobId=job-1', fixture)
  await page.getByLabel('Job Number', { exact: true }).fill('')
  expect(await page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented })).toBe(true)
  await page.getByTestId('job-card-2B').click()
  await expect(page.getByRole('dialog')).toHaveCSS('background-color', 'rgb(23, 43, 58)')
  await page.getByRole('dialog').screenshot({ path: test.info().outputPath('pending-job-discard-' + width + '.png') })
  await page.getByRole('dialog').getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(page.getByLabel('Job Number', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Job Name', { exact: true })).toHaveValue(fixture.jobs[0]!.name)
  await page.getByTestId('job-card-2B').click()
  await page.getByRole('dialog').getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expect(page.getByLabel('Job Name', { exact: true })).toHaveValue(fixture.jobs[1]!.name)
  expect(await page.evaluate(() => window.__PHASE2_E2E_STATE__?.jobs?.find(job => job.id === 'job-1')?.code)).toBe(fixture.jobs[0]!.code)
})

test('new job drafts and unadded recipient addresses require deliberate discard', async ({ page }) => {
  const fixture = createJobsFixture()
  await gotoPhase2App(page, '/jobs?jobAction=create', fixture)
  await page.getByTestId('jobs-create-name').fill('Unsaved new job')
  await page.getByRole('link', { name: 'Employees', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(page.getByTestId('jobs-create-name')).toHaveValue('Unsaved new job')
  await page.getByTestId('job-card-1A').click()
  await page.getByRole('dialog').getByRole('button', { name: 'Discard changes', exact: true }).click()
  await page.getByRole('textbox', { name: 'Daily Logs email address', exact: true }).fill('draft@example.com')
  await page.getByRole('button', { name: /All Jobs Global notification defaults/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Daily Logs email address', exact: true })).toHaveValue('draft@example.com')
  await page.getByRole('button', { name: /All Jobs Global notification defaults/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'All Jobs', exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.__PHASE2_E2E_STATE__?.jobs?.length)).toBe(fixture.jobs.length)
  expect(await page.evaluate(() => JSON.stringify(window.__PHASE2_E2E_STATE__?.jobs))).toBe(JSON.stringify(fixture.jobs))
})

test('navigation waits for an in-flight snapshot and saves newer edits to the original job', async ({ page }) => {
  const fixture = createJobsFixture()
  fixture.delays = { jobUpdateMs: 800 }
  await gotoPhase2App(page, '/jobs?jobAction=edit&jobId=job-1', fixture)
  await page.getByLabel('Job Name', { exact: true }).fill('First snapshot')
  await expect(page.getByText('Saving...', { exact: true })).toBeVisible()
  await page.getByLabel('Job Name', { exact: true }).fill('Newest snapshot')
  await page.getByTestId('job-card-2B').click()
  await expect(page.locator('.jobs-detail')).toHaveAttribute('inert', '')
  await expect(page.getByLabel('Job Name', { exact: true })).toHaveValue(fixture.jobs[1]!.name)
  expect(await page.evaluate(() => window.__PHASE2_E2E_STATE__?.jobs?.find(job => job.id === 'job-1')?.name)).toBe('Newest snapshot')
})

test('directory filtering does not clear an invalid unsaved job form', async ({ page }) => {
  await gotoPhase2App(page, '/jobs?jobAction=edit&jobId=job-1', createJobsFixture())
  await page.getByLabel('Job Name', { exact: true }).fill('')
  await page.getByTestId('jobs-search').fill('Paint')
  await expect(page.getByTestId('job-card-1A')).toHaveCount(0)
  await expect(page.getByLabel('Job Name', { exact: true })).toHaveValue('')
  await page.getByTestId('jobs-status-filter').selectOption('inactive')
  await expect(page.getByLabel('Job Name', { exact: true })).toHaveValue('')
})

test('archive confirmation waits for pending job fields to save', async ({ page }) => {
  const fixture = createJobsFixture()
  fixture.delays = { jobUpdateMs: 500 }
  await gotoPhase2App(page, '/jobs?jobAction=edit&jobId=job-1', fixture)
  await page.getByLabel('Job Name', { exact: true }).fill('Saved before archive')
  await page.getByRole('button', { name: 'Archive Job', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(await page.evaluate(() => window.__PHASE2_E2E_STATE__?.jobs?.find(job => job.id === 'job-1')?.name)).toBe('Saved before archive')
  await page.getByRole('dialog').getByRole('button', { name: 'Archive Job', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__PHASE2_E2E_STATE__?.jobs?.find(job => job.id === 'job-1')?.active)).toBe(false)
})

test('reverting a field while a different snapshot saves still persists the revert', async ({ page }) => {
  const fixture = createJobsFixture()
  fixture.delays = { jobUpdateMs: 800 }
  await gotoPhase2App(page, '/jobs?jobAction=edit&jobId=job-1', fixture)
  const name = page.getByLabel('Job Name', { exact: true })
  await name.fill('Temporary field change')
  await expect(page.getByText('Saving...', { exact: true })).toBeVisible()
  await name.fill(fixture.jobs[0]!.name)
  await expect(page.getByText('All changes saved.', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.__PHASE2_E2E_STATE__?.jobs?.find(job => job.id === 'job-1')?.name)).toBe(fixture.jobs[0]!.name)
  await expect(name).toHaveValue(fixture.jobs[0]!.name)
})

test('signing out saves pending job edits before clearing the session', async ({ page }) => {
  const fixture = createJobsFixture()
  fixture.delays = { jobUpdateMs: 500 }
  await gotoPhase2App(page, '/jobs?jobAction=edit&jobId=job-1', fixture)
  await page.getByLabel('Job Name', { exact: true }).fill('Saved before sign out')
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click()
  await expect(page).toHaveURL(/\/login(?:\?|$)/)
  expect(await page.evaluate(() => window.__PHASE2_E2E_STATE__?.jobs?.find(job => job.id === 'job-1')?.name)).toBe('Saved before sign out')
})

test('cancelled sign-out retains an invalid job draft and the active session', async ({ page }) => {
  const fixture = createJobsFixture()
  await gotoPhase2App(page, '/jobs?jobAction=edit&jobId=job-1', fixture)
  await page.getByLabel('Job Number', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(page).toHaveURL(/\/jobs\?/)
  await expect(page.getByLabel('Job Number', { exact: true })).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Sign Out', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expect(page).toHaveURL(/\/login(?:\?|$)/)
  expect(await page.evaluate(() => window.__PHASE2_E2E_STATE__?.jobs?.find(job => job.id === 'job-1')?.code)).toBe(fixture.jobs[0]!.code)
})

test('personal layout sign-out respects cancel and explicit discard before ending the session', async ({ page }) => {
  const api = await mockDashboard(page)
  api.layouts.set('personal', { version: 1, widgets: [{ id: 'message', type: 'text', title: 'Message', text: 'Saved', span: 12 }] })
  await gotoPhase2App(page, '/dashboards/personal', createJobsFixture())
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByLabel('Text content', { exact: true }).fill('Keep this layout draft')
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByLabel('Text content', { exact: true })).toHaveValue('Keep this layout draft')
  await expect(page.getByRole('button', { name: 'Sign Out', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expect(page).toHaveURL(/\/login(?:\?|$)/)
  expect(api.requests.filter(request => request.action === 'save-template')).toHaveLength(0)
})
