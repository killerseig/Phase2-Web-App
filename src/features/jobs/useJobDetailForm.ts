import { reactive, ref } from 'vue'
import { useAutosaveQueue } from '@/composables/useAutosaveQueue'
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
  getCanEditSelectedJob: () => boolean
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
  getCanEditSelectedJob,
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
  const detailAutosaveQueue = useAutosaveQueue({
    debounceMs: 450,
    canSave: () => (
      getCanEditSelectedJob()
      && getEditDrawerOpen()
      && !getIsCreateMode()
      && !!getSelectedJob()
      && !hydratingDetailForm.value
    ),
    save: () => saveDetailForm('All changes saved.', 'Saving...'),
  })

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
    detailAutosaveQueue.clearQueuedSave()
  }

  async function saveDetailForm(successMessage: string, savingMessage = '') {
    const job = getSelectedJob()
    if (!job) return

    clearDetailAutosaveTimer()
    setDetailError('')
    setDetailInfo(savingMessage)

    if (!getCanEditSelectedJob()) {
      setDetailError('You do not have permission to edit this job.')
      setDetailInfo('')
      return
    }

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
      !getCanEditSelectedJob()
      || !getEditDrawerOpen()
      || getIsCreateMode()
      || !getSelectedJob()
      || hydratingDetailForm.value
    ) {
      return
    }

    const nextSignature = serializeJobForm(detailForm)
    if (nextSignature === lastSavedDetailSignature.value) return

    detailAutosaveQueue.queueAutosave()
  }

  function shouldHydrateSelectedJob(job: JobRecord, previousJob: JobRecord | null) {
    return shouldHydrateJobDetailForm({
      job,
      previousJob,
      lastHydratedJobId: lastHydratedJobId.value,
      form: detailForm,
      lastSavedSignature: lastSavedDetailSignature.value,
      canEditJob: getCanEditSelectedJob(),
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
