import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { ToastNotifier } from '@/composables/useToast'
import {
  downloadTimecardsForWeek,
  listTimecardsForWeek,
  type ControllerTimecardFilters,
  type ControllerTimecardWeekItem,
} from '@/services/Email'
import { listTimecardsByJobAndWeek } from '@/services/Timecards'
import { recalcTotalsForTimecard, type TimecardModel } from '@/utils/timecardUtils'

type ReviewSummary = {
  totalCount: number
  submittedCount: number
  draftCount: number
  totalHours: number
  totalProduction: number
  totalLine: number
}

type LoadedPeriod = {
  startWeek: string
  endWeek: string
  startWeekEnding: string
  endWeekEnding: string
}

type UseControllerTimecardDataOptions = {
  appliedFilters: Ref<ControllerTimecardFilters | null>
  loadedPeriod: Ref<LoadedPeriod>
  buildFilterPayload: () => ControllerTimecardFilters | null
  filterValidationError: ComputedRef<string>
  pendingFilterChanges: ComputedRef<boolean>
  formatSearchRange: (startWeek: string, endWeek: string) => string
  buildTimecardKey: (jobId: string, timecardId: string) => string
  toast: ToastNotifier
}

function createEmptyReviewSummary(): ReviewSummary {
  return {
    totalCount: 0,
    submittedCount: 0,
    draftCount: 0,
    totalHours: 0,
    totalProduction: 0,
    totalLine: 0,
  }
}

function formatErr(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message?: unknown }).message || err)
  }
  return String(err || 'Unknown error')
}

export function useControllerTimecardData(options: UseControllerTimecardDataOptions) {
  const {
    appliedFilters,
    loadedPeriod,
    buildFilterPayload,
    filterValidationError,
    pendingFilterChanges,
    formatSearchRange,
    buildTimecardKey,
    toast,
  } = options

  const downloadingCsv = ref(false)
  const downloadingPdf = ref(false)
  const isDownloading = computed(() => downloadingCsv.value || downloadingPdf.value)
  const loadingTimecards = ref(false)
  const refreshingTimecards = ref(false)
  const reviewTimecards = ref<ControllerTimecardWeekItem[]>([])
  const loadedTimecardMap = ref<Record<string, TimecardModel>>({})
  const reviewSummary = ref<ReviewSummary>(createEmptyReviewSummary())
  const timecardsLoadError = ref('')

  let timecardLoadToken = 0
  let queuedReloadTimer: ReturnType<typeof setTimeout> | null = null

  function clearQueuedReload() {
    if (!queuedReloadTimer) return
    clearTimeout(queuedReloadTimer)
    queuedReloadTimer = null
  }

  function recalculateReviewSummary(rows = reviewTimecards.value) {
    reviewSummary.value = rows.reduce(
      (summary, row) => {
        summary.totalCount += 1
        if (row.status === 'submitted') summary.submittedCount += 1
        else summary.draftCount += 1
        summary.totalHours += Number(row.totalHours ?? 0)
        summary.totalProduction += Number(row.totalProduction ?? 0)
        summary.totalLine += Number(row.totalLine ?? 0)
        return summary
      },
      createEmptyReviewSummary(),
    )
  }

  async function hydrateDetailedTimecards(
    rows: ControllerTimecardWeekItem[],
    currentToken: number,
  ): Promise<Record<string, TimecardModel>> {
    if (!rows.length) return {}

    const groupedRequests = new Map<string, { jobId: string; weekEnding: string; ids: Set<string> }>()
    for (const row of rows) {
      const requestKey = `${row.jobId}::${row.weekEnding}`
      const existing = groupedRequests.get(requestKey)
      if (existing) {
        existing.ids.add(row.timecardId)
      } else {
        groupedRequests.set(requestKey, {
          jobId: row.jobId,
          weekEnding: row.weekEnding,
          ids: new Set([row.timecardId]),
        })
      }
    }

    const responses = await Promise.all(
      Array.from(groupedRequests.values()).map(async (request) => {
        const timecards = await listTimecardsByJobAndWeek(request.jobId, request.weekEnding)
        return { request, timecards: timecards as TimecardModel[] }
      }),
    )

    if (currentToken !== timecardLoadToken) return {}

    const nextMap: Record<string, TimecardModel> = {}
    for (const response of responses) {
      for (const timecard of response.timecards) {
        if (!response.request.ids.has(timecard.id)) continue
        recalcTotalsForTimecard(timecard, timecard.weekStartDate)
        nextMap[buildTimecardKey(response.request.jobId, timecard.id)] = timecard
      }
    }

    return nextMap
  }

  async function loadTimecards(filters: ControllerTimecardFilters): Promise<boolean> {
    const currentToken = ++timecardLoadToken
    const useBackgroundRefresh = reviewTimecards.value.length > 0 || !!appliedFilters.value

    if (useBackgroundRefresh) refreshingTimecards.value = true
    else loadingTimecards.value = true
    timecardsLoadError.value = ''

    try {
      const result = await listTimecardsForWeek(filters)
      if (currentToken !== timecardLoadToken) return false

      const detailedTimecards = await hydrateDetailedTimecards(result.timecards, currentToken)
      if (currentToken !== timecardLoadToken) return false

      reviewTimecards.value = result.timecards
      loadedTimecardMap.value = detailedTimecards
      reviewSummary.value = {
        totalCount: result.totalCount,
        submittedCount: result.submittedCount,
        draftCount: result.draftCount,
        totalHours: result.totalHours,
        totalProduction: result.totalProduction,
        totalLine: result.totalLine,
      }
      appliedFilters.value = {
        startWeek: result.startWeek,
        endWeek: result.endWeek,
        jobId: result.filters.jobId,
        trade: result.filters.trade,
        firstName: result.filters.firstName,
        lastName: result.filters.lastName,
        subcontracted: result.filters.subcontracted,
        status: result.filters.status,
      }
      loadedPeriod.value = {
        startWeek: result.startWeek,
        endWeek: result.endWeek,
        startWeekEnding: result.startWeekEnding,
        endWeekEnding: result.endWeekEnding,
      }
      return true
    } catch (err) {
      if (currentToken !== timecardLoadToken) return false

      reviewTimecards.value = []
      loadedTimecardMap.value = {}
      reviewSummary.value = createEmptyReviewSummary()
      timecardsLoadError.value = formatErr(err)
      return false
    } finally {
      if (currentToken === timecardLoadToken) {
        if (useBackgroundRefresh) refreshingTimecards.value = false
        else loadingTimecards.value = false
      }
    }
  }

  async function applyFilters() {
    if (filterValidationError.value) {
      toast.show(filterValidationError.value, 'error')
      return
    }

    const filters = buildFilterPayload()
    if (!filters) return
    await loadTimecards(filters)
  }

  function queueAutoReload(delayMs = 300) {
    clearQueuedReload()
    if (filterValidationError.value) return

    const filters = buildFilterPayload()
    if (!filters) return

    queuedReloadTimer = setTimeout(() => {
      queuedReloadTimer = null
      void loadTimecards(filters)
    }, delayMs)
  }

  function base64ToBlob(contentBase64: string, contentType: string): Blob {
    const binary = atob(contentBase64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes.buffer], { type: contentType || 'application/octet-stream' })
  }

  function triggerDownload(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  async function handleDownload(format: 'csv' | 'pdf') {
    if (isDownloading.value) return
    if (filterValidationError.value) {
      toast.show(filterValidationError.value, 'error')
      return
    }

    const filters = buildFilterPayload()
    if (!filters) return

    if (!appliedFilters.value || pendingFilterChanges.value) {
      const loaded = await loadTimecards(filters)
      if (!loaded) return
    }

    if (format === 'csv') downloadingCsv.value = true
    if (format === 'pdf') downloadingPdf.value = true

    try {
      const result = await downloadTimecardsForWeek(filters, format)
      if (!result.contentBase64) throw new Error('No file content returned')

      const blob = base64ToBlob(result.contentBase64, result.contentType)
      triggerDownload(blob, result.fileName)
      toast.show(
        `Downloaded ${result.timecardCount} timecard(s) for ${formatSearchRange(result.startWeek, result.endWeek)}`,
        'success',
      )
    } catch (err) {
      toast.show(formatErr(err), 'error')
    } finally {
      downloadingCsv.value = false
      downloadingPdf.value = false
    }
  }

  return {
    applyFilters,
    clearQueuedReload,
    downloadingCsv,
    downloadingPdf,
    handleDownload,
    isDownloading,
    loadedTimecardMap,
    loadTimecards,
    loadingTimecards,
    queueAutoReload,
    recalculateReviewSummary,
    refreshingTimecards,
    reviewSummary,
    reviewTimecards,
    timecardsLoadError,
  }
}
