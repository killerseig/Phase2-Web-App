import { useToast } from 'primevue/usetoast'

export type AppToastSeverity = 'success' | 'info' | 'warn' | 'error'

interface AppToastOptions {
  severity?: AppToastSeverity
  summary?: string
  detail: string
  life?: number
}

function getDefaultSummary(severity: AppToastSeverity) {
  switch (severity) {
    case 'success':
      return 'Success Message'
    case 'info':
      return 'Info Message'
    case 'warn':
      return 'Warning Message'
    case 'error':
      return 'Error Message'
    default:
      return 'Notice Message'
  }
}

export function useAppToast() {
  const toast = useToast()

  function show({
    severity = 'info',
    summary,
    detail,
    life = severity === 'error' ? 5200 : 4200,
  }: AppToastOptions) {
    const message = detail.trim()
    if (!message) return

    const defaultSummary = getDefaultSummary(severity)

    toast.add({
      group: 'app',
      severity,
      summary: defaultSummary,
      detail: message,
      life,
    })
  }

  return {
    show,
    success(detail: string, summary?: string, life?: number) {
      show({ severity: 'success', summary, detail, life })
    },
    info(detail: string, summary?: string, life?: number) {
      show({ severity: 'info', summary, detail, life })
    },
    warn(detail: string, summary?: string, life?: number) {
      show({ severity: 'warn', summary, detail, life })
    },
    error(detail: string, summary?: string, life?: number) {
      show({ severity: 'error', summary, detail, life })
    },
  }
}
