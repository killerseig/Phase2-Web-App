import { computed, ref } from 'vue'
import {
  getJobTimecardConfirmLabel,
  getJobTimecardConfirmMessage,
  getJobTimecardConfirmTitle,
  isJobTimecardConfirmDestructive,
  type JobTimecardConfirmAction,
} from '@/features/timecards/jobViewHelpers'

interface ReadonlyRef<T> {
  readonly value: T
}

export function useJobTimecardConfirmDialog(isBusy: ReadonlyRef<boolean>) {
  const timecardConfirmAction = ref<JobTimecardConfirmAction | null>(null)

  const timecardConfirmTitle = computed(() => getJobTimecardConfirmTitle(timecardConfirmAction.value))
  const timecardConfirmMessage = computed(() => getJobTimecardConfirmMessage(timecardConfirmAction.value))
  const timecardConfirmLabel = computed(() => getJobTimecardConfirmLabel(timecardConfirmAction.value))
  const timecardConfirmDestructive = computed(() => isJobTimecardConfirmDestructive(timecardConfirmAction.value))

  function closeTimecardConfirm() {
    timecardConfirmAction.value = null
  }

  function handleTimecardConfirmOpenUpdate(open: boolean) {
    if (open || isBusy.value) return

    closeTimecardConfirm()
  }

  return {
    closeTimecardConfirm,
    handleTimecardConfirmOpenUpdate,
    timecardConfirmAction,
    timecardConfirmDestructive,
    timecardConfirmLabel,
    timecardConfirmMessage,
    timecardConfirmTitle,
  }
}
