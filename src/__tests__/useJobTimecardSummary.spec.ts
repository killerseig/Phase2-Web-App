import { ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useJobTimecardSummary } from '@/features/timecards/useJobTimecardSummary'
import { createWorkbookLines } from '@/features/timecards/workbook'
import type { JobRecord, TimecardCardRecord, TimecardWeekRecord } from '@/types/domain'

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    active: true,
    assignedForemanIds: ['foreman-1'],
    code: '736',
    gc: 'General',
    id: 'job-shop',
    name: 'Shop',
    type: 'general',
    ...overrides,
  }
}

function makeWeek(overrides: Partial<TimecardWeekRecord> = {}): TimecardWeekRecord {
  return {
    employeeCardCount: 1,
    id: 'week-1',
    jobCode: '736',
    jobId: 'job-shop',
    jobName: 'Shop',
    ownerForemanName: 'CJ Blanchard',
    ownerForemanUserId: 'foreman-1',
    status: 'draft',
    weekEndDate: '2026-06-20',
    weekStartDate: '2026-06-14',
    ...overrides,
  }
}

function makeCard(overrides: Partial<TimecardCardRecord> = {}): TimecardCardRecord {
  const lines = createWorkbookLines('2026-06-14')
  const firstLine = lines[0]!
  firstLine.jobNumber = '736'
  firstLine.subsectionArea = 'Field'
  firstLine.account = '133/513'
  firstLine.days[1]!.hours = 8
  firstLine.days[2]!.hours = 6
  firstLine.days[1]!.production = 2
  firstLine.days[2]!.production = 1

  return {
    employeeId: 'employee-1',
    employeeNumber: '5133',
    firstName: 'CJ',
    footerAccount: '',
    footerAmount: '',
    footerJobOrGl: '',
    footerOffice: '',
    footerSecondAccount: '',
    footerSecondAmount: '',
    footerSecondJobOrGl: '',
    footerSecondOffice: '',
    fullName: 'Blanchard, CJ',
    id: 'card-1',
    isContractor: false,
    lastName: 'Blanchard',
    lines,
    notes: '',
    occupation: 'Foreman',
    overtimeHoursOverride: null,
    regularHoursOverride: null,
    sortIndex: 0,
    sourceType: 'employee',
    totals: {
      hoursByDay: [],
      hoursTotal: 14,
      lineTotal: 0,
      productionByDay: [],
      productionTotal: 3,
    },
    wageRate: null,
    ...overrides,
  }
}

function mountSummary(options: {
  activeSaveCount?: number
  canEditWeek?: boolean
  cards?: TimecardCardRecord[]
  ensuringWeek?: boolean
  job?: JobRecord | null
  lastSavedAt?: number | null
  pendingSaveCount?: number
  saveError?: string
  selectedWeek?: TimecardWeekRecord | null
  selectedWeekEndDate?: string
  selectedWeekStartDate?: string
} = {}) {
  const activeSaveCount = ref(options.activeSaveCount ?? 0)
  const canEditWeek = ref(options.canEditWeek ?? true)
  const cards = ref<TimecardCardRecord[]>(options.cards ?? [])
  const ensuringWeek = ref(options.ensuringWeek ?? false)
  const job = ref<JobRecord | null>(options.job === undefined ? makeJob() : options.job)
  const lastSavedAt = ref(options.lastSavedAt ?? null)
  const pendingSaveCount = ref(options.pendingSaveCount ?? 0)
  const saveError = ref(options.saveError ?? '')
  const selectedWeek = ref<TimecardWeekRecord | null>(
    options.selectedWeek === undefined ? makeWeek() : options.selectedWeek,
  )
  const selectedWeekEndDate = ref(options.selectedWeekEndDate ?? selectedWeek.value?.weekEndDate ?? '')
  const selectedWeekStartDate = ref(options.selectedWeekStartDate ?? selectedWeek.value?.weekStartDate ?? '')

  const state = useJobTimecardSummary({
    activeSaveCount,
    canEditWeek,
    cards,
    ensuringWeek,
    job,
    lastSavedAt,
    pendingSaveCount,
    saveError,
    selectedWeek,
    selectedWeekEndDate,
    selectedWeekStartDate,
  })

  return {
    activeSaveCount,
    canEditWeek,
    cards,
    ensuringWeek,
    job,
    lastSavedAt,
    pendingSaveCount,
    saveError,
    selectedWeek,
    selectedWeekEndDate,
    selectedWeekStartDate,
    state,
  }
}

describe('useJobTimecardSummary', () => {
  it('derives account summaries and total hours/production from visible cards', () => {
    const firstCard = makeCard()
    const secondCard = makeCard({
      id: 'card-2',
      totals: {
        hoursByDay: [],
        hoursTotal: 4,
        lineTotal: 0,
        productionByDay: [],
        productionTotal: 5,
      },
    })
    secondCard.lines[0]!.days[1]!.hours = 2
    secondCard.lines[0]!.days[2]!.hours = 2
    secondCard.lines[0]!.days[1]!.production = 5
    secondCard.lines[0]!.days[2]!.production = 0

    const { state } = mountSummary({
      cards: [firstCard, secondCard],
    })

    expect(state.totalHours.value).toBe(18)
    expect(state.totalProduction.value).toBe(8)
    expect(state.accountsSummary.value).toEqual([
      {
        account: '133/513',
        hoursTotal: 18,
        jobNumber: '736',
        key: '736|Field|133/513',
        productionTotal: 8,
        subsectionArea: 'Field',
      },
    ])
  })

  it('builds week, job, linked-job, and status labels from job/week state', () => {
    const { job, selectedWeek, state } = mountSummary({
      job: null,
      selectedWeek: makeWeek({
        jobCode: '5229',
        jobName: 'Lucky 3 Ranch',
        status: 'submitted',
      }),
    })

    expect(state.weekRangeLabel.value).toBe('Jun 14 - Jun 20')
    expect(state.weekStatusLabel.value).toBe('Submitted')
    expect(state.displayJobCode.value).toBe('5229')
    expect(state.displayJobName.value).toBe('Lucky 3 Ranch')
    expect(state.linkedJobNumber.value).toBe('5229')

    job.value = makeJob({ code: '736', name: 'Shop' })
    selectedWeek.value = makeWeek({ jobCode: '', jobName: '' })

    expect(state.displayJobCode.value).toBe('736')
    expect(state.displayJobName.value).toBe('Shop')
    expect(state.linkedJobNumber.value).toBe('736')
  })

  it('prioritizes week status and save-state labels for loading, errors, read-only, and saved states', () => {
    const {
      activeSaveCount,
      canEditWeek,
      ensuringWeek,
      lastSavedAt,
      pendingSaveCount,
      saveError,
      selectedWeek,
      selectedWeekEndDate,
      state,
    } = mountSummary({
      selectedWeek: null,
      selectedWeekEndDate: '',
    })

    expect(state.weekStatusLabel.value).toBe('No Week')

    selectedWeekEndDate.value = '2026-06-20'
    expect(state.weekStatusLabel.value).toBe('Not Created')

    ensuringWeek.value = true
    expect(state.weekStatusLabel.value).toBe('Opening Week')

    selectedWeek.value = makeWeek()
    expect(state.weekStatusLabel.value).toBe('Draft')

    expect(state.saveStateLabel.value).toBe('Ready')

    lastSavedAt.value = Date.now()
    expect(state.saveStateLabel.value).toBe('Saved')

    canEditWeek.value = false
    expect(state.saveStateLabel.value).toBe('Read Only')

    pendingSaveCount.value = 1
    expect(state.saveStateLabel.value).toBe('Saving...')

    activeSaveCount.value = 1
    pendingSaveCount.value = 0
    expect(state.saveStateLabel.value).toBe('Saving...')

    saveError.value = 'Could not save card.'
    expect(state.saveStateLabel.value).toBe('Could not save card.')
  })

  it('derives empty-canvas guidance from selected week/date/card/edit state', () => {
    const { canEditWeek, cards, selectedWeek, selectedWeekEndDate, state } = mountSummary({
      cards: [],
      selectedWeek: null,
      selectedWeekEndDate: '',
    })

    expect(state.emptyCanvasMessage.value).toBe('Choose a week ending date to start.')

    selectedWeekEndDate.value = '2026-06-20'
    expect(state.emptyCanvasMessage.value).toBe('No timecard week exists for this date yet. Create a week to start.')

    selectedWeek.value = makeWeek()
    expect(state.emptyCanvasMessage.value).toBe('Create a card to start this week.')

    canEditWeek.value = false
    expect(state.emptyCanvasMessage.value).toBe('No timecards were saved for this week.')

    cards.value = [makeCard()]
    expect(state.emptyCanvasMessage.value).toBe('No cards match this search.')
  })
})
