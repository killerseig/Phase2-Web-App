import { reactive, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useJobDetailForm } from '@/features/jobs/useJobDetailForm'
import { createEmptyNotificationRecipients, createRecipientInputState } from '@/features/jobs/jobViewHelpers'
import type { JobRecord, NotificationModuleKey, NotificationRecipients } from '@/types/domain'

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
    notificationRecipients: {
      dailyLogs: ['daily@example.com'],
      timecards: ['time@example.com'],
      shopOrders: ['shop@example.com'],
    },
    productionBurden: 0.42,
    startDate: '2026-06-01',
    type: 'general',
    ...overrides,
  }
}

function mountDetailForm(options: {
  canEditSelectedJob?: boolean
  editDrawerOpen?: boolean
  isCreateMode?: boolean
  selectedJob?: JobRecord | null
} = {}) {
  const selectedJob = ref<JobRecord | null>(options.selectedJob ?? makeJob())
  const canEditSelectedJob = ref(options.canEditSelectedJob ?? true)
  const editDrawerOpen = ref(options.editDrawerOpen ?? true)
  const isCreateMode = ref(options.isCreateMode ?? false)
  const detailNotificationRecipients = reactive<NotificationRecipients>({
    dailyLogs: ['stale-daily@example.com'],
    timecards: ['stale-time@example.com'],
    shopOrders: ['stale-shop@example.com'],
  })
  const detailRecipientInputs = reactive<Record<NotificationModuleKey, string>>({
    dailyLogs: 'pending daily',
    timecards: 'pending time',
    shopOrders: 'pending shop',
  })
  const persistJobDetail = vi.fn().mockResolvedValue(true)
  const detailErrors: string[] = []
  const detailInfos: string[] = []

  const form = useJobDetailForm({
    detailNotificationRecipients,
    detailRecipientInputs,
    getCanEditSelectedJob: () => canEditSelectedJob.value,
    getEditDrawerOpen: () => editDrawerOpen.value,
    getIsCreateMode: () => isCreateMode.value,
    getSelectedJob: () => selectedJob.value,
    persistJobDetail,
    setDetailError: (message) => detailErrors.push(message),
    setDetailInfo: (message) => detailInfos.push(message),
  })

  return {
    canEditSelectedJob,
    detailErrors,
    detailInfos,
    detailNotificationRecipients,
    detailRecipientInputs,
    editDrawerOpen,
    form,
    isCreateMode,
    persistJobDetail,
    selectedJob,
  }
}

describe('useJobDetailForm', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('hydrates selected job fields, notification recipients, and clears recipient inputs', () => {
    const job = makeJob({ assignedForemanIds: ['foreman-2'], code: 'A-1', name: 'Hydrated Job' })
    const { detailErrors, detailInfos, detailNotificationRecipients, detailRecipientInputs, form } = mountDetailForm()

    form.applySelectedJobToForm(job)

    expect(form.detailForm.name).toBe('Hydrated Job')
    expect(form.detailForm.code).toBe('A-1')
    expect(form.detailForm.productionBurden).toBe('0.42')
    expect(form.detailForm.assignedForemanIds).toEqual(['foreman-2'])
    expect(detailNotificationRecipients).toEqual(job.notificationRecipients)
    expect(detailRecipientInputs).toEqual(createRecipientInputState())
    expect(detailErrors).toEqual([''])
    expect(detailInfos).toEqual([''])
  })

  it('resets detail state when the selected job is cleared', () => {
    const { detailNotificationRecipients, detailRecipientInputs, form } = mountDetailForm()

    form.applySelectedJobToForm(null)

    expect(form.detailForm.name).toBe('')
    expect(form.detailForm.code).toBe('')
    expect(form.detailForm.productionBurden).toBe('0.33')
    expect(form.detailForm.assignedForemanIds).toEqual([])
    expect(detailNotificationRecipients).toEqual(createEmptyNotificationRecipients())
    expect(detailRecipientInputs).toEqual(createRecipientInputState())
  })

  it('updates individual detail fields without touching other form values', () => {
    const { form } = mountDetailForm()

    form.applySelectedJobToForm(makeJob({ code: 'A-1', name: 'Original Job' }))
    form.updateDetailFormField('name', 'Updated Job')

    expect(form.detailForm.name).toBe('Updated Job')
    expect(form.detailForm.code).toBe('A-1')
  })

  it('blocks explicit saves when validation fails', async () => {
    const { detailErrors, detailInfos, form, persistJobDetail } = mountDetailForm()

    form.applySelectedJobToForm(makeJob())
    form.updateDetailFormField('code', '')
    await form.handleSaveJob()

    expect(persistJobDetail).not.toHaveBeenCalled()
    expect(detailErrors[detailErrors.length - 1]).toBe('Enter the job number.')
    expect(detailInfos[detailInfos.length - 1]).toBe('')
  })

  it('persists valid explicit saves and records success copy', async () => {
    const { detailInfos, form, persistJobDetail, selectedJob } = mountDetailForm()

    selectedJob.value = makeJob({ id: 'job-alpha' })
    form.applySelectedJobToForm(selectedJob.value)
    form.updateDetailFormField('name', 'Saved Job')
    await form.handleSaveJob()

    expect(persistJobDetail).toHaveBeenCalledWith(
      selectedJob.value,
      expect.objectContaining({ name: 'Saved Job' }),
    )
    expect(detailInfos).toContain('Job updated.')
  })

  it('queues autosave only after editable detail changes', async () => {
    const { detailInfos, form, persistJobDetail } = mountDetailForm()

    form.applySelectedJobToForm(makeJob())
    form.queueDetailAutosave()
    await vi.advanceTimersByTimeAsync(450)

    expect(persistJobDetail).not.toHaveBeenCalled()

    form.updateDetailFormField('name', 'Autosaved Job')
    form.queueDetailAutosave()
    await vi.advanceTimersByTimeAsync(450)

    expect(persistJobDetail).toHaveBeenCalledTimes(1)
    expect(detailInfos).toContain('Saving...')
    expect(detailInfos).toContain('All changes saved.')
  })

  it('does not queue autosave when editing is not allowed', async () => {
    const { form, persistJobDetail } = mountDetailForm({ canEditSelectedJob: false })

    form.applySelectedJobToForm(makeJob())
    form.updateDetailFormField('name', 'Should Not Save')
    form.queueDetailAutosave()
    await vi.advanceTimersByTimeAsync(450)

    expect(persistJobDetail).not.toHaveBeenCalled()
  })

  it('protects dirty local detail fields from same-job remote echoes', () => {
    const job = makeJob({ id: 'job-alpha', name: 'Remote Clean' })
    const { form } = mountDetailForm({ editDrawerOpen: true })

    form.applySelectedJobToForm(job)
    form.updateDetailFormField('name', 'Local Unsaved Edit')

    expect(
      form.shouldHydrateSelectedJob(
        makeJob({ id: 'job-alpha', name: 'Remote Echo' }),
        job,
      ),
    ).toBe(false)

    expect(
      form.shouldHydrateSelectedJob(
        makeJob({ id: 'job-beta', name: 'Other Job' }),
        job,
      ),
    ).toBe(true)
  })
  it('flushes a scheduled edit before navigation without a second debounce save', async () => {
    const { form, selectedJob, persistJobDetail } = mountDetailForm()
    form.applySelectedJobToForm(selectedJob.value)
    form.updateDetailFormField('name', 'Immediate edit')
    form.queueDetailAutosave()
    expect(await form.prepareDetailNavigation()).toBe(true)
    expect(persistJobDetail).toHaveBeenCalledTimes(1)
    expect(form.detailDirty.value).toBe(false)
    await vi.advanceTimersByTimeAsync(1000)
    expect(persistJobDetail).toHaveBeenCalledTimes(1)
  })

  it('retains failed changes and allows an explicit retry', async () => {
    const { form, selectedJob, persistJobDetail } = mountDetailForm()
    form.applySelectedJobToForm(selectedJob.value)
    form.updateDetailFormField('name', 'Keep failed edit')
    persistJobDetail.mockResolvedValueOnce(false)
    expect(await form.prepareDetailNavigation()).toBe(false)
    expect(form.detailDirty.value).toBe(true)
    expect(form.detailForm.name).toBe('Keep failed edit')
    expect(await form.prepareDetailNavigation()).toBe(true)
    expect(form.detailDirty.value).toBe(false)
  })

  it('captures immutable save snapshots and flushes edits made during an in-flight save', async () => {
    const { form, selectedJob, persistJobDetail } = mountDetailForm()
    form.applySelectedJobToForm(selectedJob.value)
    let release!: (value: boolean) => void
    persistJobDetail.mockImplementationOnce(() => new Promise<boolean>(resolve => { release = resolve }))
    form.updateDetailFormField('name', 'First snapshot')
    const first = form.handleSaveJob()
    form.updateDetailFormField('name', 'Latest snapshot')
    form.detailForm.assignedForemanIds.push('another-foreman')
    const navigation = form.prepareDetailNavigation()
    expect(persistJobDetail).toHaveBeenCalledTimes(1)
    expect(persistJobDetail.mock.calls[0]?.[1].name).toBe('First snapshot')
    expect(persistJobDetail.mock.calls[0]?.[1].assignedForemanIds).toEqual(['foreman-1'])
    release(true)
    await first
    expect(await navigation).toBe(true)
    expect(persistJobDetail).toHaveBeenCalledTimes(2)
    expect(persistJobDetail.mock.calls[1]?.[1].name).toBe('Latest snapshot')
    expect(form.detailDirty.value).toBe(false)
  })

  it('does not save a form whose hydrated job no longer matches the selection', async () => {
    const { form, selectedJob, persistJobDetail } = mountDetailForm()
    form.applySelectedJobToForm(selectedJob.value)
    form.updateDetailFormField('name', 'Old job edit')
    selectedJob.value = makeJob({ id: 'another-job' })
    expect(await form.handleSaveJob()).toBe(false)
    expect(persistJobDetail).not.toHaveBeenCalled()
  })

  it('queues a user revert to the prior baseline while a different snapshot is saving', async () => {
    const { form, selectedJob, persistJobDetail } = mountDetailForm()
    form.applySelectedJobToForm(selectedJob.value)
    let release!: (value: boolean) => void
    persistJobDetail.mockImplementationOnce(() => new Promise<boolean>(resolve => { release = resolve }))
    form.updateDetailFormField('name', 'Temporary change')
    const pending = form.handleSaveJob()
    form.updateDetailFormField('name', 'Alpha Job')
    form.queueDetailAutosave()
    release(true)
    await pending
    await vi.advanceTimersByTimeAsync(450)
    expect(persistJobDetail).toHaveBeenCalledTimes(2)
    expect(persistJobDetail.mock.calls[1]?.[1].name).toBe('Alpha Job')
    expect(form.detailDirty.value).toBe(false)
  })

  it('serializes multiple save requests waiting behind the same in-flight snapshot', async () => {
    const { form, selectedJob, persistJobDetail } = mountDetailForm()
    form.applySelectedJobToForm(selectedJob.value)
    let releaseFirst!: (value: boolean) => void
    let releaseSecond!: (value: boolean) => void
    persistJobDetail
      .mockImplementationOnce(() => new Promise<boolean>(resolve => { releaseFirst = resolve }))
      .mockImplementationOnce(() => new Promise<boolean>(resolve => { releaseSecond = resolve }))
      .mockResolvedValue(true)
    form.updateDetailFormField('name', 'First snapshot')
    const first = form.handleSaveJob()
    form.updateDetailFormField('name', 'Latest snapshot')
    const second = form.handleSaveJob()
    const third = form.handleSaveJob()
    releaseFirst(true)
    for (let index = 0; index < 8; index++) await Promise.resolve()
    const savesWhileWaiting = persistJobDetail.mock.calls.length
    releaseSecond(true)
    await Promise.all([first, second, third])
    expect(savesWhileWaiting).toBe(2)
    expect(persistJobDetail).toHaveBeenCalledTimes(2)
    expect(form.detailDirty.value).toBe(false)
  })

})
