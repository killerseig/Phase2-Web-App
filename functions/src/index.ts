import * as admin from 'firebase-admin'
import PDFDocument from 'pdfkit'
import { onCall } from 'firebase-functions/v2/https'
import { HttpsError } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { defineSecret } from 'firebase-functions/params'
import {
  getJobDetails,
  getUserProfile,
  getUserDisplayName,
  verifyAdminRole,
  getDailyLog,
  getTimecard,
  getShopOrder,
  getEmailSettings,
} from './firestoreService'
import {
  sendEmail,
  buildDailyLogEmail,
  buildDailyLogAutoSubmitEmail,
  buildTimecardEmail,
  buildTimecardsEmail,
  buildShopOrderEmail,
  buildSecretExpirationEmail,
  buildWelcomeEmail,
  isEmailEnabled,
  getSenderEmail,
  sendDailyLogEmailNotification,
  sendTimecardEmailNotification,
  sendShopOrderEmailNotification,
  sendSecretExpirationWarning,
} from './emailService'

const graphClientId = defineSecret('GRAPH_CLIENT_ID')
const graphTenantId = defineSecret('GRAPH_TENANT_ID')
const graphClientSecret = defineSecret('GRAPH_CLIENT_SECRET')
const outlookSenderEmail = defineSecret('OUTLOOK_SENDER_EMAIL')
import {
  VALID_ROLES,
  ERROR_MESSAGES,
  EMAIL,
  COLLECTIONS,
  EMAIL_STYLES,
} from './constants'
admin.initializeApp()

const db = admin.firestore()
const auth = admin.auth()
const storageBucket = admin.storage().bucket()

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

const MAX_ATTACHMENT_TOTAL_BYTES = 15 * 1024 * 1024
const MAX_ATTACHMENT_COUNT = 10
const DEFAULT_PRODUCTION_BURDEN = 0.33

function normalizeRecipients(...groups: any[]): string[] {
  const merged = groups.flatMap(group => (Array.isArray(group) ? group : []))
  const cleaned = merged
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
  return Array.from(new Set(cleaned))
}

function getAssignedJobIds(user: any): string[] {
  if (!Array.isArray(user?.assignedJobIds)) return []
  return user.assignedJobIds
    .filter((value: unknown): value is string => typeof value === 'string')
    .map((value: string) => value.trim())
    .filter(Boolean)
}

function assertActiveRoleUser(user: any, allowedRoles: string[], errorMessage: string) {
  if (!user) {
    throw new HttpsError('failed-precondition', ERROR_MESSAGES.USER_PROFILE_NOT_FOUND)
  }

  const role = String(user?.role || 'none').trim().toLowerCase()
  if (user?.active !== true) {
    throw new HttpsError('permission-denied', 'Your account is inactive')
  }
  if (!allowedRoles.includes(role)) {
    throw new HttpsError('permission-denied', errorMessage)
  }

  return {
    ...user,
    role,
    assignedJobIds: getAssignedJobIds(user),
  }
}

function assertAdminOrAssignedForeman(user: any, jobId: string, errorMessage: string) {
  const authorizedUser = assertActiveRoleUser(user, ['admin', 'foreman'], errorMessage)
  if (authorizedUser.role === 'admin') return authorizedUser

  if (!authorizedUser.assignedJobIds.includes(String(jobId || '').trim())) {
    throw new HttpsError('permission-denied', errorMessage)
  }

  return authorizedUser
}

async function getJobDailyLogRecipients(jobId: string): Promise<string[]> {
  const jobSnap = await db.collection(COLLECTIONS.JOBS).doc(jobId).get()
  const data = jobSnap.data()
  return Array.isArray(data?.dailyLogRecipients)
    ? data.dailyLogRecipients.filter((value: unknown): value is string => typeof value === 'string')
    : []
}

function formatEmailDate(value: any): string {
  try {
    if (!value) return 'N/A'
    const asDate = typeof value?.toDate === 'function'
      ? value.toDate()
      : value instanceof Date
        ? value
        : new Date(value)
    if (Number.isNaN(asDate.getTime())) return 'N/A'
    return asDate.toLocaleDateString()
  } catch {
    return 'N/A'
  }
}

function toNumber(value: any): number {
  const n = Number(value)
  if (!Number.isFinite(n) || Number.isNaN(n)) return 0
  return n
}

function normalizeProductionBurden(value: any): number {
  const burden = Number(value)
  if (!Number.isFinite(burden) || Number.isNaN(burden) || burden < 0) {
    return DEFAULT_PRODUCTION_BURDEN
  }
  return burden
}

function getProductionMultiplier(productionBurden: any): number {
  return 1 + normalizeProductionBurden(productionBurden)
}

function calculateUnitCostForExport(
  employeeWage: any,
  hours: any,
  production: any,
  productionBurden = DEFAULT_PRODUCTION_BURDEN,
): number {
  const wageValue = Math.max(0, toNumber(employeeWage))
  const hourValue = Math.max(0, toNumber(hours))
  const productionValue = Math.max(0, toNumber(production))
  const multiplierValue = Math.max(0, toNumber(getProductionMultiplier(productionBurden)))

  if (wageValue <= 0 || hourValue <= 0 || productionValue <= 0 || multiplierValue <= 0) {
    return 0
  }

  return (hourValue * wageValue * multiplierValue) / productionValue
}

function formatPlexxisDate(dateString: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateString || '').trim())
  if (!match) return String(dateString || '')
  const [, year, month, day] = match
  return `${Number(month)}/${Number(day)}/${year}`
}

function buildEmptyDayDateRecord(): Record<typeof DAY_KEYS[number], string> {
  return {
    sun: '',
    mon: '',
    tue: '',
    wed: '',
    thu: '',
    fri: '',
    sat: '',
  }
}

function buildWeekDateRecord(weekStartDate: string): Record<typeof DAY_KEYS[number], string> {
  const dates = buildEmptyDayDateRecord()
  const trimmed = String(weekStartDate || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return dates

  const base = new Date(`${trimmed}T00:00:00Z`)
  DAY_KEYS.forEach((key, index) => {
    const date = new Date(base)
    date.setUTCDate(base.getUTCDate() + index)
    const yyyy = date.getUTCFullYear()
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(date.getUTCDate()).padStart(2, '0')
    dates[key] = `${yyyy}-${mm}-${dd}`
  })

  return dates
}

function mergeDayDates(
  target: Record<typeof DAY_KEYS[number], string>,
  sourceDays: any[],
): void {
  for (const day of Array.isArray(sourceDays) ? sourceDays : []) {
    const idx = typeof day?.dayOfWeek === 'number' && day.dayOfWeek >= 0 && day.dayOfWeek < DAY_KEYS.length
      ? day.dayOfWeek
      : sourceDays.indexOf(day)
    const key = DAY_KEYS[idx]
    if (key === undefined) continue

    const date = String(day?.date || '').trim()
    if (date) target[key] = date
  }
}

function formatPlexxisNumber(value: any, blankWhenZero = false): string {
  const numeric = toNumber(value)
  if (blankWhenZero && numeric === 0) return ''
  return numeric.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}

function escapeCsvValue(value: any): string {
  const str = String(value ?? '')
  if (!str.length) return ''
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function getWeekEndingFromWeekStart(weekStart: string): string {
  const parsed = new Date(`${String(weekStart || '').trim()}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return String(weekStart || '')
  parsed.setUTCDate(parsed.getUTCDate() + 6)
  const yyyy = parsed.getUTCFullYear()
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(parsed.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function getWeekStartFromWeekEnding(weekEnding: string): string {
  const parsed = new Date(`${String(weekEnding || '').trim()}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return ''
  parsed.setUTCDate(parsed.getUTCDate() - 6)
  const yyyy = parsed.getUTCFullYear()
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(parsed.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function formatDateOnly(value: Date): string {
  const yyyy = value.getUTCFullYear()
  const mm = String(value.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(value.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim())) return null
  const parsed = new Date(`${String(value || '').trim()}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return formatDateOnly(parsed) === String(value || '').trim() ? parsed : null
}

function formatWeekEndingLabel(value: string): string {
  const normalized = String(value || '').trim()
  if (!normalized) return ''
  return formatPlexxisDate(normalized)
}

function deriveEmployeeNameParts(timecard: any): { firstName: string; lastName: string; employeeName: string } {
  const firstName = String(timecard?.firstName || '').trim()
  const lastName = String(timecard?.lastName || '').trim()

  if (firstName || lastName) {
    return {
      firstName,
      lastName,
      employeeName: `${firstName} ${lastName}`.trim() || String(timecard?.employeeName || '').trim() || 'Unnamed Employee',
    }
  }

  const employeeName = String(timecard?.employeeName || '').trim()
  if (!employeeName) {
    return { firstName: '', lastName: '', employeeName: 'Unnamed Employee' }
  }

  if (employeeName.includes(',')) {
    const [rawLastName, rawFirstName] = employeeName.split(',', 2)
    return {
      firstName: String(rawFirstName || '').trim(),
      lastName: String(rawLastName || '').trim(),
      employeeName,
    }
  }

  const parts = employeeName.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return {
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' '),
      employeeName,
    }
  }

  return {
    firstName: employeeName,
    lastName: '',
    employeeName,
  }
}

function formatPlexxisEmployeeName(timecard: any): string {
  const firstNameRaw = String(timecard?.firstName || '').trim()
  const lastNameRaw = String(timecard?.lastName || '').trim()

  if (lastNameRaw && firstNameRaw) return `${lastNameRaw}, ${firstNameRaw}`
  if (lastNameRaw) return lastNameRaw
  if (firstNameRaw) return firstNameRaw

  const employeeName = String(timecard?.employeeName || '').trim()
  if (!employeeName) return ''
  if (employeeName.includes(',')) return employeeName

  const parts = employeeName.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const first = parts[0]
    const last = parts.slice(1).join(' ')
    return `${last}, ${first}`
  }
  return employeeName
}

function getLineDaySum(line: any, key: 'hours' | 'production', dayKey: typeof DAY_KEYS[number]): number {
  if (key === 'hours') return toNumber(line?.[dayKey])
  return toNumber(line?.production?.[dayKey])
}

function getLineTotalHours(line: any): number {
  const fromTotals = toNumber(line?.totals?.hours)
  if (fromTotals > 0) return fromTotals
  return DAY_KEYS.reduce((sum, key) => sum + getLineDaySum(line, 'hours', key), 0)
}

function getLineTotalProduction(line: any): number {
  const fromTotals = toNumber(line?.totals?.production)
  if (fromTotals > 0) return fromTotals
  return DAY_KEYS.reduce((sum, key) => sum + getLineDaySum(line, 'production', key), 0)
}

function pickFirstNonEmptyValue(source: any, keys: string[]): string {
  for (const key of keys) {
    if (!key) continue
    const value = source?.[key]
    if (value === null || value === undefined) continue
    const text = String(value).trim()
    if (text) return text
  }
  return ''
}

function getLineSubSection(line: any): string {
  return pickFirstNonEmptyValue(line, [
    'subsectionArea',
    'subSection',
    'subsection',
    'sub_section',
    'area',
    'section',
    'subSectionCode',
  ])
}

function getLineActivityCode(line: any): string {
  return pickFirstNonEmptyValue(line, [
    'account',
    'acct',
    'activityCode',
    'activity',
    'detailCode',
    'detail',
    'accountCode',
  ])
}

function getLineCostCode(line: any): string {
  return pickFirstNonEmptyValue(line, [
    'costCode',
    'cost_code',
    'cost',
    'costcode',
  ])
}

function sanitizeLeakedCodeValue(value: any, disallowedValues: any[]): string {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const disallowed = new Set(
    (Array.isArray(disallowedValues) ? disallowedValues : [])
      .map((v) => String(v || '').trim().toLowerCase())
      .filter(Boolean)
  )
  if (disallowed.has(raw.toLowerCase())) return ''
  return raw
}

function sanitizeActivityCode(
  value: any,
  line: any,
  disallowedValues: any[]
): string {
  const raw = sanitizeLeakedCodeValue(value, disallowedValues)
  if (!raw) return ''

  const difValues = [line?.difH, line?.difP, line?.difC]
    .map((v) => String(v || '').trim().toLowerCase())
    .filter(Boolean)
  if (difValues.includes(raw.toLowerCase())) return ''

  // Reject short numeric fragments that are commonly leaked from non-activity fields.
  if (/^\d{1,3}$/.test(raw)) return ''

  return raw
}

function getLineOffHours(line: any): number {
  return toNumber(line?.offHours ?? line?.off?.hours ?? line?.off)
}

function getLineOffProduction(line: any): number {
  return toNumber(line?.offProduction ?? line?.off?.production)
}

function getLineOffCost(line: any): number {
  return toNumber(line?.offCost ?? line?.off?.cost ?? line?.off?.amount)
}

function parseOptionalHoursOverride(value: any): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && !value.trim()) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 0) return null
  return parsed
}

function getLineMonSatHours(line: any): number {
  return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'].reduce((sum, key) => sum + toNumber(line?.[key]), 0)
}

function getLineMonSatProduction(line: any): number {
  return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'].reduce((sum, key) => sum + toNumber(line?.production?.[key]), 0)
}

function getLineMonSatCost(line: any): number {
  return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'].reduce((sum, key) => sum + toNumber(line?.unitCost?.[key]), 0)
}

function getLineTotalHoursForForm(line: any): number {
  // Form TOTAL for H row is based on MON-SAT hours.
  return getLineMonSatHours(line)
}

function getLineTotalProductionForForm(line: any): number {
  // Form TOTAL for P row is based on MON-SAT production.
  return getLineMonSatProduction(line)
}

function getLineSummaryCostForForm(line: any, employeeWage: any, productionBurden: any): number {
  const totalHours = getLineTotalHoursForForm(line)
  const totalProduction = getLineTotalProductionForForm(line)
  if (totalHours <= 0 || totalProduction <= 0) return 0
  return calculateUnitCostForExport(
    employeeWage,
    totalHours,
    totalProduction,
    productionBurden,
  )
}

function getLineTotalCostForForm(line: any, employeeWage?: any, productionBurden?: any): number {
  if (employeeWage !== undefined) {
    const summaryCost = getLineSummaryCostForForm(line, employeeWage, productionBurden)
    if (summaryCost > 0) return summaryCost
  }
  const fromTotals = toNumber(line?.totals?.lineTotal)
  if (fromTotals > 0) return fromTotals
  return getLineMonSatCost(line)
}

function hasMeaningfulLineDataForPdf(line: any): boolean {
  const totalHours = getLineTotalHoursForForm(line)
  const totalProduction = getLineTotalProductionForForm(line)
  const totalCost = getLineMonSatCost(line)
  const offHours = getLineOffHours(line)
  const offProduction = getLineOffProduction(line)
  const offCost = getLineOffCost(line)
  return totalHours > 0 || totalProduction > 0 || totalCost > 0 || offHours > 0 || offProduction > 0 || offCost > 0
}

function hasMeaningfulLineDataForCsv(line: any): boolean {
  const totalHours = getLineTotalHoursForForm(line)
  const totalProduction = getLineTotalProductionForForm(line)
  const subSection = getLineSubSection(line)
  const activityCode = sanitizeActivityCode(getLineActivityCode(line), line, [])
  const costCode = getLineCostCode(line)
  return totalHours > 0 || totalProduction > 0 || !!subSection || !!activityCode || !!costCode
}

function hasMeaningfulTimecard(tc: any): boolean {
  const lines = Array.isArray(tc?.lines) ? tc.lines : []
  if (lines.some((line: any) => hasMeaningfulLineDataForCsv(line) || hasMeaningfulLineDataForPdf(line))) return true
  const hoursTotal = toNumber(tc?.totals?.hoursTotal)
  const productionTotal = toNumber(tc?.totals?.productionTotal)
  return hoursTotal > 0 || productionTotal > 0
}

function roundToHundredths(value: number): number {
  return Math.round(toNumber(value) * 100) / 100
}

function validatePdfCsvHourParity(timecards: any[]): void {
  const mismatches: string[] = []

  for (const tc of Array.isArray(timecards) ? timecards : []) {
    const lines = Array.isArray(tc?.lines) ? tc.lines : []
    const pdfHours = lines
      .filter((line: any) => hasMeaningfulLineDataForPdf(line))
      .reduce((sum: number, line: any) => sum + getLineTotalHoursForForm(line), 0)

    const csvHours = lines
      .filter((line: any) => hasMeaningfulLineDataForCsv(line))
      .reduce((sum: number, line: any) => sum + getLineTotalHoursForForm(line), 0)

    if (Math.abs(roundToHundredths(pdfHours) - roundToHundredths(csvHours)) > 0.001) {
      const employeeName = String(tc?.employeeName || tc?.employeeCode || tc?.employeeNumber || 'Unknown employee').trim()
      mismatches.push(`${employeeName}: PDF ${roundToHundredths(pdfHours)} vs CSV ${roundToHundredths(csvHours)}`)
    }
  }

  if (mismatches.length) {
    throw new HttpsError('internal', `Hour parity validation failed: ${mismatches.slice(0, 8).join('; ')}`)
  }
}

async function loadDailyLogAttachments(log: any) {
  const attachments: Array<{ name: string; contentType?: string; contentBytes: string }> = []
  const files = Array.isArray(log?.attachments) ? log.attachments : []
  let totalBytes = 0

  for (const att of files) {
    if (!att?.path) continue
    if (attachments.length >= MAX_ATTACHMENT_COUNT) {
      console.warn('[sendDailyLogEmail] Skipping extra attachments beyond limit', { limit: MAX_ATTACHMENT_COUNT })
      break
    }

    try {
      const file = storageBucket.file(att.path)
      const [exists] = await file.exists()
      if (!exists) {
        console.warn('[sendDailyLogEmail] Attachment missing in storage', { path: att.path })
        continue
      }

      const [metadata] = await file.getMetadata()
      const size = Number(metadata?.size) || 0
      if (totalBytes + size > MAX_ATTACHMENT_TOTAL_BYTES) {
        console.warn('[sendDailyLogEmail] Skipping attachment to respect size budget', {
          path: att.path,
          size,
          totalBytes,
          max: MAX_ATTACHMENT_TOTAL_BYTES,
        })
        continue
      }

      const [buffer] = await file.download()
      totalBytes += buffer.length

      attachments.push({
        name: att?.name || file.name.split('/').pop() || 'attachment',
        contentType: metadata?.contentType || 'application/octet-stream',
        contentBytes: buffer.toString('base64'),
      })
    } catch (err) {
      console.warn('[sendDailyLogEmail] Failed to load attachment', { path: att?.path, err })
    }
  }

  return attachments
}

function normalizeTimecardForEmail(tc: any) {
  const employeeWage = toNumber(tc?.employeeWage ?? tc?.wage)
  const sourceLines = Array.isArray(tc?.lines) && tc.lines.length
    ? tc.lines
    : Array.isArray(tc?.jobs)
      ? tc.jobs
      : []

  const lines = sourceLines.map((source: any) => {
    const hoursByDay: Record<typeof DAY_KEYS[number], number> = {
      sun: 0,
      mon: 0,
      tue: 0,
      wed: 0,
      thu: 0,
      fri: 0,
      sat: 0,
    }
    const productionByDay: Record<typeof DAY_KEYS[number], number> = {
      sun: 0,
      mon: 0,
      tue: 0,
      wed: 0,
      thu: 0,
      fri: 0,
      sat: 0,
    }
    const unitCostByDay: Record<typeof DAY_KEYS[number], number> = {
      sun: 0,
      mon: 0,
      tue: 0,
      wed: 0,
      thu: 0,
      fri: 0,
      sat: 0,
    }
    const datesByDay = buildWeekDateRecord(String(tc?.weekStartDate || ''))

    const days = Array.isArray(source?.days) ? source.days : []
    const timecardDays = Array.isArray(tc?.days) ? tc.days : []
    mergeDayDates(datesByDay, timecardDays)
    mergeDayDates(datesByDay, days)
    for (const day of days) {
      const idx = typeof day?.dayOfWeek === 'number' && day.dayOfWeek >= 0 && day.dayOfWeek < DAY_KEYS.length
        ? day.dayOfWeek
        : days.indexOf(day)
      const key = DAY_KEYS[idx]
      if (key === undefined) continue
      hoursByDay[key] = Number(day?.hours) || 0
      productionByDay[key] = Number(day?.production) || 0
      unitCostByDay[key] = Number(day?.unitCost) || 0
    }

    DAY_KEYS.forEach((key) => {
      const lineHours = toNumber(source?.[key])
      const lineProduction = toNumber(source?.production?.[key])
      const lineUnitCost = toNumber(source?.unitCost?.[key])

      if (lineHours > 0 || hoursByDay[key] === 0) {
        hoursByDay[key] = lineHours || hoursByDay[key]
      }
      if (lineProduction > 0 || productionByDay[key] === 0) {
        productionByDay[key] = lineProduction || productionByDay[key]
      }

      const computedUnitCost = calculateUnitCostForExport(
        employeeWage,
        hoursByDay[key],
        productionByDay[key],
        tc?.productionBurden,
      )
      unitCostByDay[key] = lineUnitCost || unitCostByDay[key] || computedUnitCost
    })

    const lineSubSection = getLineSubSection(source)
    const lineCostCode = getLineCostCode(source)
    const lineJobCode = String(source?.jobNumber || tc?.jobCode || tc?.__jobCode || '').trim()
    const employeeCode = String(tc?.employeeCode || tc?.employeeId || tc?.employeeNumber || '').trim()
    const rawActivityCode = getLineActivityCode(source)
    const sanitizedActivityCode = sanitizeActivityCode(rawActivityCode, source, [
      lineJobCode,
      tc?.jobCode,
      tc?.__jobCode,
      employeeCode,
      tc?.employeeNumber,
    ])

    const line: any = {
      jobNumber: lineJobCode,
      subsectionArea: lineSubSection,
      area: lineSubSection,
      account: sanitizedActivityCode,
      acct: sanitizedActivityCode,
      activityCode: sanitizedActivityCode,
      costCode: lineCostCode,
      difH: source?.difH || '',
      difP: source?.difP || '',
      difC: source?.difC || '',
      offHours: toNumber(source?.offHours ?? source?.off?.hours ?? source?.off),
      offProduction: toNumber(source?.offProduction ?? source?.off?.production),
      offCost: toNumber(source?.offCost ?? source?.off?.cost ?? source?.off?.amount),
      dates: { ...datesByDay },
      production: productionByDay,
      unitCost: unitCostByDay,
    }

    DAY_KEYS.forEach(k => {
      line[k] = hoursByDay[k]
    })

    const totalHours = DAY_KEYS.reduce((sum, key) => sum + toNumber(hoursByDay[key]), 0)
    const totalProduction = DAY_KEYS.reduce((sum, key) => sum + toNumber(productionByDay[key]), 0)
    const hasRealActivity = !!sanitizedActivityCode
    const hasRealCostCode = !!String(line?.costCode || '').trim()
    // Guard against legacy rows where hours were stored under production without a real activity/cost identity.
    if (totalHours === 0 && totalProduction > 0 && !hasRealActivity && !hasRealCostCode) {
      DAY_KEYS.forEach((k) => {
        line[k] = toNumber(productionByDay[k])
        productionByDay[k] = 0
        unitCostByDay[k] = 0
      })
      line.production = productionByDay
      line.unitCost = unitCostByDay
    }

    const finalTotalHours = DAY_KEYS.reduce((sum, key) => sum + toNumber(line[key]), 0)
    const finalTotalProduction = DAY_KEYS.reduce((sum, key) => sum + toNumber(productionByDay[key]), 0)
    let totalLine = 0
    DAY_KEYS.forEach(k => {
      totalLine += (productionByDay[k] || 0) * (unitCostByDay[k] || 0)
    })

    line.totals = {
      hours: finalTotalHours,
      production: finalTotalProduction,
      lineTotal: totalLine,
    }

    return line
  })

  const totals = lines.reduce(
    (agg: any, line: any) => {
      agg.hoursTotal += Number(line?.totals?.hours) || 0
      agg.productionTotal += Number(line?.totals?.production) || 0
      agg.lineTotal += Number(line?.totals?.lineTotal) || 0
      return agg
    },
    { hoursTotal: 0, productionTotal: 0, lineTotal: 0 }
  )

  return {
    ...tc,
    lines,
    jobCode: String(tc?.jobCode || tc?.__jobCode || '').trim(),
    employeeWage: tc?.employeeWage ?? tc?.wage ?? null,
    totals,
  }
}

/**
 * Send Daily Log via email
 */
export const sendDailyLogEmail = onCall({ secrets: [graphClientId, graphTenantId, graphClientSecret, outlookSenderEmail] }, async (request) => {
  if (!request.auth) {
    throw new Error(ERROR_MESSAGES.NOT_SIGNED_IN)
  }
  const callerUid = request.auth.uid

  const { jobId, dailyLogId } = request.data

  if (!jobId) {
    throw new Error(ERROR_MESSAGES.JOB_ID_REQUIRED)
  }

  if (!dailyLogId) {
    throw new Error(ERROR_MESSAGES.DAILY_LOG_ID_REQUIRED)
  }

  try {
    const user = await getUserProfile(callerUid)
    const authorizedUser = assertAdminOrAssignedForeman(
      user,
      jobId,
      'Only admins or assigned foremen can send daily log emails'
    )

    if (!isEmailEnabled()) {
      console.log('[sendDailyLogEmail] Email sending disabled. Skipping send.')
      return { success: true, message: 'Email sending disabled. Skipped.' }
    }

    const log = await getDailyLog(jobId, dailyLogId)
    if (!log) {
      throw new Error(ERROR_MESSAGES.DAILY_LOG_NOT_FOUND)
    }
    if (String(log?.status || '').trim().toLowerCase() !== 'submitted') {
      throw new HttpsError('failed-precondition', 'Only submitted daily logs can be emailed')
    }
    if (authorizedUser.role === 'foreman' && String(log?.uid || '').trim() !== callerUid) {
      throw new HttpsError('permission-denied', 'Foremen can only email their own daily logs')
    }

    const settings = await getEmailSettings()
    const recipients = normalizeRecipients(
      settings.dailyLogSubmitRecipients,
      await getJobDailyLogRecipients(jobId)
    )

    if (!recipients.length) {
      throw new HttpsError('failed-precondition', ERROR_MESSAGES.RECIPIENTS_REQUIRED)
    }

    const job = await getJobDetails(log?.jobId || '')
    const emailHtml = buildDailyLogEmail(job || { id: '', name: 'Unknown Job', number: '' }, log?.logDate || new Date().toISOString(), log)
    const attachments = await loadDailyLogAttachments(log)

    await sendEmail({
      to: recipients,
      subject: `${EMAIL.SUBJECTS.DAILY_LOG} - ${job?.name || 'Job'} - ${log?.logDate || 'N/A'}`,
      html: emailHtml,
      ...(attachments.length ? { attachments } : {}),
    })

    console.log(`Daily log ${dailyLogId} emailed to ${recipients.join(', ')}`)
    return { success: true, message: 'Email sent successfully' }
  } catch (error: any) {
    console.error('Error sending daily log email:', error)
    if (error instanceof HttpsError) throw error
    throw new HttpsError('internal', error?.message || 'Failed to send daily log email')
  }
})

/**
 * Send Timecard via email
 */
export const sendTimecardEmail = onCall({ secrets: [graphClientId, graphTenantId, graphClientSecret, outlookSenderEmail] }, async (request) => {
  if (!request.auth) {
    throw new Error(ERROR_MESSAGES.NOT_SIGNED_IN)
  }
  const callerUid = request.auth.uid

  const { jobId, timecardIds, weekStart } = request.data

  if (!jobId) {
    throw new Error(ERROR_MESSAGES.JOB_ID_REQUIRED)
  }
  if (!timecardIds || !Array.isArray(timecardIds) || timecardIds.length === 0) {
    throw new Error('timecardIds array is required')
  }
  if (!weekStart) {
    throw new Error(ERROR_MESSAGES.WEEK_START_REQUIRED)
  }

  try {
    const user = await getUserProfile(callerUid)
    const authorizedUser = assertAdminOrAssignedForeman(
      user,
      jobId,
      'Only admins or assigned foremen can send timecard emails'
    )

    if (!isEmailEnabled()) {
      console.log('[sendTimecardEmail] Email sending disabled. Skipping send.')
      return { success: true, message: 'Email sending disabled. Skipped.' }
    }

    const settings = await getEmailSettings()
    const recipients = normalizeRecipients(settings.timecardSubmitRecipients)
    if (!recipients.length) {
      throw new HttpsError('failed-precondition', ERROR_MESSAGES.RECIPIENTS_REQUIRED)
    }

    // Fetch all timecards
    const timecards = []
    const missingIds: string[] = []
    for (const tcId of timecardIds) {
      console.log('[sendTimecardEmail] Fetching timecard', { jobId, weekStart, tcId })
      const tc = await getTimecard(jobId, weekStart, tcId)
      if (tc) {
        timecards.push(tc)
      } else {
        missingIds.push(tcId)
        console.warn('[sendTimecardEmail] Timecard not found', { jobId, weekStart, tcId })
      }
    }

    if (timecards.length === 0) {
      const availableSnap = await db.collection(COLLECTIONS.JOBS).doc(jobId).collection('timecards').get()
      const availableIds = availableSnap.docs.map(d => d.id)
      console.error('[sendTimecardEmail] No timecards found for requested IDs', {
        jobId,
        weekStart,
        requested: timecardIds,
        missing: missingIds,
        availableCount: availableIds.length,
        availableSample: availableIds.slice(0, 25),
      })
      throw new Error(`${ERROR_MESSAGES.TIMECARD_NOT_FOUND}: ${missingIds.join(', ') || 'none found'}`)
    }

    if (authorizedUser.role === 'foreman') {
      const unauthorizedTimecard = timecards.find((timecard: any) => (
        String(timecard?.createdByUid || '').trim() !== callerUid
      ))
      if (unauthorizedTimecard) {
        throw new HttpsError('permission-denied', 'Foremen can only email their own timecards')
      }
    }

    const draftTimecard = timecards.find((timecard: any) => String(timecard?.status || '').trim().toLowerCase() !== 'submitted')
    if (draftTimecard) {
      throw new HttpsError('failed-precondition', 'Only submitted timecards can be emailed')
    }

    const normalizedTimecards = timecards.map(normalizeTimecardForEmail)

    const job = await getJobDetails(jobId)
    const userName = await getUserDisplayName(request.auth.uid, request.auth.token.email)

    const emailHtml = buildTimecardsEmail({
      jobName: job?.name,
      jobNumber: job?.number,
      submittedBy: userName,
      weekStart,
      timecards: normalizedTimecards,
    })

      const csvAttachment = buildTimecardCsv(normalizedTimecards, weekStart, job?.number)
      const csvFileName = buildTimecardCsvFilename(weekStart, undefined, job?.number)
      const pdfFileName = buildTimecardPdfFilename(weekStart, undefined, job?.number)
      const pdfBuffer = await buildTimecardPdfBuffer({
        jobName: job?.name,
        jobNumber: job?.number,
        submittedBy: userName,
        weekStart,
        timecards: normalizedTimecards,
      })

      const attachments: Array<{ name: string; contentType?: string; contentBytes: string }> = []
      if (csvAttachment) {
        attachments.push({
          name: csvFileName,
          contentType: 'text/csv',
          contentBytes: Buffer.from(csvAttachment, 'utf-8').toString('base64'),
        })
      }
      attachments.push({
        name: pdfFileName,
        contentType: 'application/pdf',
        contentBytes: pdfBuffer.toString('base64'),
      })

      await sendEmail({
        to: recipients,
        subject: `${EMAIL.SUBJECTS.TIMECARD} - ${timecards.length} timecard(s) - Week of ${weekStart}`,
        html: emailHtml,
        attachments,
      })

    console.log(`Timecards ${timecardIds.join(', ')} emailed to ${recipients.join(', ')}`)
    return { success: true, message: 'Email sent successfully' }
  } catch (error: any) {
    console.error('Error sending timecard email:', error)
    if (error instanceof HttpsError) throw error
    throw new HttpsError('internal', error?.message || 'Failed to send timecard email')
  }
})

async function listSubmittedTimecardsForJobWeek(jobId: string, weekStart: string): Promise<any[]> {
  const weekEnding = getWeekEndingFromWeekStart(weekStart)

  const directSnap = await db
    .collection(COLLECTIONS.JOBS)
    .doc(jobId)
    .collection(COLLECTIONS.TIMECARDS)
    .where('status', '==', 'submitted')
    .get()

  const direct = directSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((tc: any) => {
      if (tc?.archived === true) return false
      const matchesWeekStart = String(tc?.weekStartDate || '').trim() === weekStart
      const matchesWeekEnding = String(tc?.weekEndingDate || '').trim() === weekEnding
      return matchesWeekStart || matchesWeekEnding
    })

  const legacySnap = await db
    .collection(COLLECTIONS.JOBS)
    .doc(jobId)
    .collection(COLLECTIONS.WEEKS)
    .doc(weekStart)
    .collection(COLLECTIONS.TIMECARDS)
    .get()

  const legacy = legacySnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data(), weekStartDate: doc.data()?.weekStartDate || weekStart }))
    .filter((tc: any) => tc?.status === 'submitted' && tc?.archived !== true)

  const mergedById = new Map<string, any>()
  for (const tc of direct) mergedById.set(tc.id, tc)
  for (const tc of legacy) {
    if (!mergedById.has(tc.id)) mergedById.set(tc.id, tc)
  }

  return Array.from(mergedById.values())
}

async function listAllTimecardsForJobWeek(jobId: string, weekStart: string): Promise<any[]> {
  const weekEnding = getWeekEndingFromWeekStart(weekStart)
  const jobRef = db.collection(COLLECTIONS.JOBS).doc(jobId)

  const [directByEndingSnap, directByStartSnap, legacySnap] = await Promise.all([
    jobRef.collection(COLLECTIONS.TIMECARDS).where('weekEndingDate', '==', weekEnding).get(),
    jobRef.collection(COLLECTIONS.TIMECARDS).where('weekStartDate', '==', weekStart).get(),
    jobRef.collection(COLLECTIONS.WEEKS).doc(weekStart).collection(COLLECTIONS.TIMECARDS).get(),
  ])

  const mergedById = new Map<string, any>()

  const mergeTimecards = (docs: FirebaseFirestore.QueryDocumentSnapshot[]) => {
    for (const doc of docs) {
      const timecard: any = { id: doc.id, ...doc.data() }
      if (timecard?.archived === true) continue
      mergedById.set(doc.id, timecard)
    }
  }

  mergeTimecards(directByEndingSnap.docs)
  mergeTimecards(directByStartSnap.docs)
  mergeTimecards(legacySnap.docs)

  return Array.from(mergedById.values())
}

async function listAllTimecardsForJobRange(jobId: string, startWeek: string, endWeek: string): Promise<any[]> {
  if (startWeek === endWeek) {
    return listAllTimecardsForJobWeek(jobId, startWeek)
  }

  const startWeekEnding = getWeekEndingFromWeekStart(startWeek)
  const endWeekEnding = getWeekEndingFromWeekStart(endWeek)
  const jobRef = db.collection(COLLECTIONS.JOBS).doc(jobId)

  const [directByStartSnap, directByEndingSnap, legacyWeeksSnap] = await Promise.all([
    jobRef.collection(COLLECTIONS.TIMECARDS).where('weekStartDate', '>=', startWeek).where('weekStartDate', '<=', endWeek).get(),
    jobRef.collection(COLLECTIONS.TIMECARDS).where('weekEndingDate', '>=', startWeekEnding).where('weekEndingDate', '<=', endWeekEnding).get(),
    jobRef
      .collection(COLLECTIONS.WEEKS)
      .orderBy(admin.firestore.FieldPath.documentId())
      .where(admin.firestore.FieldPath.documentId(), '>=', startWeek)
      .where(admin.firestore.FieldPath.documentId(), '<=', endWeek)
      .get(),
  ])

  const mergedById = new Map<string, any>()

  const mergeTimecards = (docs: Array<FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot>, legacyWeekStart?: string) => {
    for (const doc of docs) {
      if (!doc.exists) continue
      const timecard: any = { id: doc.id, ...doc.data() }
      if (legacyWeekStart && !timecard?.weekStartDate) {
        timecard.weekStartDate = legacyWeekStart
      }
      if (timecard?.archived === true) continue
      mergedById.set(doc.id, timecard)
    }
  }

  mergeTimecards(directByStartSnap.docs)
  mergeTimecards(directByEndingSnap.docs)

  const legacyWeekTimecards = await Promise.all(
    legacyWeeksSnap.docs.map(async (weekDoc) => {
      const snap = await weekDoc.ref.collection(COLLECTIONS.TIMECARDS).get()
      return { weekStart: weekDoc.id, docs: snap.docs }
    })
  )

  for (const week of legacyWeekTimecards) {
    mergeTimecards(week.docs, week.weekStart)
  }

  return Array.from(mergedById.values())
}

function toIsoString(value: any): string | null {
  if (!value) return null
  const asDate =
    typeof value?.toDate === 'function'
      ? value.toDate()
      : value instanceof Date
        ? value
        : new Date(value)

  if (Number.isNaN(asDate.getTime())) return null
  return asDate.toISOString()
}

function formatUserDisplayNameFromData(data: any, fallback?: string): string {
  const firstName = String(data?.firstName || '').trim()
  const lastName = String(data?.lastName || '').trim()
  if (firstName && lastName) return `${firstName} ${lastName}`

  const displayName = String(data?.displayName || '').trim()
  if (displayName) return displayName

  const email = String(data?.email || '').trim()
  if (email) return email

  return String(fallback || '').trim() || 'Unknown Creator'
}

async function resolveCreatorNames(timecards: any[]): Promise<Record<string, string>> {
  const uniqueUids = Array.from(new Set(
    (Array.isArray(timecards) ? timecards : [])
      .map((tc) => String(tc?.createdByUid || '').trim())
      .filter(Boolean),
  ))

  if (!uniqueUids.length) return {}

  const snapshots = await Promise.all(
    uniqueUids.map(async (uid) => {
      const snap = await db.collection(COLLECTIONS.USERS).doc(uid).get()
      return { uid, snap }
    }),
  )

  const names: Record<string, string> = {}
  for (const { uid, snap } of snapshots) {
    names[uid] = snap.exists
      ? formatUserDisplayNameFromData(snap.data(), uid)
      : uid
  }

  return names
}

function toControllerTimecardRow(
  tc: any,
  fallbackWeekStart: string,
  fallbackWeekEnding: string,
  creatorNames: Record<string, string>,
) {
  const submittedAtIso = toIsoString(tc?.submittedAt)
  const nameParts = deriveEmployeeNameParts(tc)
  const weekStart = String(tc?.weekStartDate || '').trim() || getWeekStartFromWeekEnding(String(tc?.weekEndingDate || '').trim()) || fallbackWeekStart
  const weekEnding = String(tc?.weekEndingDate || '').trim() || getWeekEndingFromWeekStart(weekStart || fallbackWeekStart) || fallbackWeekEnding
  const createdByUid = String(tc?.createdByUid || '').trim()

  return {
    id: `${String(tc?.jobId || tc?.__jobId || '').trim()}:${String(tc?.id || '').trim()}`,
    timecardId: String(tc?.id || '').trim(),
    jobId: String(tc?.jobId || tc?.__jobId || '').trim(),
    jobName: String(tc?.__jobName || '').trim() || 'Unknown Job',
    jobCode: String(tc?.__jobCode || '').trim(),
    createdByUid,
    createdByName: creatorNames[createdByUid] || createdByUid || 'Unknown Creator',
    employeeNumber: String(tc?.employeeNumber || '').trim(),
    employeeName: nameParts.employeeName,
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    occupation: String(tc?.occupation || '').trim(),
    status: String(tc?.status || '').trim() === 'submitted' ? 'submitted' : 'draft',
    weekStart,
    weekEnding,
    totalHours: Math.round(toNumber(tc?.totals?.hoursTotal) * 100) / 100,
    totalProduction: Math.round(toNumber(tc?.totals?.productionTotal) * 100) / 100,
    totalLine: Math.round(toNumber(tc?.totals?.lineTotal) * 100) / 100,
    subcontractedEmployee: Boolean(tc?.subcontractedEmployee),
    submittedAt: submittedAtIso,
    submittedAtMs: submittedAtIso ? Date.parse(submittedAtIso) : null,
  }
}

function parseControllerTimecardFilters(data: any) {
  const startWeek = String(data?.startWeek || data?.weekStart || '').trim()
  const endWeek = String(data?.endWeek || startWeek).trim() || startWeek
  const startDate = parseDateOnly(startWeek)
  const endDate = parseDateOnly(endWeek)

  if (!startWeek) {
    throw new HttpsError('invalid-argument', ERROR_MESSAGES.WEEK_START_REQUIRED)
  }
  if (!startDate) {
    throw new HttpsError('invalid-argument', 'startWeek must use YYYY-MM-DD format')
  }
  if (!endDate) {
    throw new HttpsError('invalid-argument', 'endWeek must use YYYY-MM-DD format')
  }
  if (endDate.getTime() < startDate.getTime()) {
    throw new HttpsError('invalid-argument', 'endWeek must be on or after startWeek')
  }

  const subcontracted = String(data?.subcontracted || 'all').trim().toLowerCase()
  if (!['all', 'subcontracted', 'direct'].includes(subcontracted)) {
    throw new HttpsError('invalid-argument', 'subcontracted must be "all", "subcontracted", or "direct"')
  }

  const status = String(data?.status || 'all').trim().toLowerCase()
  if (!['all', 'submitted', 'draft'].includes(status)) {
    throw new HttpsError('invalid-argument', 'status must be "all", "submitted", or "draft"')
  }

  return {
    startWeek: formatDateOnly(startDate),
    endWeek: formatDateOnly(endDate),
    startWeekEnding: getWeekEndingFromWeekStart(formatDateOnly(startDate)),
    endWeekEnding: getWeekEndingFromWeekStart(formatDateOnly(endDate)),
    jobId: String(data?.jobId || '').trim(),
    trade: String(data?.trade || '').trim(),
    firstName: String(data?.firstName || '').trim(),
    lastName: String(data?.lastName || '').trim(),
    subcontracted: subcontracted as 'all' | 'subcontracted' | 'direct',
    status: status as 'all' | 'submitted' | 'draft',
  }
}

function rowMatchesControllerFilters(row: any, filters: ReturnType<typeof parseControllerTimecardFilters>) {
  const tradeNeedle = filters.trade.toLowerCase()
  const firstNameNeedle = filters.firstName.toLowerCase()
  const lastNameNeedle = filters.lastName.toLowerCase()

  if (filters.jobId && row.jobId !== filters.jobId) return false
  if (filters.status !== 'all' && row.status !== filters.status) return false
  if (filters.subcontracted === 'subcontracted' && !row.subcontractedEmployee) return false
  if (filters.subcontracted === 'direct' && row.subcontractedEmployee) return false
  if (tradeNeedle && !String(row.occupation || '').toLowerCase().includes(tradeNeedle)) return false
  if (firstNameNeedle && !String(row.firstName || '').toLowerCase().includes(firstNameNeedle)) return false
  if (lastNameNeedle && !String(row.lastName || '').toLowerCase().includes(lastNameNeedle)) return false
  return true
}

function sortControllerTimecardRows(a: any, b: any) {
  const weekCompare = String(a.weekStart || '').localeCompare(String(b.weekStart || ''))
  if (weekCompare !== 0) return weekCompare
  const jobCompare = String(a.jobName || '').localeCompare(String(b.jobName || ''))
  if (jobCompare !== 0) return jobCompare
  const employeeCompare = String(a.employeeName || '').localeCompare(String(b.employeeName || ''))
  if (employeeCompare !== 0) return employeeCompare
  return String(a.employeeNumber || '').localeCompare(String(b.employeeNumber || ''))
}

async function resolveControllerTargetJobs(jobId: string): Promise<Array<{ id: string; name: string; code: string }>> {
  if (jobId) {
    const jobSnap = await db.collection(COLLECTIONS.JOBS).doc(jobId).get()
    if (!jobSnap.exists) {
      throw new HttpsError('not-found', 'Job not found')
    }
    const data = jobSnap.data() || {}
    return [{
      id: jobId,
      name: String(data.name || 'Unknown Job').trim() || 'Unknown Job',
      code: String(data.number || data.code || '').trim(),
    }]
  }

  const jobsSnap = await db.collection(COLLECTIONS.JOBS).get()
  return jobsSnap.docs.map((doc) => {
    const data = doc.data() || {}
    return {
      id: doc.id,
      name: String(data.name || 'Unknown Job').trim() || 'Unknown Job',
      code: String(data.number || data.code || '').trim(),
    }
  })
}

async function queryControllerTimecards(filters: ReturnType<typeof parseControllerTimecardFilters>) {
  const targetJobs = await resolveControllerTargetJobs(filters.jobId)

  if (!targetJobs.length) {
    return {
      ...filters,
      jobName: 'All Jobs',
      jobCode: '',
      rows: [],
      exportTimecards: [],
    }
  }

  const timecardsByJob = await Promise.all(
    targetJobs.map(async (job) => {
      const jobCards = await listAllTimecardsForJobRange(job.id, filters.startWeek, filters.endWeek)
      return jobCards.map((tc: any) => ({
        ...tc,
        __jobId: job.id,
        __jobCode: job.code,
        __jobName: job.name,
      }))
    })
  )

  const creatorNames = await resolveCreatorNames(timecardsByJob.flat())

  const matchingEntries = timecardsByJob
    .flat()
    .map((tc) => ({
      source: tc,
      row: toControllerTimecardRow(tc, filters.startWeek, filters.endWeekEnding, creatorNames),
    }))
    .filter((entry) => rowMatchesControllerFilters(entry.row, filters))
    .sort((left, right) => sortControllerTimecardRows(left.row, right.row))

  const resolvedJob = filters.jobId ? targetJobs[0] : null

  return {
    ...filters,
    jobName: resolvedJob?.name || 'All Jobs',
    jobCode: resolvedJob?.code || '',
    rows: matchingEntries.map((entry) => entry.row),
    exportTimecards: matchingEntries.map((entry) => ({
      ...entry.source,
      weekStartDate: entry.row.weekStart,
      weekEndingDate: entry.row.weekEnding,
      firstName: entry.row.firstName,
      lastName: entry.row.lastName,
      employeeName: entry.row.employeeName,
      occupation: entry.row.occupation,
      subcontractedEmployee: entry.row.subcontractedEmployee,
      __jobCode: entry.row.jobCode,
      __jobName: entry.row.jobName,
      __jobId: entry.row.jobId,
    })),
  }
}

/**
 * List filtered weekly timecards across jobs for controller review.
 * Access: admin and controller roles
 */
export const listTimecardsForWeek = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', ERROR_MESSAGES.NOT_SIGNED_IN)
  }

  const user = await getUserProfile(request.auth.uid)
  assertActiveRoleUser(user, ['admin', 'controller'], 'Only active admins or controllers can perform this action')

  const filters = parseControllerTimecardFilters(request.data)

  try {
    const result = await queryControllerTimecards(filters)
    const rows = result.rows

    return {
      success: true,
      startWeek: result.startWeek,
      endWeek: result.endWeek,
      startWeekEnding: result.startWeekEnding,
      endWeekEnding: result.endWeekEnding,
      filters: {
        jobId: result.jobId,
        trade: result.trade,
        firstName: result.firstName,
        lastName: result.lastName,
        subcontracted: result.subcontracted,
        status: result.status,
      },
      totalCount: rows.length,
      submittedCount: rows.filter((row) => row.status === 'submitted').length,
      draftCount: rows.filter((row) => row.status === 'draft').length,
      totalHours: Math.round(rows.reduce((sum, row) => sum + toNumber(row.totalHours), 0) * 100) / 100,
      totalProduction: Math.round(rows.reduce((sum, row) => sum + toNumber(row.totalProduction), 0) * 100) / 100,
      totalLine: Math.round(rows.reduce((sum, row) => sum + toNumber(row.totalLine), 0) * 100) / 100,
      timecards: rows,
    }
  } catch (error: any) {
    console.error('[listTimecardsForWeek] Error', { filters, error })
    if (error instanceof HttpsError) throw error
    throw new HttpsError('internal', error?.message || 'Failed to load timecards')
  }
})

/**
 * Download filtered timecards as CSV or PDF.
 * Access: admin and controller roles
 */
export const downloadTimecardsForWeek = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', ERROR_MESSAGES.NOT_SIGNED_IN)
  }

  const user = await getUserProfile(request.auth.uid)
  assertActiveRoleUser(user, ['admin', 'controller'], 'Only active admins or controllers can perform this action')

  const filters = parseControllerTimecardFilters(request.data)
  const format = String(request.data?.format || '').trim().toLowerCase()
  if (format !== 'csv' && format !== 'pdf') {
    throw new HttpsError('invalid-argument', 'format must be either "csv" or "pdf"')
  }

  try {
    const result = await queryControllerTimecards(filters)
    if (!result.exportTimecards.length) {
      throw new HttpsError('not-found', 'No timecards found for the selected filters')
    }

    const normalizedTimecards = result.exportTimecards
      .map(normalizeTimecardForEmail)
      .filter((tc: any) => hasMeaningfulTimecard(tc))
      .sort((a: any, b: any) => {
        const weekCompare = String(a?.weekStartDate || '').localeCompare(String(b?.weekStartDate || ''))
        if (weekCompare !== 0) return weekCompare
        const jobCompare = String(a?.__jobName || '').localeCompare(String(b?.__jobName || ''))
        if (jobCompare !== 0) return jobCompare
        const nameA = String(a?.employeeName || '').toLowerCase()
        const nameB = String(b?.employeeName || '').toLowerCase()
        return nameA.localeCompare(nameB)
      })

    if (!normalizedTimecards.length) {
      throw new HttpsError('not-found', 'No timecards with export data found for the selected filters')
    }

    validatePdfCsvHourParity(normalizedTimecards)

    if (format === 'csv') {
      const csv = buildTimecardCsv(normalizedTimecards, result.startWeek, result.jobCode || undefined)
      return {
        success: true,
        format: 'csv',
        fileName: buildTimecardCsvFilename(result.startWeek, result.endWeek, result.jobCode || undefined),
        contentType: 'text/csv',
        contentBase64: Buffer.from(csv, 'utf-8').toString('base64'),
        weekStart: result.startWeek,
        weekEnding: result.endWeekEnding,
        startWeek: result.startWeek,
        endWeek: result.endWeek,
        startWeekEnding: result.startWeekEnding,
        endWeekEnding: result.endWeekEnding,
        timecardCount: normalizedTimecards.length,
      }
    }

    const submittedBy = await getUserDisplayName(request.auth.uid, request.auth.token.email)
    const pdfBuffer = await buildTimecardPdfBuffer({
      jobName: result.jobName,
      jobNumber: result.jobCode,
      submittedBy,
      weekStart: result.startWeek,
      timecards: normalizedTimecards,
    })

    return {
      success: true,
      format: 'pdf',
      fileName: buildTimecardPdfFilename(result.startWeek, result.endWeek, result.jobCode || undefined),
      contentType: 'application/pdf',
      contentBase64: pdfBuffer.toString('base64'),
      weekStart: result.startWeek,
      weekEnding: result.endWeekEnding,
      startWeek: result.startWeek,
      endWeek: result.endWeek,
      startWeekEnding: result.startWeekEnding,
      endWeekEnding: result.endWeekEnding,
      timecardCount: normalizedTimecards.length,
    }
  } catch (error: any) {
    console.error('[downloadTimecardsForWeek] Error', { filters, format, error })
    if (error instanceof HttpsError) throw error
    throw new HttpsError('internal', error?.message || 'Failed to download timecards')
  }
})

function buildTimecardCsv(timecards: any[], weekStart: string, defaultJobCode?: string): string {
  const headers = ['Employee Name', 'Employee Code', 'Job Code', 'DETAIL_DATE', 'Sub-Section', 'Activity Code', 'Cost Code', 'H_Hours', 'P_HOURS', '', '']
  const fixedDataRowCount = 108
  const blankRow = Array(headers.length).fill('')
  const rows: Array<Array<string | number>> = [headers, [...blankRow]]
  const fallbackDates = buildWeekDateRecord(weekStart)

  for (const tc of Array.isArray(timecards) ? timecards : []) {
    const lines = Array.isArray(tc?.lines) && tc.lines.length ? tc.lines : []
    const employeeName = formatPlexxisEmployeeName(tc)
    const employeeCode = String(tc?.employeeCode || tc?.employeeId || tc?.employeeNumber || '').trim()

    for (const line of lines) {
      const subSection = getLineSubSection(line)
      const activityCode = sanitizeActivityCode(getLineActivityCode(line), line, [
        String(line?.jobNumber || tc?.jobCode || tc?.__jobCode || defaultJobCode || '').trim(),
        String(tc?.employeeCode || tc?.employeeId || tc?.employeeNumber || '').trim(),
      ])
      const costCode = getLineCostCode(line)
      const rowJobCode = String(line?.jobNumber || tc?.jobCode || tc?.__jobCode || defaultJobCode || '').trim()
      for (const key of DAY_KEYS) {
        const dayHours = toNumber(line?.[key])
        const dayProduction = toNumber(line?.production?.[key])
        const hasData = dayHours > 0 || dayProduction > 0

        if (!hasData) continue

        rows.push([
          employeeName,
          employeeCode,
          rowJobCode,
          formatPlexxisDate(String(line?.dates?.[key] || fallbackDates[key] || tc?.weekEndingDate || '')),
          subSection,
          activityCode,
          costCode,
          formatPlexxisNumber(dayHours, true),
          formatPlexxisNumber(dayProduction, true),
          '',
          '',
        ])
      }
    }
  }

  while (rows.length < fixedDataRowCount + 1) {
    rows.push([...blankRow])
  }

  return rows
    .map((row) => row.map((value) => escapeCsvValue(value)).join(','))
    .join('\r\n')
}

function buildTimecardExportPeriodLabel(startWeek: string, endWeek?: string): string {
  const normalizedStartWeek = String(startWeek || '').trim()
  const normalizedEndWeek = String(endWeek || startWeek || '').trim() || normalizedStartWeek
  const startLabel = getWeekEndingFromWeekStart(normalizedStartWeek)
  const endLabel = getWeekEndingFromWeekStart(normalizedEndWeek)

  if (normalizedStartWeek && normalizedStartWeek === normalizedEndWeek) {
    return startLabel || normalizedStartWeek
  }

  if (startLabel && endLabel) {
    return `${startLabel}_to_${endLabel}`
  }

  return normalizedStartWeek === normalizedEndWeek
    ? normalizedStartWeek || 'timecards'
    : `${normalizedStartWeek || 'start'}_to_${normalizedEndWeek || 'end'}`
}

function buildTimecardCsvFilename(startWeek: string, endWeek?: string, jobCode?: string): string {
  const periodLabel = buildTimecardExportPeriodLabel(startWeek, endWeek)
  const normalizedJobCode = String(jobCode || '').trim()
  return normalizedJobCode ? `${periodLabel} ${normalizedJobCode}.csv` : `${periodLabel}.csv`
}

function buildTimecardPdfFilename(startWeek: string, endWeek?: string, jobCode?: string): string {
  const periodLabel = buildTimecardExportPeriodLabel(startWeek, endWeek)
  const normalizedJobCode = String(jobCode || '').trim()
  return normalizedJobCode ? `${periodLabel} ${normalizedJobCode}.pdf` : `${periodLabel}.pdf`
}

async function buildTimecardPdfBuffer(payload: {
  jobName?: string
  jobNumber?: string
  submittedBy?: string
  weekStart?: string
  timecards: any[]
}): Promise<Buffer> {
  // Use a true landscape page so the emailed PDF prints in the same orientation
  // as the legacy workbook instead of relying on rotated portrait content.
  const doc = new PDFDocument({ margin: 24, size: 'LETTER', layout: 'landscape' })
  const chunks: Buffer[] = []

  const monSatKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

  const safeText = (value: any) => String(value ?? '').trim() || '-'
  const fmt = (value: any, blankWhenZero = false) => {
    const numeric = toNumber(value)
    if (blankWhenZero && numeric === 0) return ''
    return numeric.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
  }
  const fmtWorkbookEntry = (value: any, decimals = 2, blankWhenZero = false) => {
    const numeric = toNumber(value)
    if (blankWhenZero && numeric === 0) return ''
    return numeric.toFixed(decimals)
  }
  const fmtWorkbookHoursTotal = (value: any, blankWhenZero = false) => {
    const numeric = toNumber(value)
    if (blankWhenZero && numeric === 0) return ''
    return numeric.toFixed(1)
  }
  const fmtWorkbookCost = (value: any, blankWhenZero = false) => {
    const numeric = toNumber(value)
    if (blankWhenZero && numeric === 0) return ''
    return numeric.toFixed(2)
  }
  const fmtWorkbookSummaryCost = (value: any, blankWhenZero = false) => {
    const numeric = toNumber(value)
    if (blankWhenZero && numeric === 0) return ''
    return numeric.toFixed(3)
  }
  const percentWidths = (total: number, weights: number[]) => {
    const sum = weights.reduce((s, w) => s + w, 0) || 1
    const widths = weights.map((w) => (total * w) / sum)
    const used = widths.slice(0, -1).reduce((s, v) => s + v, 0)
    widths[widths.length - 1] = Math.max(total - used, 0)
    return widths
  }

  const weekStartDate = payload.weekStart ? new Date(`${payload.weekStart}T00:00:00Z`) : null
  const weekEndDate = weekStartDate && !Number.isNaN(weekStartDate.getTime()) ? new Date(weekStartDate) : null
  if (weekEndDate) weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6)
  const weekEndingLabel = weekEndDate
    ? formatWeekEndingLabel(formatDateOnly(weekEndDate))
    : safeText(payload.weekStart)

  await new Promise<void>((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    doc.on('end', () => resolve())
    doc.on('error', (err) => reject(err))

    const sumWidths = (widths: number[], startIndex: number, endIndexExclusive: number) => (
      widths.slice(startIndex, endIndexExclusive).reduce((sum, current) => sum + current, 0)
    )

    const getColumnX = (x: number, colWidths: number[], index: number) => (
      x + sumWidths(colWidths, 0, index)
    )

    const drawCell = (
      x: number,
      y: number,
      width: number,
      height: number,
      text: string,
      options?: {
        bold?: boolean
        align?: 'left' | 'center' | 'right'
        fontSize?: number
        fontName?: 'Helvetica' | 'Helvetica-Bold' | 'Helvetica-Oblique'
        verticalAlign?: 'top' | 'middle'
        paddingX?: number
        paddingY?: number
        textOffsetY?: number
      },
    ) => {
      doc.lineWidth(0.5).strokeColor('#111111').rect(x, y, width, height).stroke()

      const paddingX = options?.paddingX ?? 1.2
      const paddingY = options?.paddingY ?? 1.2
      const fontSize = options?.fontSize ?? 6.0
      const lineHeight = fontSize * 1.15
      const textOffsetY = options?.textOffsetY ?? 0
      const textY = (options?.verticalAlign === 'middle'
        ? y + Math.max((height - lineHeight) / 2, paddingY)
        : y + paddingY) + textOffsetY

      doc
        .font(options?.fontName || (options?.bold ? 'Helvetica-Bold' : 'Helvetica'))
        .fontSize(fontSize)
        .fillColor('#111111')
        .text(text, x + paddingX, textY, {
          width: Math.max(width - (paddingX * 2), 0),
          height: Math.max(height - (paddingY * 2), 0),
          align: options?.align ?? 'center',
          ellipsis: true,
        })
    }

    const drawGridRow = (
      x: number,
      y: number,
      colWidths: number[],
      rowHeight: number,
      cells: string[],
      options?: {
        bold?: boolean
        align?: Array<'left' | 'center' | 'right'>
        fontSize?: number
        fontName?: 'Helvetica' | 'Helvetica-Bold' | 'Helvetica-Oblique'
      }
    ) => {
      let cx = x
      const aligns = options?.align || []
      doc.lineWidth(0.5).strokeColor('#111111')
      for (let i = 0; i < colWidths.length; i++) {
        const cellWidth = colWidths[i] || 0
        const text = cells[i] ?? ''
        const align = aligns[i] || 'center'
        drawCell(cx, y, cellWidth, rowHeight, text, {
          bold: options?.bold,
          fontSize: options?.fontSize,
          fontName: options?.fontName,
          align,
          verticalAlign: 'middle',
        })
        cx += cellWidth
      }
    }

    const drawWorkbookDaySeparators = (
      x: number,
      yTop: number,
      yBottom: number,
      colWidths: number[],
    ) => {
      const separatorIndexes = [6, 7, 8, 9, 10]
      separatorIndexes.forEach((index) => {
        const separatorX = getColumnX(x, colWidths, index)
        doc.save()
        doc
          .lineWidth(1.1)
          .strokeColor('#ffffff')
          .moveTo(separatorX, yTop)
          .lineTo(separatorX, yBottom)
          .stroke()
        doc
          .dash(1.2, { space: 1.1 })
          .lineWidth(0.5)
          .strokeColor('#111111')
          .moveTo(separatorX, yTop)
          .lineTo(separatorX, yBottom)
          .stroke()
          .undash()
        doc.restore()
      })
    }

    const drawUnderlinedField = (
      x: number,
      y: number,
      width: number,
      rowHeight: number,
      label: string,
      value: string,
      align: 'left' | 'right' = 'left',
    ) => {
      const normalizedLabel = String(label || '').trim()
      const normalizedValue = String(value || '').trim()
      const labelInset = 2
      const labelFontSize = 6.8
      const valueFontSize = 7.0
      if (!normalizedLabel && !normalizedValue) return
      doc.font('Helvetica-Oblique').fontSize(labelFontSize)
      const labelWidth = normalizedLabel
        ? Math.min(doc.widthOfString(normalizedLabel) + 8, width * 0.42)
        : 12
      const lineStart = x + Math.max(labelWidth + labelInset, 18)
      const lineEnd = x + width - 2
      const lineY = y + rowHeight - 3

      if (normalizedLabel) {
        doc
          .font('Helvetica-Oblique')
          .fontSize(labelFontSize)
          .fillColor('#111111')
          .text(normalizedLabel, x + labelInset, y + 2, {
            width: Math.max(labelWidth - labelInset, 0),
            align: 'left',
            ellipsis: true,
          })
      }

      if (lineStart < lineEnd) {
        doc.moveTo(lineStart, lineY).lineTo(lineEnd, lineY).stroke()
      }

      if (normalizedValue) {
        doc
          .font('Helvetica-Bold')
          .fontSize(valueFontSize)
          .fillColor('#111111')
          .text(normalizedValue, lineStart + 2, y + 2, {
            width: Math.max(lineEnd - lineStart - 2, 0),
            align,
            ellipsis: true,
          })
      }
    }

    const drawWorkbookGroupCell = (
      x: number,
      y: number,
      width: number,
      rowHeight: number,
      values: string[],
      options?: {
        fontSize?: number
        align?: 'left' | 'center' | 'right'
        paddingX?: number
      },
    ) => {
      const groupHeight = rowHeight * 3
      drawCell(x, y, width, groupHeight, '', {
        fontSize: options?.fontSize,
        align: options?.align ?? 'center',
        verticalAlign: 'middle',
      })

      const fontSize = options?.fontSize ?? 5.8
      const align = options?.align ?? 'right'
      const paddingX = options?.paddingX ?? 1.6
      const lineInsetY = Math.max((rowHeight - fontSize) / 2, 0.9)

      values.forEach((value, index) => {
        if (!value) return
        doc
          .font('Helvetica')
          .fontSize(fontSize)
          .fillColor('#111111')
          .text(value, x + paddingX, y + (rowHeight * index) + lineInsetY, {
            width: Math.max(width - (paddingX * 2), 0),
            align,
            ellipsis: true,
          })
      })
    }

    const drawFooterUnderlinedValue = (
      x: number,
      y: number,
      width: number,
      rowHeight: number,
      label: string,
      value: string,
      options?: {
        valueOffsetY?: number
      },
    ) => {
      const labelInset = 2
      const labelFontSize = 5.8
      const valueFontSize = 6.2
      doc.font('Helvetica').fontSize(labelFontSize)
      const labelWidth = Math.max(doc.widthOfString(label) + 5, 16)
      const lineStart = x + labelWidth + labelInset
      const lineEnd = x + width - 2
      const lineY = y + rowHeight - 2.2

      doc
        .font('Helvetica')
        .fontSize(labelFontSize)
        .fillColor('#111111')
        .text(label, x + labelInset, y + 1.4, {
          width: Math.max(labelWidth, 0),
          align: 'left',
          ellipsis: true,
        })

      if (lineStart < lineEnd) {
        doc.moveTo(lineStart, lineY).lineTo(lineEnd, lineY).stroke()
      }

      if (value) {
        const valueOffsetY = options?.valueOffsetY ?? 0
        doc
          .font('Helvetica')
          .fontSize(valueFontSize)
          .fillColor('#111111')
          .text(value, lineStart + 2, y + 1.1 + valueOffsetY, {
            width: Math.max(lineEnd - lineStart - 2, 0),
            align: 'center',
            ellipsis: true,
          })
      }
    }

    const drawHeaderFieldRow = (
      x: number,
      y: number,
      width: number,
      rowHeight: number,
      leftField: { label: string; value: string },
      rightField: { label: string; value: string },
    ) => {
      const leftWidth = Math.round(width * 0.62 * 1000) / 1000
      drawUnderlinedField(x, y, leftWidth, rowHeight, leftField.label, leftField.value, 'left')
      drawUnderlinedField(x + leftWidth, y, width - leftWidth, rowHeight, rightField.label, rightField.value, 'right')
    }

    const drawTimecardCard = (tc: any, x: number, y: number, width: number, height: number, renderBlankTemplate = false) => {
      const pad = 6
      const innerX = x + pad
      const innerY = y + pad
      const innerWidth = width - pad * 2
      const innerHeight = height - pad * 2
      const bottom = y + height - pad

      doc.lineWidth(1).strokeColor('#111111').rect(x, y, width, height).stroke()

      let cursorY = innerY
      doc
        .font('Helvetica')
        .fontSize(9.8)
        .fillColor('#111111')
        .text('PHASE 2 COMPANY', innerX, cursorY, { width: innerWidth, align: 'center' })
      cursorY += 14

      const employeeName = renderBlankTemplate ? '' : String(tc?.employeeName || '').trim()
      const employeeCode = renderBlankTemplate ? '' : String(tc?.employeeCode || tc?.employeeId || tc?.employeeNumber || '').trim()
      const occupation = renderBlankTemplate ? '' : String(tc?.occupation || '').trim()
      const wageNumeric = toNumber(tc?.employeeWage ?? tc?.wage)
      const wageSource = tc?.employeeWage ?? tc?.wage ?? ''
      const wageLabel = renderBlankTemplate ? '' : (wageNumeric > 0 ? `$${wageNumeric.toFixed(2)}` : (String(wageSource).trim() || '-'))
      const cardWeekEnding = String(tc?.weekEndingDate || '').trim()
        || getWeekEndingFromWeekStart(String(tc?.weekStartDate || '').trim())
      const weekEnding = renderBlankTemplate ? '' : formatWeekEndingLabel(cardWeekEnding) || weekEndingLabel

      const fieldRowHeight = 11.5
      drawHeaderFieldRow(innerX, cursorY, innerWidth, fieldRowHeight, {
        label: 'EMP. NAME:',
        value: employeeName,
      }, {
        label: 'EMPLOYEE#',
        value: employeeCode,
      })
      cursorY += fieldRowHeight
      drawHeaderFieldRow(innerX, cursorY, innerWidth, fieldRowHeight, {
        label: 'OCCUPATION:',
        value: occupation,
      }, {
        label: 'Wage',
        value: wageLabel,
      })
      cursorY += fieldRowHeight
      drawHeaderFieldRow(innerX, cursorY, innerWidth, fieldRowHeight, {
        label: '',
        value: '',
      }, {
        label: 'WEEK ENDING',
        value: weekEnding,
      })
      cursorY += fieldRowHeight + 2

      const footerHeight = 98
      const gridTop = cursorY
      const gridBottom = Math.max(gridTop + 30, innerY + innerHeight - footerHeight)
      const gridHeight = Math.max(gridBottom - gridTop, 30)
      const tableHeaderHeight = 11
      const maxLineGroups = 13
      const rowHeight = Math.max(5.5, (gridHeight - tableHeaderHeight) / (maxLineGroups * 3))
      const lineGroupHeight = rowHeight * 3
      const columnWidths = percentWidths(innerWidth, [11.5, 5.5, 4, 9.5, 5.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 8.5, 8.5, 8.5])
      const detailFontSize = rowHeight >= 6.25 ? 5.8 : 4.9
      const costFontSize = rowHeight >= 6.25 ? 5.5 : 4.6

      drawGridRow(
        innerX,
        gridTop,
        columnWidths,
        tableHeaderHeight,
        ['JOB #', '1', '', 'ACCT', 'DIF', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'TOTAL', 'PROD', 'OFF'],
        {
          fontSize: rowHeight >= 6.25 ? 5.9 : 5.1,
          fontName: 'Helvetica-Oblique',
          align: ['left', 'center', 'center', 'left', 'center', 'center', 'center', 'center', 'center', 'center', 'center', 'center', 'center', 'center'],
        }
      )
      let cursorDataY = gridTop + tableHeaderHeight
      const lines = renderBlankTemplate ? [] : (Array.isArray(tc?.lines) ? tc.lines.filter((line: any) => hasMeaningfulLineDataForPdf(line)) : [])
      const employeeWage = toNumber(tc?.employeeWage ?? tc?.wage)

      for (let lineIndex = 0; lineIndex < maxLineGroups; lineIndex++) {
        const line = lines[lineIndex]
        const hasLine = !!line
        const jobCode = hasLine ? String(line?.jobNumber || tc?.jobCode || tc?.__jobCode || '').trim() : ''
        const account = hasLine
          ? sanitizeActivityCode(getLineActivityCode(line), line, [
            jobCode,
            String(tc?.employeeCode || tc?.employeeId || tc?.employeeNumber || '').trim(),
          ])
          : ''
        const lineHoursTotal = hasLine ? getLineTotalHoursForForm(line) : 0
        const lineProdTotal = hasLine ? getLineTotalProductionForForm(line) : 0
        const lineCostTotal = hasLine ? getLineTotalCostForForm(line, employeeWage, tc?.productionBurden) : 0
        const offHours = hasLine ? getLineOffHours(line) : 0
        const offProduction = hasLine ? getLineOffProduction(line) : 0
        const offCost = hasLine ? getLineOffCost(line) : 0
        const subsectionArea = hasLine ? String(line?.subsectionArea || line?.area || '').trim() : ''
        const groupHeight = rowHeight * 3
        const mergedColumns = [
          { index: 0, text: jobCode, align: 'center' as const },
          { index: 1, text: subsectionArea, align: 'center' as const },
          { index: 3, text: account, align: 'center' as const },
        ]
        for (const column of mergedColumns) {
          drawCell(
            getColumnX(innerX, columnWidths, column.index),
            cursorDataY,
            columnWidths[column.index] || 0,
            groupHeight,
            column.text,
            {
              fontSize: detailFontSize,
              align: column.align,
              verticalAlign: 'middle',
            },
          )
        }

        const rowDefinitions = [
          {
            label: 'H',
            diff: hasLine ? String(line?.difH || '').trim() : '',
            dayValues: monSatKeys.map((key) => fmtWorkbookEntry(line?.[key], 2, true)),
            fontSize: detailFontSize,
          },
          {
            label: 'P',
            diff: hasLine ? String(line?.difP || '').trim() : '',
            dayValues: monSatKeys.map((key) => fmtWorkbookEntry(line?.production?.[key], 2, true)),
            fontSize: detailFontSize,
          },
          {
            label: 'C',
            diff: hasLine ? String(line?.difC || '').trim() : '',
            dayValues: monSatKeys.map((key) => fmtWorkbookCost(line?.unitCost?.[key], true)),
            fontSize: costFontSize,
          },
        ]

        rowDefinitions.forEach((rowDef, rowIndex) => {
          const rowY = cursorDataY + (rowIndex * rowHeight)
          drawCell(
            getColumnX(innerX, columnWidths, 2),
            rowY,
            columnWidths[2] || 0,
            rowHeight,
            rowDef.label,
            {
              bold: true,
              fontSize: detailFontSize,
              align: 'center',
              verticalAlign: 'middle',
            },
          )
          drawCell(
            getColumnX(innerX, columnWidths, 4),
            rowY,
            columnWidths[4] || 0,
            rowHeight,
            rowDef.diff,
            {
              fontSize: rowDef.fontSize,
              align: 'center',
              verticalAlign: 'middle',
            },
          )

        })

        monSatKeys.forEach((key, dayOffset) => {
          const columnIndex = 5 + dayOffset
          drawWorkbookGroupCell(
            getColumnX(innerX, columnWidths, columnIndex),
            cursorDataY,
            columnWidths[columnIndex] || 0,
            rowHeight,
            [
              fmtWorkbookEntry(line?.[key], 2, true),
              fmtWorkbookEntry(line?.production?.[key], 2, true),
              fmtWorkbookCost(line?.unitCost?.[key], true),
            ],
            {
              fontSize: detailFontSize,
              align: 'center',
              paddingX: 1.6,
            },
          )
        })

        drawWorkbookGroupCell(
          getColumnX(innerX, columnWidths, 11),
          cursorDataY,
          columnWidths[11] || 0,
          rowHeight,
          [
            hasLine ? fmtWorkbookHoursTotal(lineHoursTotal, true) : '',
            '',
            '',
          ],
          {
            fontSize: detailFontSize,
            align: 'center',
            paddingX: 1.6,
          },
        )
        drawWorkbookGroupCell(
          getColumnX(innerX, columnWidths, 12),
          cursorDataY,
          columnWidths[12] || 0,
          rowHeight,
          [
            '',
            hasLine ? fmt(lineProdTotal, true) : '',
            hasLine ? fmtWorkbookSummaryCost(lineCostTotal, true) : '',
          ],
          {
            fontSize: detailFontSize,
            align: 'center',
            paddingX: 1.6,
          },
        )
        drawWorkbookGroupCell(
          getColumnX(innerX, columnWidths, 13),
          cursorDataY,
          columnWidths[13] || 0,
          rowHeight,
          [
            hasLine ? fmtWorkbookHoursTotal(offHours, true) : '',
            hasLine ? fmt(offProduction, true) : '',
            hasLine ? fmtWorkbookCost(offCost, true) : '',
          ],
          {
            fontSize: detailFontSize,
            align: 'center',
            paddingX: 1.6,
          },
        )

        cursorDataY += groupHeight
      }

      const footerTop = gridTop + tableHeaderHeight + (maxLineGroups * lineGroupHeight)
      const mondayHours = lines.reduce((sum: number, line: any) => sum + toNumber(line?.mon), 0)
      const tuesdayHours = lines.reduce((sum: number, line: any) => sum + toNumber(line?.tue), 0)
      const wednesdayHours = lines.reduce((sum: number, line: any) => sum + toNumber(line?.wed), 0)
      const thursdayHours = lines.reduce((sum: number, line: any) => sum + toNumber(line?.thu), 0)
      const fridayHours = lines.reduce((sum: number, line: any) => sum + toNumber(line?.fri), 0)
      const saturdayHours = lines.reduce((sum: number, line: any) => sum + toNumber(line?.sat), 0)
      const weekTotalHours = mondayHours + tuesdayHours + wednesdayHours + thursdayHours + fridayHours + saturdayHours

      const totalsRowHeight = 11
      drawWorkbookDaySeparators(innerX, gridTop + tableHeaderHeight, footerTop + totalsRowHeight, columnWidths)
      drawCell(innerX, footerTop, sumWidths(columnWidths, 0, 5), totalsRowHeight, 'TOTAL HOURS', {
        bold: true,
        fontSize: 5.8,
        align: 'right',
        verticalAlign: 'middle',
        paddingX: 4,
        textOffsetY: 0.45,
      })
      ;[
        mondayHours,
        tuesdayHours,
        wednesdayHours,
        thursdayHours,
        fridayHours,
        saturdayHours,
      ].forEach((dayTotal, dayOffset) => {
        const columnIndex = 5 + dayOffset
        drawCell(
          getColumnX(innerX, columnWidths, columnIndex),
          footerTop,
          columnWidths[columnIndex] || 0,
          totalsRowHeight,
          fmtWorkbookHoursTotal(dayTotal, true),
          {
            bold: true,
            fontSize: 5.8,
            align: 'center',
            verticalAlign: 'middle',
            paddingX: 1.2,
            textOffsetY: 0.45,
          },
        )
      })
      drawCell(
        getColumnX(innerX, columnWidths, 11),
        footerTop,
        columnWidths[11] || 0,
        totalsRowHeight,
        fmtWorkbookHoursTotal(weekTotalHours, true),
        {
          bold: true,
          fontSize: 5.8,
          align: 'center',
          verticalAlign: 'middle',
          paddingX: 1.2,
          textOffsetY: 0.45,
        },
      )
      drawCell(getColumnX(innerX, columnWidths, 12), footerTop, columnWidths[12] || 0, totalsRowHeight, '', { bold: true })
      drawCell(getColumnX(innerX, columnWidths, 13), footerTop, columnWidths[13] || 0, totalsRowHeight, '', { bold: true })

      const totalHoursForFooter = Math.max(0, toNumber(weekTotalHours))
      const regularOverride = toNumber(tc?.regularHoursOverride)
      const overtimeOverride = toNumber(tc?.overtimeHoursOverride)
      const hasRegularOverride = tc?.regularHoursOverride != null && tc?.regularHoursOverride !== ''
      const hasOvertimeOverride = tc?.overtimeHoursOverride != null && tc?.overtimeHoursOverride !== ''

      let otHours = ''
      let regHours = ''
      if (!renderBlankTemplate) {
        if (hasRegularOverride || hasOvertimeOverride) {
          regHours = hasRegularOverride ? fmt(regularOverride, true) : ''
          otHours = hasOvertimeOverride ? fmt(overtimeOverride, true) : ''
        } else if (totalHoursForFooter <= 40) {
          regHours = totalHoursForFooter > 0 ? fmt(totalHoursForFooter) : ''
        } else {
          regHours = fmt(40)
          otHours = fmt(totalHoursForFooter - 40, true)
        }
      }

      const footerSectionGap = 8
      const footerLabelRowY = footerTop + totalsRowHeight + footerSectionGap
      const footerLabelRowHeight = 6
      const footerInputRowY = footerLabelRowY + footerLabelRowHeight
      const footerInputRowHeight = 9
      const footerSecondRowY = footerInputRowY + footerInputRowHeight
      const footerFields = [
        {
          label: 'JOB or GL',
          value: safeText(renderBlankTemplate ? '' : tc?.footerJobOrGl).replace(/^-\s*$/, ''),
          start: 0,
          end: 2,
        },
        {
          label: 'ACCT',
          value: safeText(renderBlankTemplate ? '' : tc?.footerAccount).replace(/^-\s*$/, ''),
          start: 2,
          end: 4,
        },
        {
          label: 'OFFICE',
          value: safeText(renderBlankTemplate ? '' : tc?.footerOffice).replace(/^-\s*$/, ''),
          start: 4,
          end: 6,
        },
        {
          label: 'AMT',
          value: safeText(renderBlankTemplate ? '' : tc?.footerAmount).replace(/^-\s*$/, ''),
          start: 6,
          end: 8,
        },
      ]

      footerFields.forEach((field) => {
        const fieldX = getColumnX(innerX, columnWidths, field.start)
        const fieldWidth = sumWidths(columnWidths, field.start, field.end)
        doc
          .font('Helvetica')
          .fontSize(5.4)
          .fillColor('#111111')
          .text(field.label, fieldX, footerLabelRowY + 0.5, {
            width: fieldWidth,
            align: 'center',
            ellipsis: true,
          })
        drawCell(fieldX, footerInputRowY, fieldWidth, footerInputRowHeight, field.value, {
          fontSize: 6.0,
          align: 'center',
          verticalAlign: 'middle',
        })
        drawCell(fieldX, footerSecondRowY, fieldWidth, footerInputRowHeight, '', {
          fontSize: 6.0,
          align: 'center',
          verticalAlign: 'middle',
        })
      })

      const otRegX = getColumnX(innerX, columnWidths, 10)
      const otRegWidth = sumWidths(columnWidths, 10, 12)
      const otRegRowHeight = 8.5
      drawFooterUnderlinedValue(otRegX, footerLabelRowY + 0.8, otRegWidth, otRegRowHeight, 'OT', otHours, {
        valueOffsetY: -0.45,
      })
      drawFooterUnderlinedValue(otRegX, footerSecondRowY + 1.2, otRegWidth, otRegRowHeight, 'REG', regHours, {
        valueOffsetY: -0.45,
      })

      const notesY = Math.max(footerSecondRowY + footerInputRowHeight + 12, bottom - 18)
      const notesLabel = 'NOTES:'
      doc.font('Helvetica-Bold').fontSize(6.6)
      const notesLabelWidth = Math.max(doc.widthOfString(notesLabel) + 6, 34)
      doc
        .font('Helvetica-Bold')
        .fontSize(6.6)
        .fillColor('#111111')
        .text(notesLabel, innerX + 2, notesY, {
          width: notesLabelWidth,
          align: 'left',
          ellipsis: true,
        })
      const notesLineStart = innerX + notesLabelWidth + 2
      const notesLineEnd = innerX + innerWidth - 2
      const notesLineY = notesY + 7
      if (notesLineStart < notesLineEnd) {
        doc.moveTo(notesLineStart, notesLineY).lineTo(notesLineEnd, notesLineY).stroke()
      }
      const notesText = renderBlankTemplate ? '' : String(tc?.notes || '').trim()
      if (notesText) {
        doc
          .font('Helvetica')
          .fontSize(6.2)
          .fillColor('#111111')
          .text(notesText, notesLineStart + 2, notesY - 1, {
            width: Math.max(notesLineEnd - notesLineStart - 2, 0),
            height: Math.max(bottom - notesY - 2, 10),
            align: 'left',
            ellipsis: true,
          })
      }
    }

    const timecards = (Array.isArray(payload.timecards) ? payload.timecards : []).filter((tc) => hasMeaningfulTimecard(tc))
    const pageWidth = doc.page.width
    const pageHeight = doc.page.height
    const marginLeft = doc.page.margins.left || 24
    const marginTop = doc.page.margins.top || 24
    const marginRight = doc.page.margins.right || 24
    const marginBottom = doc.page.margins.bottom || 24
    const contentLeft = marginLeft
    const contentTop = marginTop
    const contentWidth = pageWidth - marginLeft - marginRight
    const contentHeight = pageHeight - marginTop - marginBottom
    const columnGap = 10
    const cardWidth = (contentWidth - columnGap) / 2

    if (!timecards.length) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#111111')
        .text('No submitted timecards found.', contentLeft, contentTop)
      doc.end()
      return
    }

    const cardTop = contentTop
    const cardHeight = contentHeight

    for (let idx = 0; idx < timecards.length; idx += 2) {
      if (idx > 0) doc.addPage()

      const leftX = contentLeft
      const rightX = contentLeft + cardWidth + columnGap
      drawTimecardCard(timecards[idx], leftX, cardTop, cardWidth, cardHeight, false)

      if (idx + 1 < timecards.length) {
        drawTimecardCard(timecards[idx + 1], rightX, cardTop, cardWidth, cardHeight, false)
      }
    }

    doc.end()
  })

  return Buffer.concat(chunks)
}

/**
 * Send Shop Order via email
 */
export const sendShopOrderEmail = onCall({ secrets: [graphClientId, graphTenantId, graphClientSecret, outlookSenderEmail] }, async (request) => {
  if (!request.auth) {
    throw new Error(ERROR_MESSAGES.NOT_SIGNED_IN)
  }

  const { jobId, shopOrderId } = request.data

  if (!jobId) {
    throw new Error(ERROR_MESSAGES.JOB_ID_REQUIRED)
  }
  if (!shopOrderId) {
    throw new Error(ERROR_MESSAGES.SHOP_ORDER_ID_REQUIRED)
  }

  try {
    const user = await getUserProfile(request.auth.uid)
    assertAdminOrAssignedForeman(
      user,
      jobId,
      'Only admins or assigned foremen can send shop order emails'
    )

    if (!isEmailEnabled()) {
      console.log('[sendShopOrderEmail] Email sending disabled. Skipping send.')
      return { success: true, message: 'Email sending disabled. Skipped.' }
    }

    const settings = await getEmailSettings()
    const recipients = normalizeRecipients(settings.shopOrderSubmitRecipients)
    if (!recipients.length) {
      throw new HttpsError('failed-precondition', ERROR_MESSAGES.RECIPIENTS_REQUIRED)
    }

    let order: any = null

    // Primary: job-scoped collection (jobs/{jobId}/shop_orders/{shopOrderId})
    const jobOrderSnap = await db.collection(COLLECTIONS.JOBS).doc(jobId).collection('shop_orders').doc(shopOrderId).get()
    if (jobOrderSnap.exists) {
      order = { id: jobOrderSnap.id, ...jobOrderSnap.data(), jobId }
    } else {
      // Fallback to legacy root collection (shopOrders)
      order = await getShopOrder(shopOrderId)
    }

    if (!order) {
      throw new Error(ERROR_MESSAGES.SHOP_ORDER_NOT_FOUND)
    }
    const resolvedJobId = String(order?.jobId || jobId).trim()
    if (resolvedJobId && resolvedJobId !== String(jobId).trim()) {
      throw new HttpsError('permission-denied', 'Shop order does not belong to the requested job')
    }

    const job = await getJobDetails(resolvedJobId || jobId)

    const emailHtml = buildShopOrderEmail(order)

    const orderDateLabel = formatEmailDate(order?.orderDate || order?.createdAt || order?.updatedAt)

    await sendEmail({
      to: recipients,
      subject: `${EMAIL.SUBJECTS.SHOP_ORDER} - ${job?.name || 'Job'} - ${orderDateLabel}`,
      html: emailHtml,
    })

    console.log(`Shop order ${shopOrderId} emailed to ${recipients.join(', ')}`)
    return { success: true, message: 'Email sent successfully' }
  } catch (error: any) {
    console.error('Error sending shop order email:', error)
    if (error instanceof HttpsError) throw error
    throw new HttpsError('internal', error?.message || 'Failed to send shop order email')
  }
})



/**
 * Internal helper to send daily log email (used by scheduled function)
 */
async function sendDailyLogEmailInternal(jobId: string, dailyLogId: string, recipients: string[]) {
  if (!isEmailEnabled()) {
    console.log('[sendDailyLogEmailInternal] Email sending disabled. Skipping send.')
    return
  }

  const log = await getDailyLog(jobId, dailyLogId)
  if (!log) {
    throw new Error(ERROR_MESSAGES.DAILY_LOG_NOT_FOUND)
  }

  const job = await getJobDetails(log?.jobId || '')
  const emailHtml = buildDailyLogAutoSubmitEmail(job || { id: '', name: 'Unknown Job', number: '' }, log?.logDate || new Date().toISOString())
  const attachments = await loadDailyLogAttachments(log)

  await sendEmail({
    to: recipients,
    subject: `${EMAIL.SUBJECTS.DAILY_LOG_AUTO} - ${job?.name || 'Job'} - ${log?.logDate || 'N/A'}`,
    html: emailHtml,
    ...(attachments.length ? { attachments } : {}),
  })
}

async function removeEmailFromRecipientLists(email: string): Promise<{ settingsUpdated: boolean; jobsUpdated: number }> {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!normalizedEmail) {
    return { settingsUpdated: false, jobsUpdated: 0 }
  }

  let settingsUpdated = false
  let jobsUpdated = 0

  const settingsRef = db.collection('settings').doc('email')
  const settingsSnap = await settingsRef.get()
  if (settingsSnap.exists) {
    const data = settingsSnap.data() || {}
    const filterRecipientList = (values: any): string[] => {
      const list = Array.isArray(values) ? values : []
      return list.filter((value: any) => String(value || '').trim().toLowerCase() !== normalizedEmail)
    }

    const nextTimecard = filterRecipientList(data.timecardSubmitRecipients)
    const nextShopOrder = filterRecipientList(data.shopOrderSubmitRecipients)
    const nextDailyLog = filterRecipientList(data.dailyLogSubmitRecipients)

    const changed =
      nextTimecard.length !== (Array.isArray(data.timecardSubmitRecipients) ? data.timecardSubmitRecipients.length : 0) ||
      nextShopOrder.length !== (Array.isArray(data.shopOrderSubmitRecipients) ? data.shopOrderSubmitRecipients.length : 0) ||
      nextDailyLog.length !== (Array.isArray(data.dailyLogSubmitRecipients) ? data.dailyLogSubmitRecipients.length : 0)

    if (changed) {
      await settingsRef.set(
        {
          timecardSubmitRecipients: nextTimecard,
          shopOrderSubmitRecipients: nextShopOrder,
          dailyLogSubmitRecipients: nextDailyLog,
        },
        { merge: true }
      )
      settingsUpdated = true
    }
  }

  const jobsSnap = await db.collection(COLLECTIONS.JOBS).get()
  const batch = db.batch()
  jobsSnap.docs.forEach((jobDoc) => {
    const currentRecipients = Array.isArray(jobDoc.data()?.dailyLogRecipients)
      ? jobDoc.data().dailyLogRecipients
      : []
    if (!currentRecipients.length) return

    const nextRecipients = currentRecipients.filter(
      (value: any) => String(value || '').trim().toLowerCase() !== normalizedEmail
    )

    if (nextRecipients.length !== currentRecipients.length) {
      batch.update(jobDoc.ref, { dailyLogRecipients: nextRecipients })
      jobsUpdated += 1
    }
  })

  if (jobsUpdated > 0) {
    await batch.commit()
  }

  return { settingsUpdated, jobsUpdated }
}

export const removeEmailFromAllRecipientLists = onCall(async (request) => {
  if (!request.auth) {
    throw new Error(ERROR_MESSAGES.NOT_SIGNED_IN)
  }

  await verifyAdminRole(request.auth.uid)

  const rawEmail = String(request.data?.email || '').trim()
  if (!rawEmail) {
    throw new Error(ERROR_MESSAGES.EMAIL_REQUIRED)
  }

  const cleanup = await removeEmailFromRecipientLists(rawEmail)
  return {
    success: true,
    message: 'Recipient cleanup completed',
    removedFromRecipientLists: cleanup.settingsUpdated || cleanup.jobsUpdated > 0,
    updatedJobCount: cleanup.jobsUpdated,
  }
})

export const handleUserAccessRevocationCleanup = onDocumentUpdated('users/{uid}', async (event) => {
  const beforeData = event.data?.before?.data()
  const afterData = event.data?.after?.data()

  if (!afterData) return

  const beforeRole = String(beforeData?.role || '').trim().toLowerCase()
  const afterRole = String(afterData?.role || '').trim().toLowerCase()
  const beforeActive = typeof beforeData?.active === 'boolean' ? beforeData.active : true
  const afterActive = typeof afterData?.active === 'boolean' ? afterData.active : true

  const changedToNoneRole = beforeRole !== afterRole && afterRole === 'none'
  const changedToInactive = beforeActive !== afterActive && afterActive === false
  const roleChangedWhileInactive = beforeRole !== afterRole && afterActive === false

  if (!changedToNoneRole && !changedToInactive && !roleChangedWhileInactive) {
    return
  }

  const email = String(afterData?.email || beforeData?.email || '').trim()
  if (!email) return

  try {
    const cleanup = await removeEmailFromRecipientLists(email)
    console.log('[handleUserAccessRevocationCleanup] Recipient cleanup complete', {
      uid: event.params.uid,
      email,
      reason: {
        changedToNoneRole,
        changedToInactive,
        roleChangedWhileInactive,
      },
      settingsUpdated: cleanup.settingsUpdated,
      jobsUpdated: cleanup.jobsUpdated,
    })
  } catch (error) {
    console.error('[handleUserAccessRevocationCleanup] Recipient cleanup failed', {
      uid: event.params.uid,
      email,
      error,
    })
  }
})

/**
 * Delete a user from both Firestore and Firebase Authentication
 * Only callable by authenticated admin users
 */
export const deleteUser = onCall(async (request) => {
  if (!request.auth) {
    throw new Error(ERROR_MESSAGES.NOT_SIGNED_IN_DELETE)
  }

  const { uid } = request.data

  if (!uid) {
    throw new Error(ERROR_MESSAGES.UID_REQUIRED)
  }

  try {
    await verifyAdminRole(request.auth.uid)

    const userDocRef = db.collection(COLLECTIONS.USERS).doc(uid)
    const userDocSnap = await userDocRef.get()

    let authEmail = ''
    try {
      const authUser = await auth.getUser(uid)
      authEmail = String(authUser.email || '').trim()
    } catch (lookupError) {
      console.warn('[deleteUser] Unable to load auth user before delete', { uid, lookupError })
    }

    const firestoreEmail = String(userDocSnap.data()?.email || '').trim()
    const candidateEmails = Array.from(new Set([authEmail, firestoreEmail].filter(Boolean)))

    let settingsUpdated = false
    let jobsUpdated = 0
    for (const candidateEmail of candidateEmails) {
      const cleanup = await removeEmailFromRecipientLists(candidateEmail)
      settingsUpdated = settingsUpdated || cleanup.settingsUpdated
      jobsUpdated += cleanup.jobsUpdated
    }

    // Delete from Firebase Auth
    await auth.deleteUser(uid)

    // Delete from Firestore
    await userDocRef.delete()

    console.log('[deleteUser] Offboarding cleanup complete', {
      uid,
      candidateEmails,
      settingsUpdated,
      jobsUpdated,
    })

    return {
      success: true,
      message: 'User deleted successfully',
      removedFromRecipientLists: settingsUpdated || jobsUpdated > 0,
      updatedJobCount: jobsUpdated,
    }
  } catch (error: any) {
    throw new Error(error.message || ERROR_MESSAGES.FAILED_TO_DELETE_USER)
  }
})

/**
 * Create a new user account (admin-only)
 * Generates password reset link and sends welcome email
 */
export const createUserByAdmin = onCall({ secrets: [graphClientId, graphTenantId, graphClientSecret, outlookSenderEmail] }, async (request) => {
  if (!request.auth) {
    throw new Error(ERROR_MESSAGES.NOT_SIGNED_IN_CREATE)
  }

  const { email, firstName, lastName, role } = request.data

  // Validate inputs
  if (!email || !email.trim()) {
    throw new Error(ERROR_MESSAGES.EMAIL_REQUIRED)
  }
  if (!firstName || !firstName.trim()) {
    throw new Error(ERROR_MESSAGES.FIRST_NAME_REQUIRED)
  }
  if (!lastName || !lastName.trim()) {
    throw new Error(ERROR_MESSAGES.LAST_NAME_REQUIRED)
  }

  const userRole = role || 'none'
  if (!VALID_ROLES.includes(userRole)) {
    throw new Error(ERROR_MESSAGES.INVALID_ROLE(VALID_ROLES as any))
  }

  try {
    // Verify caller is admin
    await verifyAdminRole(request.auth.uid)

    // Check if user already exists
    try {
      await auth.getUserByEmail(email)
      throw new Error(ERROR_MESSAGES.USER_ALREADY_EXISTS)
    } catch (err: any) {
      if (err.code !== 'auth/user-not-found') {
        throw err
      }
      // User doesn't exist, continue
    }

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email: email.trim(),
      emailVerified: false,
    })

    console.log(`[createUserByAdmin] Created auth user: ${userRecord.uid}`)

    // Create a custom setup token for password creation
    const crypto = require('crypto')
    const setupToken = crypto.randomBytes(32).toString('hex')
    const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    console.log(`[createUserByAdmin] Generated setup token: ${setupToken.substring(0, 10)}...`)

    // Create Firestore profile with setup token
    await db.collection(COLLECTIONS.USERS).doc(userRecord.uid).set({
      email: userRecord.email,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role: userRole,
      active: true,
      createdAt: new Date(),
      setupToken: setupToken,
      setupTokenExpiry: tokenExpiry,
    })

    console.log(`[createUserByAdmin] Created Firestore profile with setup token: ${userRecord.uid}`)
    
    // Verify the token was stored
    const verifyDoc = await db.collection(COLLECTIONS.USERS).doc(userRecord.uid).get()
    const verifyData = verifyDoc.data()
    console.log(`[createUserByAdmin] Verified token stored: ${verifyData?.setupToken?.substring(0, 10)}...`)

    // Build custom setup link with token
    const setupLink = `https://phase2-website.web.app/set-password?setupToken=${setupToken}&uid=${userRecord.uid}`

    // Send welcome email with custom setup link
    if (isEmailEnabled()) {
      const emailHtml = buildWelcomeEmail(firstName, setupLink)

      await sendEmail({
        to: userRecord.email!,
        subject: EMAIL.SUBJECTS.WELCOME,
        html: emailHtml,
      })

      console.log(`[createUserByAdmin] Sent welcome email to ${userRecord.email}`)
    }

    return {
      success: true,
      message: `User created successfully. Welcome email sent to ${userRecord.email}`,
      uid: userRecord.uid,
    }
  } catch (error: any) {
    console.error('[createUserByAdmin] Error:', error.message)
    throw new Error(error.message || ERROR_MESSAGES.FAILED_TO_CREATE_USER)
  }
})

/**
 * Verify setup token for new user account
 * Called from the SetPassword page to validate the token before password creation
 * No authentication required - uses token for validation
 */
export const verifySetupToken = onCall(async (request) => {
  const { uid, setupToken } = request.data

  // Validate inputs
  if (!uid || !setupToken) {
    throw new Error('Missing required parameters: uid and setupToken')
  }

  try {
    // Get the user document with admin privileges
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(uid).get()
    
    if (!userDoc.exists) {
      console.log(`[verifySetupToken] User not found: ${uid}`)
      throw new Error('User not found')
    }

    const userData = userDoc.data()
    
    console.log(`[verifySetupToken] Verifying token for user ${uid}`)
    
    // Verify token matches
    if (!userData?.setupToken || userData.setupToken !== setupToken) {
      console.log(`[verifySetupToken] Token mismatch for user ${uid}`)
      throw new Error('Invalid token')
    }

    // Check if token has expired
    let expiryTime: Date
    if (userData.setupTokenExpiry?.toDate) {
      // It's a Firestore Timestamp
      expiryTime = userData.setupTokenExpiry.toDate()
    } else if (userData.setupTokenExpiry instanceof Date) {
      expiryTime = userData.setupTokenExpiry
    } else {
      expiryTime = new Date(userData.setupTokenExpiry)
    }
    
    if (new Date() > expiryTime) {
      console.log(`[verifySetupToken] Token expired for user ${uid}`)
      throw new Error('Token expired')
    }

    console.log(`[verifySetupToken] Token verified successfully for user ${uid}`)
    
    return {
      success: true,
      email: userData.email,
      message: 'Token verified',
    }
  } catch (error: any) {
    console.error(`[verifySetupToken] Error:`, error.message)
    throw new Error(error.message || 'Failed to verify token')
  }
})

/**
 * Set password for new user account using custom setup token
 * Called from the SetPassword page
 */
export const setUserPassword = onCall(async (request) => {
  const { uid, password, setupToken } = request.data

  // Validate inputs
  if (!uid || !password || !setupToken) {
    throw new Error('Missing required parameters: uid, password, and setupToken')
  }

  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters')
  }

  try {
    // Verify the user exists and token is valid
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(uid).get()
    
    if (!userDoc || !userDoc.exists) {
      throw new Error('User not found')
    }

    const userData = userDoc.data()
    
    // Verify token matches
    if (userData?.setupToken !== setupToken) {
      throw new Error('Invalid setup token')
    }

    // Check if token has expired
    let expiryTime: Date
    if (userData?.setupTokenExpiry?.toDate) {
      // It's a Firestore Timestamp
      expiryTime = userData.setupTokenExpiry.toDate()
    } else if (userData?.setupTokenExpiry instanceof Date) {
      expiryTime = userData.setupTokenExpiry
    } else {
      expiryTime = new Date(userData?.setupTokenExpiry)
    }
    
    if (new Date() > expiryTime) {
      throw new Error('Setup token has expired')
    }

    // Update user password in Firebase Auth
    await auth.updateUser(uid, { password })
    console.log(`[setUserPassword] Password set for user: ${uid}`)

    // Clear the setup token from Firestore
    await db.collection(COLLECTIONS.USERS).doc(uid).update({
      setupToken: null,
      setupTokenExpiry: null,
    })

    return {
      success: true,
      message: 'Password set successfully',
    }
  } catch (error: any) {
    console.error('[setUserPassword] Error:', error.message)
    throw new Error(error.message || 'Failed to set password')
  }
})

/**
 * Scheduled function to notify admins of upcoming secret expiration
 * Runs daily at 9:00 AM UTC
 * Sends notification 30 days before secret expiration (Jan 10, 2027)
 */
export const notifySecretExpiration = onSchedule(
  { schedule: 'every day 09:00', secrets: [graphClientId, graphTenantId, graphClientSecret, outlookSenderEmail] },
  async (context) => {
    try {
      const today = new Date()
      const currentDateStr = today.toISOString().split('T')[0] // YYYY-MM-DD format

      // Parse expiration date and notification trigger date
      const expirationDate = new Date(EMAIL.SECRET_EXPIRATION_DATE)
      const notificationTriggerDate = new Date(expirationDate)
      notificationTriggerDate.setDate(notificationTriggerDate.getDate() - EMAIL.SECRET_NOTIFICATION_DAYS)
      const notificationTriggerDateStr = notificationTriggerDate.toISOString().split('T')[0]

      console.log(`[notifySecretExpiration] Today: ${currentDateStr}`)
      console.log(`[notifySecretExpiration] Notification trigger date: ${notificationTriggerDateStr}`)
      console.log(`[notifySecretExpiration] Secret expiration date: ${EMAIL.SECRET_EXPIRATION_DATE}`)

      // Check if today is on or after the notification trigger date
      if (currentDateStr < notificationTriggerDateStr) {
        console.log('[notifySecretExpiration] Not yet time to notify. Exiting.')
        return
      }

      // Check if secret has already expired
      if (currentDateStr > EMAIL.SECRET_EXPIRATION_DATE) {
        console.error('[notifySecretExpiration] Secret has already expired!')
        // Still send warning but with different urgency
      }

      // Get all admin users
      const adminSnapshot = await db
        .collection(COLLECTIONS.USERS)
        .where('role', '==', 'admin')
        .where('active', '==', true)
        .get()

      if (adminSnapshot.empty) {
        console.log('[notifySecretExpiration] No active admin users found')
        return
      }

      const adminEmails = adminSnapshot.docs
        .map(doc => doc.data().email)
        .filter((email: any) => email && email.trim().length > 0)

      console.log(`[notifySecretExpiration] Found ${adminEmails.length} admin(s): ${adminEmails.join(', ')}`)

      if (adminEmails.length === 0) {
        console.log('[notifySecretExpiration] No admin emails found')
        return
      }

      // Send notification email to each admin
      const emailHtml = buildSecretExpirationEmail()

      await sendEmail({
        to: adminEmails,
        subject: EMAIL.SUBJECTS.SECRET_EXPIRATION,
        html: emailHtml,
      })

      console.log(`[notifySecretExpiration] Notification sent to ${adminEmails.length} admin(s)`)
    } catch (error: any) {
      console.error('[notifySecretExpiration] Error:', error.message)
      // Don't throw - we want the function to complete even if there's an issue
      // so the scheduler doesn't mark it as failed
    }
  }
)

