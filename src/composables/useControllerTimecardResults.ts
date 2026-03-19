import { computed, ref, type Ref } from 'vue'
import type {
  ControllerJobGroup,
  ControllerSortKey,
  ControllerSortOption,
} from '@/components/controller/controllerTypes'
import type { ControllerTimecardWeekItem } from '@/services/Email'
import type { TimecardModel } from '@/views/timecards/timecardUtils'

type SortDir = 'asc' | 'desc'

type UseControllerTimecardResultsOptions = {
  reviewTimecards: Ref<ControllerTimecardWeekItem[]>
  loadedTimecardMap: Ref<Record<string, TimecardModel>>
  buildTimecardKey: (jobId: string, timecardId: string) => string
}

const sortOptions: ControllerSortOption[] = [
  { key: 'weekEnding', label: 'Week Ending' },
  { key: 'jobName', label: 'Job' },
  { key: 'jobCode', label: 'Code' },
  { key: 'employeeNumber', label: 'Employee #' },
  { key: 'employeeName', label: 'Employee' },
  { key: 'occupation', label: 'Trade' },
  { key: 'status', label: 'Status' },
  { key: 'totalHours', label: 'Hours' },
  { key: 'totalProduction', label: 'Production' },
  { key: 'totalLine', label: 'Line Total' },
  { key: 'submittedAt', label: 'Submitted' },
]

export function useControllerTimecardResults(options: UseControllerTimecardResultsOptions) {
  const { reviewTimecards, loadedTimecardMap, buildTimecardKey } = options

  const timecardSortKey = ref<ControllerSortKey>('weekEnding')
  const timecardSortDir = ref<SortDir>('asc')

  const currentSortLabel = computed(() => (
    sortOptions.find((option) => option.key === timecardSortKey.value)?.label || 'Week Ending'
  ))

  const sortedTimecards = computed(() => {
    const rows = [...reviewTimecards.value]
    const direction = timecardSortDir.value === 'asc' ? 1 : -1

    const statusRank = (status: ControllerTimecardWeekItem['status']) => (status === 'submitted' ? 0 : 1)

    const valueForSort = (row: ControllerTimecardWeekItem, key: ControllerSortKey): string | number => {
      switch (key) {
        case 'status':
          return statusRank(row.status)
        case 'totalHours':
          return row.totalHours
        case 'totalProduction':
          return row.totalProduction
        case 'totalLine':
          return row.totalLine
        case 'submittedAt':
          return row.submittedAtMs ?? -1
        default:
          return String(row[key] ?? '').toLowerCase()
      }
    }

    rows.sort((a, b) => {
      const left = valueForSort(a, timecardSortKey.value)
      const right = valueForSort(b, timecardSortKey.value)

      if (left === right) {
        return (
          String(a.weekEnding || '').localeCompare(String(b.weekEnding || ''))
          || a.jobName.localeCompare(b.jobName)
          || a.employeeName.localeCompare(b.employeeName)
        )
      }

      if (typeof left === 'number' && typeof right === 'number') {
        return (left - right) * direction
      }

      return String(left).localeCompare(String(right)) * direction
    })

    return rows
  })

  const groupedTimecards = computed<ControllerJobGroup[]>(() => {
    const groups = new Map<string, ControllerJobGroup>()

    for (const row of sortedTimecards.value) {
      const key = buildTimecardKey(row.jobId, row.timecardId)
      const timecard = loadedTimecardMap.value[key]
      if (!timecard) continue
      const creatorKey = row.createdByUid || 'unknown'

      let group = groups.get(row.jobId)
      if (!group) {
        group = {
          jobId: row.jobId,
          jobName: row.jobName,
          jobCode: row.jobCode,
          totalCount: 0,
          draftCount: 0,
          submittedCount: 0,
          totalHours: 0,
          totalProduction: 0,
          totalLine: 0,
          creatorGroups: [],
        }
        groups.set(row.jobId, group)
      }

      let creatorGroup = group.creatorGroups.find((entry) => entry.creatorKey === creatorKey)
      if (!creatorGroup) {
        creatorGroup = {
          creatorKey,
          creatorName: row.createdByName || 'Unknown Creator',
          totalCount: 0,
          draftCount: 0,
          submittedCount: 0,
          totalHours: 0,
          totalProduction: 0,
          totalLine: 0,
          timecards: [],
        }
        group.creatorGroups.push(creatorGroup)
      }

      const groupedTimecard = { key, row, timecard }
      creatorGroup.timecards.push(groupedTimecard)
      creatorGroup.totalCount += 1
      creatorGroup.totalHours += timecard.totals?.hoursTotal ?? 0
      creatorGroup.totalProduction += timecard.totals?.productionTotal ?? 0
      creatorGroup.totalLine += timecard.totals?.lineTotal ?? 0

      group.totalCount += 1
      group.totalHours += timecard.totals?.hoursTotal ?? 0
      group.totalProduction += timecard.totals?.productionTotal ?? 0
      group.totalLine += timecard.totals?.lineTotal ?? 0
      if (timecard.status === 'submitted') {
        creatorGroup.submittedCount += 1
        group.submittedCount += 1
      } else {
        creatorGroup.draftCount += 1
        group.draftCount += 1
      }
    }

    return Array.from(groups.values()).map((group) => ({
      ...group,
      creatorGroups: group.creatorGroups
        .map((creatorGroup) => ({
          ...creatorGroup,
          timecards: creatorGroup.timecards,
        }))
        .sort((left, right) => left.creatorName.localeCompare(right.creatorName)),
    }))
  })

  function formatTimecardWeek(timecard: TimecardModel): string {
    return `Week ending ${timecard.weekEndingDate}`
  }

  function toggleSortDirection() {
    timecardSortDir.value = timecardSortDir.value === 'asc' ? 'desc' : 'asc'
  }

  function handleSortKeyChange(value: string) {
    timecardSortKey.value = value as ControllerSortKey
  }

  function resetSort() {
    timecardSortKey.value = 'weekEnding'
    timecardSortDir.value = 'asc'
  }

  return {
    currentSortLabel,
    formatTimecardWeek,
    groupedTimecards,
    handleSortKeyChange,
    resetSort,
    sortOptions,
    sortedTimecards,
    timecardSortDir,
    timecardSortKey,
    toggleSortDirection,
  }
}
