import { buildTimecardCsvExport, downloadTimecardCsvExport } from '@/features/timecards/csv-export'
import type { TimecardExportArchiveCardRecord } from '@/features/timecards/exportViewHelpers'
import { saveTimecardPdfExportPayload } from '@/features/timecards/pdf-export'

interface ReadonlyRef<T> {
  readonly value: T
}

interface UseTimecardExportDownloadActionsOptions {
  buildCsvExportFilename: () => string
  buildPdfExportSubtitle: () => string
  flushPendingSaves: () => Promise<void>
  orderedCards: ReadonlyRef<TimecardExportArchiveCardRecord[]>
  resolvePrintHref: (exportId: string) => string
  setPageError: (error: unknown, fallbackMessage: string) => void
  setPageErrorMessage: (message: string) => void
  setPageInfo: (message: string) => void
  resetPageAndSaveMessages: () => void
}

export function useTimecardExportDownloadActions({
  buildCsvExportFilename,
  buildPdfExportSubtitle,
  flushPendingSaves,
  orderedCards,
  resolvePrintHref,
  resetPageAndSaveMessages,
  setPageError,
  setPageErrorMessage,
  setPageInfo,
}: UseTimecardExportDownloadActionsOptions) {
  async function handlePdfExport() {
    if (!orderedCards.value.length) {
      setPageInfo('No timecards match the current filters.')
      return
    }

    resetPageAndSaveMessages()

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setPageErrorMessage('Allow popups to export the PDF.')
      return
    }

    printWindow.document.title = 'Preparing Timecard PDF...'
    printWindow.document.body.innerHTML = '<p style="font-family: Arial, sans-serif; padding: 24px;">Preparing timecard PDF...</p>'

    try {
      await flushPendingSaves()

      const exportId = saveTimecardPdfExportPayload({
        title: 'Timecard Export',
        subtitle: buildPdfExportSubtitle(),
        generatedAt: Date.now(),
        cards: orderedCards.value.map((card) => ({
          ...card,
          exportWeekId: card.archiveWeekId,
          exportWeekStartDate: card.archiveWeekStartDate,
          exportWeekEndDate: card.archiveWeekEndDate,
          exportWeekStatus: card.archiveWeekStatus,
          exportJobId: card.archiveJobId,
          exportJobCode: card.archiveJobCode,
          exportJobName: card.archiveJobName,
          exportForemanName: card.archiveForemanName,
          exportBurden: card.archiveBurden,
        })),
      })

      printWindow.location.href = resolvePrintHref(exportId)
      setPageInfo(`Opened ${orderedCards.value.length} timecard${orderedCards.value.length === 1 ? '' : 's'} for PDF export.`)
    } catch (error) {
      printWindow.close()
      setPageError(error, 'Failed to prepare the PDF export.')
    }
  }

  async function handleCsvExport() {
    if (!orderedCards.value.length) {
      setPageInfo('No timecards match the current filters.')
      return
    }

    resetPageAndSaveMessages()

    try {
      await flushPendingSaves()

      const exportResult = buildTimecardCsvExport(orderedCards.value)
      if (!exportResult.detailRowCount) {
        setPageInfo('No CSV detail rows were found in the current timecards.')
        return
      }

      downloadTimecardCsvExport(buildCsvExportFilename(), exportResult.csvText)
      setPageInfo(
        `Downloaded CSV with ${exportResult.detailRowCount} detail row${exportResult.detailRowCount === 1 ? '' : 's'} from ${orderedCards.value.length} timecard${orderedCards.value.length === 1 ? '' : 's'}.`,
      )
    } catch (error) {
      setPageError(error, 'Failed to prepare the CSV export.')
    }
  }

  return {
    handleCsvExport,
    handlePdfExport,
  }
}
