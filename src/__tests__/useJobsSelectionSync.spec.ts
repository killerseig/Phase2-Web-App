import { computed, effectScope, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ALL_JOBS_ID } from '@/features/jobs/jobViewHelpers'
import { useJobsSelectionSync } from '@/features/jobs/useJobsSelectionSync'
import type { JobRecord } from '@/types/domain'

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    active: true,
    assignedForemanIds: [],
    code: '100',
    finishDate: null,
    gc: 'Phase 2',
    id: 'job-100',
    jobAddress: '100 Main St',
    name: 'Alpha Job',
    productionBurden: 0.33,
    startDate: null,
    type: 'general',
    ...overrides,
  }
}

function mountSelectionSync(options: {
  canManageGlobalJobDefaults?: boolean
  canUseJobSetupEditor?: boolean
  editDrawerOpen?: boolean
  jobs?: JobRecord[]
  selectedJobId?: string | null
  shouldHydrateSelectedJob?: (job: JobRecord, previousJob: JobRecord | null) => boolean
  visibleJobs?: JobRecord[]
} = {}) {
  const jobs = ref<JobRecord[]>(options.jobs ?? [
    makeJob({ id: 'job-alpha', name: 'Alpha Job' }),
    makeJob({ id: 'job-beta', name: 'Beta Job' }),
  ])
  const visibleJobs = ref<JobRecord[]>(options.visibleJobs ?? jobs.value)
  const editDrawerOpen = ref(options.editDrawerOpen ?? false)
  const selectedJobId = ref<string | typeof ALL_JOBS_ID | null>(options.selectedJobId ?? null)
  const canManageGlobalJobDefaults = ref(options.canManageGlobalJobDefaults ?? true)
  const canUseJobSetupEditor = ref(options.canUseJobSetupEditor ?? true)
  const selectedJob = computed(() => jobs.value.find((job) => job.id === selectedJobId.value) ?? null)
  const applySelectedJobToForm = vi.fn()
  const clearDetailAutosaveTimer = vi.fn()
  const shouldHydrateSelectedJob = vi.fn(options.shouldHydrateSelectedJob ?? (() => true))
  const scope = effectScope()

  scope.run(() => {
    useJobsSelectionSync({
      applySelectedJobToForm,
      clearDetailAutosaveTimer,
      editDrawerOpen,
      getCanManageGlobalJobDefaults: () => canManageGlobalJobDefaults.value,
      getCanUseJobSetupEditor: () => canUseJobSetupEditor.value,
      selectedJob,
      selectedJobId,
      shouldHydrateSelectedJob,
      visibleJobs,
    })
  })

  return {
    applySelectedJobToForm,
    canManageGlobalJobDefaults,
    canUseJobSetupEditor,
    clearDetailAutosaveTimer,
    editDrawerOpen,
    jobs,
    selectedJob,
    selectedJobId,
    shouldHydrateSelectedJob,
    stop: () => scope.stop(),
    visibleJobs,
  }
}

describe('useJobsSelectionSync', () => {
  const stops: Array<() => void> = []

  afterEach(() => {
    while (stops.length) stops.pop()?.()
    vi.restoreAllMocks()
  })

  function track<T extends { stop: () => void }>(mount: T): T {
    stops.push(mount.stop)
    return mount
  }

  it('clears autosave state and resets the form when there is no selected job', () => {
    const { applySelectedJobToForm, clearDetailAutosaveTimer } = track(mountSelectionSync())

    expect(clearDetailAutosaveTimer).toHaveBeenCalledTimes(1)
    expect(applySelectedJobToForm).toHaveBeenCalledWith(null)
  })

  it('hydrates selected job forms when the hydration guard allows it', async () => {
    const {
      applySelectedJobToForm,
      clearDetailAutosaveTimer,
      selectedJobId,
      shouldHydrateSelectedJob,
    } = track(mountSelectionSync({ selectedJobId: 'job-alpha' }))

    expect(shouldHydrateSelectedJob).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job-alpha' }),
      null,
    )
    expect(clearDetailAutosaveTimer).toHaveBeenCalledTimes(1)
    expect(applySelectedJobToForm).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'job-alpha' }))

    vi.clearAllMocks()
    selectedJobId.value = 'job-beta'
    await nextTick()

    expect(shouldHydrateSelectedJob).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job-beta' }),
      expect.objectContaining({ id: 'job-alpha' }),
    )
    expect(clearDetailAutosaveTimer).toHaveBeenCalledTimes(1)
    expect(applySelectedJobToForm).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'job-beta' }))
  })

  it('does not rehydrate selected job forms when the hydration guard blocks it', async () => {
    const {
      applySelectedJobToForm,
      clearDetailAutosaveTimer,
      selectedJobId,
      shouldHydrateSelectedJob,
    } = track(mountSelectionSync({
      selectedJobId: 'job-alpha',
      shouldHydrateSelectedJob: (_job, previousJob) => previousJob === null,
    }))

    expect(applySelectedJobToForm).toHaveBeenCalledTimes(1)

    vi.clearAllMocks()
    selectedJobId.value = 'job-beta'
    await nextTick()

    expect(shouldHydrateSelectedJob).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job-beta' }),
      expect.objectContaining({ id: 'job-alpha' }),
    )
    expect(clearDetailAutosaveTimer).not.toHaveBeenCalled()
    expect(applySelectedJobToForm).not.toHaveBeenCalled()
  })

  it('selects the first visible job for field users with no selection', () => {
    const { selectedJobId } = track(mountSelectionSync({ canUseJobSetupEditor: false }))

    expect(selectedJobId.value).toBe('job-alpha')
  })

  it('falls back when a manager-selected job disappears from visible jobs', async () => {
    const { editDrawerOpen, selectedJobId, visibleJobs } = track(mountSelectionSync({
      editDrawerOpen: false,
      selectedJobId: 'job-alpha',
    }))

    visibleJobs.value = [makeJob({ id: 'job-beta', name: 'Beta Job' })]
    await nextTick()

    expect(selectedJobId.value).toBeNull()

    selectedJobId.value = 'job-alpha'
    editDrawerOpen.value = true
    visibleJobs.value = [makeJob({ id: 'job-gamma', name: 'Gamma Job' })]
    await nextTick()

    expect(selectedJobId.value).toBe(ALL_JOBS_ID)
  })

  it('does not fall back to all-jobs defaults for non-admin setup editors', async () => {
    const { editDrawerOpen, selectedJobId, visibleJobs } = track(mountSelectionSync({
      canManageGlobalJobDefaults: false,
      canUseJobSetupEditor: true,
      editDrawerOpen: true,
      selectedJobId: 'job-alpha',
    }))

    visibleJobs.value = [makeJob({ id: 'job-gamma', name: 'Gamma Job' })]
    await nextTick()

    expect(selectedJobId.value).toBeNull()

    editDrawerOpen.value = false
    await nextTick()
    editDrawerOpen.value = true
    await nextTick()

    expect(selectedJobId.value).toBeNull()
  })

  it('preserves create and all-jobs modes when visible jobs change', async () => {
    const { selectedJobId, visibleJobs } = track(mountSelectionSync({ selectedJobId: 'new' }))

    visibleJobs.value = []
    await nextTick()

    expect(selectedJobId.value).toBe('new')

    selectedJobId.value = ALL_JOBS_ID
    visibleJobs.value = [makeJob({ id: 'job-beta' })]
    await nextTick()

    expect(selectedJobId.value).toBe(ALL_JOBS_ID)
  })

  it('sets all-jobs mode when managers open an empty edit drawer and clears timers when it closes', async () => {
    const {
      clearDetailAutosaveTimer,
      editDrawerOpen,
      selectedJobId,
    } = track(mountSelectionSync({ editDrawerOpen: false, selectedJobId: null }))

    vi.clearAllMocks()
    editDrawerOpen.value = true
    await nextTick()

    expect(selectedJobId.value).toBe(ALL_JOBS_ID)
    expect(clearDetailAutosaveTimer).not.toHaveBeenCalled()

    editDrawerOpen.value = false
    await nextTick()

    expect(clearDetailAutosaveTimer).toHaveBeenCalledTimes(1)
  })
})
