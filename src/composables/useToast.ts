import { readonly, ref } from 'vue'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export type ToastMessage = {
  id: string
  type: ToastType
  message: string
  duration?: number
}

export type ToastNotifier = {
  show: (message: string, type?: ToastType, duration?: number) => unknown
}

const toasts = ref<ToastMessage[]>([])
const timers = new Map<string, ReturnType<typeof setTimeout>>()
let nextId = 0

const clearTimer = (id: string) => {
  const timer = timers.get(id)
  if (!timer) return
  clearTimeout(timer)
  timers.delete(id)
}

const remove = (id: string) => {
  clearTimer(id)
  const idx = toasts.value.findIndex((toast) => toast.id === id)
  if (idx !== -1) {
    toasts.value.splice(idx, 1)
  }
}

const show = (message: string, type: ToastType = 'info', duration = 5000) => {
  const id = `toast-${nextId++}`
  const toast: ToastMessage = { id, message, type, duration }
  toasts.value.push(toast)

  if (duration > 0) {
    const timer = setTimeout(() => {
      remove(id)
    }, duration)
    timers.set(id, timer)
  }

  return id
}

const clear = () => {
  for (const id of timers.keys()) {
    clearTimer(id)
  }
  toasts.value = []
}

export function useToast() {
  return {
    toasts: readonly(toasts),
    show,
    remove,
    clear,
  }
}
