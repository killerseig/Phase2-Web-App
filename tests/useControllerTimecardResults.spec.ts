import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useControllerTimecardResults } from '@/composables/useControllerTimecardResults'
import type { ControllerTimecardWeekItem } from '@/services/Email'
import type { TimecardModel } from '@/utils/timecardUtils'

function createReviewRow(overrides: Partial<ControllerTimecardWeekItem> = {}): ControllerTimecardWeekItem {
  return {
    id: overrides.id ?? 'row-1',
    timecardId: overrides.timecardId ?? 'tc-1',
    jobId: overrides.jobId ?? 'job-1',
    jobName: overrides.jobName ?? 'Alpha Build',
    jobCode: overrides.jobCode ?? '100',
    createdByUid: overrides.createdByUid ?? 'creator-1',
    createdByName: overrides.createdByName ?? 'Pat Foreman',
    employeeNumber: overrides.employeeNumber ?? '100',
    employeeName: overrides.employeeName ?? 'Casey Stone',
    firstName: overrides.firstName ?? 'Casey',
    lastName: overrides.lastName ?? 'Stone',
    occupation: overrides.occupation ?? 'Carpenter',
    status: overrides.status ?? 'draft',
    weekStart: overrides.weekStart ?? '2026-03-08',
    weekEnding: overrides.weekEnding ?? '2026-03-14',
    totalHours: overrides.totalHours ?? 8,
    totalProduction: overrides.totalProduction ?? 5,
    totalLine: overrides.totalLine ?? 240,
    subcontractedEmployee: overrides.subcontractedEmployee ?? false,
    submittedAt: overrides.submittedAt ?? null,
    submittedAtMs: overrides.submittedAtMs ?? null,
  }
}

function createTimecard(overrides: Partial<TimecardModel> = {}): TimecardModel {
  return {
    id: overrides.id ?? 'tc-1',
    jobId: overrides.jobId ?? 'job-1',
    weekStartDate: overrides.weekStartDate ?? '2026-03-08',
    weekEndingDate: overrides.weekEndingDate ?? '2026-03-14',
    status: overrides.status ?? 'draft',
    createdByUid: overrides.createdByUid ?? 'creator-1',
    employeeRosterId: overrides.employeeRosterId ?? 'roster-1',
    employeeNumber: overrides.employeeNumber ?? '100',
    employeeName: overrides.employeeName ?? 'Casey Stone',
    firstName: overrides.firstName ?? 'Casey',
    lastName: overrides.lastName ?? 'Stone',
    occupation: overrides.occupation ?? 'Carpenter',
    employeeWage: overrides.employeeWage ?? 30,
    subcontractedEmployee: overrides.subcontractedEmployee ?? false,
    productionBurden: overrides.productionBurden ?? 0.33,
    jobs: overrides.jobs ?? [],
    days: overrides.days ?? [],
    totals: overrides.totals ?? {
      hours: [0, 0, 0, 0, 0, 0, 0],
      production: [0, 0, 0, 0, 0, 0, 0],
      hoursTotal: 8,
      productionTotal: 5,
      lineTotal: 240,
    },
    notes: overrides.notes ?? '',
    archived: overrides.archived ?? false,
  }
}

describe('useControllerTimecardResults', () => {
  it('groups timecards by job and creator using hydrated timecard totals', () => {
    const reviewTimecards = ref<ControllerTimecardWeekItem[]>([
      createReviewRow(),
      createReviewRow({
        id: 'row-2',
        timecardId: 'tc-2',
        createdByUid: 'creator-2',
        createdByName: 'Jordan Smith',
        employeeName: 'Jordan Smith',
        employeeNumber: '101',
        status: 'submitted',
        totalHours: 12,
        totalProduction: 7,
        totalLine: 360,
      }),
    ])
    const loadedTimecardMap = ref<Record<string, TimecardModel>>({
      'job-1::tc-1': createTimecard(),
      'job-1::tc-2': createTimecard({
        id: 'tc-2',
        status: 'submitted',
        createdByUid: 'creator-2',
        employeeName: 'Jordan Smith',
        employeeNumber: '101',
        totals: {
          hours: [0, 0, 0, 0, 0, 0, 0],
          production: [0, 0, 0, 0, 0, 0, 0],
          hoursTotal: 12,
          productionTotal: 7,
          lineTotal: 360,
        },
      }),
    })

    const results = useControllerTimecardResults({
      reviewTimecards,
      loadedTimecardMap,
      buildTimecardKey: (jobId, timecardId) => `${jobId}::${timecardId}`,
    })

    expect(results.groupedTimecards.value).toHaveLength(1)

    const [group] = results.groupedTimecards.value

    expect(group).toBeDefined()
    expect(group!.totalCount).toBe(2)
    expect(group!.draftCount).toBe(1)
    expect(group!.submittedCount).toBe(1)
    expect(group!.totalHours).toBe(20)
    expect(group!.creatorGroups).toHaveLength(2)
  })

  it('tracks sort state and exposes the formatted timecard week label', () => {
    const results = useControllerTimecardResults({
      reviewTimecards: ref([]),
      loadedTimecardMap: ref({}),
      buildTimecardKey: (jobId, timecardId) => `${jobId}::${timecardId}`,
    })

    expect(results.currentSortLabel.value).toBe('Week Ending')

    results.handleSortKeyChange('employeeName')
    results.toggleSortDirection()

    expect(results.timecardSortKey.value).toBe('employeeName')
    expect(results.timecardSortDir.value).toBe('desc')
    expect(results.currentSortLabel.value).toBe('Employee')
    expect(results.formatTimecardWeek(createTimecard())).toBe('Week ending 2026-03-14')
  })
})
