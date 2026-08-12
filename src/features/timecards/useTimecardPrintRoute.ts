import { computed, nextTick, ref } from 'vue'
import type { TimecardPdfExportPayload } from './pdf-export'
import {
  getTimecardPrintExportId,
  getTimecardPrintPages,
  missingTimecardPrintPayloadMessage,
} from './printViewHelpers'

type PrintRouteQuery = { exportId?: unknown }

interface UseTimecardPrintRouteOptions {
  loadPayload: (exportId?: string) => TimecardPdfExportPayload | null
  print?: () => void
  query: PrintRouteQuery
  schedulePrint?: (callback: () => void, delayMs: number) => unknown
}

function defaultPrint() {
  window.print()
}

function defaultSchedulePrint(callback: () => void, delayMs: number) {
  return window.setTimeout(callback, delayMs)
}

export function useTimecardPrintRoute({
  loadPayload,
  print = defaultPrint,
  query,
  schedulePrint = defaultSchedulePrint,
}: UseTimecardPrintRouteOptions) {
  const payload = ref<TimecardPdfExportPayload | null>(null)
  const loadError = ref('')
  const autoPrinting = ref(false)
  const pagedCards = computed(() => getTimecardPrintPages(payload.value?.cards ?? []))

  async function triggerPrint() {
    if (!payload.value || autoPrinting.value) return false

    autoPrinting.value = true
    await nextTick()
    schedulePrint(() => {
      print()
      autoPrinting.value = false
    }, 150)

    return true
  }

  async function loadPrintPayload() {
    const exportId = getTimecardPrintExportId(query)
    const nextPayload = loadPayload(exportId)

    if (!nextPayload) {
      loadError.value = missingTimecardPrintPayloadMessage
      return false
    }

    payload.value = nextPayload
    await triggerPrint()
    return true
  }

  return {
    autoPrinting,
    loadError,
    loadPrintPayload,
    pagedCards,
    payload,
    triggerPrint,
  }
}
