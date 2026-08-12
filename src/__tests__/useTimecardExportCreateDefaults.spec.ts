import { computed, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useTimecardExportCreateDefaults } from '@/features/timecards/useTimecardExportCreateDefaults'

function mountDefaults(options: {
  foremanOptions?: Array<{ id: string, label: string }>
  jobOptions?: Array<{ id: string }>
  selectedForemanFilter?: string
  targetCreateWeek?: { id: string, jobId: string } | null
} = {}) {
  const createCardForemanId = ref('')
  const createCardJobId = ref('')
  const createCardForemanOptions = ref(options.foremanOptions ?? [])
  const createCardJobOptions = ref(options.jobOptions ?? [])
  const selectedForemanFilter = ref(options.selectedForemanFilter ?? 'all')
  const targetCreateWeek = ref(options.targetCreateWeek ?? null)

  useTimecardExportCreateDefaults({
    createCardForemanId,
    createCardForemanOptions: computed(() => createCardForemanOptions.value),
    createCardJobId,
    createCardJobOptions: computed(() => createCardJobOptions.value),
    selectedForemanFilter,
    targetCreateWeek,
  })

  return {
    createCardForemanId,
    createCardForemanOptions,
    createCardJobId,
    createCardJobOptions,
    selectedForemanFilter,
    targetCreateWeek,
  }
}

describe('useTimecardExportCreateDefaults', () => {
  it('defaults job selection from valid current, target week, single option, or blank state', async () => {
    const {
      createCardJobId,
      createCardJobOptions,
      targetCreateWeek,
    } = mountDefaults({
      jobOptions: [{ id: 'job-1' }, { id: 'job-2' }],
      targetCreateWeek: { id: 'week-1', jobId: 'job-2' },
    })

    await nextTick()
    expect(createCardJobId.value).toBe('job-2')

    createCardJobId.value = 'job-1'
    createCardJobOptions.value = [{ id: 'job-1' }, { id: 'job-3' }]
    await nextTick()
    expect(createCardJobId.value).toBe('job-1')

    createCardJobOptions.value = [{ id: 'job-3' }]
    await nextTick()
    expect(createCardJobId.value).toBe('job-3')

    targetCreateWeek.value = null
    createCardJobOptions.value = [{ id: 'job-3' }, { id: 'job-4' }]
    await nextTick()
    expect(createCardJobId.value).toBe('job-3')

    createCardJobOptions.value = []
    await nextTick()
    expect(createCardJobId.value).toBe('')
  })

  it('defaults foreman selection from valid current, target week, active filter, single option, or blank state', async () => {
    const {
      createCardForemanId,
      createCardForemanOptions,
      selectedForemanFilter,
      targetCreateWeek,
    } = mountDefaults({
      foremanOptions: [
        { id: 'foreman-cj', label: 'CJ Blanchard' },
        { id: 'foreman-vince', label: 'Vince Hintz' },
      ],
      selectedForemanFilter: 'Vince Hintz',
    })

    await nextTick()
    expect(createCardForemanId.value).toBe('foreman-vince')

    createCardForemanId.value = 'foreman-cj'
    createCardForemanOptions.value = [
      { id: 'foreman-cj', label: 'CJ Blanchard' },
      { id: 'foreman-rocky', label: 'Rocky Rodriguez' },
    ]
    await nextTick()
    expect(createCardForemanId.value).toBe('foreman-cj')

    createCardForemanOptions.value = [{ id: 'foreman-rocky', label: 'Rocky Rodriguez' }]
    await nextTick()
    expect(createCardForemanId.value).toBe('foreman-rocky')

    createCardForemanOptions.value = [
      { id: 'foreman-rocky', label: 'Rocky Rodriguez' },
      { id: 'foreman-cj', label: 'CJ Blanchard' },
    ]
    await nextTick()
    expect(createCardForemanId.value).toBe('foreman-rocky')

    selectedForemanFilter.value = 'CJ Blanchard'
    createCardForemanOptions.value = [
      { id: 'foreman-cj', label: 'CJ Blanchard' },
      { id: 'foreman-vince', label: 'Vince Hintz' },
    ]
    await nextTick()
    expect(createCardForemanId.value).toBe('foreman-cj')

    createCardForemanId.value = ''
    targetCreateWeek.value = { id: 'week-existing', jobId: 'job-1' }
    selectedForemanFilter.value = 'all'
    createCardForemanOptions.value = [{ id: 'foreman-existing', label: 'Existing Foreman' }]
    await nextTick()
    expect(createCardForemanId.value).toBe('foreman-existing')

    createCardForemanOptions.value = []
    await nextTick()
    expect(createCardForemanId.value).toBe('')
  })
})
