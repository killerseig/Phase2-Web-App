import { computed, effectScope, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useTimecardExportSideEffects } from '@/features/timecards/useTimecardExportSideEffects'
import { createWorkbookLines } from '@/features/timecards/workbook'
import type { JobRecord, TimecardCardRecord } from '@/types/domain'

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: 'job-shop',
    active: true,
    assignedForemanIds: ['foreman-cj'],
    code: '736',
    gc: 'Phase 2',
    name: 'Shop',
    productionBurden: 0.33,
    type: 'General',
    ...overrides,
  }
}

function makeCard(overrides: Partial<TimecardCardRecord> = {}): TimecardCardRecord {
  return {
    id: 'card-1',
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
    lines: createWorkbookLines('2026-06-14'),
    notes: '',
    occupation: 'Shop Foreman',
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

function mountSideEffects(options: {
  cards?: TimecardCardRecord[]
  jobs?: JobRecord[]
} = {}) {
  const jobs = ref<JobRecord[]>(options.jobs ?? [makeJob()])
  const orderedCards = ref<TimecardCardRecord[]>(options.cards ?? [makeCard()])
  const redecorateLoadedCards = vi.fn()
  const syncSelectedCardFromVisibleCards = vi.fn()
  const scope = effectScope()

  scope.run(() => {
    useTimecardExportSideEffects({
      getJobs: () => jobs.value,
      orderedCards: computed(() => orderedCards.value),
      redecorateLoadedCards,
      syncSelectedCardFromVisibleCards,
    })
  })

  return {
    jobs,
    orderedCards,
    redecorateLoadedCards,
    scope,
    syncSelectedCardFromVisibleCards,
  }
}

describe('useTimecardExportSideEffects', () => {
  it('redecorates loaded cards only when job ids or production burden values change', async () => {
    const {
      jobs,
      redecorateLoadedCards,
      scope,
    } = mountSideEffects()

    await nextTick()
    expect(redecorateLoadedCards).not.toHaveBeenCalled()

    jobs.value = [
      makeJob({
        name: 'Shop Renamed',
        productionBurden: 0.33,
      }),
    ]
    await nextTick()

    expect(redecorateLoadedCards).not.toHaveBeenCalled()

    jobs.value = [
      makeJob({
        productionBurden: 0.45,
      }),
    ]
    await nextTick()

    expect(redecorateLoadedCards).toHaveBeenCalledTimes(1)

    jobs.value = [
      makeJob({
        productionBurden: 0.45,
      }),
      makeJob({
        id: 'job-lucky',
        code: '5229',
        name: 'Lucky 3 Ranch',
        productionBurden: null,
      }),
    ]
    await nextTick()

    expect(redecorateLoadedCards).toHaveBeenCalledTimes(2)

    scope.stop()
  })

  it('syncs selected-card state only when the ordered card id signature changes', async () => {
    const firstCard = makeCard()
    const secondCard = makeCard({
      id: 'card-2',
      employeeNumber: '5229',
      firstName: 'Vince',
      fullName: 'Hintz, Vince',
      lastName: 'Hintz',
    })
    const {
      orderedCards,
      scope,
      syncSelectedCardFromVisibleCards,
    } = mountSideEffects({
      cards: [firstCard],
    })

    await nextTick()
    expect(syncSelectedCardFromVisibleCards).not.toHaveBeenCalled()

    orderedCards.value = [
      {
        ...firstCard,
        notes: 'Same card, new note.',
      },
    ]
    await nextTick()

    expect(syncSelectedCardFromVisibleCards).not.toHaveBeenCalled()

    orderedCards.value = [firstCard, secondCard]
    await nextTick()

    expect(syncSelectedCardFromVisibleCards).toHaveBeenCalledTimes(1)
    expect(syncSelectedCardFromVisibleCards).toHaveBeenLastCalledWith([firstCard, secondCard])

    orderedCards.value = [secondCard, firstCard]
    await nextTick()

    expect(syncSelectedCardFromVisibleCards).toHaveBeenCalledTimes(2)
    expect(syncSelectedCardFromVisibleCards).toHaveBeenLastCalledWith([secondCard, firstCard])

    scope.stop()
  })
})
