import { reactive, ref } from 'vue'
import {
  applyJobRecordToFormState,
  applyNotificationRecipients,
  createEmptyJobFormState,
  resetJobFormState,
  resetRecipientInputs,
  serializeJobForm,
  shouldHydrateJobDetailForm,
  validateJobForm,
  type JobFormState,
  type JobFormTextField,
} from '@/features/jobs/jobViewHelpers'
import type { JobRecord, NotificationModuleKey, NotificationRecipients } from '@/types/domain'

interface UseJobDetailFormOptions {
  detailNotificationRecipients: NotificationRecipients
  detailRecipientInputs: Record<NotificationModuleKey, string>
  getEditDrawerOpen: () => boolean
  getIsAdmin: () => boolean
  getIsCreateMode: () => boolean
  getSelectedJob: () => JobRecord | null
  persistJobDetail: (job: JobRecord, form: JobFormState) => Promise<boolean>
  setDetailError: (message: string) => void
  setDetailInfo: (message: string) => void
}

export function useJobDetailForm({
  detailNotificationRecipients,
  detailRecipientInputs,
  getEditDrawerOpen,
  getIsAdmin,
  getIsCreateMode,
  getSelectedJob,
  persistJobDetail,
  setDetailError,
  setDetailInfo,
}: UseJobDetailFormOptions) {
  const detailForm = reactive<JobFormState>(createEmptyJobFormState())
  const hydratingDetailForm = ref(false)
  const lastHydratedJobId = ref<string | null>(null)
  const lastSavedDetailSignature = ref('')
  let detailAutosaveTimer: ReturnType<typeof setTimeout> | null = null

  function applySelectedJobToForm(job: JobRecord | null) {
    setDetailError('')
    setDetailInfo('')
    hydratingDetailForm.value = true
    lastHydratedJobId.value = job?.id ?? null

    if (!job) {
      resetJobFormState(detailForm)
      applyNotificationRecipients(detailNotificationRecipients)
      resetRecipientInputs(detailRecipientInputs)
      lastSavedDetailSignature.value = ''
      hydratingDetailForm.value = false
      return
    }

    applyJobRecordToFormState(detailForm, job)
    applyNotificationRecipients(detailNotificationRecipients, job.notificationRecipients)
    resetRecipientInputs(detailRecipientInputs)
    lastSavedDetailSignature.value = serializeJobForm(detailForm)
    hydratingDetailForm.value = false
  }

  function updateDetailFormField(field: JobFormTextField, value: string) {
    detailForm[field] = value
  }

  function clearDetailAutosaveTimer() {
    if (!detailAutosaveTimer) return

    clearTimeout(detailAutosaveTimer)
    detailAutosaveTimer = null
  }

  async function saveDetailForm(successMessage: string, savingMessage = '') {
    const job = getSelectedJob()
    if (!job) return

    clearDetailAutosaveTimer()
    setDetailError('')
    setDetailInfo(savingMessage)

    const validationMessage = validateJobForm(detailForm)
    if (validationMessage) {
      setDetailError(validationMessage)
      setDetailInfo('')
      return
    }

    const saved = await persistJobDetail(job, detailForm)
    if (!saved) return

    lastSavedDetailSignature.value = serializeJobForm(detailForm)
    setDetailInfo(successMessage)
  }

  function queueDetailAutosave() {
    if (
      !getIsAdmin()
      || !getEditDrawerOpen()
      || getIsCreateMode()
      || !getSelectedJob()
      || hydratingDetailForm.value
    ) {
      return
    }

    const nextSignature = serializeJobForm(detailForm)
    if (nextSignature === lastSavedDetailSignature.value) return

    clearDetailAutosaveTimer()
    detailAutosaveTimer = setTimeout(() => {
      void saveDetailForm('All changes saved.', 'Saving...')
    }, 450)
  }

  function shouldHydrateSelectedJob(job: JobRecord, previousJob: JobRecord | null) {
    return shouldHydrateJobDetailForm({
      job,
      previousJob,
      lastHydratedJobId: lastHydratedJobId.value,
      form: detailForm,
      lastSavedSignature: lastSavedDetailSignature.value,
      isAdmin: getIsAdmin(),
      editDrawerOpen: getEditDrawerOpen(),
      isCreateMode: getIsCreateMode(),
    })
  }

  function handleSaveJob() {
    return saveDetailForm('Job updated.')
  }

  return {
    applySelectedJobToForm,
    clearDetailAutosaveTimer,
    detailForm,
    handleSaveJob,
    queueDetailAutosave,
    shouldHydrateSelectedJob,
    updateDetailFormField,
  }
}
