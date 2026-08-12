import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import {
  buildDirectoryEditorMobilePanelTabs,
  useDirectoryEditorPanels,
} from '@/composables/useDirectoryEditorPanels'

describe('useDirectoryEditorPanels', () => {
  it('builds the shared directory/editor mobile tab definitions', () => {
    expect(buildDirectoryEditorMobilePanelTabs()).toEqual([
      { key: 'directory', label: 'Directory' },
      { key: 'editor', label: 'Editor' },
    ])

    expect(buildDirectoryEditorMobilePanelTabs('Users')).toEqual([
      { key: 'directory', label: 'Users' },
      { key: 'editor', label: 'Editor' },
    ])
  })

  it('starts on the directory panel and switches panels from valid tab keys', () => {
    const selectedId = ref<string | 'new' | null>(null)
    const panels = useDirectoryEditorPanels<string | 'new' | null, string>({
      createSelection: 'new',
      selectedId,
    })

    expect(panels.activeMobilePanel.value).toBe('directory')

    panels.showMobilePanel('editor')
    expect(panels.activeMobilePanel.value).toBe('editor')

    panels.showMobilePanel('directory')
    expect(panels.activeMobilePanel.value).toBe('directory')
  })

  it('ignores invalid mobile panel keys', () => {
    const selectedId = ref<string | 'new'>('new')
    const panels = useDirectoryEditorPanels<string | 'new', string>({
      createSelection: 'new',
      selectedId,
    })

    panels.showMobilePanel('editor')
    panels.showMobilePanel('details')

    expect(panels.activeMobilePanel.value).toBe('editor')
  })

  it('opens create mode, selects the create sentinel, and runs create cleanup', () => {
    const selectedId = ref<string | 'new' | null>('user-1')
    const onCreateMode = vi.fn()
    const panels = useDirectoryEditorPanels<string | 'new' | null, string>({
      createSelection: 'new',
      selectedId,
      onCreateMode,
    })

    panels.openCreateMode()

    expect(selectedId.value).toBe('new')
    expect(panels.activeMobilePanel.value).toBe('editor')
    expect(onCreateMode).toHaveBeenCalledTimes(1)
  })

  it('selects a record and opens the editor panel', () => {
    const selectedId = ref<string | 'new'>('new')
    const panels = useDirectoryEditorPanels<string | 'new', string>({
      createSelection: 'new',
      selectedId,
    })

    panels.selectRecord('employee-1')

    expect(selectedId.value).toBe('employee-1')
    expect(panels.activeMobilePanel.value).toBe('editor')
  })
})
