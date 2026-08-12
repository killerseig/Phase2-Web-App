import { ref } from 'vue'
import { describe, expect, it } from 'vitest'

import {
  type TimecardExportArchiveCardRecord,
} from '@/features/timecards/exportViewHelpers'
import { useTimecardExportSummary } from '@/features/timecards/useTimecardExportSummary'
import { createWorkbookLines } from '@/features/timecards/workbook'
import type { TimecardWeekRecord } from '@/types/domain'

function makeWeek(overrides: Partial<TimecardWeekRecord> = {}): TimecardWeekRecord {
  return {
    id: 'week-1',
    employeeCardCount: 1,
    jobCode: '736',
    jobId: 'job-shop',
    jobName: 'Shop',
    ownerForemanName: 'CJ Blanchard',
    ownerForemanUserId: 'foreman-1',
    status: 'submitted',
    weekEndDate: '2026-06-20',
    weekStartDate: '2026-06-14',
    ...overrides,
  }
}

function makeCard(overrides: Partial<TimecardExportArchiveCardRecord> = {}): TimecardExportArchiveCardRecord {
  const lines = createWorkbookLines('2026-06-14')
  const firstLine = lines[0]!
  firstLine.jobNumber = '736'
  firstLine.subsectionArea = 'Field'
  firstLine.account = '133/513'
  firstLine.days[1]!.hours = 8
  firstLine.days[2]!.hours = 8
  firstLine.days[1]!.production = 1
  firstLine.days[2]!.production = 2

  return {
    id: 'card-1',
    archiveBurden: 0.33,
    archiveForemanName: 'CJ Blanchard',
    archiveJobCode: '736',
    archiveJobId: 'job-shop',
    archiveJobName: 'Shop',
    archiveWeekEndDate: '2026-06-20',
    archiveWeekId: 'week-1',
    archiveWeekStartDate: '2026-06-14',
    archiveWeekStatus: 'submitted',
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
    isContractor: false,
    lastName: 'Blanchard',
    lines,
    notes: '',
    occupation: 'Shop Foreman',
    overtimeHoursOverride: null,
    regularHoursOverride: null,
    sortIndex: 0,
    sourceType: 'employee',
    totals: {
      hoursByDay: [],
      hoursTotal: 16,
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
  bounds?: { startDate: string, endDate: string }
  cards?: TimecardExportArchiveCardRecord[]
  cardsLoading?: boolean
  currentWeekEndDate?: string
  filteredCards?: TimecardExportArchiveCardRecord[]
  filteredWeeks?: TimecardWeekRecord[]
  lastSavedAt?: number | null
  orderedCards?: TimecardExportArchiveCardRecord[]
  pendingSaveCount?: number
  saveError?: string
} = {}) {
  const cards = ref<TimecardExportArchiveCardRecord[]>(options.cards ?? [])
  const filteredCards = ref<TimecardExportArchiveCardRecord[]>(options.filteredCards ?? cards.value)
  const filteredWeeks = ref<TimecardWeekRecord[]>(options.filteredWeeks ?? [])
  const orderedCards = ref<TimecardExportArchiveCardRecord[]>(options.orderedCards ?? filteredCards.value)
  const state = useTimecardExportSummary({
    activeSaveCount: ref(options.activeSaveCount ?? 0),
    activeWeekFilterBounds: ref(options.bounds ?? { startDate: '2026-06-20', endDate: '2026-06-20' }),
    cards,
    cardsLoading: ref(options.cardsLoading ?? false),
    currentWeekEndDate: options.currentWeekEndDate ?? '2026-06-20',
    filteredCards,
    filteredWeeks,
    lastSavedAt: ref(options.lastSavedAt ?? null),
    orderedCards,
    pendingSaveCount: ref(options.pendingSaveCount ?? 0),
    saveError: ref(options.saveError ?? ''),
  })

  return {
    cards,
    filteredCards,
    filteredWeeks,
    orderedCards,
    state,
  }
}

describe('useTimecardExportSummary', () => {
  it('derives totals and account summaries from export cards', () => {
    const firstCard = makeCard()
    const secondCard = makeCard({
      id: 'card-2',
      totals: {
        hoursByDay: [],
        hoursTotal: 4,
        lineTotal: 0,
        productionByDay: [],
        productionTotal: 3,
      },
    })
    secondCard.lines[0]!.days[1]!.hours = 4
    secondCard.lines[0]!.days[2]!.hours = 0
    secondCard.lines[0]!.days[1]!.production = 3
    secondCard.lines[0]!.days[2]!.production = 0

    const { state } = mountSummary({
      cards: [firstCard, secondCard],
    })

    expect(state.totalHours.value).toBe(20)
    expect(state.totalProduction.value).toBe(6)
    expect(state.accountsSummary.value).toEqual([
      {
        account: '133/513',
        hoursTotal: 20,
        jobNumber: '736',
        key: '736|Field|133/513',
        productionTotal: 6,
        subsectionArea: 'Field',
      },
    ])
  })

  it('builds week, package, job, foreman, status, PDF, and CSV labels', () => {
    const card = makeCard()
    const { state } = mountSummary({
      bounds: { startDate: '2026-06-13', endDate: '2026-06-20' },
      cards: [card],
      filteredCards: [card],
      filteredWeeks: [
        makeWeek({ id: 'week-shop', jobId: 'job-shop', jobCode: '736', jobName: 'Shop', ownerForemanName: 'CJ Blanchard' }),
        makeWeek({
          id: 'week-lucky',
          jobId: 'job-lucky',
          jobCode: '5229',
          jobName: 'Lucky 3 Ranch',
          ownerForemanName: 'Vince Hintz',
        }),
      ],
      orderedCards: [card],
    })

    expect(state.visibleWeekHeading.value).toBe('6/13/2026 - 6/20/2026')
    expect(state.matchingPackageCountLabel.value).toBe('2 saved week packages')
    expect(state.matchingJobsLabel.value).toBe('2 jobs')
    expect(state.matchingForemenLabel.value).toBe('2 foremen')
    expect(state.weekStatusLabel.value).toBe('Submitted')
    expect(state.buildPdfExportSubtitle()).toBe('6/13/2026 - 6/20/2026 \u00b7 2 saved week packages \u00b7 1 cards')
    expect(state.buildCsvExportFilename()).toBe('timecard-export-2026-06-13_to_2026-06-20.csv')
  })

  it('prioritizes save status and empty-canvas messages for loading, errors, and filtered results', () => {
    const card = makeCard()
    const { filteredCards, filteredWeeks, state } = mountSummary({
      cards: [card],
      cardsLoading: true,
      filteredCards: [card],
      filteredWeeks: [makeWeek()],
      orderedCards: [card],
    })

    expect(state.saveStateLabel.value).toBe('Loading...')
    expect(state.statusSignals.value).toEqual([
      { key: 'results', text: 'Status: Submitted', tone: 'success' },
      { key: 'autosave', text: 'Save: Loading', tone: 'default' },
      { key: 'weeks', text: 'Weeks: 1', tone: 'default' },
      { key: 'cards', text: 'Cards: 1', tone: 'default' },
    ])
    expect(state.emptyCanvasMessage.value).toBe('No timecards available.')

    filteredCards.value = []

    expect(state.emptyCanvasMessage.value).toBe('No cards match this employee search.')

    filteredWeeks.value = []

    expect(state.weekStatusLabel.value).toBe('No Results')
    expect(state.emptyCanvasMessage.value).toBe('No saved weeks match the current filters.')
  })

  it('shows pending, saved, no-week, and error save states in priority order', () => {
    const activeSaveCount = ref(0)
    const cardsLoading = ref(false)
    const filteredWeeks = ref<TimecardWeekRecord[]>([makeWeek()])
    const lastSavedAt = ref<number | null>(null)
    const pendingSaveCount = ref(0)
    const saveError = ref('')
    const state = useTimecardExportSummary({
      activeSaveCount,
      activeWeekFilterBounds: ref({ startDate: '2026-06-20', endDate: '2026-06-20' }),
      cards: ref([]),
      cardsLoading,
      currentWeekEndDate: '2026-06-20',
      filteredCards: ref([]),
      filteredWeeks,
      lastSavedAt,
      orderedCards: ref([]),
      pendingSaveCount,
      saveError,
    })

    expect(state.saveStateLabel.value).toBe('Idle')

    pendingSaveCount.value = 1
    expect(state.saveStateLabel.value).toBe('Saving...')

    pendingSaveCount.value = 0
    lastSavedAt.value = 123
    expect(state.saveStateLabel.value).toBe('Saved')

    lastSavedAt.value = null
    filteredWeeks.value = []
    expect(state.saveStateLabel.value).toBe('No Matching Weeks')

    saveError.value = 'Could not save card.'
    expect(state.saveStateLabel.value).toBe('Could not save card.')
    expect(state.statusSignals.value[1]).toEqual({
      key: 'autosave',
      text: 'Save: Error',
      tone: 'error',
    })
  })
})
