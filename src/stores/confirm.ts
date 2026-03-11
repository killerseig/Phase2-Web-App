import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ConfirmVariant = 'primary' | 'danger' | 'warning'

export type ConfirmDialogOptions = {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: ConfirmVariant
}

const DEFAULT_OPTIONS: Required<Omit<ConfirmDialogOptions, 'message'>> = {
  title: 'Please Confirm',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  variant: 'primary',
}

export const useConfirmStore = defineStore('confirm', () => {
  const isOpen = ref(false)
  const options = ref<ConfirmDialogOptions>({
    ...DEFAULT_OPTIONS,
    message: '',
  })
  let resolver: ((value: boolean) => void) | null = null

  const reset = () => {
    options.value = {
      ...DEFAULT_OPTIONS,
      message: '',
    }
  }

  const close = (result: boolean) => {
    isOpen.value = false
    if (resolver) {
      resolver(result)
      resolver = null
    }
    reset()
  }

  const ask = (nextOptions: ConfirmDialogOptions): Promise<boolean> => {
    if (resolver) {
      resolver(false)
      resolver = null
    }

    options.value = {
      ...DEFAULT_OPTIONS,
      ...nextOptions,
    }
    isOpen.value = true

    return new Promise((resolve) => {
      resolver = resolve
    })
  }

  const confirm = () => close(true)
  const cancel = () => close(false)

  const $reset = () => {
    if (resolver) {
      resolver(false)
      resolver = null
    }
    isOpen.value = false
    reset()
  }

  return {
    isOpen,
    options,
    ask,
    confirm,
    cancel,
    $reset,
  }
})
