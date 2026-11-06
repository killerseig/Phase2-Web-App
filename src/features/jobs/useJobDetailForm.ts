import { computed, reactive, ref } from 'vue'
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
  let activeDetailSave: Promise<boolean> | undefined
  const detailDirty = computed(() => !!getSelectedJob() && !getIsCreateMode()
    && lastHydratedJobId.value === getSelectedJob()?.id
    && serializeJobForm(detailForm) !== lastSavedDetailSignature.value)
  const detailAutosaveQueue = useAutosaveQueue({
    debounceMs: 450,
    canSave: () => (
      getCanEditSelectedJob()
      && getEditDrawerOpen()
      && !getIsCreateMode()
      && !!getSelectedJob()
      && !hydratingDetailForm.value
    ),
    save: () => detailDirty.value ? saveDetailForm('All changes saved.', 'Saving...') : true,
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

  async function saveDetailForm(successMessage: string, savingMessage = ''): Promise<boolean> {
    while (activeDetailSave) {
      if (!(await activeDetailSave)) return false
      if (!detailDirty.value) return true
    }
    const pending = performDetailSave(successMessage, savingMessage)
    activeDetailSave = pending
    try { return await pending }
    finally { if (activeDetailSave === pending) activeDetailSave = undefined }
  }

  async function performDetailSave(successMessage: string, savingMessage = ''): Promise<boolean> {
    const job = getSelectedJob()
    if (!job || lastHydratedJobId.value !== job.id) return false

    clearDetailAutosaveTimer()
    setDetailError('')
    setDetailInfo(savingMessage)

    if (!getCanEditSelectedJob()) {
      setDetailError('You do not have permission to edit this job.')
      setDetailInfo('')
      return false
    }

    const validationMessage = validateJobForm(detailForm)
    if (validationMessage) {
      setDetailError(validationMessage)
      setDetailInfo('')
      return false
    }

    const snapshot = { ...detailForm, assignedForemanIds: [...detailForm.assignedForemanIds] }
    const signature = serializeJobForm(snapshot)
    const saved = await persistJobDetail(job, snapshot)
    if (!saved) { setDetailInfo(''); return false }
    if (lastHydratedJobId.value === job.id) {
      lastSavedDetailSignature.value = signature
      setDetailInfo(detailDirty.value ? '' : successMessage)
    }
    return true
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
    if (nextSignature === lastSavedDetailSignature.value && !activeDetailSave) return

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

  async function prepareDetailNavigation() {
    clearDetailAutosaveTimer()
    if (activeDetailSave && !(await activeDetailSave)) return false
    if (!detailDirty.value) return true
    return await saveDetailForm('All changes saved.', 'Saving...') && !detailDirty.value
  }

  function handleSaveJob() {
    return saveDetailForm('Job updated.')
  }

  return {
    applySelectedJobToForm,
    clearDetailAutosaveTimer,
    detailForm,
    detailDirty,
    prepareDetailNavigation,
    handleSaveJob,
    queueDetailAutosave,
    shouldHydrateSelectedJob,
    updateDetailFormField,
  }
}
