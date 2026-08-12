import { effectScope, nextTick, reactive, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useJobsSideEffects } from '@/features/jobs/useJobsSideEffects'

function mountSideEffects() {
  const detailForm = reactive({
    assignedForemanIds: [] as string[],
    code: '100',
    name: 'Alpha Job',
  })
  const jobsError = ref<string | null>(null)
  const queueDetailAutosave = vi.fn()
  const showJobsError = vi.fn()
  const scope = effectScope()

  scope.run(() => {
    useJobsSideEffects({
      detailForm,
      getJobsError: () => jobsError.value,
      queueDetailAutosave,
      showJobsError,
    })
  })

  return {
    detailForm,
    jobsError,
    queueDetailAutosave,
    scope,
    showJobsError,
  }
}

describe('useJobsSideEffects', () => {
  it('queues detail autosave when top-level or nested form state changes', async () => {
    const { detailForm, queueDetailAutosave, scope } = mountSideEffects()

    await nextTick()
    expect(queueDetailAutosave).not.toHaveBeenCalled()

    detailForm.name = 'Updated Job'
    await nextTick()

    expect(queueDetailAutosave).toHaveBeenCalledTimes(1)

    detailForm.assignedForemanIds.push('foreman-1')
    await nextTick()

    expect(queueDetailAutosave).toHaveBeenCalledTimes(2)

    scope.stop()
  })

  it('forwards new jobs errors and ignores empty or unchanged messages', async () => {
    const { jobsError, scope, showJobsError } = mountSideEffects()

    jobsError.value = ''
    await nextTick()
    expect(showJobsError).not.toHaveBeenCalled()

    jobsError.value = 'Failed to load jobs.'
    await nextTick()

    expect(showJobsError).toHaveBeenCalledTimes(1)
    expect(showJobsError).toHaveBeenLastCalledWith('Failed to load jobs.')

    jobsError.value = 'Failed to load jobs.'
    await nextTick()

    expect(showJobsError).toHaveBeenCalledTimes(1)

    jobsError.value = 'Missing or insufficient permissions.'
    await nextTick()

    expect(showJobsError).toHaveBeenCalledTimes(2)
    expect(showJobsError).toHaveBeenLastCalledWith('Missing or insufficient permissions.')

    scope.stop()
  })
})
