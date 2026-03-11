import { useConfirmStore, type ConfirmDialogOptions } from '@/stores/confirm'

type ConfirmPromptOptions = Omit<ConfirmDialogOptions, 'message'>

export function useConfirmDialog() {
  const confirmStore = useConfirmStore()

  const confirm = (message: string, options?: ConfirmPromptOptions): Promise<boolean> => {
    return confirmStore.ask({
      message,
      ...options,
    })
  }

  const confirmDelete = (itemLabel: string, options?: ConfirmPromptOptions): Promise<boolean> => {
    return confirm(`Delete "${itemLabel}"? This cannot be undone.`, {
      title: 'Delete Confirmation',
      confirmText: 'Delete',
      variant: 'danger',
      ...options,
    })
  }

  return {
    confirm,
    confirmDelete,
  }
}
