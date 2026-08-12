import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useJobCrudActions } from '@/features/jobs/useJobCrudActions'
import { createEmptyJobFormState, createEmptyNotificationRecipients } from '@/features/jobs/jobViewHelpers'
import {
  createJobRecord,
  deleteJobRecord,
  setJobActive,
  updateJobRecord,
} from '@/services/jobs'
import type { JobRecord } from '@/types/domain'

vi.mock('@/services/jobs', () => ({
  createJobRecord: vi.fn(),
  deleteJobRecord: vi.fn(),
  setJobActive: vi.fn(),
  updateJobRecord: vi.fn(),
}))

const createJobRecordMock = vi.mocked(createJobRecord)
const deleteJobRecordMock = vi.mocked(deleteJobRecord)
const setJobActiveMock = vi.mocked(setJobActive)
const updateJobRecordMock = vi.mocked(updateJobRecord)

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    active: true,
    assignedForemanIds: ['foreman-1'],
    code: '100',
    finishDate: '2026-06-30',
    gc: 'Phase 2',
    id: 'job-100',
    jobAddress: '100 Main St',
    name: 'Alpha Job',
    notificationRecipients: createEmptyNotificationRecipients(),
    productionBurden: 0.33,
    startDate: '2026-06-01',
    type: 'general',
    ...overrides,
  }
}

function mountCrudActions(options: {
  selectedJob?: JobRecord | null
  visibleJobs?: JobRecord[]
} = {}) {
  const archiveLoading = ref(false)
  const createLoading = ref(false)
  const deleteLoading = ref(false)
  const saveLoading = ref(false)
  const selectedJob = ref<JobRecord | null>(
    options.selectedJob === undefined ? makeJob() : options.selectedJob,
  )
  const selectedJobId = ref<string | 'new' | '__all_jobs__' | null>(selectedJob.value?.id ?? null)
  const visibleJobs = ref<JobRecord[]>(options.visibleJobs ?? [
    makeJob({ id: 'job-next', name: 'Next Job' }),
    makeJob({ id: 'job-other', name: 'Other Job' }),
  ])
  const createForm = createEmptyJobFormState()
  const createNotificationRecipients = createEmptyNotificationRecipients()
  const detailNotificationRecipients = createEmptyNotificationRecipients()
  const closeArchiveConfirm = vi.fn()
  const closeDeleteConfirm = vi.fn()
  const resetCreateMessages = vi.fn()
  const resetDetailMessages = vi.fn()
  const createErrorMessages: string[] = []
  const createErrors: Array<{ error: unknown; fallbackMessage: string }> = []
  const createInfos: string[] = []
  const detailErrors: Array<{ error: unknown; fallbackMessage: string }> = []
  const detailInfos: string[] = []

  const actions = useJobCrudActions({
    archiveLoading,
    closeArchiveConfirm,
    closeDeleteConfirm,
    createForm,
    createLoading,
    createNotificationRecipients,
    deleteLoading,
    detailNotificationRecipients,
    resetCreateMessages,
    resetDetailMessages,
    saveLoading,
    selectedJob,
    selectedJobId,
    setCreateError: (error, fallbackMessage) => createErrors.push({ error, fallbackMessage }),
    setCreateErrorMessage: (message) => createErrorMessages.push(message),
    setCreateInfo: (message) => createInfos.push(message),
    setDetailError: (error, fallbackMessage) => detailErrors.push({ error, fallbackMessage }),
    setDetailInfo: (message) => detailInfos.push(message),
    visibleJobs,
  })

  return {
    actions,
    archiveLoading,
    closeArchiveConfirm,
    closeDeleteConfirm,
    createErrorMessages,
    createErrors,
    createForm,
    createInfos,
    createLoading,
    createNotificationRecipients,
    deleteLoading,
    detailErrors,
    detailInfos,
    detailNotificationRecipients,
    resetCreateMessages,
    resetDetailMessages,
    saveLoading,
    selectedJob,
    selectedJobId,
    visibleJobs,
  }
}

describe('useJobCrudActions', () => {
  beforeEach(() => {
    createJobRecordMock.mockReset()
    deleteJobRecordMock.mockReset()
    setJobActiveMock.mockReset()
    updateJobRecordMock.mockReset()
    createJobRecordMock.mockResolvedValue('job-created')
    deleteJobRecordMock.mockResolvedValue(undefined)
    setJobActiveMock.mockResolvedValue(undefined)
    updateJobRecordMock.mockResolvedValue(undefined)
  })

  it('blocks job creation when required fields are missing', async () => {
    const { actions, createErrorMessages, createLoading, resetCreateMessages } = mountCrudActions()

    await actions.handleCreateJob()

    expect(resetCreateMessages).toHaveBeenCalledTimes(1)
    expect(createErrorMessages).toEqual(['Enter the job number.'])
    expect(createJobRecordMock).not.toHaveBeenCalled()
    expect(createLoading.value).toBe(false)
  })

  it('creates an active job with normalized fields, copied foremen, and notification recipients', async () => {
    const {
      actions,
      createForm,
      createInfos,
      createLoading,
      createNotificationRecipients,
      selectedJobId,
    } = mountCrudActions()
    createForm.code = '  7505  '
    createForm.name = '  Lucky 3 Ranch  '
    createForm.type = 'general'
    createForm.productionBurden = ' 0.42 '
    createForm.assignedForemanIds.push('foreman-1')
    createNotificationRecipients.dailyLogs.push('daily@example.com')

    await actions.handleCreateJob()

    expect(createJobRecordMock).toHaveBeenCalledWith({
      ...createForm,
      active: true,
      assignedForemanIds: ['foreman-1'],
      notificationRecipients: createNotificationRecipients,
      productionBurden: '0.42',
    })
    expect(createInfos).toEqual(['Job created.'])
    expect(selectedJobId.value).toBe('job-created')
    expect(createLoading.value).toBe(false)
  })

  it('forwards create failures and clears loading state', async () => {
    const error = new Error('Create denied')
    createJobRecordMock.mockRejectedValueOnce(error)
    const { actions, createErrors, createForm, createLoading } = mountCrudActions()
    createForm.code = '100'
    createForm.name = 'Alpha Job'

    await actions.handleCreateJob()

    expect(createErrors).toEqual([{ error, fallbackMessage: 'Failed to create job.' }])
    expect(createLoading.value).toBe(false)
  })

  it('persists job details with normalized burden, copied foremen, recipients, and existing active state', async () => {
    const {
      actions,
      detailNotificationRecipients,
      saveLoading,
    } = mountCrudActions()
    const job = makeJob({ active: false, id: 'job-detail' })
    const form = createEmptyJobFormState()
    form.code = '  22  '
    form.name = '  Detail Job  '
    form.productionBurden = ' 0.55 '
    form.assignedForemanIds.push('foreman-2')
    detailNotificationRecipients.shopOrders.push('shop@example.com')

    await expect(actions.persistJobDetail(job, form)).resolves.toBe(true)

    expect(updateJobRecordMock).toHaveBeenCalledWith('job-detail', {
      ...form,
      active: false,
      assignedForemanIds: ['foreman-2'],
      notificationRecipients: detailNotificationRecipients,
      productionBurden: '0.55',
    })
    expect(saveLoading.value).toBe(false)
  })

  it('reports detail save failures and returns false', async () => {
    const error = new Error('Save denied')
    updateJobRecordMock.mockRejectedValueOnce(error)
    const { actions, detailErrors, saveLoading } = mountCrudActions()

    await expect(actions.persistJobDetail(makeJob(), createEmptyJobFormState())).resolves.toBe(false)

    expect(detailErrors).toEqual([{ error, fallbackMessage: 'Failed to update job.' }])
    expect(saveLoading.value).toBe(false)
  })

  it('archives and restores the selected job through the active flag service', async () => {
    const {
      actions,
      archiveLoading,
      closeArchiveConfirm,
      detailInfos,
      resetDetailMessages,
      selectedJob,
    } = mountCrudActions({ selectedJob: makeJob({ active: true, id: 'job-active' }) })

    await actions.handleToggleArchive()

    expect(resetDetailMessages).toHaveBeenCalledTimes(1)
    expect(setJobActiveMock).toHaveBeenCalledWith('job-active', false)
    expect(detailInfos).toEqual(['Job archived.'])
    expect(closeArchiveConfirm).toHaveBeenCalledTimes(1)
    expect(archiveLoading.value).toBe(false)

    selectedJob.value = makeJob({ active: false, id: 'job-archived' })
    await actions.handleToggleArchive()

    expect(setJobActiveMock).toHaveBeenLastCalledWith('job-archived', true)
    expect(detailInfos[detailInfos.length - 1]).toBe('Job restored.')
  })

  it('closes archive confirmation without work when no job is selected', async () => {
    const { actions, closeArchiveConfirm, resetDetailMessages } = mountCrudActions({ selectedJob: null })

    await actions.handleToggleArchive()

    expect(closeArchiveConfirm).toHaveBeenCalledTimes(1)
    expect(resetDetailMessages).not.toHaveBeenCalled()
    expect(setJobActiveMock).not.toHaveBeenCalled()
  })

  it('deletes the selected job and selects the next visible job', async () => {
    const {
      actions,
      closeDeleteConfirm,
      deleteLoading,
      detailInfos,
      resetDetailMessages,
      selectedJobId,
    } = mountCrudActions({
      selectedJob: makeJob({ id: 'job-delete' }),
      visibleJobs: [makeJob({ id: 'job-next' })],
    })

    await actions.handleDeleteJob()

    expect(resetDetailMessages).toHaveBeenCalledTimes(1)
    expect(deleteJobRecordMock).toHaveBeenCalledWith('job-delete')
    expect(detailInfos).toEqual(['Job deleted.'])
    expect(selectedJobId.value).toBe('job-next')
    expect(closeDeleteConfirm).toHaveBeenCalledTimes(1)
    expect(deleteLoading.value).toBe(false)
  })

  it('falls back to create mode when deleting the final visible job', async () => {
    const { actions, selectedJobId } = mountCrudActions({
      selectedJob: makeJob({ id: 'job-delete' }),
      visibleJobs: [],
    })

    await actions.handleDeleteJob()

    expect(selectedJobId.value).toBe('new')
  })

  it('reports archive and delete failures without leaving busy state stuck', async () => {
    const archiveError = new Error('Archive denied')
    const deleteError = new Error('Delete denied')
    setJobActiveMock.mockRejectedValueOnce(archiveError)
    deleteJobRecordMock.mockRejectedValueOnce(deleteError)
    const { actions, archiveLoading, deleteLoading, detailErrors } = mountCrudActions()

    await actions.handleToggleArchive()
    await actions.handleDeleteJob()

    expect(detailErrors).toEqual([
      { error: archiveError, fallbackMessage: 'Failed to archive job.' },
      { error: deleteError, fallbackMessage: 'Failed to delete job.' },
    ])
    expect(archiveLoading.value).toBe(false)
    expect(deleteLoading.value).toBe(false)
  })
})
