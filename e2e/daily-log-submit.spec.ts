import { expect, test, type Page } from './helpers/test.js'
import { createDailyLogsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

const requiredFieldValues: Record<string, string> = {
  weeklySchedule: 'Crew A framing, Crew B layout, and safety meeting at 7:00 AM.',
  manpowerAssessment: 'Current staffing covers the planned work for today.',
  safetyConcerns: 'Scissor lift work needs spotter coverage in the lobby.',
  ahaReviewed: 'Reviewed with the whole crew before the shift started.',
  scheduleConcerns: 'No schedule blockers at this time.',
  budgetConcerns: 'Tracking material waste and labor hours closely.',
  deliveriesReceived: 'Received 2 pallets of board and 4 boxes of anchors.',
  deliveriesNeeded: 'Need 1 more pallet of board by Friday morning.',
  newWorkAuthorizations: 'No new work authorizations were issued today.',
  qcAssignedTo: 'CJ Larsen',
  qcAreasInspected: 'Lobby, corridor, and office wing.',
  qcIssuesIdentified: 'Found minor board damage in the north corridor.',
  qcIssuesResolved: 'Damaged board was replaced before closeout.',
  notesCorrespondence: 'Updated the PM and GC during the afternoon call.',
  actionItems: 'Confirm Friday delivery window and prep staging area.',
}

async function fillRequiredDailyLogFields(page: Page) {
  for (const [fieldKey, value] of Object.entries(requiredFieldValues)) {
    await page.getByTestId(`dailylog-${fieldKey}`).fill(value)
  }
}

test.describe('daily log submit workflows', () => {
  test('submit blocks incomplete drafts with the real validation message', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e/daily-logs', createDailyLogsFixture())

    await page.getByRole('button', { name: 'Submit Daily Log' }).click()

    await expect(page.getByText('Complete "Weekly Schedule" before submitting.')).toBeVisible()
    await expect(page.getByTestId('dailylog-history-daily-log-1')).toContainText('Draft #1')
  })

  test('submit turns the draft into a submitted log and reports email success', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e/daily-logs', createDailyLogsFixture())

    await fillRequiredDailyLogFields(page)
    await page.getByRole('button', { name: 'Submit Daily Log' }).click()

    await expect(page.getByText('Daily log submitted and emailed.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Submit Daily Log' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Delete Draft' })).toHaveCount(0)
    await expect(page.getByText('Status: Submitted')).toBeVisible()
    await expect(page.getByTestId('dailylog-history-daily-log-1')).toContainText('Submitted #1')
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          dailyLogs?: Array<{ status?: string | null }>
        }
        return state.dailyLogs?.[0]?.status ?? null
      }))
      .toBe('submitted')
  })

  test('daily log photos upload, save descriptions, and remove from the real form', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e/daily-logs', createDailyLogsFixture())

    const photosCard = page.locator('.daily-logs-card', {
      has: page.getByRole('heading', { name: 'Photos', exact: true }),
    })
    const pngBuffer = (globalThis as unknown as {
      Buffer: { from: (bytes: number[]) => unknown }
    }).Buffer.from([
      0x89, 0x50, 0x4e, 0x47,
      0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01,
      0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00,
      0x00, 0x90, 0x77, 0x53,
      0xde, 0x00, 0x00, 0x00,
      0x0c, 0x49, 0x44, 0x41,
      0x54, 0x08, 0xd7, 0x63,
      0xf8, 0xcf, 0xc0, 0x00,
      0x00, 0x03, 0x01, 0x01,
      0x00, 0x18, 0xdd, 0x8d,
      0xb0, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4e,
      0x44, 0xae, 0x42, 0x60,
      0x82,
    ])

    await photosCard.locator('input[type="file"]').setInputFiles({
      name: 'site-progress.png',
      mimeType: 'image/png',
      buffer: pngBuffer as never,
    })

    await expect(photosCard.getByText('site-progress.png')).toBeVisible()
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          dailyLogs?: Array<{ id?: string; payload?: { attachments?: Array<{ name?: string }> } }>
        }
        return state.dailyLogs?.find((log) => log.id === 'daily-log-1')?.payload?.attachments?.length ?? 0
      }))
      .toBe(1)

    await photosCard.getByPlaceholder('Description').fill('North corridor progress photo')
    await photosCard.getByPlaceholder('Description').press('Tab')

    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          dailyLogs?: Array<{
            id?: string
            payload?: { attachments?: Array<{ description?: string }> }
          }>
        }
        return state.dailyLogs?.find((log) => log.id === 'daily-log-1')?.payload?.attachments?.[0]?.description ?? ''
      }))
      .toBe('North corridor progress photo')

    await photosCard.getByRole('button', { name: 'Delete' }).click()

    await expect(photosCard.getByText('site-progress.png')).toHaveCount(0)
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          dailyLogs?: Array<{ id?: string; payload?: { attachments?: unknown[] } }>
        }
        return state.dailyLogs?.find((log) => log.id === 'daily-log-1')?.payload?.attachments?.length ?? 0
      }))
      .toBe(0)
  })

  test('submitted daily logs become read-only and allow starting another draft for today', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e/daily-logs', createDailyLogsFixture())

    await fillRequiredDailyLogFields(page)
    await page.getByRole('button', { name: 'Submit Daily Log' }).click()

    await expect(page.getByText('Daily log submitted and emailed.')).toBeVisible()
    await expect(page.getByTestId('dailylog-weeklySchedule')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Delete Draft' })).toHaveCount(0)
    await expect(page.getByTestId('dailylog-history-daily-log-1')).toContainText('Submitted #1')

    await page.getByRole('button', { name: 'Another Daily Log' }).click()

    await expect(page.getByText('Daily log draft created.')).toBeVisible()
    await expect(page.getByTestId('dailylog-weeklySchedule')).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Submit Daily Log' })).toBeEnabled()
    await expect(page.getByRole('heading', { name: 'Draft #2' })).toBeVisible()
  })
})
