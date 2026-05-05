import { TIMECARD_VISIBLE_DAY_INDEXES, buildCardDisplayName } from '@/features/timecards/workbook'
import type { TimecardCardRecord } from '@/types/domain'

const TIMECARD_CSV_HEADER = [
  'Employee Name',
  'Employee Code',
  'Job Code',
  'DETAIL_DATE',
  'Sub-Section',
  'Activity Code',
  'Cost Code',
  'H_Hours',
  'P_HOURS',
  '',
  '',
] as const

type CsvCompatibleTimecardCard = TimecardCardRecord & {
  archiveJobCode?: string | null
}

export interface TimecardCsvExportPayload {
  csvText: string
  detailRowCount: number
}

function formatCsvDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return `${parsed.getMonth() + 1}/${parsed.getDate()}/${parsed.getFullYear()}`
}

function formatCsvNumber(value: number | null | undefined, decimals = 2) {
  const safe = Number(value ?? 0)
  if (!Number.isFinite(safe) || Number.isNaN(safe)) return ''
  if (safe === 0) return ''
  return safe.toFixed(decimals).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
}

function formatEmployeeCsvName(card: Pick<TimecardCardRecord, 'firstName' | 'lastName' | 'fullName' | 'employeeNumber'>) {
  const firstName = card.firstName.trim()
  const lastName = card.lastName.trim()
  if (lastName && firstName) return `${lastName}, ${firstName}`
  return buildCardDisplayName(card)
}

function resolveActivityAndCostCode(account: string) {
  const trimmed = account.trim()
  if (!trimmed) {
    return {
      activityCode: '',
      costCode: '',
    }
  }

  const shouldMirrorAsCostCode = /[A-Za-z-]/.test(trimmed)
  return {
    activityCode: trimmed,
    costCode: shouldMirrorAsCostCode ? trimmed : '',
  }
}

function escapeCsvField(value: string | number | null | undefined) {
  const next = value == null ? '' : String(value)
  if (/[",\r\n]/.test(next)) {
    return `"${next.replace(/"/g, '""')}"`
  }

  return next
}

function buildCsvRow(values: Array<string | number | null | undefined>) {
  return values.map(escapeCsvField).join(',')
}

export function buildTimecardCsvExport(cards: CsvCompatibleTimecardCard[]): TimecardCsvExportPayload {
  const rows: string[] = [
    buildCsvRow([...TIMECARD_CSV_HEADER]),
    buildCsvRow(Array(TIMECARD_CSV_HEADER.length).fill('')),
  ]

  let detailRowCount = 0

  cards.forEach((card) => {
    const employeeName = formatEmployeeCsvName(card)
    const employeeCode = card.employeeNumber.trim()

    card.lines.forEach((line) => {
      const lineJobCode = line.jobNumber.trim() || card.archiveJobCode?.trim() || ''
      const subsection = line.subsectionArea.trim()
      const { activityCode, costCode } = resolveActivityAndCostCode(line.account)

      TIMECARD_VISIBLE_DAY_INDEXES.forEach((dayIndex) => {
        const day = line.days[dayIndex]
        if (!day) return

        const hours = Number(day.hours ?? 0)
        const production = Number(day.production ?? 0)
        if (hours === 0 && production === 0) return

        rows.push(buildCsvRow([
          employeeName,
          employeeCode,
          lineJobCode,
          formatCsvDate(day.date),
          subsection,
          activityCode,
          costCode,
          formatCsvNumber(hours),
          formatCsvNumber(production),
          '',
          '',
        ]))
        detailRowCount += 1
      })
    })
  })

  return {
    csvText: rows.join('\r\n'),
    detailRowCount,
  }
}

export function downloadTimecardCsvExport(filename: string, csvText: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('CSV export is only available in the browser.')
  }

  const blob = new Blob([`\uFEFF${csvText}`], { type: 'text/csv;charset=utf-8;' })
  const downloadUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = downloadUrl
  anchor.download = filename
  anchor.style.display = 'none'

  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.URL.revokeObjectURL(downloadUrl)
}
