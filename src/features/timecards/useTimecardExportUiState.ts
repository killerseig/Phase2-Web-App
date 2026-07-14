import { reactive, ref, type Ref } from 'vue'
import { clearBooleanRecord, pruneRecordToIds } from '@/features/timecards/stateMapHelpers'

export type TimecardExportMobileToolbarTabKey = 'weeks' | 'archive' | 'sort' | 'actions' | 'saved'

export const timecardExportMobileToolbarTabs: ReadonlyArray<{
  key: TimecardExportMobileToolbarTabKey
  label: string
}> = [
  { key: 'weeks', label: 'Weeks' },
  { key: 'archive', label: 'Archive' },
  { key: 'sort', label: 'Sort' },
  { key: 'actions', label: 'Actions' },
  { key: 'saved', label: 'Saved' },
]

export function useTimecardExportUiState(canEditWeek: Ref<boolean>) {
  const activeMobileToolbarTab = ref<TimecardExportMobileToolbarTabKey>('weeks')
  const adminCardEditStates = reactive<Record<string, boolean>>({})

  function selectMobileToolbarTab(key: string) {
    if (!timecardExportMobileToolbarTabs.some((tab) => tab.key === key)) return
    activeMobileToolbarTab.value = key as TimecardExportMobileToolbarTabKey
  }

  function resetCardEditStates() {
    clearBooleanRecord(adminCardEditStates)
  }

  function pruneCardEditStates(validIds: Set<string>) {
    pruneRecordToIds(adminCardEditStates, validIds)
  }

  function isCardEditable(cardId: string) {
    if (!canEditWeek.value) return false
    return adminCardEditStates[cardId] === true
  }

  function isCardReadOnly(cardId: string) {
    return !isCardEditable(cardId)
  }

  function setCardEditMode(cardId: string, value: boolean) {
    if (!canEditWeek.value) return
    adminCardEditStates[cardId] = value
  }

  function toggleCardEditMode(cardId: string) {
    if (!canEditWeek.value) return
    adminCardEditStates[cardId] = !adminCardEditStates[cardId]
  }

  return {
    activeMobileToolbarTab,
    isCardEditable,
    isCardReadOnly,
    pruneCardEditStates,
    resetCardEditStates,
    selectMobileToolbarTab,
    setCardEditMode,
    toggleCardEditMode,
  }
}
