import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildTimecardCsvExport, downloadTimecardCsvExport } from '@/features/timecards/csv-export'
import {
  type TimecardExportArchiveCardRecord,
} from '@/features/timecards/exportViewHelpers'
import { saveTimecardPdfExportPayload } from '@/features/timecards/pdf-export'
import { useTimecardExportDownloadActions } from '@/features/timecards/useTimecardExportDownloadActions'
import { createWorkbookLines } from '@/features/timecards/workbook'

vi.mock('@/features/timecards/csv-export', () => ({
  buildTimecardCsvExport: vi.fn(),
  downloadTimecardCsvExport: vi.fn(),
}))

vi.mock('@/features/timecards/pdf-export', () => ({
  saveTimecardPdfExportPayload: vi.fn(),
  transferTimecardPdfExport: vi.fn(),
}))

const buildTimecardCsvExportMock = vi.mocked(buildTimecardCsvExport)
const downloadTimecardCsvExportMock = vi.mocked(downloadTimecardCsvExport)
const saveTimecardPdfExportPayloadMock = vi.mocked(saveTimecardPdfExportPayload)

function makeCard(overrides: Partial<TimecardExportArchiveCardRecord> = {}): TimecardExportArchiveCardRecord {
  const lines = createWorkbookLines('2026-06-14')
  const firstLine = lines[0]!
  firstLine.jobNumber = '736'
  firstLine.account = '133/513'
  firstLine.days[1]!.hours = 8

  return {
    id: 'card-1',
    archiveBurden: 0.33,
    archiveForemanName: 'CJ Blanchard',
    archiveJobCode: '736',
    archiveJobId: 'job-shop',
    archiveJobName: 'Shop',
    archiveWeekEndDate: '2026-06-20',
    archiveWeekId: 'week-1',
    archiveWeekStartDate: '2026-06-14',
    archiveWeekStatus: 'submitted',
    employeeId: 'employee-1',
    employeeNumber: '5133',
    firstName: 'CJ',
    footerAccount: '',
    footerAmount: '',
    footerJobOrGl: '',
    footerOffice: '',
    footerSecondAccount: '',
    footerSecondAmount: '',
    footerSecondJobOrGl: '',
    footerSecondOffice: '',
    fullName: 'Blanchard, CJ',
    isContractor: false,
    lastName: 'Blanchard',
    lines,
    notes: 'Ready for payroll.',
    occupation: 'Shop Foreman',
    overtimeHoursOverride: null,
    regularHoursOverride: null,
    sortIndex: 0,
    sourceType: 'employee',
    totals: {
      hoursByDay: [],
      hoursTotal: 8,
      lineTotal: 0,
      productionByDay: [],
      productionTotal: 0,
    },
    wageRate: 42.5,
    ...overrides,
  }
}

function makePrintWindow() {
  return {
    close: vi.fn(),
    document: {
      body: {
        innerHTML: '',
      },
      title: '',
    },
    location: {
      href: '',
    },
  }
}

function mountDownloadActions(options: {
  cards?: TimecardExportArchiveCardRecord[]
  flushPendingSaves?: () => Promise<void>
  onResolvePrintHref?: (exportId: string) => string
} = {}) {
  const orderedCards = ref<TimecardExportArchiveCardRecord[]>(options.cards ?? [makeCard()])
  const buildCsvExportFilename = vi.fn(() => 'timecard-export-2026-06-20.csv')
  const buildPdfExportSubtitle = vi.fn(() => '6/14/2026 - 6/20/2026 · 1 card')
  const flushPendingSaves = vi.fn(options.flushPendingSaves ?? (async () => {}))
  const resetPageAndSaveMessages = vi.fn()
  const resolvePrintHref = vi.fn(options.onResolvePrintHref ?? ((exportId: string) => `/timecard-export/print?exportId=${exportId}`))
  const setPageError = vi.fn()
  const setPageErrorMessage = vi.fn()
  const setPageInfo = vi.fn()

  const actions = useTimecardExportDownloadActions({
    buildCsvExportFilename,
    buildPdfExportSubtitle,
    flushPendingSaves,
    orderedCards,
    resolvePrintHref,
    resetPageAndSaveMessages,
    setPageError,
    setPageErrorMessage,
    setPageInfo,
  })

  return {
    ...actions,
    buildCsvExportFilename,
    buildPdfExportSubtitle,
    flushPendingSaves,
    orderedCards,
    resetPageAndSaveMessages,
    resolvePrintHref,
    setPageError,
    setPageErrorMessage,
    setPageInfo,
  }
}

describe('useTimecardExportDownloadActions', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    saveTimecardPdfExportPayloadMock.mockReturnValue('export-123')
    buildTimecardCsvExportMock.mockReturnValue({
      csvText: 'Employee Name,Hours\r\nBlanchard,8',
      detailRowCount: 1,
    })
  })

  it('shows an empty-filter message instead of opening a PDF export with no cards', async () => {
    const { flushPendingSaves, handlePdfExport, resetPageAndSaveMessages, setPageInfo } = mountDownloadActions({
      cards: [],
    })
    const openSpy = vi.spyOn(window, 'open')

    await handlePdfExport()

    expect(setPageInfo).toHaveBeenCalledWith('No timecards match the current filters.')
    expect(openSpy).not.toHaveBeenCalled()
    expect(resetPageAndSaveMessages).not.toHaveBeenCalled()
    expect(flushPendingSaves).not.toHaveBeenCalled()
    expect(saveTimecardPdfExportPayloadMock).not.toHaveBeenCalled()
  })

  it('asks the user to allow popups when PDF export cannot open a print window', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    const { flushPendingSaves, handlePdfExport, resetPageAndSaveMessages, setPageErrorMessage } = mountDownloadActions()

    await handlePdfExport()

    expect(resetPageAndSaveMessages).toHaveBeenCalledTimes(1)
    expect(setPageErrorMessage).toHaveBeenCalledWith('Allow popups to export the PDF.')
    expect(flushPendingSaves).not.toHaveBeenCalled()
    expect(saveTimecardPdfExportPayloadMock).not.toHaveBeenCalled()
  })

  it('flushes pending saves, stores a normalized PDF payload, opens the print route, and reports success', async () => {
    const calls: string[] = []
    const printWindow = makePrintWindow()
    vi.spyOn(window, 'open').mockReturnValue(printWindow as unknown as Window)
    vi.spyOn(Date, 'now').mockReturnValue(123456)
    saveTimecardPdfExportPayloadMock.mockImplementation((payload) => {
      calls.push('save-payload')
      expect(payload.cards[0]).toEqual(expect.objectContaining({
        exportBurden: 0.33,
        exportForemanName: 'CJ Blanchard',
        exportJobCode: '736',
        exportJobId: 'job-shop',
        exportJobName: 'Shop',
        exportWeekEndDate: '2026-06-20',
        exportWeekId: 'week-1',
        exportWeekStartDate: '2026-06-14',
        exportWeekStatus: 'submitted',
      }))
      return 'export-123'
    })

    const {
      buildPdfExportSubtitle,
      flushPendingSaves,
      handlePdfExport,
      resetPageAndSaveMessages,
      resolvePrintHref,
      setPageInfo,
    } = mountDownloadActions({
      flushPendingSaves: async () => {
        calls.push('flush-saves')
      },
      onResolvePrintHref: (exportId) => {
        calls.push(`resolve:${exportId}`)
        return `/print/${exportId}`
      },
    })

    await handlePdfExport()

    expect(resetPageAndSaveMessages).toHaveBeenCalledTimes(1)
    expect(window.open).toHaveBeenCalledWith('', '_blank')
    expect(printWindow.document.title).toBe('Preparing Timecard PDF...')
    expect(printWindow.document.body.innerHTML).toContain('Preparing timecard PDF')
    expect(flushPendingSaves).toHaveBeenCalledTimes(1)
    expect(buildPdfExportSubtitle).toHaveBeenCalledTimes(1)
    expect(saveTimecardPdfExportPayloadMock).toHaveBeenCalledWith(expect.objectContaining({
      cards: expect.any(Array),
      generatedAt: 123456,
      subtitle: '6/14/2026 - 6/20/2026 · 1 card',
      title: 'Timecard Export',
    }))
    expect(resolvePrintHref).toHaveBeenCalledWith('export-123')
    expect(printWindow.location.href).toBe('/print/export-123')
    expect(setPageInfo).toHaveBeenCalledWith('Opened 1 timecard for PDF export.')
    expect(calls).toEqual(['flush-saves', 'save-payload', 'resolve:export-123'])
  })

  it('closes the PDF prep window and reports a fallback message when export preparation fails', async () => {
    const error = new Error('flush failed')
    const printWindow = makePrintWindow()
    vi.spyOn(window, 'open').mockReturnValue(printWindow as unknown as Window)
    const { handlePdfExport, setPageError } = mountDownloadActions({
      flushPendingSaves: async () => {
        throw error
      },
    })

    await handlePdfExport()

    expect(printWindow.close).toHaveBeenCalledTimes(1)
    expect(setPageError).toHaveBeenCalledWith(error, 'Failed to prepare the PDF export.')
    expect(saveTimecardPdfExportPayloadMock).not.toHaveBeenCalled()
  })

  it('shows an empty-filter message instead of building a CSV export with no cards', async () => {
    const { flushPendingSaves, handleCsvExport, resetPageAndSaveMessages, setPageInfo } = mountDownloadActions({
      cards: [],
    })

    await handleCsvExport()

    expect(setPageInfo).toHaveBeenCalledWith('No timecards match the current filters.')
    expect(resetPageAndSaveMessages).not.toHaveBeenCalled()
    expect(flushPendingSaves).not.toHaveBeenCalled()
    expect(buildTimecardCsvExportMock).not.toHaveBeenCalled()
    expect(downloadTimecardCsvExportMock).not.toHaveBeenCalled()
  })

  it('flushes pending saves, builds the CSV, downloads it, and reports detail-row count', async () => {
    const calls: string[] = []
    const card = makeCard()
    buildTimecardCsvExportMock.mockImplementation((cards) => {
      calls.push(`build:${cards.length}`)
      return {
        csvText: 'Employee Name,Hours\r\nBlanchard,8',
        detailRowCount: 2,
      }
    })
    downloadTimecardCsvExportMock.mockImplementation((filename) => {
      calls.push(`download:${filename}`)
    })

    const {
      buildCsvExportFilename,
      flushPendingSaves,
      handleCsvExport,
      resetPageAndSaveMessages,
      setPageInfo,
    } = mountDownloadActions({
      cards: [card, makeCard({ id: 'card-2', employeeNumber: '5229' })],
      flushPendingSaves: async () => {
        calls.push('flush-saves')
      },
    })

    await handleCsvExport()

    expect(resetPageAndSaveMessages).toHaveBeenCalledTimes(1)
    expect(flushPendingSaves).toHaveBeenCalledTimes(1)
    expect(buildTimecardCsvExportMock).toHaveBeenCalledWith([card, expect.objectContaining({ id: 'card-2' })])
    expect(buildCsvExportFilename).toHaveBeenCalledTimes(1)
    expect(downloadTimecardCsvExportMock).toHaveBeenCalledWith(
      'timecard-export-2026-06-20.csv',
      'Employee Name,Hours\r\nBlanchard,8',
    )
    expect(setPageInfo).toHaveBeenCalledWith('Downloaded CSV with 2 detail rows from 2 timecards.')
    expect(calls).toEqual(['flush-saves', 'build:2', 'download:timecard-export-2026-06-20.csv'])
  })

  it('reports when matching timecards do not contain CSV detail rows', async () => {
    buildTimecardCsvExportMock.mockReturnValue({
      csvText: 'Employee Name,Hours',
      detailRowCount: 0,
    })
    const { handleCsvExport, setPageInfo } = mountDownloadActions()

    await handleCsvExport()

    expect(setPageInfo).toHaveBeenCalledWith('No CSV detail rows were found in the current timecards.')
    expect(downloadTimecardCsvExportMock).not.toHaveBeenCalled()
  })

  it('reports CSV export preparation failures with the fallback message', async () => {
    const error = new Error('csv failed')
    const { handleCsvExport, setPageError } = mountDownloadActions({
      flushPendingSaves: async () => {
        throw error
      },
    })

    await handleCsvExport()

    expect(setPageError).toHaveBeenCalledWith(error, 'Failed to prepare the CSV export.')
    expect(buildTimecardCsvExportMock).not.toHaveBeenCalled()
    expect(downloadTimecardCsvExportMock).not.toHaveBeenCalled()
  })
})
