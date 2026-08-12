import { useActionConfirmDialog } from '@/composables/useActionConfirmDialog'
import {
  getTimecardExportConfirmLabel,
  getTimecardExportConfirmMessage,
  getTimecardExportConfirmTitle,
  type TimecardExportConfirmAction,
} from '@/features/timecards/exportViewHelpers'
import type { ReadonlyRef } from '@/types/reactivity'

export function useTimecardExportConfirmDialog(isBusy: ReadonlyRef<boolean>) {
  const {
    confirmAction: timecardExportConfirmAction,
    confirmLabel: timecardExportConfirmLabel,
    confirmMessage: timecardExportConfirmMessage,
    confirmTitle: timecardExportConfirmTitle,
    handleConfirmOpenUpdate: handleTimecardExportConfirmOpenUpdate,
  } = useActionConfirmDialog<TimecardExportConfirmAction>({
    getLabel: getTimecardExportConfirmLabel,
    getMessage: getTimecardExportConfirmMessage,
    getTitle: getTimecardExportConfirmTitle,
    isBusy,
  })

  return {
    handleTimecardExportConfirmOpenUpdate,
    timecardExportConfirmAction,
    timecardExportConfirmLabel,
    timecardExportConfirmMessage,
    timecardExportConfirmTitle,
  }
}
