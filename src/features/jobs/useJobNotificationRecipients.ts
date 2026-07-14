import { ref, type ComputedRef, type Ref } from 'vue'
import {
  getNotificationModuleLabel,
} from '@/features/jobs/jobViewHelpers'
import {
  updateGlobalNotificationRecipients,
  updateJobNotificationRecipients,
} from '@/services/jobs'
import type { JobRecord, NotificationModuleKey, NotificationRecipients } from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'
import {
  isValidRecipientEmail,
  normalizeRecipientEmail,
} from '@/utils/recipientEmails'

type JobRecipientTargetMode = 'create' | 'job' | 'all'

interface UseJobNotificationRecipientsOptions {
  createError: Ref<string>
  createInfo: Ref<string>
  createNotificationRecipients: NotificationRecipients
  createRecipientInputs: Record<NotificationModuleKey, string>
  detailError: Ref<string>
  detailInfo: Ref<string>
  detailNotificationRecipients: NotificationRecipients
  detailRecipientInputs: Record<NotificationModuleKey, string>
  globalNotificationRecipients: Ref<NotificationRecipients>
  globalRecipientInputs: Record<NotificationModuleKey, string>
  selectedJob: ComputedRef<JobRecord | null>
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

  function getRecipientTargets(mode: JobRecipientTargetMode) {
    return {
      errorTarget: mode === 'create' ? createError : detailError,
      infoTarget: mode === 'create' ? createInfo : detailInfo,
      inputs: mode === 'create'
        ? createRecipientInputs
        : mode === 'job'
          ? detailRecipientInputs
          : globalRecipientInputs,
      recipients: mode === 'create'
        ? createNotificationRecipients
        : mode === 'job'
          ? detailNotificationRecipients
          : globalNotificationRecipients.value,
    }
  }

  async function persistRecipients(
    mode: Exclude<JobRecipientTargetMode, 'create'>,
    moduleKey: NotificationModuleKey,
    nextRecipients: string[],
  ) {
    if (mode === 'job' && selectedJob.value) {
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
    moduleKey: NotificationModuleKey,
  ) {
    const {
      errorTarget,
      infoTarget,
      inputs,
      recipients,
    } = getRecipientTargets(mode)
    const email = normalizeRecipientEmail(inputs[moduleKey])

    errorTarget.value = ''

    if (!email.length) {
      errorTarget.value = `Enter a ${getNotificationModuleLabel(moduleKey)} email first.`
      return
    }

    if (!isValidRecipientEmail(email)) {
      errorTarget.value = 'Enter a valid email address.'
      return
    }

    if (recipients[moduleKey].includes(email)) {
      infoTarget.value = 'That recipient is already on the list.'
      inputs[moduleKey] = ''
      return
    }

    const nextRecipients = [...recipients[moduleKey], email]

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
      errorTarget.value = normalizeError(error, `Failed to add the ${getNotificationModuleLabel(moduleKey)} recipient.`)
    } finally {
      recipientSaving.value = false
    }
  }

  async function removeRecipientFromTarget(
    mode: JobRecipientTargetMode,
    moduleKey: NotificationModuleKey,
    email: string,
  ) {
    const {
      errorTarget,
      infoTarget,
      recipients,
    } = getRecipientTargets(mode)
    const nextRecipients = recipients[moduleKey].filter((entry) => entry !== email)

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
      errorTarget.value = normalizeError(error, `Failed to remove the ${getNotificationModuleLabel(moduleKey)} recipient.`)
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
