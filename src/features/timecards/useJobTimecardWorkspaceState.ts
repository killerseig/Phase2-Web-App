import { computed } from 'vue'
import {
  filterAvailableTimecardEmployees,
  filterJobTimecardCards,
  preferJobTimecardDisplayWeek,
} from '@/features/timecards/jobViewHelpers'
import {
  DEFAULT_TIMECARD_BURDEN,
  getWeekStartFromSaturday,
} from '@/features/timecards/workbook'
import type { EmployeeRecord, JobRecord, TimecardCardRecord, TimecardWeekRecord } from '@/types/domain'
import type { ReadonlyRef } from '@/types/reactivity'

interface UseJobTimecardWorkspaceStateOptions {
  cardSearchTerm: ReadonlyRef<string>
  cards: ReadonlyRef<TimecardCardRecord[]>
  employeeSearchTerm: ReadonlyRef<string>
  employees: ReadonlyRef<EmployeeRecord[]>
  ensuringWeek: ReadonlyRef<boolean>
  getCanManageJobTimecards: () => boolean
  getCanUseJobTimecardWorkflow: () => boolean
  job: ReadonlyRef<JobRecord | null>
  jobId: ReadonlyRef<string | null>
  selectedWeekEndDate: ReadonlyRef<string>
  selectedWeekId: ReadonlyRef<string | null>
  weeks: ReadonlyRef<TimecardWeekRecord[]>
  weeksLoading: ReadonlyRef<boolean>
}

export function useJobTimecardWorkspaceState({
  cardSearchTerm,
  cards,
  employeeSearchTerm,
  employees,
  ensuringWeek,
  getCanManageJobTimecards,
  getCanUseJobTimecardWorkflow,
  job,
  jobId,
  selectedWeekEndDate,
  selectedWeekId,
  weeks,
  weeksLoading,
}: UseJobTimecardWorkspaceStateOptions) {
  const weeksForSelectedDate = computed(() => (
    weeks.value.filter((week) => week.weekEndDate === selectedWeekEndDate.value)
  ))
  const selectedWeek = computed(() => {
    if (selectedWeekId.value) {
      const exactWeek = weeks.value.find((week) => week.id === selectedWeekId.value)
      if (exactWeek && exactWeek.weekEndDate === selectedWeekEndDate.value) return exactWeek
    }

    return preferJobTimecardDisplayWeek(weeksForSelectedDate.value)
  })
  const selectedWeekStartDate = computed(() => (
    selectedWeek.value?.weekStartDate
    ?? (selectedWeekEndDate.value ? getWeekStartFromSaturday(selectedWeekEndDate.value) : '')
  ))
  const filteredCards = computed(() => filterJobTimecardCards(cards.value, cardSearchTerm.value))
  const availableEmployees = computed(() => filterAvailableTimecardEmployees(employees.value, employeeSearchTerm.value))
  const canEditWeek = computed(() => {
    if (!selectedWeek.value) return false
    if (selectedWeek.value.status === 'submitted') return getCanManageJobTimecards()
    return getCanUseJobTimecardWorkflow()
  })
  const canCreateSelectedWeek = computed(() => (
    !!jobId.value
    && !!selectedWeekEndDate.value
    && !selectedWeek.value
    && !weeksLoading.value
    && !ensuringWeek.value
    && getCanUseJobTimecardWorkflow()
  ))
  const burdenValue = computed(() => job.value?.productionBurden ?? DEFAULT_TIMECARD_BURDEN)
  const recentWeeks = computed(() => weeks.value.slice(0, 10))

  return {
    availableEmployees,
    burdenValue,
    canCreateSelectedWeek,
    canEditWeek,
    filteredCards,
    recentWeeks,
    selectedWeek,
    selectedWeekStartDate,
    weeksForSelectedDate,
  }
}
