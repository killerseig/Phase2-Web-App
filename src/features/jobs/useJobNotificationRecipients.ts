import { ref } from 'vue'
import { useRecipientEditor } from '@/composables/useRecipientEditor'
import { getNotificationModuleLabel } from '@/features/jobs/jobViewHelpers'
import {
  updateGlobalNotificationRecipients,
  updateJobNotificationRecipients,
} from '@/services/jobs'
import type {
  GlobalNotificationModuleKey,
  GlobalNotificationRecipients,
  JobRecord,
  NotificationModuleKey,
  NotificationRecipients,
} from '@/types/domain'
import type { ReadonlyRef, WritableRef } from '@/types/reactivity'
import { normalizeError } from '@/utils/normalizeError'

type JobRecipientTargetMode = 'create' | 'job' | 'all'
type RecipientLists = Partial<Record<GlobalNotificationModuleKey, string[]>>
type RecipientInputs = Partial<Record<GlobalNotificationModuleKey, string>>

function isJobNotificationModuleKey(
  moduleKey: GlobalNotificationModuleKey,
): moduleKey is NotificationModuleKey {
  return moduleKey === 'dailyLogs' || moduleKey === 'timecards' || moduleKey === 'shopOrders'
}

interface UseJobNotificationRecipientsOptions {
  createError: WritableRef<string>
  createInfo: WritableRef<string>
  createNotificationRecipients: NotificationRecipients
  createRecipientInputs: Record<NotificationModuleKey, string>
  detailError: WritableRef<string>
  detailInfo: WritableRef<string>
  detailNotificationRecipients: NotificationRecipients
  detailRecipientInputs: Record<NotificationModuleKey, string>
  globalNotificationRecipients: WritableRef<GlobalNotificationRecipients>
  globalRecipientInputs: Record<GlobalNotificationModuleKey, string>
  selectedJob: ReadonlyRef<JobRecord | null>
}

export function useJobNotificationRecipients({
  createError,
  createInfo,
  createNotificationRecipients,
  createRecipientInputs,
  detailError,
  detailInfo,
  detailNotificationRecipients,
  detailRecipientInputs,
  globalNotificationRecipients,
  globalRecipientInputs,
  selectedJob,
}: UseJobNotificationRecipientsOptions) {
  const recipientSaving = ref(false)
  const { appendRecipient, getRecipientValueAddResult, removeRecipient } = useRecipientEditor()

  function getRecipientTargets(mode: JobRecipientTargetMode): {
    errorTarget: WritableRef<string>
    infoTarget: WritableRef<string>
    inputs: RecipientInputs
    recipients: RecipientLists
  } {
    return {
      errorTarget: mode === 'create' ? createError : detailError,
      infoTarget: mode === 'create' ? createInfo : detailInfo,
      inputs:
        mode === 'create'
          ? createRecipientInputs
          : mode === 'job'
            ? detailRecipientInputs
            : globalRecipientInputs,
      recipients:
        mode === 'create'
          ? createNotificationRecipients
          : mode === 'job'
            ? detailNotificationRecipients
            : globalNotificationRecipients.value,
    }
  }

  async function persistRecipients(
    mode: Exclude<JobRecipientTargetMode, 'create'>,
    moduleKey: GlobalNotificationModuleKey,
    nextRecipients: string[],
  ) {
    if (mode === 'job' && selectedJob.value && isJobNotificationModuleKey(moduleKey)) {
      await updateJobNotificationRecipients(selectedJob.value.id, moduleKey, nextRecipients)
      detailNotificationRecipients[moduleKey] = nextRecipients
      return
    }

    if (mode === 'all') {
      await updateGlobalNotificationRecipients(moduleKey, nextRecipients)
      globalNotificationRecipients.value = {
        ...globalNotificationRecipients.value,
        [moduleKey]: nextRecipients,
      }
    }
  }

  async function addRecipientToTarget(
    mode: JobRecipientTargetMode,
    moduleKey: GlobalNotificationModuleKey,
  ) {
    const { errorTarget, infoTarget, inputs, recipients } = getRecipientTargets(mode)
    if (mode !== 'all' && !isJobNotificationModuleKey(moduleKey)) {
      errorTarget.value = 'That email option is available only under All Jobs.'
      return
    }

    const result = getRecipientValueAddResult(inputs[moduleKey] ?? '', recipients[moduleKey] ?? [])

    errorTarget.value = ''

    if (result.status === 'empty') {
      errorTarget.value = `Enter a ${getNotificationModuleLabel(moduleKey)} email first.`
      return
    }

    if (result.status === 'invalid') {
      errorTarget.value = 'Enter a valid email address.'
      return
    }

    if (result.status === 'duplicate') {
      infoTarget.value = 'That recipient is already on the list.'
      inputs[moduleKey] = ''
      return
    }

    const nextRecipients = appendRecipient(recipients[moduleKey] ?? [], result.email)

    if (mode === 'create') {
      recipients[moduleKey] = nextRecipients
      inputs[moduleKey] = ''
      infoTarget.value = 'Recipient added.'
      return
    }

    recipientSaving.value = true
    infoTarget.value = ''
    try {
      await persistRecipients(mode, moduleKey, nextRecipients)
      inputs[moduleKey] = ''
      infoTarget.value = 'Recipient added.'
    } catch (error) {
      errorTarget.value = normalizeError(
        error,
        `Failed to add the ${getNotificationModuleLabel(moduleKey)} recipient.`,
      )
    } finally {
      recipientSaving.value = false
    }
  }

  async function removeRecipientFromTarget(
    mode: JobRecipientTargetMode,
    moduleKey: GlobalNotificationModuleKey,
    email: string,
  ) {
    const { errorTarget, infoTarget, recipients } = getRecipientTargets(mode)
    if (mode !== 'all' && !isJobNotificationModuleKey(moduleKey)) {
      errorTarget.value = 'That email option is available only under All Jobs.'
      return
    }

    const nextRecipients = removeRecipient(recipients[moduleKey] ?? [], email)

    errorTarget.value = ''

    if (mode === 'create') {
      recipients[moduleKey] = nextRecipients
      infoTarget.value = 'Recipient removed.'
      return
    }

    recipientSaving.value = true
    infoTarget.value = ''
    try {
      await persistRecipients(mode, moduleKey, nextRecipients)
      infoTarget.value = 'Recipient removed.'
    } catch (error) {
      errorTarget.value = normalizeError(
        error,
        `Failed to remove the ${getNotificationModuleLabel(moduleKey)} recipient.`,
      )
    } finally {
      recipientSaving.value = false
    }
  }

  return {
    addRecipientToTarget,
    recipientSaving,
    removeRecipientFromTarget,
  }
}
