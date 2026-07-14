import { computed, ref, type ComputedRef } from 'vue'
import {
  getArchiveJobConfirmLabel,
  getArchiveJobConfirmMessage,
  getArchiveJobConfirmTitle,
  getDeleteJobConfirmMessage,
} from '@/features/jobs/jobViewHelpers'
import type { JobRecord } from '@/types/domain'

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseJobConfirmDialogsOptions {
  archiveBusy: ReadonlyRef<boolean>
  deleteBusy: ReadonlyRef<boolean>
  selectedJob: ComputedRef<JobRecord | null>
}

export function useJobConfirmDialogs({
  archiveBusy,
  deleteBusy,
  selectedJob,
}: UseJobConfirmDialogsOptions) {
  const archiveConfirmOpen = ref(false)
  const deleteConfirmOpen = ref(false)

  const archiveJobConfirmTitle = computed(() => getArchiveJobConfirmTitle(selectedJob.value))
  const archiveJobConfirmMessage = computed(() => getArchiveJobConfirmMessage(selectedJob.value))
  const archiveJobConfirmLabel = computed(() => getArchiveJobConfirmLabel(selectedJob.value))
  const deleteJobConfirmMessage = computed(() => getDeleteJobConfirmMessage(selectedJob.value))

  function requestToggleArchive() {
    if (!selectedJob.value) return

    archiveConfirmOpen.value = true
  }

  function closeArchiveConfirm() {
    archiveConfirmOpen.value = false
  }

  function handleArchiveConfirmOpenUpdate(open: boolean) {
    if (open || archiveBusy.value) return

    closeArchiveConfirm()
  }

  function requestDeleteJob() {
    if (!selectedJob.value) return

    deleteConfirmOpen.value = true
  }

  function closeDeleteConfirm() {
    deleteConfirmOpen.value = false
  }

  function handleDeleteConfirmOpenUpdate(open: boolean) {
    if (open || deleteBusy.value) return

    closeDeleteConfirm()
  }

  return {
    archiveConfirmOpen,
    archiveJobConfirmLabel,
    archiveJobConfirmMessage,
    archiveJobConfirmTitle,
    closeArchiveConfirm,
    closeDeleteConfirm,
    deleteConfirmOpen,
    deleteJobConfirmMessage,
    handleArchiveConfirmOpenUpdate,
    handleDeleteConfirmOpenUpdate,
    requestDeleteJob,
    requestToggleArchive,
  }
}
