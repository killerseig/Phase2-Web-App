import { ref } from 'vue'
import { createEmptyDailyLogPayload } from '@/features/dailyLogs/schema'
import { validateDailyLogForSubmit } from '@/features/dailyLogs/viewHelpers'
import {
  createDailyLogRecord,
  deleteDailyLogAttachment,
  deleteDailyLogRecord,
  sendDailyLogEmail,
  updateDailyLogRecord,
  type DailyLogActor,
} from '@/services/dailyLogs'
import type { DailyLogPayload, DailyLogRecord, JobRecord } from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

interface Ref<T> {
  value: T
}

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseDailyLogActionsOptions {
  canEditSelectedLog: ReadonlyRef<boolean>
  clonePreparedPayload: (payload?: DailyLogPayload) => DailyLogPayload
  currentUserId: ReadonlyRef<string | null>
  form: Ref<DailyLogPayload>
  getActor: () => DailyLogActor
  hasUnsavedDraftChanges: ReadonlyRef<boolean>
  job: ReadonlyRef<JobRecord | null>
  jobId: ReadonlyRef<string | null>
  resetForm: (log?: DailyLogRecord | null) => void
  saveDraftImmediately: () => Promise<boolean>
  selectedDate: ReadonlyRef<string>
  selectedDateIsToday: ReadonlyRef<boolean>
  selectedLog: ReadonlyRef<DailyLogRecord | null>
  selectedLogId: Ref<string | null>
  setActionError: (message: string) => void
  setActionInfo: (message: string) => void
  setSavedPayloadSnapshot: (payload?: DailyLogPayload) => void
  visibleLogs: ReadonlyRef<DailyLogRecord[]>
}

export function useDailyLogActions({
  canEditSelectedLog,
  clonePreparedPayload,
  currentUserId,
  form,
  getActor,
  hasUnsavedDraftChanges,
  job,
  jobId,
  resetForm,
  saveDraftImmediately,
  selectedDate,
  selectedDateIsToday,
  selectedLog,
  selectedLogId,
  setActionError,
  setActionInfo,
  setSavedPayloadSnapshot,
  visibleLogs,
}: UseDailyLogActionsOptions) {
  const creatingDraft = ref(false)
  const deletingDraft = ref(false)
  const deleteDraftConfirmOpen = ref(false)
  const submittingLog = ref(false)

  async function handleCreateDraft(silent = false) {
    if (!jobId.value || !job.value || !currentUserId.value) {
      setActionError('Load the job before creating a daily log.')
      return
    }

    if (!selectedDateIsToday.value) {
      setActionError('New daily log drafts can only be created for today.')
      return
    }

    const existingDraft = visibleLogs.value.find(
      (log) => log.status === 'draft' && log.foremanUserId === currentUserId.value,
    )
    if (existingDraft) {
      selectedLogId.value = existingDraft.id
      if (!silent) setActionInfo('Your current daily log draft is already open.')
      return
    }

    creatingDraft.value = true
    setActionError('')

    try {
      const actor = getActor()
      const draftPayload = clonePreparedPayload(createEmptyDailyLogPayload())
      const createdId = await createDailyLogRecord({
        jobId: jobId.value,
        jobCode: job.value.code ?? null,
        jobName: job.value.name,
        logDate: selectedDate.value,
        foremanUserId: currentUserId.value,
        foremanName: actor.displayName,
        payload: draftPayload,
      })

      selectedLogId.value = createdId
      resetForm()
      form.value = draftPayload
      setSavedPayloadSnapshot(draftPayload)

      if (!silent) {
        setActionInfo('Daily log draft created.')
      }
    } catch (error) {
      setActionError(normalizeError(error, 'Failed to create a daily log draft.'))
    } finally {
      creatingDraft.value = false
    }
  }

  async function handleSaveDraft() {
    const hadUnsavedChanges = hasUnsavedDraftChanges.value
    const saved = await saveDraftImmediately()
    if (!saved) return

    setActionInfo(hadUnsavedChanges ? 'Daily log draft saved.' : 'Daily log draft is already saved.')
  }

  async function handleSubmit() {
    if (!selectedLog.value || !canEditSelectedLog.value) {
      setActionError('Only your current draft for today can be submitted.')
      return
    }

    const preparedPayload = clonePreparedPayload(form.value)
    const validationMessage = validateDailyLogForSubmit(preparedPayload)
    if (validationMessage) {
      setActionError(validationMessage)
      return
    }

    submittingLog.value = true
    setActionError('')

    try {
      const submittedLogId = selectedLog.value.id
      const submittedJobId = jobId.value
      await updateDailyLogRecord(
        submittedLogId,
        {
          payload: preparedPayload,
          status: 'submitted',
        },
        getActor(),
      )
      setSavedPayloadSnapshot(preparedPayload)

      if (!submittedJobId) {
        setActionInfo('Daily log submitted.')
        return
      }

      try {
        const emailMessage = await sendDailyLogEmail(submittedJobId, submittedLogId)
        if (emailMessage.toLowerCase().includes('skipped')) {
          setActionInfo('Daily log submitted.')
          return
        }

        setActionInfo('Daily log submitted and emailed.')
      } catch (emailError) {
        setActionError(`Daily log submitted, but email failed. ${normalizeError(emailError, 'Failed to send the daily log email.')}`)
      }
    } catch (error) {
      setActionError(normalizeError(error, 'Failed to submit the daily log.'))
    } finally {
      submittingLog.value = false
    }
  }

  function handleDeleteSelectedLog() {
    if (!selectedLog.value || !canEditSelectedLog.value) return

    deleteDraftConfirmOpen.value = true
  }

  async function confirmDeleteSelectedLog() {
    if (!selectedLog.value || !canEditSelectedLog.value) return

    deletingDraft.value = true
    setActionError('')

    try {
      const attachmentPaths = selectedLog.value.payload.attachments.map((attachment) => attachment.path)
      await Promise.allSettled(attachmentPaths.map((path) => deleteDailyLogAttachment(path)))
      await deleteDailyLogRecord(selectedLog.value.id)
      selectedLogId.value = null
      setActionInfo('Daily log draft deleted.')
    } catch (error) {
      setActionError(normalizeError(error, 'Failed to delete the daily log draft.'))
    } finally {
      deletingDraft.value = false
      deleteDraftConfirmOpen.value = false
    }
  }

  return {
    confirmDeleteSelectedLog,
    creatingDraft,
    deletingDraft,
    deleteDraftConfirmOpen,
    handleCreateDraft,
    handleDeleteSelectedLog,
    handleSaveDraft,
    handleSubmit,
    submittingLog,
  }
}
