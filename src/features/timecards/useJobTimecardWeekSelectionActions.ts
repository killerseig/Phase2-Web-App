import {
  snapToSaturday,
} from '@/features/timecards/workbook'
import type { TimecardWeekRecord } from '@/types/domain'
import { openNativeDatePicker, readInputValue } from '@/utils/domEvents'
import type { WritableRef } from '@/types/reactivity'

interface UseJobTimecardWeekSelectionActionsOptions {
  closeCreateTray: () => void
  flushPendingSaves: () => Promise<void>
  selectedWeekEndDate: WritableRef<string>
  selectedWeekId: WritableRef<string | null>
}

export function useJobTimecardWeekSelectionActions({
  closeCreateTray,
  flushPendingSaves,
  selectedWeekEndDate,
  selectedWeekId,
}: UseJobTimecardWeekSelectionActionsOptions) {
  async function handleSelectWeek(week: TimecardWeekRecord) {
    if (selectedWeekId.value === week.id) return
    await flushPendingSaves()
    closeCreateTray()
    selectedWeekId.value = week.id
    selectedWeekEndDate.value = week.weekEndDate
  }

  async function handleWeekEndingInput(event: Event) {
    const rawValue = readInputValue(event)
    const nextValue = rawValue ? snapToSaturday(rawValue) : ''
    if (nextValue === selectedWeekEndDate.value && !selectedWeekId.value) return
    await flushPendingSaves()
    closeCreateTray()
    selectedWeekId.value = null
    selectedWeekEndDate.value = nextValue
  }

  function handleWeekEndingPickerOpen(event: Event) {
    openNativeDatePicker(event)
  }

  return {
    handleSelectWeek,
    handleWeekEndingInput,
    handleWeekEndingPickerOpen,
  }
}
