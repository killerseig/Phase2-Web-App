import { ref } from 'vue'
import type { WritableRef } from '@/types/reactivity'

export type DirectoryEditorMobilePanel = 'directory' | 'editor'

export interface DirectoryEditorMobilePanelTab {
  key: DirectoryEditorMobilePanel
  label: string
}

interface UseDirectoryEditorPanelsOptions<TSelection, TRecordId extends TSelection> {
  createSelection: TSelection
  selectedId: WritableRef<TSelection>
  onCreateMode?: () => void
}

function isDirectoryEditorMobilePanel(panel: string): panel is DirectoryEditorMobilePanel {
  return panel === 'directory' || panel === 'editor'
}

export function buildDirectoryEditorMobilePanelTabs(
  directoryLabel = 'Directory',
): DirectoryEditorMobilePanelTab[] {
  return [
    { key: 'directory', label: directoryLabel },
    { key: 'editor', label: 'Editor' },
  ]
}

export function useDirectoryEditorPanels<TSelection, TRecordId extends TSelection = TSelection>({
  createSelection,
  onCreateMode,
  selectedId,
}: UseDirectoryEditorPanelsOptions<TSelection, TRecordId>) {
  const activeMobilePanel = ref<DirectoryEditorMobilePanel>('directory')

  function showMobilePanel(panel: string) {
    if (!isDirectoryEditorMobilePanel(panel)) return
    activeMobilePanel.value = panel
  }

  function openCreateMode() {
    selectedId.value = createSelection
    activeMobilePanel.value = 'editor'
    onCreateMode?.()
  }

  function selectRecord(recordId: TRecordId) {
    selectedId.value = recordId
    activeMobilePanel.value = 'editor'
  }

  return {
    activeMobilePanel,
    openCreateMode,
    selectRecord,
    showMobilePanel,
  }
}
