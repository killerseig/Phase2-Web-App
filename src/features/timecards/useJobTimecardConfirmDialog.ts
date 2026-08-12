import { useActionConfirmDialog } from '@/composables/useActionConfirmDialog'
import {
  getJobTimecardConfirmLabel,
  getJobTimecardConfirmMessage,
  getJobTimecardConfirmTitle,
  isJobTimecardConfirmDestructive,
  type JobTimecardConfirmAction,
} from '@/features/timecards/jobViewHelpers'
import type { ReadonlyRef } from '@/types/reactivity'

export function useJobTimecardConfirmDialog(isBusy: ReadonlyRef<boolean>) {
  const {
    closeConfirm: closeTimecardConfirm,
    confirmAction: timecardConfirmAction,
    confirmDestructive: timecardConfirmDestructive,
    confirmLabel: timecardConfirmLabel,
    confirmMessage: timecardConfirmMessage,
    confirmTitle: timecardConfirmTitle,
    handleConfirmOpenUpdate: handleTimecardConfirmOpenUpdate,
  } = useActionConfirmDialog<JobTimecardConfirmAction>({
    getLabel: getJobTimecardConfirmLabel,
    getMessage: getJobTimecardConfirmMessage,
    getTitle: getJobTimecardConfirmTitle,
    isBusy,
    isDestructive: isJobTimecardConfirmDestructive,
  })

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
