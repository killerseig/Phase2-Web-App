import { watch } from 'vue'
import { type AppToastSeverity, useAppToast } from '@/composables/useAppToast'
import type { WritableRef } from '@/types/reactivity'

interface ToastMessageConfig {
  source: WritableRef<string>
  severity?: AppToastSeverity
  summary?: string
  life?: number
  when?: (message: string) => boolean
  clear?: boolean
}

export function useToastMessages(configs: ToastMessageConfig[]) {
  const toast = useAppToast()

  for (const {
    source,
    severity = 'info',
    summary,
    life,
    when,
    clear = true,
  } of configs) {
    watch(() => source.value, (nextMessage, previousMessage) => {
      const message = nextMessage.trim()
      const previous = previousMessage.trim()

      if (!message || message === previous) return
      if (when && !when(message)) return

      toast.show({
        severity,
        summary,
        detail: message,
        life,
      })

      if (clear) {
        queueMicrotask(() => {
          if (source.value === nextMessage) {
            source.value = ''
          }
        })
      }
    })
  }
}
