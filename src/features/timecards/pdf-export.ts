import type { TimecardCardRecord, TimecardWeekRecord } from '@/types/domain'

const TIMECARD_PDF_EXPORT_STORAGE_KEY = 'phase2-timecard-pdf-exports'
const TIMECARD_PDF_EXPORT_MAX_AGE_MS = 1000 * 60 * 60 * 12

export interface TimecardPdfExportCard extends TimecardCardRecord {
  exportWeekId: string
  exportWeekStartDate: string
  exportWeekEndDate: string
  exportWeekStatus: TimecardWeekRecord['status']
  exportJobId: string
  exportJobCode: string | null
  exportJobName: string | null
  exportForemanName: string | null
  exportBurden: number
}

export interface TimecardPdfExportPayload {
  exportId: string
  title: string
  subtitle: string
  generatedAt: number
  cards: TimecardPdfExportCard[]
}

type StoredTimecardPdfExportPayloads = Record<string, TimecardPdfExportPayload>

interface LegacyStoredTimecardPdfExportPayload {
  exportId: string
  payload: TimecardPdfExportPayload
}

function createExportId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `timecard-pdf-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function getPdfExportStorage() {
  if (typeof window === 'undefined') return null

  try {
    if (window.localStorage) return window.localStorage
  } catch {
    return null
  }

  return null
}

function isValidPayload(value: unknown): value is TimecardPdfExportPayload {
  if (!value || typeof value !== 'object') return false

  const payload = value as Partial<TimecardPdfExportPayload>
  return (
    typeof payload.exportId === 'string'
    && typeof payload.title === 'string'
    && typeof payload.subtitle === 'string'
    && typeof payload.generatedAt === 'number'
    && Array.isArray(payload.cards)
  )
}

function pruneStoredPayloads(payloads: StoredTimecardPdfExportPayloads, now: number) {
  return Object.fromEntries(
    Object.entries(payloads).filter(([, payload]) => (
      isValidPayload(payload)
      && now - payload.generatedAt <= TIMECARD_PDF_EXPORT_MAX_AGE_MS
    )),
  )
}

function readStoredPayloads() {
  const storage = getPdfExportStorage()
  if (!storage) return {}

  const raw = storage.getItem(TIMECARD_PDF_EXPORT_STORAGE_KEY)
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as unknown

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const now = Date.now()

      if ('exportId' in parsed && 'payload' in parsed) {
        const legacy = parsed as Partial<LegacyStoredTimecardPdfExportPayload>
        if (
          typeof legacy.exportId === 'string'
          && legacy.payload
          && isValidPayload(legacy.payload)
          && now - legacy.payload.generatedAt <= TIMECARD_PDF_EXPORT_MAX_AGE_MS
        ) {
          return { [legacy.exportId]: legacy.payload }
        }

        return {}
      }

      return pruneStoredPayloads(parsed as StoredTimecardPdfExportPayloads, now)
    }

    return {}
  } catch {
    return {}
  }
}

function writeStoredPayloads(payloads: StoredTimecardPdfExportPayloads) {
  const storage = getPdfExportStorage()
  if (!storage) {
    throw new Error('This browser does not support PDF export storage.')
  }

  storage.setItem(
    TIMECARD_PDF_EXPORT_STORAGE_KEY,
    JSON.stringify(payloads),
  )
}

export function saveTimecardPdfExportPayload(
  payload: Omit<TimecardPdfExportPayload, 'exportId'>,
) {
  const storage = getPdfExportStorage()
  if (!storage) {
    throw new Error('This browser does not support PDF export storage.')
  }

  const exportId = createExportId()
  const nextPayload: TimecardPdfExportPayload = {
    ...payload,
    exportId,
  }

  const storedPayloads = readStoredPayloads()
  const nextStoredPayloads: StoredTimecardPdfExportPayloads = {
    ...storedPayloads,
    [exportId]: nextPayload,
  }

  writeStoredPayloads(pruneStoredPayloads(nextStoredPayloads, Date.now()))

  return exportId
}

export function loadTimecardPdfExportPayload(exportId?: string) {
  const storage = getPdfExportStorage()
  if (!storage) return null

  const storedPayloads = readStoredPayloads()
  writeStoredPayloads(storedPayloads)

  if (exportId) {
    return storedPayloads[exportId] ?? null
  }

  const latestPayload = Object.values(storedPayloads).sort(
    (left, right) => right.generatedAt - left.generatedAt,
  )[0]

  return latestPayload ?? null
}
