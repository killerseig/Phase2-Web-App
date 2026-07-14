import {
  computed,
  ref,
  type ComputedRef,
  type Ref,
} from 'vue'
import {
  getAdditionalDailyLogRecipients,
  getAdminDailyLogRecipients,
  normalizeDailyLogRecipientEmail,
} from '@/features/dailyLogs/viewHelpers'
import { updateDailyLogRecord, type DailyLogActor } from '@/services/dailyLogs'
import type { DailyLogRecord, JobRecord, NotificationRecipients } from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'
import { isValidRecipientEmail } from '@/utils/recipientEmails'

interface UseDailyLogRecipientsOptions {
  canEditSelectedLog: ComputedRef<boolean>
  clearActionError: () => void
  getActor: () => DailyLogActor
  globalNotificationRecipients: Ref<NotificationRecipients>
  job: ComputedRef<JobRecord | null>
  logs: Ref<DailyLogRecord[]>
  selectedLog: ComputedRef<DailyLogRecord | null>
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
  const recipientInput = ref('')
  const recipientSaving = ref(false)
  const adminDailyLogRecipients = computed(() => getAdminDailyLogRecipients({
    globalRecipients: globalNotificationRecipients.value,
    job: job.value,
  }))
  const additionalDailyLogRecipients = computed(() => (
    getAdditionalDailyLogRecipients(selectedLog.value, adminDailyLogRecipients.value)
  ))

  function clearRecipientInput() {
    recipientInput.value = ''
  }

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

    const email = normalizeDailyLogRecipientEmail(recipientInput.value)
    if (!email) {
      setActionError('Enter an email address before adding a recipient.')
      return
    }

    if (!isValidRecipientEmail(email)) {
      setActionError('Enter a valid email address.')
      return
    }

    if (adminDailyLogRecipients.value.includes(email) || additionalDailyLogRecipients.value.includes(email)) {
      setActionInfo('That recipient is already on the list.')
      clearRecipientInput()
      return
    }

    recipientSaving.value = true
    clearActionError()
    try {
      const nextRecipients = [...additionalDailyLogRecipients.value, email]
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
      const nextRecipients = additionalDailyLogRecipients.value.filter((entry) => entry !== email)
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
