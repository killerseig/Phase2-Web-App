import type { Page } from '@playwright/test'
import { expect, test } from './helpers/test.js'
import { createTimecardsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

const DEFAULT_WEEK_END_DATE = '2026-06-06'
const NEXT_WEEK_END_DATE = '2026-06-13'

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

async function selectWeekEnding(page: Page, weekEndDate = DEFAULT_WEEK_END_DATE) {
  const input = page.getByTestId('timecards-week-ending')
  await input.fill(weekEndDate)
  await input.dispatchEvent('change')
  await expect(input).toHaveValue(weekEndDate)
}

test.describe('timecard workbook regressions', () => {
  test('timecards require the foreman to choose a week ending date before creating a week', async ({ page }) => {
    const fixture = createTimecardsFixture({ seededCard: false })
    fixture.timecardWeeks = []
    fixture.timecardCards = []

    await gotoPhase2App(page, '/jobs/job-e2e/timecards', fixture)

    await expect(page.getByTestId('timecards-week-ending')).toHaveValue('')
    await expect(page.locator('.timecards-signal').filter({ hasText: 'Choose Week' })).toBeVisible()
    await expect(page.getByTestId('create-card')).toBeDisabled()
    await expect(page.getByText('Choose a week ending date to start.')).toBeVisible()
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          timecardWeeks?: unknown[]
        }
        return state.timecardWeeks?.length ?? -1
      }))
      .toBe(0)

    await selectWeekEnding(page)

    await expect(page.getByTestId('create-card')).toBeEnabled()
  })

  test('job timecard page does not show lock card controls', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e/timecards', createTimecardsFixture({ seededCard: true }))
    await selectWeekEnding(page)

    await expect(page.getByRole('button', { name: 'Lock Card' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Edit Card' })).toHaveCount(0)
  })

  test('seeded cards keep the linked job number on every starting row', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e/timecards', createTimecardsFixture({ seededCard: true }))
    await selectWeekEnding(page)

    await expect(page.getByTestId('timecard-job-number-0')).toHaveValue('9411')
    await expect(page.getByTestId('timecard-job-number-1')).toHaveValue('9411')
    await expect(page.getByTestId('timecard-job-number-2')).toHaveValue('9411')
    await expect(page.getByTestId('timecard-job-number-3')).toHaveValue('9411')
  })

  test('job number edits cascade downward and stop at the first intentionally changed row', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e/timecards', createTimecardsFixture({ seededCard: true }))
    await selectWeekEnding(page)

    await page.getByTestId('timecard-job-number-0').fill('123')
    await expect(page.getByTestId('timecard-job-number-0')).toHaveValue('123')
    await expect(page.getByTestId('timecard-job-number-1')).toHaveValue('123')
    await expect(page.getByTestId('timecard-job-number-2')).toHaveValue('123')
    await expect(page.getByTestId('timecard-job-number-3')).toHaveValue('123')

    await page.getByTestId('timecard-job-number-2').fill('456')
    await expect(page.getByTestId('timecard-job-number-0')).toHaveValue('123')
    await expect(page.getByTestId('timecard-job-number-1')).toHaveValue('123')
    await expect(page.getByTestId('timecard-job-number-2')).toHaveValue('456')
    await expect(page.getByTestId('timecard-job-number-3')).toHaveValue('456')

    await page.getByTestId('timecard-job-number-1').fill('565')
    await expect(page.getByTestId('timecard-job-number-0')).toHaveValue('123')
    await expect(page.getByTestId('timecard-job-number-1')).toHaveValue('565')
    await expect(page.getByTestId('timecard-job-number-2')).toHaveValue('456')
    await expect(page.getByTestId('timecard-job-number-3')).toHaveValue('456')
  })

  test('clicking a populated field selects its full value so typing replaces it', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e/timecards', createTimecardsFixture({ seededCard: true }))
    await selectWeekEnding(page)

    const firstJobNumber = page.getByTestId('timecard-job-number-0')

    await firstJobNumber.click()
    await firstJobNumber.pressSequentially('123')

    await expect(firstJobNumber).toHaveValue('123')
    await expect(page.getByTestId('timecard-job-number-1')).toHaveValue('123')
    await expect(page.getByTestId('timecard-job-number-2')).toHaveValue('123')
    await expect(page.getByTestId('timecard-job-number-3')).toHaveValue('123')
  })

  test('arrow keys move between the real workbook rows', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e/timecards', createTimecardsFixture({ seededCard: true }))
    await selectWeekEnding(page)

    const firstJobNumber = page.getByTestId('timecard-job-number-0')
    const secondJobNumber = page.getByTestId('timecard-job-number-1')

    await firstJobNumber.click()
    await firstJobNumber.press('ArrowDown')
    await expect(secondJobNumber).toBeFocused()

    await secondJobNumber.press('ArrowUp')
    await expect(firstJobNumber).toBeFocused()
  })

  test('total hours, REG, and OT update immediately while typing hours', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e/timecards', createTimecardsFixture({ seededCard: true }))
    await selectWeekEnding(page)

    const mondayHours = page.locator('.timecard-grid__body-row--hours .timecard-grid__day-cell input').first()

    await expect(page.getByTestId('timecard-total-hours')).toHaveText('0.0')
    await expect(page.getByTestId('timecard-regular-hours')).toHaveText('0')
    await expect(page.getByTestId('timecard-overtime-hours')).toHaveText('0')

    await mondayHours.fill('8')
    await expect(page.getByTestId('timecard-total-hours')).toHaveText('8.0')
    await expect(page.getByTestId('timecard-regular-hours')).toHaveText('8')
    await expect(page.getByTestId('timecard-overtime-hours')).toHaveText('0')

    await mondayHours.fill('45')
    await expect(page.getByTestId('timecard-total-hours')).toHaveText('45.0')
    await expect(page.getByTestId('timecard-regular-hours')).toHaveText('40')
    await expect(page.getByTestId('timecard-overtime-hours')).toHaveText('5')
  })

  test('existing timecard notes can be edited without replacing the whole note', async ({ page }) => {
    const fixture = createTimecardsFixture({ seededCard: true })
    fixture.timecardCards[0].notes = 'Existing note'

    await gotoPhase2App(page, '/jobs/job-e2e/timecards', fixture)
    await selectWeekEnding(page)

    const notesInput = page.getByTestId('timecard-notes-input')
    await expect(notesInput).toHaveValue('Existing note')

    const box = await notesInput.boundingBox()
    await notesInput.click({
      position: {
        x: Math.max(1, (box?.width ?? 160) - 2),
        y: Math.max(1, (box?.height ?? 16) / 2),
      },
    })
    await notesInput.pressSequentially(' updated')

    await expect(notesInput).toHaveValue('Existing note updated')
  })

  test('new card creation uses the current linked job number for all initial rows', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e/timecards', createTimecardsFixture({ seededCard: false }))
    await selectWeekEnding(page)

    await expect(page.getByTestId('create-card')).toBeEnabled()
    await page.getByTestId('create-card').click()
    await page.getByTestId('timecards-add-employee-employee-1').click()

    await expect(page.getByTestId('timecard-job-number-0')).toHaveValue('9411')
    await expect(page.getByTestId('timecard-job-number-1')).toHaveValue('9411')
    await expect(page.getByTestId('timecard-job-number-2')).toHaveValue('9411')
  })

  test('sorting cards by name orders them by last name', async ({ page }) => {
    const fixture = createTimecardsFixture({ seededCard: true })
    const baseCard = fixture.timecardCards[0]!

    fixture.timecardWeeks[0].employeeCardCount = 3
    fixture.timecardCards = [
      {
        ...cloneRecord(baseCard),
        id: 'card-zebra',
        firstName: 'Adam',
        lastName: 'Zebra',
        fullName: 'Adam Zebra',
        employeeNumber: '1002',
        sortIndex: 0,
      },
      {
        ...cloneRecord(baseCard),
        id: 'card-alpha',
        firstName: 'Zoe',
        lastName: 'Alpha',
        fullName: 'Zoe Alpha',
        employeeNumber: '1003',
        sortIndex: 1,
      },
      {
        ...cloneRecord(baseCard),
        id: 'card-brown',
        firstName: 'Mary',
        lastName: 'Brown',
        fullName: 'Mary Brown',
        employeeNumber: '1001',
        sortIndex: 2,
      },
    ]

    await gotoPhase2App(page, '/jobs/job-e2e/timecards', fixture)
    await selectWeekEnding(page)

    await expect(page.locator('[data-testid^="timecards-card-"]')).toHaveCount(3)
    await page.getByRole('radio', { name: 'Name' }).check()
    await page.getByRole('button', { name: /^Sort Cards$/ }).click()

    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          timecardCards?: Array<{ id?: string; sortIndex?: number }>
        }
        return (state.timecardCards ?? [])
          .slice()
          .sort((left, right) => (left.sortIndex ?? 0) - (right.sortIndex ?? 0))
          .map((card) => card.id)
      }))
      .toEqual(['card-alpha', 'card-brown', 'card-zebra'])

    await expect(page.locator('[data-testid^="timecards-card-"]').first()).toHaveAttribute('data-testid', 'timecards-card-card-alpha')
  })

  test('foremen can create a timecard when no week exists yet', async ({ page }) => {
    const fixture = createTimecardsFixture({ seededCard: false })
    fixture.timecardWeeks = []
    fixture.timecardCards = []

    await gotoPhase2App(page, '/jobs/job-e2e/timecards', fixture)
    await selectWeekEnding(page)

    await expect(page.getByTestId('create-card')).toBeEnabled()
    await page.getByTestId('create-card').click()
    await page.getByTestId('timecards-add-employee-employee-1').click()

    await expect(page.locator('[data-testid^="timecards-card-"]')).toHaveCount(1)
    await expect(page.getByTestId('timecard-job-number-0')).toHaveValue('9411')
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          timecardWeeks?: Array<{ ownerForemanUserId?: string | null }>
          timecardCards?: unknown[]
        }
        return {
          currentForemanWeeks: state.timecardWeeks?.filter((week) => week.ownerForemanUserId === 'foreman-e2e').length ?? 0,
          cardCount: state.timecardCards?.length ?? 0,
        }
      }))
      .toEqual({
        currentForemanWeeks: 1,
        cardCount: 1,
      })
  })

  test('timecard rollover clears copied ACCT values along with hours and production', async ({ page }) => {
    const fixture = createTimecardsFixture({ seededCard: true })
    fixture.timecardCards[0].lines[0].account = '4001'
    fixture.timecardCards[0].lines[0].days[1].hours = 8
    fixture.timecardCards[0].lines[0].days[1].production = 12

    await gotoPhase2App(page, '/jobs/job-e2e/timecards', fixture)
    await selectWeekEnding(page, NEXT_WEEK_END_DATE)

    await expect(page.locator('[data-testid^="timecards-card-"]')).toHaveCount(1)
    await expect(page.getByTestId('timecard-job-number-0')).toHaveValue('9411')
    await expect(page.getByTestId('timecard-account-0')).toHaveValue('')
    await expect(page.locator('.timecard-grid__body-row--hours .timecard-grid__day-cell input').first()).toHaveValue('')
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          timecardWeeks?: Array<{ weekEndDate?: string; employeeCardCount?: number }>
          timecardCards?: Array<{ weekId?: string; lines?: Array<{ account?: string; days?: Array<{ hours?: number; production?: number }> }> }>
        }
        const nextWeek = state.timecardWeeks?.find((week) => week.weekEndDate === '2026-06-13')
        const nextCard = state.timecardCards?.find((card) => card.weekId === nextWeek?.id)
        const firstLine = nextCard?.lines?.[0]
        return {
          employeeCardCount: nextWeek?.employeeCardCount ?? null,
          account: firstLine?.account ?? null,
          hours: firstLine?.days?.[1]?.hours ?? null,
          production: firstLine?.days?.[1]?.production ?? null,
        }
      }))
      .toEqual({
        employeeCardCount: 1,
        account: '',
        hours: 0,
        production: 0,
      })
  })

  test('opening an empty future draft backfills cards from the previous week', async ({ page }) => {
    const fixture = createTimecardsFixture({ seededCard: true })
    fixture.timecardCards[0].lines[0].account = '4001'
    fixture.timecardCards[0].lines[0].days[1].hours = 8
    fixture.timecardWeeks.push({
      ...fixture.timecardWeeks[0],
      id: 'week-empty-future',
      weekStartDate: '2026-06-07',
      weekEndDate: NEXT_WEEK_END_DATE,
      employeeCardCount: 0,
      createdAt: '2026-06-04T10:00:00.000Z',
      updatedAt: '2026-06-04T10:00:00.000Z',
    })

    await gotoPhase2App(page, '/jobs/job-e2e/timecards', fixture)
    await selectWeekEnding(page, NEXT_WEEK_END_DATE)

    await expect(page.locator('[data-testid^="timecards-card-"]')).toHaveCount(1)
    await expect(page.getByTestId('timecard-job-number-0')).toHaveValue('9411')
    await expect(page.getByTestId('timecard-account-0')).toHaveValue('')
    await expect(page.locator('.timecard-grid__body-row--hours .timecard-grid__day-cell input').first()).toHaveValue('')
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          timecardWeeks?: Array<{ id?: string; employeeCardCount?: number }>
          timecardCards?: Array<{ weekId?: string; lines?: Array<{ account?: string; days?: Array<{ hours?: number }> }> }>
        }
        const futureWeek = state.timecardWeeks?.find((week) => week.id === 'week-empty-future')
        const futureCard = state.timecardCards?.find((card) => card.weekId === 'week-empty-future')
        return {
          employeeCardCount: futureWeek?.employeeCardCount ?? null,
          account: futureCard?.lines?.[0]?.account ?? null,
          hours: futureCard?.lines?.[0]?.days?.[1]?.hours ?? null,
        }
      }))
      .toEqual({
        employeeCardCount: 1,
        account: '',
        hours: 0,
      })
  })

  test('foremen can create and submit timecards without a job assignment', async ({ page }) => {
    const fixture = createTimecardsFixture({ seededCard: false })
    fixture.auth.profile.assignedJobIds = []
    fixture.users = fixture.users.map((user) => (
      user.id === 'foreman-e2e'
        ? { ...user, assignedJobIds: [] }
        : user
    ))
    fixture.jobs = fixture.jobs.map((job) => ({ ...job, assignedForemanIds: [] }))
    fixture.timecardWeeks = []
    fixture.timecardCards = []

    await gotoPhase2App(page, '/jobs/job-e2e/timecards', fixture)
    await selectWeekEnding(page)

    await expect(page.getByTestId('create-card')).toBeEnabled()
    await page.getByTestId('create-card').click()
    await page.getByTestId('timecards-add-employee-employee-1').click()

    await expect(page.locator('[data-testid^="timecards-card-"]')).toHaveCount(1)
    await page.getByRole('button', { name: 'Submit Week' }).click()

    await expect(page.getByText('Week submitted and emailed to 1 recipient.')).toBeVisible()
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          timecardWeeks?: Array<{ ownerForemanUserId?: string | null; status?: string | null }>
        }
        return state.timecardWeeks?.find((week) => week.ownerForemanUserId === 'foreman-e2e')?.status ?? null
      }))
      .toBe('submitted')
  })

  test('foremen can create their own timecard when another foreman has the same job week', async ({ page }) => {
    const fixture = createTimecardsFixture({ seededCard: false })
    fixture.timecardWeeks = [
      {
        ...fixture.timecardWeeks[0],
        id: 'week-other-foreman',
        ownerForemanUserId: 'foreman-other',
        ownerForemanName: 'Sam Foreman',
      },
    ]
    fixture.timecardCards = []

    await gotoPhase2App(page, '/jobs/job-e2e/timecards', fixture)
    await selectWeekEnding(page)

    await expect(page.getByTestId('create-card')).toBeEnabled()
    await page.getByTestId('create-card').click()
    await page.getByTestId('timecards-add-employee-employee-1').click()

    await expect(page.locator('[data-testid^="timecards-card-"]')).toHaveCount(1)
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          timecardWeeks?: Array<{ ownerForemanUserId?: string | null }>
        }
        return state.timecardWeeks?.filter((week) => week.ownerForemanUserId === 'foreman-e2e').length ?? 0
      }))
      .toBe(1)
  })

  test('submitting a week reports the notification email result', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e/timecards', createTimecardsFixture({ seededCard: true }))
    await selectWeekEnding(page)

    await page.getByRole('button', { name: 'Submit Week' }).click()

    await expect(page.getByText('Week submitted and emailed to 1 recipient.')).toBeVisible()
  })

  test('the same employee can be added more than once for multiple card pages', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e/timecards', createTimecardsFixture({ seededCard: true }))
    await selectWeekEnding(page)

    await page.getByTestId('create-card').click()
    await expect(page.getByTestId('timecards-add-employee-employee-1')).toBeVisible()
    await page.getByTestId('timecards-add-employee-employee-1').click()

    await expect(page.locator('[data-testid^="timecards-card-"]')).toHaveCount(2)

    await page.getByTestId('create-card').click()
    await expect(page.getByTestId('timecards-add-employee-employee-1')).toBeVisible()
  })

  test('deleting the last card returns the empty weekly workspace state', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e/timecards', createTimecardsFixture({ seededCard: true }))
    await selectWeekEnding(page)

    await expect(page.getByTestId('timecards-card-card-e2e')).toBeVisible()

    await page.getByRole('button', { name: 'Delete Card' }).click()

    await expect(page.getByText('Removed the timecard.')).toBeVisible()
    await expect(page.getByTestId('timecards-card-card-e2e')).toHaveCount(0)
    await expect(page.getByText('Create a card to start this week.')).toBeVisible()
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          timecardCards?: unknown[]
        }
        return state.timecardCards?.length ?? -1
      }))
      .toBe(0)
  })

  test('submitted weeks stay read only on the job timecard page', async ({ page }) => {
    const fixture = createTimecardsFixture({ seededCard: true })
    fixture.timecardWeeks[0].status = 'submitted'
    fixture.timecardWeeks[0].submittedAt = '2026-06-04T12:30:00.000Z'

    await gotoPhase2App(page, '/jobs/job-e2e/timecards', fixture)
    await selectWeekEnding(page)

    await expect(page.getByTestId('create-card')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Submit Week' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Delete Card' })).toHaveCount(0)
    await expect(page.locator('.timecards-signal').filter({ hasText: 'Read Only' })).toBeVisible()
    await expect(page.locator('.timecard-grid__body-row--hours .timecard-grid__day-cell input').first()).toBeDisabled()
  })

  test('wage formatting rules still hold on the real workbook page', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e/timecards', createTimecardsFixture({ seededCard: true }))
    await selectWeekEnding(page)

    const wageInput = page.getByTestId('timecard-wage-input')

    await wageInput.fill('')
    await wageInput.blur()
    await expect(wageInput).toHaveValue('')

    await wageInput.click()
    await wageInput.pressSequentially('abc')
    await wageInput.blur()
    await expect(wageInput).toHaveValue('')

    await wageInput.fill('1.')
    await wageInput.blur()
    await expect(wageInput).toHaveValue('$1.00')

    await wageInput.click()
    await wageInput.press('Control+A')
    await wageInput.pressSequentially('12.3')
    await wageInput.blur()
    await expect(wageInput).toHaveValue('$12.30')

    await wageInput.fill('20')
    await wageInput.blur()
    await expect(wageInput).toHaveValue('$20.00')

    await wageInput.fill('2.5')
    await wageInput.blur()
    await expect(wageInput).toHaveValue('$2.50')
  })

  test('the full H / P / C row structure stays visible', async ({ page }) => {
    await gotoPhase2App(page, '/jobs/job-e2e/timecards', createTimecardsFixture({ seededCard: true }))
    await selectWeekEnding(page)

    await expect(page.getByTestId('timecard-row-label-0-hours')).toHaveText('H')
    await expect(page.getByTestId('timecard-row-label-0-production')).toHaveText('P')
    await expect(page.getByTestId('timecard-row-label-0-cost')).toHaveText('C')
  })
})
