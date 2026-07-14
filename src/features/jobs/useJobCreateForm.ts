import { reactive } from 'vue'
import {
  applyNotificationRecipients,
  createEmptyJobFormState,
  createEmptyNotificationRecipients,
  createRecipientInputState,
  resetJobFormState,
  resetRecipientInputs,
  type JobFormState,
  type JobFormTextField,
} from '@/features/jobs/jobViewHelpers'
import type { NotificationModuleKey, NotificationRecipients } from '@/types/domain'

interface UseJobCreateFormOptions {
  clearCreateMessages: () => void
}

export function useJobCreateForm({
  clearCreateMessages,
}: UseJobCreateFormOptions) {
  const createForm = reactive<JobFormState>(createEmptyJobFormState())
  const createNotificationRecipients = reactive<NotificationRecipients>(createEmptyNotificationRecipients())
  const createRecipientInputs = reactive<Record<NotificationModuleKey, string>>(createRecipientInputState())

  function resetCreateForm() {
    resetJobFormState(createForm)
    applyNotificationRecipients(createNotificationRecipients)
    resetRecipientInputs(createRecipientInputs)
    clearCreateMessages()
  }

  function updateCreateFormField(field: JobFormTextField, value: string) {
    createForm[field] = value
  }

  return {
    createForm,
    createNotificationRecipients,
    createRecipientInputs,
    resetCreateForm,
    updateCreateFormField,
  }
}
