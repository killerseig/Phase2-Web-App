import {
  ALL_JOBS_ID,
  normalizeFormText,
  validateJobForm,
  type JobFormState,
} from '@/features/jobs/jobViewHelpers'
import {
  createJobRecord,
  deleteJobRecord,
  setJobActive,
  updateJobRecord,
} from '@/services/jobs'
import type { JobRecord, NotificationRecipients } from '@/types/domain'

interface Ref<T> {
  value: T
}

interface ReadonlyRef<T> {
  readonly value: T
}

type JobsViewSelectionId = string | 'new' | typeof ALL_JOBS_ID | null

interface UseJobCrudActionsOptions {
  archiveLoading: Ref<boolean>
  closeArchiveConfirm: () => void
  closeDeleteConfirm: () => void
  createForm: JobFormState
  createLoading: Ref<boolean>
  createNotificationRecipients: NotificationRecipients
  deleteLoading: Ref<boolean>
  detailNotificationRecipients: NotificationRecipients
  resetCreateMessages: () => void
  resetDetailMessages: () => void
  saveLoading: Ref<boolean>
  selectedJob: ReadonlyRef<JobRecord | null>
  selectedJobId: Ref<JobsViewSelectionId>
  setCreateError: (error: unknown, fallbackMessage: string) => void
  setCreateErrorMessage: (message: string) => void
  setCreateInfo: (message: string) => void
  setDetailError: (error: unknown, fallbackMessage: string) => void
  setDetailInfo: (message: string) => void
  visibleJobs: ReadonlyRef<JobRecord[]>
}

export function useJobCrudActions({
  archiveLoading,
  closeArchiveConfirm,
  closeDeleteConfirm,
  createForm,
  createLoading,
  createNotificationRecipients,
  deleteLoading,
  detailNotificationRecipients,
  resetCreateMessages,
  resetDetailMessages,
  saveLoading,
  selectedJob,
  selectedJobId,
  setCreateError,
  setCreateErrorMessage,
  setCreateInfo,
  setDetailError,
  setDetailInfo,
  visibleJobs,
}: UseJobCrudActionsOptions) {
  async function handleCreateJob() {
    resetCreateMessages()

    const validationMessage = validateJobForm(createForm)
    if (validationMessage) {
      setCreateErrorMessage(validationMessage)
      return
    }

    createLoading.value = true
    try {
      const jobId = await createJobRecord({
        ...createForm,
        productionBurden: normalizeFormText(createForm.productionBurden),
        assignedForemanIds: [...createForm.assignedForemanIds],
        notificationRecipients: createNotificationRecipients,
        active: true,
      })

      setCreateInfo('Job created.')
      selectedJobId.value = jobId
    } catch (error) {
      setCreateError(error, 'Failed to create job.')
    } finally {
      createLoading.value = false
    }
  }

  async function persistJobDetail(job: JobRecord, form: JobFormState) {
    saveLoading.value = true
    try {
      await updateJobRecord(job.id, {
        ...form,
        productionBurden: normalizeFormText(form.productionBurden),
        assignedForemanIds: [...form.assignedForemanIds],
        notificationRecipients: detailNotificationRecipients,
        active: job.active,
      })

      return true
    } catch (error) {
      setDetailError(error, 'Failed to update job.')
      return false
    } finally {
      saveLoading.value = false
    }
  }

  async function handleToggleArchive() {
    if (!selectedJob.value) {
      closeArchiveConfirm()
      return
    }

    const nextActive = !selectedJob.value.active

    resetDetailMessages()
    archiveLoading.value = true
    try {
      await setJobActive(selectedJob.value.id, nextActive)
      setDetailInfo(nextActive ? 'Job restored.' : 'Job archived.')
      closeArchiveConfirm()
    } catch (error) {
      setDetailError(error, `Failed to ${nextActive ? 'restore' : 'archive'} job.`)
    } finally {
      archiveLoading.value = false
    }
  }

  async function handleDeleteJob() {
    if (!selectedJob.value) {
      closeDeleteConfirm()
      return
    }

    resetDetailMessages()
    deleteLoading.value = true
    try {
      await deleteJobRecord(selectedJob.value.id)
      setDetailInfo('Job deleted.')
      selectedJobId.value = visibleJobs.value[0]?.id ?? 'new'
      closeDeleteConfirm()
    } catch (error) {
      setDetailError(error, 'Failed to delete job.')
    } finally {
      deleteLoading.value = false
    }
  }

  return {
    handleCreateJob,
    handleDeleteJob,
    handleToggleArchive,
    persistJobDetail,
  }
}
