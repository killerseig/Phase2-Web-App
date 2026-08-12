import {
  computed,
  ref,
} from 'vue'
import { useRecipientEditor } from '@/composables/useRecipientEditor'
import {
  getAdditionalDailyLogRecipients,
  getAdminDailyLogRecipients,
} from '@/features/dailyLogs/viewHelpers'
import { updateDailyLogRecord, type DailyLogActor } from '@/services/dailyLogs'
import type { DailyLogRecord, JobRecord, NotificationRecipients } from '@/types/domain'
import type { ReadonlyRef, WritableRef } from '@/types/reactivity'
import { normalizeError } from '@/utils/normalizeError'

interface UseDailyLogRecipientsOptions {
  canEditSelectedLog: ReadonlyRef<boolean>
  clearActionError: () => void
  getActor: () => DailyLogActor
  globalNotificationRecipients: ReadonlyRef<NotificationRecipients>
  job: ReadonlyRef<JobRecord | null>
  logs: WritableRef<DailyLogRecord[]>
  selectedLog: ReadonlyRef<DailyLogRecord | null>
  setActionError: (message: string) => void
  setActionInfo: (message: string) => void
}

export function useDailyLogRecipients({
  canEditSelectedLog,
  clearActionError,
  getActor,
  globalNotificationRecipients,
  job,
  logs,
  selectedLog,
  setActionError,
  setActionInfo,
}: UseDailyLogRecipientsOptions) {
  const {
    appendRecipient,
    clearRecipientInput,
    getRecipientInputAddResult,
    recipientInput,
    removeRecipient,
  } = useRecipientEditor()
  const recipientSaving = ref(false)
  const adminDailyLogRecipients = computed(() => getAdminDailyLogRecipients({
    globalRecipients: globalNotificationRecipients.value,
    job: job.value,
  }))
  const additionalDailyLogRecipients = computed(() => (
    getAdditionalDailyLogRecipients(selectedLog.value, adminDailyLogRecipients.value)
  ))

  function updateSelectedLogRecipients(nextRecipients: string[]) {
    if (!selectedLog.value) return

    logs.value = logs.value.map((log) => (
      log.id === selectedLog.value?.id
        ? { ...log, additionalRecipients: nextRecipients }
        : log
    ))
  }

  async function handleAddRecipient() {
    if (!selectedLog.value || !canEditSelectedLog.value) return

    const result = getRecipientInputAddResult(
      additionalDailyLogRecipients.value,
      adminDailyLogRecipients.value,
    )

    if (result.status === 'empty') {
      setActionError('Enter an email address before adding a recipient.')
      return
    }

    if (result.status === 'invalid') {
      setActionError('Enter a valid email address.')
      return
    }

    if (result.status === 'duplicate') {
      setActionInfo('That recipient is already on the list.')
      clearRecipientInput()
      return
    }

    recipientSaving.value = true
    clearActionError()
    try {
      const nextRecipients = appendRecipient(additionalDailyLogRecipients.value, result.email)
      await updateDailyLogRecord(selectedLog.value.id, { additionalRecipients: nextRecipients }, getActor())
      updateSelectedLogRecipients(nextRecipients)
      clearRecipientInput()
      setActionInfo('Recipient added.')
    } catch (error) {
      setActionError(normalizeError(error, 'Failed to add the recipient.'))
    } finally {
      recipientSaving.value = false
    }
  }

  async function handleRemoveRecipient(email: string) {
    if (!selectedLog.value || !canEditSelectedLog.value) return

    recipientSaving.value = true
    clearActionError()
    try {
      const nextRecipients = removeRecipient(additionalDailyLogRecipients.value, email)
      await updateDailyLogRecord(selectedLog.value.id, { additionalRecipients: nextRecipients }, getActor())
      updateSelectedLogRecipients(nextRecipients)
      setActionInfo('Recipient removed.')
    } catch (error) {
      setActionError(normalizeError(error, 'Failed to remove the recipient.'))
    } finally {
      recipientSaving.value = false
    }
  }

  return {
    additionalDailyLogRecipients,
    adminDailyLogRecipients,
    clearRecipientInput,
    handleAddRecipient,
    handleRemoveRecipient,
    recipientInput,
    recipientSaving,
  }
}
