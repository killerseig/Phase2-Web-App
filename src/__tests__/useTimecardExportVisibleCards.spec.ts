import { reactive, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import {
  type TimecardExportArchiveCardRecord,
  type TimecardExportSortMode,
} from '@/features/timecards/exportViewHelpers'
import { useTimecardExportVisibleCards } from '@/features/timecards/useTimecardExportVisibleCards'
import type { TimecardWeekRecord } from '@/types/domain'

function makeWeek(overrides: Partial<TimecardWeekRecord> = {}): TimecardWeekRecord {
  return {
    id: 'week-1',
    employeeCardCount: 1,
    jobCode: '5229',
    jobId: 'job-1',
    jobName: 'Lucky 3 Ranch',
    ownerForemanName: 'Vince Hintz',
    ownerForemanUserId: 'foreman-1',
    status: 'draft',
    weekEndDate: '2026-06-20',
    weekStartDate: '2026-06-14',
    ...overrides,
  }
}

function makeCard(overrides: Partial<TimecardExportArchiveCardRecord> = {}): TimecardExportArchiveCardRecord {
  return {
    id: 'card-1',
    archiveBurden: 0.33,
    archiveForemanName: 'Vince Hintz',
    archiveJobCode: '5229',
    archiveJobId: 'job-1',
    archiveJobName: 'Lucky 3 Ranch',
    archiveWeekEndDate: '2026-06-20',
    archiveWeekId: 'week-1',
    archiveWeekStartDate: '2026-06-14',
    archiveWeekStatus: 'draft',
    employeeId: 'employee-1',
    employeeNumber: '5133',
    firstName: 'Vince',
    footerAccount: '',
    footerAmount: '',
    footerJobOrGl: '',
    footerOffice: '',
    footerSecondAccount: '',
    footerSecondAmount: '',
    footerSecondJobOrGl: '',
    footerSecondOffice: '',
    fullName: 'Hintz, Vince',
    isContractor: false,
    lastName: 'Hintz',
    lines: [],
    notes: '',
    occupation: 'Foreman',
    overtimeHoursOverride: null,
    regularHoursOverride: null,
    sortIndex: 0,
    sourceType: 'employee',
    totals: {
      hoursByDay: [],
      hoursTotal: 0,
      lineTotal: 0,
      productionByDay: [],
      productionTotal: 0,
    },
    wageRate: null,
    ...overrides,
  }
}

function mountVisibleCards(options: {
  cards?: TimecardExportArchiveCardRecord[]
  cardsByWeekId?: Record<string, TimecardExportArchiveCardRecord[]>
  cardSearch?: string
  sortMode?: TimecardExportSortMode
  targetCreateWeek?: TimecardWeekRecord | null
} = {}) {
  const cards = ref<TimecardExportArchiveCardRecord[]>(options.cards ?? [])
  const cardsByWeekId = options.cardsByWeekId ?? {}
  const filters = reactive({ cardSearch: options.cardSearch ?? '' })
  const sortMode = ref<TimecardExportSortMode>(options.sortMode ?? 'name')
  const targetCreateWeek = ref<TimecardWeekRecord | null>(options.targetCreateWeek ?? null)
  const state = useTimecardExportVisibleCards({
    cards,
    cardsByWeekId,
    collator: new Intl.Collator('en-US', { numeric: true, sensitivity: 'base' }),
    filters,
    sortMode,
    targetCreateWeek,
  })

  return {
    cards,
    filters,
    sortMode,
    state,
    targetCreateWeek,
  }
}

describe('useTimecardExportVisibleCards', () => {
  it('returns the cards for the active create week without flattening unrelated weeks', () => {
    const weekOne = makeWeek({ id: 'week-1' })
    const weekTwo = makeWeek({ id: 'week-2' })
    const weekOneCards = [makeCard({ id: 'card-week-1', archiveWeekId: 'week-1' })]
    const weekTwoCards = [makeCard({ id: 'card-week-2', archiveWeekId: 'week-2' })]
    const { state, targetCreateWeek } = mountVisibleCards({
      cardsByWeekId: {
        'week-1': weekOneCards,
        'week-2': weekTwoCards,
      },
      targetCreateWeek: weekOne,
    })

    expect(state.activeCreateWeekCards.value.map((card) => card.id)).toEqual(['card-week-1'])

    targetCreateWeek.value = weekTwo
    expect(state.activeCreateWeekCards.value.map((card) => card.id)).toEqual(['card-week-2'])

    targetCreateWeek.value = makeWeek({ id: 'missing-week' })
    expect(state.activeCreateWeekCards.value).toEqual([])

    targetCreateWeek.value = null
    expect(state.activeCreateWeekCards.value).toEqual([])
  })

  it('filters cards by display fields and sorts the filtered cards by name or employee number', () => {
    const { filters, sortMode, state } = mountVisibleCards({
      cards: [
        makeCard({
          id: 'card-vince',
          employeeNumber: '10',
          fullName: 'Hintz, Vince',
          occupation: 'Foreman',
        }),
        makeCard({
          id: 'card-cj',
          employeeNumber: '2',
          fullName: 'Blanchard, CJ',
          occupation: 'Shop Foreman',
        }),
        makeCard({
          id: 'card-alison',
          employeeNumber: '1',
          fullName: 'Larsen, Alison',
          occupation: 'Admin',
        }),
      ],
    })

    filters.cardSearch = 'foreman'

    expect(state.filteredCards.value.map((card) => card.id)).toEqual(['card-vince', 'card-cj'])
    expect(state.orderedCards.value.map((card) => card.id)).toEqual(['card-cj', 'card-vince'])

    sortMode.value = 'number'

    expect(state.orderedCards.value.map((card) => card.id)).toEqual(['card-cj', 'card-vince'])

    filters.cardSearch = ''

    expect(state.orderedCards.value.map((card) => card.id)).toEqual(['card-alison', 'card-cj', 'card-vince'])
  })
})
