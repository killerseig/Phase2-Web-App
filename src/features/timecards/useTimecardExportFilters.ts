import { computed, reactive } from 'vue'
import {
  filterTimecardExportWeeks,
  getTimecardExportWeekFilterBounds,
  type TimecardExportDateFilterMode,
  type TimecardExportWeekStatusFilter,
} from '@/features/timecards/exportViewHelpers'
import { snapToSaturday } from '@/features/timecards/workbook'
import type { TimecardWeekRecord } from '@/types/domain'

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseTimecardExportFiltersOptions {
  currentWeekEndDate: string
  weeks: ReadonlyRef<TimecardWeekRecord[]>
}

export function useTimecardExportFilters({
  currentWeekEndDate,
  weeks,
}: UseTimecardExportFiltersOptions) {
  const filters = reactive({
    dateMode: 'single' as TimecardExportDateFilterMode,
    singleWeekEndDate: currentWeekEndDate,
    rangeStartDate: currentWeekEndDate,
    rangeEndDate: currentWeekEndDate,
    selectedJobIds: [] as string[],
    foreman: 'all',
    status: 'all' as TimecardExportWeekStatusFilter,
    weekSearch: '',
    cardSearch: '',
  })

  const activeWeekFilterBounds = computed(() => getTimecardExportWeekFilterBounds(filters))
  const filteredWeeks = computed(() => filterTimecardExportWeeks(weeks.value, filters, activeWeekFilterBounds.value))

  function updateToolbarFilter(field: keyof typeof filters, value: string | string[]) {
    switch (field) {
      case 'selectedJobIds':
        filters.selectedJobIds = Array.isArray(value) ? value : []
        return
      case 'dateMode':
        filters.dateMode = value === 'range' ? 'range' : 'single'
        return
      case 'singleWeekEndDate':
      case 'rangeStartDate':
      case 'rangeEndDate':
        filters[field] = snapToSaturday(typeof value === 'string' ? value : currentWeekEndDate)
        return
      case 'status':
        filters.status = value === 'submitted' || value === 'draft' ? value : 'all'
        return
      case 'foreman':
      case 'weekSearch':
      case 'cardSearch':
        filters[field] = typeof value === 'string' ? value : ''
    }
  }

  return {
    activeWeekFilterBounds,
    filteredWeeks,
    filters,
    updateToolbarFilter,
  }
}
