import { computed, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useControllerFilters } from '@/composables/useControllerFilters'
import type { Job } from '@/types/models'

const jobs = ref<Job[]>([
  { id: 'job-2', name: 'Bravo', code: '200', type: 'general', active: true },
  { id: 'job-1', name: 'Alpha', code: '100', type: 'general', active: true },
])

describe('useControllerFilters', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('defaults to the current week and allows selecting the in-progress week', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-06T12:00:00Z'))

    const filters = useControllerFilters({
      jobs: computed(() => jobs.value),
    })

    expect(filters.selectedSingleDate.value).toBe('2026-04-06')
    expect(filters.currentStartWeek.value).toBe('2026-04-05')
    expect(filters.weekPickerConfig.value.maxDate).toBe('2026-04-06')
    expect(filters.buildFilterPayload()).toMatchObject({
      startWeek: '2026-04-05',
      endWeek: '2026-04-05',
    })
  })

  it('sorts job options and builds filter summaries', () => {
    const filters = useControllerFilters({
      jobs: computed(() => jobs.value),
    })

    filters.selectedJobId.value = 'job-2'
    filters.tradeFilter.value = 'Carpenter'

    expect(filters.jobOptions.value.map((job) => job.label)).toEqual([
      '100 - Alpha',
      '200 - Bravo',
    ])
    expect(filters.currentFilterSummary.value).toContain('Job: 200 - Bravo')
    expect(filters.currentFilterSummary.value).toContain('Trade: Carpenter')
  })

  it('validates invalid week ranges and returns null payloads', () => {
    const filters = useControllerFilters({
      jobs: computed(() => jobs.value),
    })

    filters.useWeekRange.value = true
    filters.selectedRangeStartDate.value = '2026-03-21'
    filters.selectedRangeEndDate.value = '2026-03-14'

    expect(filters.filterValidationError.value).toBe('End week must be on or after the start week.')
    expect(filters.buildFilterPayload()).toBeNull()
  })

  it('resets all filter values to their defaults', () => {
    const filters = useControllerFilters({
      jobs: computed(() => jobs.value),
    })

    filters.useWeekRange.value = true
    filters.selectedJobId.value = 'job-1'
    filters.tradeFilter.value = 'Laborer'
    filters.firstNameFilter.value = 'Alex'
    filters.lastNameFilter.value = 'Stone'
    filters.subcontractedFilter.value = 'subcontracted'
    filters.statusFilter.value = 'submitted'

    filters.resetFilterValues()

    expect(filters.useWeekRange.value).toBe(false)
    expect(filters.selectedJobId.value).toBe('')
    expect(filters.tradeFilter.value).toBe('')
    expect(filters.firstNameFilter.value).toBe('')
    expect(filters.lastNameFilter.value).toBe('')
    expect(filters.subcontractedFilter.value).toBe('all')
    expect(filters.statusFilter.value).toBe('all')
  })
})
