import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createEmptyDailyLogPayload } from '@/features/dailyLogs/schema'
import { useDailyLogActions } from '@/features/dailyLogs/useDailyLogActions'
import {
  createDailyLogRecord,
  deleteDailyLogAttachment,
  deleteDailyLogRecord,
  sendDailyLogEmail,
  updateDailyLogRecord,
} from '@/services/dailyLogs'
import type { DailyLogPayload, DailyLogRecord, JobRecord } from '@/types/domain'

vi.mock('@/services/dailyLogs', () => ({
  createDailyLogRecord: vi.fn(),
  deleteDailyLogAttachment: vi.fn(),
  deleteDailyLogRecord: vi.fn(),
  sendDailyLogEmail: vi.fn(),
  updateDailyLogRecord: vi.fn(),
}))

const createDailyLogRecordMock = vi.mocked(createDailyLogRecord)
const deleteDailyLogAttachmentMock = vi.mocked(deleteDailyLogAttachment)
const deleteDailyLogRecordMock = vi.mocked(deleteDailyLogRecord)
const sendDailyLogEmailMock = vi.mocked(sendDailyLogEmail)
const updateDailyLogRecordMock = vi.mocked(updateDailyLogRecord)

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: 'job-1',
    name: 'Lucky 3 Ranch',
    code: '5229',
    gc: 'Phase 2',
    type: 'general',
    active: true,
    assignedForemanIds: [],
    ...overrides,
  }
}

function makeSubmitReadyPayload(overrides: Partial<DailyLogPayload> = {}): DailyLogPayload {
  return createEmptyDailyLogPayload({
    actionItems: 'Follow up tomorrow',
    ahaReviewed: 'AHA reviewed',
    budgetConcerns: 'No budget concerns',
    deliveriesNeeded: 'None',
    deliveriesReceived: 'Materials arrived',
    indoorClimateReadings: [
      {
        area: 'Level 1',
        high: '72',
        humidity: '30',
        low: '68',
      },
    ],
    manpowerAssessment: 'Crew was sufficient',
    manpowerLines: [
      {
        addedByUserId: 'user-1',
        areas: 'Level 1',
        count: 3,
        trade: 'Acoustical Carpenter',
      },
    ],
    newWorkAuthorizations: 'None',
    notesCorrespondence: 'Notes complete',
    qcAreasInspected: 'Level 1',
    qcAssignedTo: 'CJ',
    qcIssuesIdentified: 'No issues',
    qcIssuesResolved: 'No issues',
    safetyConcerns: 'No safety concerns',
    scheduleConcerns: 'No schedule concerns',
    weeklySchedule: 'Install panels',
    ...overrides,
  })
}

function makeLog(overrides: Partial<DailyLogRecord> = {}): DailyLogRecord {
  return {
    id: 'daily-log-1',
    jobId: 'job-1',
    jobCode: '5229',
    jobName: 'Lucky 3 Ranch',
    logDate: '2026-07-15',
    sequenceNumber: 1,
    status: 'draft',
    foremanUserId: 'user-1',
    foremanName: 'Vince Hintz',
    additionalRecipients: [],
    payload: makeSubmitReadyPayload(),
    ...overrides,
  }
}

function mountActions(options: {
  canDelete?: boolean
  canEdit?: boolean
  currentUserId?: string | null
  form?: DailyLogPayload
  hasUnsavedDraftChanges?: boolean
  job?: JobRecord | null
  jobId?: string | null
  saveDraftResult?: boolean
  selectedDate?: string
  selectedDateIsFuture?: boolean
  selectedLog?: DailyLogRecord | null
  selectedLogId?: string | null
  visibleLogs?: DailyLogRecord[]
} = {}) {
  const canEdit = ref(options.canEdit ?? true)
  const canDelete = ref(options.canDelete ?? canEdit.value)
  const currentUserId = ref<string | null>(options.currentUserId === undefined ? 'user-1' : options.currentUserId)
  const form = ref(options.form ?? makeSubmitReadyPayload())
  const hasUnsavedDraftChanges = ref(options.hasUnsavedDraftChanges ?? true)
  const job = ref<JobRecord | null>(options.job === undefined ? makeJob() : options.job)
  const jobId = ref<string | null>(options.jobId === undefined ? 'job-1' : options.jobId)
  const selectedDate = ref(options.selectedDate ?? '2026-07-15')
  const selectedDateIsFuture = ref(options.selectedDateIsFuture ?? false)
  const selectedLog = ref<DailyLogRecord | null>(
    options.selectedLog === undefined ? makeLog({ payload: form.value }) : options.selectedLog,
  )
  const selectedLogId = ref<string | null>(
    options.selectedLogId === undefined ? selectedLog.value?.id ?? null : options.selectedLogId,
  )
  const visibleLogs = ref<DailyLogRecord[]>(options.visibleLogs ?? [])
  const actionErrors: string[] = []
  const actionInfos: string[] = []
  const clonePreparedPayload = vi.fn((payload = form.value) => createEmptyDailyLogPayload(payload))
  const resetForm = vi.fn()
  const saveDraftImmediately = vi.fn<() => Promise<boolean>>()
    .mockResolvedValue(options.saveDraftResult ?? true)
  const setSavedPayloadSnapshot = vi.fn()

  const actions = useDailyLogActions({
    canDeleteSelectedLog: computed(() => canDelete.value),
    canEditSelectedLog: computed(() => canEdit.value),
    clonePreparedPayload,
    currentUserId: computed(() => currentUserId.value),
    form,
    getActor: () => ({ userId: currentUserId.value, displayName: 'Vince Hintz' }),
    hasUnsavedDraftChanges: computed(() => hasUnsavedDraftChanges.value),
    job: computed(() => job.value),
    jobId: computed(() => jobId.value),
    resetForm,
    saveDraftImmediately,
    selectedDate: computed(() => selectedDate.value),
    selectedDateIsFuture: computed(() => selectedDateIsFuture.value),
    selectedLog: computed(() => selectedLog.value),
    selectedLogId,
    setActionError: (message) => {
      actionErrors.push(message)
    },
    setActionInfo: (message) => {
      actionInfos.push(message)
    },
    setSavedPayloadSnapshot,
    visibleLogs: computed(() => visibleLogs.value),
  })

  return {
    actionErrors,
    actionInfos,
    actions,
    clonePreparedPayload,
    form,
    resetForm,
    saveDraftImmediately,
    selectedLog,
    selectedLogId,
    setSavedPayloadSnapshot,
  }
}

describe('useDailyLogActions', () => {
  beforeEach(() => {
    createDailyLogRecordMock.mockReset()
    deleteDailyLogAttachmentMock.mockReset()
    deleteDailyLogRecordMock.mockReset()
    sendDailyLogEmailMock.mockReset()
    updateDailyLogRecordMock.mockReset()
    createDailyLogRecordMock.mockResolvedValue('created-log')
    deleteDailyLogAttachmentMock.mockResolvedValue(undefined)
    deleteDailyLogRecordMock.mockResolvedValue(undefined)
    sendDailyLogEmailMock.mockResolvedValue('sent')
    updateDailyLogRecordMock.mockResolvedValue(undefined)
  })

  it('creates a daily log draft for the current job and selects the created log', async () => {
    const { actionInfos, actions, form, resetForm, selectedLogId, setSavedPayloadSnapshot } = mountActions({
      selectedLog: null,
      selectedLogId: null,
    })

    await actions.handleCreateDraft()

    expect(createDailyLogRecordMock).toHaveBeenCalledWith(expect.objectContaining({
      foremanName: 'Vince Hintz',
      foremanUserId: 'user-1',
      jobCode: '5229',
      jobId: 'job-1',
      jobName: 'Lucky 3 Ranch',
      logDate: '2026-07-15',
    }))
    expect(selectedLogId.value).toBe('created-log')
    expect(resetForm).toHaveBeenCalledTimes(1)
    expect(form.value).toEqual(expect.objectContaining({
      projectName: '',
      weeklySchedule: '',
    }))
    expect(setSavedPayloadSnapshot).toHaveBeenCalledWith(form.value)
    expect(actionInfos).toContain('Daily log draft created.')
    expect(actions.creatingDraft.value).toBe(false)
  })

  it('reuses an existing user draft instead of creating a duplicate', async () => {
    const existingDraft = makeLog({ id: 'existing-draft', foremanUserId: 'user-1' })
    const { actionInfos, actions, selectedLogId } = mountActions({
      selectedLog: null,
      selectedLogId: null,
      visibleLogs: [existingDraft],
    })

    await actions.handleCreateDraft()

    expect(createDailyLogRecordMock).not.toHaveBeenCalled()
    expect(selectedLogId.value).toBe('existing-draft')
    expect(actionInfos).toContain('Your current daily log draft is already open.')
  })

  it('blocks draft creation without required context or when viewing a future day', async () => {
    const missingContext = mountActions({ currentUserId: null })

    await missingContext.actions.handleCreateDraft()

    expect(missingContext.actionErrors).toContain('Load the job before creating a daily log.')
    expect(createDailyLogRecordMock).not.toHaveBeenCalled()

    const futureDay = mountActions({
      selectedDate: '2026-07-16',
      selectedDateIsFuture: true,
    })

    await futureDay.actions.handleCreateDraft()

    expect(futureDay.actionErrors).toContain('Daily log drafts cannot be created for future dates.')
    expect(createDailyLogRecordMock).not.toHaveBeenCalled()
  })

  it('creates a daily log draft for an earlier selected date', async () => {
    const { actions } = mountActions({
      selectedDate: '2026-07-14',
      selectedDateIsFuture: false,
      selectedLog: null,
      selectedLogId: null,
    })

    await actions.handleCreateDraft()

    expect(createDailyLogRecordMock).toHaveBeenCalledWith(expect.objectContaining({
      logDate: '2026-07-14',
    }))
  })

  it('reports save status based on whether the draft had unsaved changes', async () => {
    const dirty = mountActions({ hasUnsavedDraftChanges: true })

    await dirty.actions.handleSaveDraft()

    expect(dirty.saveDraftImmediately).toHaveBeenCalledTimes(1)
    expect(dirty.actionInfos).toContain('Daily log draft saved.')

    const clean = mountActions({ hasUnsavedDraftChanges: false })

    await clean.actions.handleSaveDraft()

    expect(clean.actionInfos).toContain('Daily log draft is already saved.')

    const failed = mountActions({ saveDraftResult: false })

    await failed.actions.handleSaveDraft()

    expect(failed.actionInfos).toEqual([])
  })

  it('validates submit permissions and required payload fields', async () => {
    const readOnly = mountActions({ canEdit: false })

    await readOnly.actions.handleSubmit()

    expect(readOnly.actionErrors).toContain('Only an editable daily log draft can be submitted.')
    expect(updateDailyLogRecordMock).not.toHaveBeenCalled()

    const invalidPayload = mountActions({
      form: makeSubmitReadyPayload({ weeklySchedule: '' }),
    })

    await invalidPayload.actions.handleSubmit()

    expect(invalidPayload.actionErrors).toContain('Complete "Weekly Schedule" before submitting.')
    expect(updateDailyLogRecordMock).not.toHaveBeenCalled()
  })

  it('submits valid logs, saves the payload snapshot, and reports email success', async () => {
    const {
      actionInfos,
      actions,
      form,
      setSavedPayloadSnapshot,
    } = mountActions()

    await actions.handleSubmit()

    expect(updateDailyLogRecordMock).toHaveBeenCalledWith(
      'daily-log-1',
      {
        payload: form.value,
        status: 'submitted',
      },
      { userId: 'user-1', displayName: 'Vince Hintz' },
    )
    expect(setSavedPayloadSnapshot).toHaveBeenCalledWith(form.value)
    expect(sendDailyLogEmailMock).toHaveBeenCalledWith('job-1', 'daily-log-1')
    expect(actionInfos).toContain('Daily log submitted and emailed.')
    expect(actions.submittingLog.value).toBe(false)
  })

  it('handles skipped or failed email separately from the submitted log save', async () => {
    sendDailyLogEmailMock.mockResolvedValueOnce('skipped: no recipients')
    const skippedEmail = mountActions()

    await skippedEmail.actions.handleSubmit()

    expect(skippedEmail.actionInfos).toContain('Daily log submitted.')

    sendDailyLogEmailMock.mockRejectedValueOnce(new Error('SMTP offline'))
    const failedEmail = mountActions()

    await failedEmail.actions.handleSubmit()

    expect(failedEmail.actionErrors).toContain('Daily log submitted, but email failed. SMTP offline')
    expect(updateDailyLogRecordMock).toHaveBeenCalledTimes(2)
  })

  it('opens delete confirmation only for deletable selected drafts', () => {
    const editable = mountActions()

    editable.actions.handleDeleteSelectedLog()

    expect(editable.actions.deleteDraftConfirmOpen.value).toBe(true)

    const readOnly = mountActions({ canDelete: false })

    readOnly.actions.handleDeleteSelectedLog()

    expect(readOnly.actions.deleteDraftConfirmOpen.value).toBe(false)

    const adminDeleteOnly = mountActions({ canDelete: true, canEdit: false })

    adminDeleteOnly.actions.handleDeleteSelectedLog()

    expect(adminDeleteOnly.actions.deleteDraftConfirmOpen.value).toBe(true)
  })

  it('deletes draft attachments and the draft record, then clears selection and closes confirmation', async () => {
    const logWithAttachments = makeLog({
      payload: makeSubmitReadyPayload({
        attachments: [
          {
            description: 'Photo',
            name: 'photo.jpg',
            path: 'dailyLogs/job-1/photo.jpg',
            type: 'photo',
            url: 'https://example.test/photo.jpg',
          },
        ],
      }),
    })
    const { actionInfos, actions, selectedLogId } = mountActions({
      selectedLog: logWithAttachments,
      selectedLogId: logWithAttachments.id,
    })

    await actions.confirmDeleteSelectedLog()

    expect(deleteDailyLogAttachmentMock).toHaveBeenCalledWith('dailyLogs/job-1/photo.jpg')
    expect(deleteDailyLogRecordMock).toHaveBeenCalledWith('daily-log-1')
    expect(selectedLogId.value).toBeNull()
    expect(actionInfos).toContain('Daily log draft deleted.')
    expect(actions.deleteDraftConfirmOpen.value).toBe(false)
    expect(actions.deletingDraft.value).toBe(false)
  })

  it('reports delete failures and still closes the delete confirmation', async () => {
    deleteDailyLogRecordMock.mockRejectedValueOnce(new Error('Delete denied'))
    const { actionErrors, actions } = mountActions()

    await actions.confirmDeleteSelectedLog()

    expect(actionErrors).toContain('Delete denied')
    expect(actions.deleteDraftConfirmOpen.value).toBe(false)
    expect(actions.deletingDraft.value).toBe(false)
  })
})
