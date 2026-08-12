import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useActionConfirmDialog } from '@/composables/useActionConfirmDialog'

interface TestConfirmAction {
  kind: 'delete' | 'archive'
  label: string
}

function createDialog() {
  const isBusy = ref(false)
  const dialog = useActionConfirmDialog<TestConfirmAction>({
    getLabel: (action) => action ? `Confirm ${action.label}` : 'Confirm',
    getMessage: (action) => action ? `Message ${action.label}` : '',
    getTitle: (action) => action ? `Title ${action.label}` : '',
    isBusy,
    isDestructive: (action) => action?.kind === 'delete',
  })

  return { dialog, isBusy }
}

describe('useActionConfirmDialog', () => {
  it('derives dialog copy and destructive state from the current action', () => {
    const { dialog } = createDialog()

    dialog.confirmAction.value = { kind: 'delete', label: 'Record' }

    expect(dialog.confirmTitle.value).toBe('Title Record')
    expect(dialog.confirmMessage.value).toBe('Message Record')
    expect(dialog.confirmLabel.value).toBe('Confirm Record')
    expect(dialog.confirmDestructive.value).toBe(true)
  })

  it('clears the action when the dialog closes and no action is busy', () => {
    const { dialog } = createDialog()

    dialog.confirmAction.value = { kind: 'archive', label: 'Record' }
    dialog.handleConfirmOpenUpdate(false)

    expect(dialog.confirmAction.value).toBeNull()
  })

  it('keeps the action open while a confirm action is busy', () => {
    const { dialog, isBusy } = createDialog()
    const action: TestConfirmAction = { kind: 'archive', label: 'Record' }

    dialog.confirmAction.value = action
    isBusy.value = true
    dialog.handleConfirmOpenUpdate(false)

    expect(dialog.confirmAction.value).toBe(action)
  })
})
