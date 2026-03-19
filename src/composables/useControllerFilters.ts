import { computed, ref, type Ref } from 'vue'
import type { Job } from '@/types/models'
import type {
  ControllerSubcontractedFilter,
  ControllerTimecardFilters,
  ControllerTimecardStatusFilter,
} from '@/services/Email'
import {
  createDatePickerConfig,
  getLastCompletedSaturdayDateInputValue,
  isValidDateInputValue,
} from '@/utils/dateInputs'
import {
  formatWeekRange,
  getSaturdayFromSunday,
  snapToSunday,
} from '@/utils/modelValidation'

type ControllerJobOption = {
  id: string
  label: string
}

type ControllerLoadedPeriod = {
  startWeek: string
  endWeek: string
  startWeekEnding: string
  endWeekEnding: string
}

function formatSearchRange(startWeek: string, endWeek: string): string {
  if (!startWeek) return 'No week selected'

  const startLabel = formatWeekRange(startWeek, getSaturdayFromSunday(startWeek))
  if (!endWeek || startWeek === endWeek) return startLabel

  const endLabel = formatWeekRange(endWeek, getSaturdayFromSunday(endWeek))
  return `${startLabel} to ${endLabel}`
}

function filterSignature(filters: ControllerTimecardFilters | null): string {
  if (!filters) return ''
  return JSON.stringify({
    startWeek: filters.startWeek,
    endWeek: filters.endWeek || filters.startWeek,
    jobId: filters.jobId || '',
    trade: filters.trade || '',
    firstName: filters.firstName || '',
    lastName: filters.lastName || '',
    subcontracted: filters.subcontracted || 'all',
    status: filters.status || 'all',
  })
}

function summarizeFilters(
  filters: ControllerTimecardFilters | null,
  jobOptions: ControllerJobOption[],
): string {
  if (!filters) return 'No filters applied.'

  const parts: string[] = []
  const jobLabel = filters.jobId
    ? jobOptions.find((job) => job.id === filters.jobId)?.label || 'Selected job'
    : ''

  if (jobLabel) parts.push(`Job: ${jobLabel}`)
  if (filters.trade) parts.push(`Trade: ${filters.trade}`)
  if (filters.firstName) parts.push(`First: ${filters.firstName}`)
  if (filters.lastName) parts.push(`Last: ${filters.lastName}`)
  if (filters.subcontracted === 'subcontracted') parts.push('Subcontracted only')
  if (filters.subcontracted === 'direct') parts.push('Direct labor only')
  if (filters.status !== 'all') parts.push(`Status: ${filters.status}`)

  return parts.length ? parts.join(' | ') : 'All jobs, trades, and employees.'
}

export function useControllerFilters(options: { jobs: Ref<Job[]> }) {
  const lastCompletedSaturday = getLastCompletedSaturdayDateInputValue()
  const lastCompletedWeekStart = snapToSunday(lastCompletedSaturday)

  const useWeekRange = ref(false)
  const selectedSingleDate = ref(lastCompletedSaturday)
  const selectedRangeStartDate = ref(lastCompletedSaturday)
  const selectedRangeEndDate = ref(lastCompletedSaturday)
  const selectedJobId = ref('')
  const tradeFilter = ref('')
  const firstNameFilter = ref('')
  const lastNameFilter = ref('')
  const subcontractedFilter = ref<ControllerSubcontractedFilter>('all')
  const statusFilter = ref<ControllerTimecardStatusFilter>('all')

  const appliedFilters = ref<ControllerTimecardFilters | null>(null)
  const loadedPeriod = ref<ControllerLoadedPeriod>({
    startWeek: lastCompletedWeekStart,
    endWeek: lastCompletedWeekStart,
    startWeekEnding: getSaturdayFromSunday(lastCompletedWeekStart),
    endWeekEnding: getSaturdayFromSunday(lastCompletedWeekStart),
  })

  const maxSelectableWeek = computed(() => getLastCompletedSaturdayDateInputValue())
  const weekPickerConfig = computed(() => createDatePickerConfig({
    maxDate: maxSelectableWeek.value,
  }))

  const currentStartWeek = computed(() => {
    const source = useWeekRange.value ? selectedRangeStartDate.value : selectedSingleDate.value
    return isValidDateInputValue(source) ? snapToSunday(source) : ''
  })

  const currentEndWeek = computed(() => {
    const source = useWeekRange.value ? selectedRangeEndDate.value : selectedSingleDate.value
    return isValidDateInputValue(source) ? snapToSunday(source) : ''
  })

  const currentWeekLabel = computed(() => formatSearchRange(currentStartWeek.value, currentEndWeek.value))
  const loadedWeekLabel = computed(() => formatSearchRange(loadedPeriod.value.startWeek, loadedPeriod.value.endWeek))

  const filterValidationError = computed(() => {
    if (!currentStartWeek.value || !currentEndWeek.value) {
      return 'Choose a valid week before searching.'
    }

    const start = new Date(`${currentStartWeek.value}T00:00:00Z`)
    const end = new Date(`${currentEndWeek.value}T00:00:00Z`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return 'Choose a valid week before searching.'
    }
    if (end.getTime() < start.getTime()) {
      return 'End week must be on or after the start week.'
    }

    return ''
  })

  const jobOptions = computed<ControllerJobOption[]>(() => {
    const jobs = [...options.jobs.value]
    jobs.sort((left, right) => {
      const leftLabel = `${left.code || ''} ${left.name}`.trim().toLowerCase()
      const rightLabel = `${right.code || ''} ${right.name}`.trim().toLowerCase()
      return leftLabel.localeCompare(rightLabel)
    })

    return jobs.map((job) => ({
      id: job.id,
      label: [job.code, job.name].filter(Boolean).join(' - ') || job.name,
    }))
  })

  function buildFilterPayload(): ControllerTimecardFilters | null {
    if (filterValidationError.value) return null

    return {
      startWeek: currentStartWeek.value,
      endWeek: currentEndWeek.value || currentStartWeek.value,
      jobId: selectedJobId.value || '',
      trade: tradeFilter.value.trim(),
      firstName: firstNameFilter.value.trim(),
      lastName: lastNameFilter.value.trim(),
      subcontracted: subcontractedFilter.value,
      status: statusFilter.value,
    }
  }

  const currentFilterSummary = computed(() => (
    summarizeFilters(buildFilterPayload(), jobOptions.value)
  ))

  const activeFilterSummary = computed(() => (
    summarizeFilters(appliedFilters.value, jobOptions.value)
  ))

  const autoFilterSignature = computed(() => JSON.stringify({
    useWeekRange: useWeekRange.value,
    selectedSingleDate: selectedSingleDate.value,
    selectedRangeStartDate: selectedRangeStartDate.value,
    selectedRangeEndDate: selectedRangeEndDate.value,
    selectedJobId: selectedJobId.value,
    trade: tradeFilter.value.trim(),
    firstName: firstNameFilter.value.trim(),
    lastName: lastNameFilter.value.trim(),
    subcontracted: subcontractedFilter.value,
    status: statusFilter.value,
  }))

  const pendingFilterChanges = computed(() => {
    const current = buildFilterPayload()
    if (!current || !appliedFilters.value) return false
    return filterSignature(current) !== filterSignature(appliedFilters.value)
  })

  function resetFilterValues() {
    useWeekRange.value = false
    selectedSingleDate.value = lastCompletedSaturday
    selectedRangeStartDate.value = lastCompletedSaturday
    selectedRangeEndDate.value = lastCompletedSaturday
    selectedJobId.value = ''
    tradeFilter.value = ''
    firstNameFilter.value = ''
    lastNameFilter.value = ''
    subcontractedFilter.value = 'all'
    statusFilter.value = 'all'
  }

  return {
    appliedFilters,
    activeFilterSummary,
    autoFilterSignature,
    buildFilterPayload,
    currentEndWeek,
    currentFilterSummary,
    currentStartWeek,
    currentWeekLabel,
    filterValidationError,
    formatSearchRange,
    jobOptions,
    lastCompletedSaturday,
    loadedPeriod,
    loadedWeekLabel,
    pendingFilterChanges,
    resetFilterValues,
    selectedJobId,
    selectedRangeEndDate,
    selectedRangeStartDate,
    selectedSingleDate,
    statusFilter,
    subcontractedFilter,
    tradeFilter,
    firstNameFilter,
    lastNameFilter,
    useWeekRange,
    weekPickerConfig,
  }
}
