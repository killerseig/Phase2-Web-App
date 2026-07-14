import { computed, ref } from 'vue'
import {
  getTimecardExportConfirmLabel,
  getTimecardExportConfirmMessage,
  getTimecardExportConfirmTitle,
  type TimecardExportConfirmAction,
} from '@/features/timecards/exportViewHelpers'

interface ReadonlyRef<T> {
  readonly value: T
}

export function useTimecardExportConfirmDialog(isBusy: ReadonlyRef<boolean>) {
  const timecardExportConfirmAction = ref<TimecardExportConfirmAction | null>(null)

  const timecardExportConfirmTitle = computed(() => getTimecardExportConfirmTitle(timecardExportConfirmAction.value))
  const timecardExportConfirmMessage = computed(() => getTimecardExportConfirmMessage(timecardExportConfirmAction.value))
  const timecardExportConfirmLabel = computed(() => getTimecardExportConfirmLabel(timecardExportConfirmAction.value))

  function handleTimecardExportConfirmOpenUpdate(open: boolean) {
    if (open || isBusy.value) return
    timecardExportConfirmAction.value = null
  }

  return {
    handleTimecardExportConfirmOpenUpdate,
    timecardExportConfirmAction,
    timecardExportConfirmLabel,
    timecardExportConfirmMessage,
    timecardExportConfirmTitle,
  }
}
