import { computed, shallowRef, type ComputedRef } from 'vue'
import type { ReadonlyRef, WritableRef } from '@/types/reactivity'

interface UseActionConfirmDialogOptions<TAction> {
  isBusy: ReadonlyRef<boolean>
  getTitle: (action: TAction | null) => string
  getMessage: (action: TAction | null) => string
  getLabel: (action: TAction | null) => string
  isDestructive?: (action: TAction | null) => boolean
}

interface UseActionConfirmDialogResult<TAction> {
  closeConfirm: () => void
  confirmAction: WritableRef<TAction | null>
  confirmDestructive: ComputedRef<boolean>
  confirmLabel: ComputedRef<string>
  confirmMessage: ComputedRef<string>
  confirmTitle: ComputedRef<string>
  handleConfirmOpenUpdate: (open: boolean) => void
}

export function useActionConfirmDialog<TAction>({
  getLabel,
  getMessage,
  getTitle,
  isBusy,
  isDestructive = () => false,
}: UseActionConfirmDialogOptions<TAction>): UseActionConfirmDialogResult<TAction> {
  const confirmAction = shallowRef<TAction | null>(null)

  const confirmTitle = computed(() => getTitle(confirmAction.value))
  const confirmMessage = computed(() => getMessage(confirmAction.value))
  const confirmLabel = computed(() => getLabel(confirmAction.value))
  const confirmDestructive = computed(() => isDestructive(confirmAction.value))

  function closeConfirm() {
    confirmAction.value = null
  }

  function handleConfirmOpenUpdate(open: boolean) {
    if (open || isBusy.value) return

    closeConfirm()
  }

  return {
    closeConfirm,
    confirmAction,
    confirmDestructive,
    confirmLabel,
    confirmMessage,
    confirmTitle,
    handleConfirmOpenUpdate,
  }
}
