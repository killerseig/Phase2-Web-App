import {
  FieldValue,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
  type Transaction,
} from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { buildSubmissionEmailRouting, buildTimecardEmailSubject, buildTimecardsEmail, isEmailEnabled, sendEmail } from './emailService'
import {
  buildSubmittedEmailOperationId,
  buildSubmittedEmailStatusUpdate,
  isSubmittedEmailOperationInProgress,
} from './emailStatus'
import { getEmailSettings, getJobDetails } from './firestoreService'
import { getGraphEmailSecrets } from './functionConfig'
import {
  claimSubmittedEmailOperation,
  getSubmittedEmailClaimShortCircuitMessage,
} from './submittedEmailOperations'
import {
  buildTimecardCsv,
  buildTimecardCsvFilename,
  buildTimecardPdfBuffer,
  buildTimecardPdfFilename,
  prepareTimecardsForPdfCsvExport,
} from './operationsFunctions'
import {
  type CurrentFunctionUser,
  buildCurrentFunctionUser,
  currentFunctionUserHasAnyRole,
} from './roleAccess'
import { db } from './runtime'
import {
  canCreateTimecardWeekForJob,
  isFunctionShopJob,
} from './timecardWeekAccess'
import { targetFunctionRoleCanViewSubmittedTimecards } from './targetTimecardAccess'

interface EnsureTimecardWeekInput {
  jobId: string
  jobCode: string | null
  jobName: string | null
  ownerForemanUserId: string | null
  ownerForemanName: string | null
  weekEndDate: string
}

interface SubmitTimecardWeekResponse {
  success: boolean
  emailSent: boolean
  emailMessage: string
}

export interface TimecardRequiredFieldIssue {
  cardId: string
  employeeName: string
  lineNumber: number
  missingFields: string[]
}

interface ListTimecardWeeksInput {
  jobId: string
  ownerForemanUserId?: string | null
  statusFilter?: string | null
}

interface CallableRequestLike {
  auth?: { uid: string } | null
  data?: any
}

const SUBMITTED_WEEK_LOCKED_MESSAGE = 'Week has already been submitted and can no longer be changed.'

function text(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function textOrNull(value: unknown) {
  const normalized = text(value)
  return normalized || null
}

function normalizeRecipients(...groups: unknown[]): string[] {
  const merged = groups.flatMap((group) => (Array.isArray(group) ? group : []))
  const cleaned = merged
    .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
    .filter(Boolean)
  return Array.from(new Set(cleaned))
}

function numberOrZero(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return 0
  return Math.max(0, parsed)
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return null
  return Math.max(0, parsed)
}

function validationRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function getTimecardEmployeeLabel(value: unknown) {
  const card = validationRecord(value)
  return text(card.fullName)
    || [text(card.firstName), text(card.lastName)].filter(Boolean).join(' ')
    || (text(card.employeeNumber) ? `Employee #${text(card.employeeNumber)}` : '')
    || 'Unnamed employee'
}

function lineHasHours(value: unknown) {
  const line = validationRecord(value)
  const days = Array.isArray(line.days) ? line.days : []
  const off = validationRecord(line.off)
  return days.some((day) => numberOrZero(validationRecord(day).hours) > 0)
    || numberOrZero(line.offHours ?? off.hours) > 0
}

export function findTimecardRequiredFieldIssues(value: unknown): TimecardRequiredFieldIssue[] {
  const issues: TimecardRequiredFieldIssue[] = []

  for (const candidate of Array.isArray(value) ? value : []) {
    const card = validationRecord(candidate)
    const lines = Array.isArray(card.lines) ? card.lines : []
    lines.forEach((candidateLine, lineIndex) => {
      const line = validationRecord(candidateLine)
      if (!lineHasHours(line)) return

      const missingFields = [
        !text(line.jobNumber) ? 'Job #' : '',
        !text(line.subsectionArea) ? 'Area' : '',
        !text(line.account) ? 'Acct' : '',
      ].filter(Boolean)

      if (missingFields.length) {
        issues.push({
          cardId: text(card.id),
          employeeName: getTimecardEmployeeLabel(card),
          lineNumber: lineIndex + 1,
          missingFields,
        })
      }
    })
  }

  return issues
}

function formatMissingFieldList(fields: string[]) {
  if (fields.length <= 1) return fields[0] || ''
  if (fields.length === 2) return `${fields[0]} and ${fields[1]}`
  return `${fields.slice(0, -1).join(', ')}, and ${fields[fields.length - 1]}`
}

export function buildTimecardRequiredFieldsMessage(issues: TimecardRequiredFieldIssue[]) {
  const firstIssue = issues[0]
  if (!firstIssue) return ''

  const additionalIssueCount = issues.length - 1
  const additionalIssueMessage = additionalIssueCount > 0
    ? ` ${additionalIssueCount} other ${additionalIssueCount === 1 ? 'line also needs' : 'lines also need'} attention.`
    : ''

  return `${firstIssue.employeeName}, line ${firstIssue.lineNumber} is missing ${formatMissingFieldList(firstIssue.missingFields)}.${additionalIssueMessage} Complete Job #, Area, and Acct for every line with hours before submitting.`
}

function formatIsoDate(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getWeekStartFromSaturday(weekEndDate: string) {
  const current = new Date(`${weekEndDate}T00:00:00Z`)
  current.setUTCDate(current.getUTCDate() - 6)
  return formatIsoDate(current)
}

function getPreviousSaturday(weekEndDate: string) {
  const current = new Date(`${weekEndDate}T00:00:00Z`)
  current.setUTCDate(current.getUTCDate() - 7)
  return formatIsoDate(current)
}

function buildWeekDates(weekStartDate: string) {
  const start = new Date(`${weekStartDate}T00:00:00Z`)
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(start)
    next.setUTCDate(start.getUTCDate() + index)
    return formatIsoDate(next)
  })
}

async function getAuthorizedUser(uid: string): Promise<CurrentFunctionUser & { email?: string }> {
  const userSnap = await db.collection('users').doc(uid).get()
  if (!userSnap.exists) {
    throw new HttpsError('failed-precondition', 'Your user profile was not found.')
  }

  const data = userSnap.data() || {}
  const user = buildCurrentFunctionUser(uid, data)

  if (!user.active) {
    throw new HttpsError('permission-denied', 'Your account is inactive.')
  }

  if (!currentFunctionUserHasAnyRole(user, ['admin', 'payroll', 'foreman', 'shop-foreman', 'project-manager'])) {
    throw new HttpsError('permission-denied', 'Your account does not have access to timecards.')
  }

  return { ...user, email: typeof data.email === 'string' ? data.email : undefined }
}

function isFieldTimecardOwnerRole(user: CurrentFunctionUser) {
  return user.role === 'foreman' || user.role === 'shop-foreman'
}

function getAccessAssignedJobIds(
  user: CurrentFunctionUser,
  jobId: string,
  job: Awaited<ReturnType<typeof getJobDetails>>,
) {
  const assignedJobIds = new Set(user.assignedJobIds)
  if ((job?.assignedForemanIds ?? []).includes(user.uid)) {
    assignedJobIds.add(jobId)
  }
  return Array.from(assignedJobIds)
}

function canViewSubmittedWeekForJob(
  user: CurrentFunctionUser,
  jobId: string,
  job: Awaited<ReturnType<typeof getJobDetails>>,
) {
  return targetFunctionRoleCanViewSubmittedTimecards({
    assignedJobIds: getAccessAssignedJobIds(user, jobId, job),
    isShopJob: isFunctionShopJob(job),
    jobId,
    role: user.role,
  })
}

function canReadTimecardWeekHeaderForJob(
  user: CurrentFunctionUser,
  jobId: string,
  job: Awaited<ReturnType<typeof getJobDetails>>,
) {
  return (
    user.role === 'admin'
    || user.role === 'payroll'
    || canCreateTimecardWeekForJob(user, jobId, job)
    || canViewSubmittedWeekForJob(user, jobId, job)
  )
}

function canReadTimecardWeekCardsForJob(
  user: CurrentFunctionUser,
  week: any,
  jobId: string,
  job: Awaited<ReturnType<typeof getJobDetails>>,
) {
  if (user.role === 'admin' || user.role === 'payroll') return true
  if (canCreateTimecardWeekForJob(user, jobId, job)) return true
  return text(week?.status) === 'submitted' && canViewSubmittedWeekForJob(user, jobId, job)
}

function serializeFirestoreValue(value: any): any {
  if (value === null || value === undefined) return value
  if (typeof value?.toDate === 'function') {
    return value.toDate().toISOString()
  }
  if (Array.isArray(value)) {
    return value.map((entry) => serializeFirestoreValue(entry))
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, serializeFirestoreValue(entry)]),
    )
  }
  return value
}

function normalizeWeekForResponse(doc: QueryDocumentSnapshot | DocumentSnapshot) {
  return {
    id: doc.id,
    ...serializeFirestoreValue(doc.data() || {}),
  }
}

function normalizeCardForResponse(doc: QueryDocumentSnapshot | DocumentSnapshot) {
  return {
    id: doc.id,
    ...serializeFirestoreValue(doc.data() || {}),
  }
}

function sortWeekResponses(weeks: any[]) {
  return weeks.slice().sort((left, right) => (
    text(right.weekEndDate).localeCompare(text(left.weekEndDate))
    || Number(text(right.status) === 'submitted') - Number(text(left.status) === 'submitted')
    || numberOrZero(right.employeeCardCount) - numberOrZero(left.employeeCardCount)
    || text(right.id).localeCompare(text(left.id))
  ))
}

function sortCardResponses(cards: any[]) {
  return cards.slice().sort((left, right) => (
    numberOrZero(left.sortIndex) - numberOrZero(right.sortIndex)
    || text(left.lastName).localeCompare(text(right.lastName))
    || text(left.firstName).localeCompare(text(right.firstName))
    || text(left.id).localeCompare(text(right.id))
  ))
}

async function assertCanAccessWeek(
  user: CurrentFunctionUser,
  jobId: string,
  getJob: typeof getJobDetails = getJobDetails,
) {
  const job = await getJob(jobId)
  if (canCreateTimecardWeekForJob(user, jobId, job)) return
  throw new HttpsError('permission-denied', 'You can only change timecard weeks for jobs assigned to you.')
}

function getOwnerForemanUserId(user: CurrentFunctionUser, inputOwnerId: unknown) {
  if (user.role === 'foreman' || user.role === 'shop-foreman') return user.uid
  return textOrNull(inputOwnerId ?? user.uid)
}

function getOwnerForemanName(user: CurrentFunctionUser, inputOwnerName: unknown) {
  if (user.role === 'foreman' || user.role === 'shop-foreman') return user.displayName
  return textOrNull(inputOwnerName ?? user.displayName)
}

function sanitizeDay(day: any, index: number, weekDates: string[]) {
  return {
    date: text(day?.date) || weekDates[index] || '',
    dayOfWeek: index,
    hours: numberOrZero(day?.hours),
    production: numberOrZero(day?.production),
    unitCost: numberOrZero(day?.unitCost),
    unitCostOverride: numberOrNull(day?.unitCostOverride),
    lineTotal: numberOrZero(day?.lineTotal),
  }
}

function sanitizeLine(line: any, weekDates: string[]) {
  const sourceDays = Array.isArray(line?.days) ? line.days : []
  return {
    jobNumber: text(line?.jobNumber),
    subsectionArea: text(line?.subsectionArea),
    account: text(line?.account),
    difH: text(line?.difH),
    difP: text(line?.difP),
    difC: text(line?.difC),
    offHours: numberOrZero(line?.offHours),
    offProduction: numberOrZero(line?.offProduction),
    offCost: numberOrZero(line?.offCost),
    days: weekDates.map((date, index) => sanitizeDay(sourceDays[index], index, weekDates)),
  }
}

function sanitizeCardPayload(card: any, weekStartDate: string, sortIndexFallback = 0) {
  const weekDates = buildWeekDates(weekStartDate)
  const lines = Array.isArray(card?.lines) ? card.lines : []
  const totals = card?.totals || {}

  return {
    sourceType: text(card?.sourceType) === 'custom' ? 'custom' : 'employee',
    employeeId: textOrNull(card?.employeeId),
    firstName: text(card?.firstName),
    lastName: text(card?.lastName),
    fullName: text(card?.fullName) || [text(card?.firstName), text(card?.lastName)].filter(Boolean).join(' '),
    employeeNumber: text(card?.employeeNumber),
    occupation: text(card?.occupation),
    wageRate: numberOrNull(card?.wageRate),
    isContractor: card?.isContractor === true,
    sortIndex: Number.isFinite(Number(card?.sortIndex)) ? Number(card.sortIndex) : sortIndexFallback,
    lines: lines.map((line: any) => sanitizeLine(line, weekDates)),
    footerJobOrGl: text(card?.footerJobOrGl),
    footerAccount: text(card?.footerAccount),
    footerOffice: text(card?.footerOffice),
    footerAmount: text(card?.footerAmount),
    footerSecondJobOrGl: text(card?.footerSecondJobOrGl),
    footerSecondAccount: text(card?.footerSecondAccount),
    footerSecondOffice: text(card?.footerSecondOffice),
    footerSecondAmount: text(card?.footerSecondAmount),
    notes: card?.notes == null ? '' : String(card.notes),
    regularHoursOverride: numberOrNull(card?.regularHoursOverride),
    overtimeHoursOverride: numberOrNull(card?.overtimeHoursOverride),
    totals: {
      hoursByDay: Array.isArray(totals.hoursByDay) ? totals.hoursByDay.map((value: unknown) => numberOrZero(value)) : Array(7).fill(0),
      productionByDay: Array.isArray(totals.productionByDay) ? totals.productionByDay.map((value: unknown) => numberOrZero(value)) : Array(7).fill(0),
      hoursTotal: numberOrZero(totals.hoursTotal),
      productionTotal: numberOrZero(totals.productionTotal),
      lineTotal: numberOrZero(totals.lineTotal),
    },
    updatedAt: FieldValue.serverTimestamp(),
  }
}

function cloneLineForNewWeek(line: any, weekDates: string[]) {
  return {
    jobNumber: text(line?.jobNumber),
    subsectionArea: text(line?.subsectionArea),
    account: '',
    difH: text(line?.difH),
    difP: text(line?.difP),
    difC: text(line?.difC),
    offHours: 0,
    offProduction: 0,
    offCost: 0,
    days: weekDates.map((date, index) => ({
      date,
      dayOfWeek: index,
      hours: 0,
      production: 0,
      unitCost: 0,
      unitCostOverride: null,
      lineTotal: 0,
    })),
  }
}

function cloneCardForNewWeek(source: any, weekStartDate: string) {
  const weekDates = buildWeekDates(weekStartDate)
  const sourceLines = Array.isArray(source?.lines) ? source.lines : []
  return {
    sourceType: text(source?.sourceType) === 'custom' ? 'custom' : 'employee',
    employeeId: textOrNull(source?.employeeId),
    firstName: text(source?.firstName),
    lastName: text(source?.lastName),
    fullName: text(source?.fullName) || [text(source?.firstName), text(source?.lastName)].filter(Boolean).join(' '),
    employeeNumber: text(source?.employeeNumber),
    occupation: text(source?.occupation),
    wageRate: numberOrNull(source?.wageRate),
    isContractor: source?.isContractor === true,
    sortIndex: numberOrZero(source?.sortIndex),
    lines: sourceLines.map((line: any) => cloneLineForNewWeek(line, weekDates)),
    footerJobOrGl: '',
    footerAccount: '',
    footerOffice: '',
    footerAmount: '',
    footerSecondJobOrGl: '',
    footerSecondAccount: '',
    footerSecondOffice: '',
    footerSecondAmount: '',
    notes: '',
    regularHoursOverride: null,
    overtimeHoursOverride: null,
    totals: {
      hoursByDay: Array(7).fill(0),
      productionByDay: Array(7).fill(0),
      hoursTotal: 0,
      productionTotal: 0,
      lineTotal: 0,
    },
  }
}

async function getWeekDoc(weekId: string) {
  const weekRef = db.collection('timecardWeeks').doc(weekId)
  const weekSnap = await weekRef.get()
  if (!weekSnap.exists) {
    throw new HttpsError('not-found', 'Timecard week not found.')
  }

  const week = weekSnap.data() || {}
  const jobId = text(week.jobId)
  if (!jobId) {
    throw new HttpsError('failed-precondition', 'Timecard week is missing its job assignment.')
  }

  return { weekRef, weekSnap, week, jobId }
}

async function listWeekCards(weekId: string): Promise<any[]> {
  const cardsSnap = await db.collection('timecardWeeks').doc(weekId).collection('cards').get()
  return cardsSnap.docs
    .map((doc): any => ({ id: doc.id, ...(doc.data() || {}) }))
    .sort((left, right) => numberOrZero(left.sortIndex) - numberOrZero(right.sortIndex))
}

export const listTimecardWeeksForCurrentUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }

  const input = request.data as ListTimecardWeeksInput
  const jobId = text(input?.jobId)
  if (!jobId || jobId.includes('/')) {
    throw new HttpsError('invalid-argument', 'jobId is required.')
  }

  const user = await getAuthorizedUser(request.auth.uid)
  const job = await getJobDetails(jobId)
  if (!canReadTimecardWeekHeaderForJob(user, jobId, job)) {
    throw new HttpsError('permission-denied', 'Your account does not have access to this job timecard.')
  }

  let weekQuery: Query = db
    .collection('timecardWeeks')
    .where('jobId', '==', jobId)

  const statusFilter = textOrNull(input?.statusFilter)
  if (statusFilter) {
    weekQuery = weekQuery.where('status', '==', statusFilter)
  }

  const requestedOwnerForemanUserId = textOrNull(input?.ownerForemanUserId)
  if (!isFieldTimecardOwnerRole(user) && requestedOwnerForemanUserId) {
    weekQuery = weekQuery.where('ownerForemanUserId', '==', requestedOwnerForemanUserId)
  }

  const snapshot = await weekQuery.get()
  let weeks = snapshot.docs.map(normalizeWeekForResponse)

  if (!(user.role === 'admin' || user.role === 'payroll' || canCreateTimecardWeekForJob(user, jobId, job))) {
    weeks = weeks.filter((week) => text(week.status) === 'submitted')
  }

  return {
    weeks: sortWeekResponses(weeks),
  }
})

export const listTimecardCardsForCurrentUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }

  const weekId = text(request.data?.weekId)
  if (!weekId || weekId.includes('/')) {
    throw new HttpsError('invalid-argument', 'weekId is required.')
  }

  const { week, jobId } = await getWeekDoc(weekId)
  const user = await getAuthorizedUser(request.auth.uid)
  const job = await getJobDetails(jobId)
  if (!canReadTimecardWeekCardsForJob(user, week, jobId, job)) {
    throw new HttpsError('permission-denied', 'Your account does not have access to these timecard cards.')
  }

  const cardsSnap = await db
    .collection('timecardWeeks')
    .doc(weekId)
    .collection('cards')
    .get()

  return {
    cards: sortCardResponses(cardsSnap.docs.map(normalizeCardForResponse)),
  }
})

async function copyPreviousWeekCardsIntoDraft(input: {
  targetWeekId: string
  targetWeekRef: DocumentReference
  jobId: string
  weekEndDate: string
  weekStartDate: string
  ownerForemanUserId: string | null
}) {
  const targetCardsSnap = await db
    .collection('timecardWeeks')
    .doc(input.targetWeekId)
    .collection('cards')
    .limit(1)
    .get()

  if (!targetCardsSnap.empty) return 0

  const previousWeekQuery = db
    .collection('timecardWeeks')
    .where('jobId', '==', input.jobId)
    .where('weekEndDate', '==', getPreviousSaturday(input.weekEndDate))

  const previousWeekSnap = await previousWeekQuery.get()
  const previousWeekDocs = previousWeekSnap.docs.sort((left, right) => {
    const leftData = left.data() || {}
    const rightData = right.data() || {}
    return (
      Number(text(rightData.status) === 'submitted') - Number(text(leftData.status) === 'submitted')
      || numberOrZero(rightData.employeeCardCount) - numberOrZero(leftData.employeeCardCount)
      || right.id.localeCompare(left.id)
    )
  })

  let previousCardsSnap: QuerySnapshot | null = null
  for (const previousWeekDoc of previousWeekDocs) {
    const candidateCardsSnap = await db
      .collection('timecardWeeks')
      .doc(previousWeekDoc.id)
      .collection('cards')
      .get()

    if (!candidateCardsSnap.empty) {
      previousCardsSnap = candidateCardsSnap
      break
    }
  }

  if (!previousCardsSnap || previousCardsSnap.empty) return 0

  const batch = db.batch()
  previousCardsSnap.docs
    .sort((left, right) => numberOrZero(left.data()?.sortIndex) - numberOrZero(right.data()?.sortIndex))
    .forEach((cardDoc, index) => {
      const nextCardRef = db.collection('timecardWeeks').doc(input.targetWeekId).collection('cards').doc()
      batch.set(nextCardRef, {
        ...sanitizeCardPayload(cloneCardForNewWeek(cardDoc.data(), input.weekStartDate), input.weekStartDate, index),
        createdAt: FieldValue.serverTimestamp(),
      })
    })

  batch.update(input.targetWeekRef, {
    employeeCardCount: previousCardsSnap.size,
    updatedAt: FieldValue.serverTimestamp(),
  })

  await batch.commit()
  return previousCardsSnap.size
}

export async function sendSubmittedWeekEmail(
  weekId: string,
  week: any,
  jobId: string,
  submittedByName: string | null,
  submittedByEmail?: string,
): Promise<SubmitTimecardWeekResponse> {
  if (!isEmailEnabled()) {
    return {
      success: true,
      emailSent: false,
      emailMessage: 'Week submitted. Notification email is disabled in system settings.',
    }
  }

  const settings = await getEmailSettings()
  const emailRouting = buildSubmissionEmailRouting(
    normalizeRecipients(settings.globalNotificationRecipients.timecards),
    submittedByEmail,
  )
  const recipients = emailRouting.to

  if (!recipients.length) {
    return {
      success: true,
      emailSent: false,
      emailMessage: 'Week submitted. No timecard email recipients are configured.',
    }
  }

  const cards = await listWeekCards(weekId)
  if (!cards.length) {
    return {
      success: true,
      emailSent: false,
      emailMessage: 'Week submitted. No timecard cards were available to include in the notification email.',
    }
  }

  const job = await getJobDetails(jobId)
  const weekStart = text(week.weekStartDate)
  const weekEnd = text(week.weekEndDate)
  const jobNumber = text(job?.number || week?.jobCode)
  const jobName = text(job?.name || week?.jobName)
  const productionBurden = job?.productionBurden
  const submittedBy = submittedByName || textOrNull(week?.submittedByName) || 'Phase 2 Foreman'

  const normalizedTimecards = await prepareTimecardsForPdfCsvExport(cards.map((card) => ({
    ...card,
    weekStartDate: weekStart,
    weekEndingDate: weekEnd,
    jobCode: jobNumber,
    __jobCode: jobNumber,
    employeeWage: card?.wageRate ?? null,
    wage: card?.wageRate ?? null,
    productionBurden,
    status: 'submitted',
  })))

  const html = buildTimecardsEmail({
    jobName,
    jobNumber,
    submittedBy,
    weekStart,
    timecards: normalizedTimecards,
  })

  const csvAttachment = buildTimecardCsv(normalizedTimecards, weekStart, jobNumber || undefined)
  const csvFileName = buildTimecardCsvFilename(weekStart, undefined, jobNumber || undefined)
  const pdfFileName = buildTimecardPdfFilename(weekStart, undefined, jobNumber || undefined)
  const pdfBuffer = await buildTimecardPdfBuffer({
    jobName,
    jobNumber,
    submittedBy,
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
    ...emailRouting,
    subject: buildTimecardEmailSubject({
      jobName,
      jobNumber,
      submittedBy,
      weekStart,
    }),
    html,
    attachments,
  })

  return {
    success: true,
    emailSent: true,
    emailMessage: `Week submitted and emailed to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}.`,
  }
}

export const ensureTimecardWeekRecord = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }

  const input = request.data as EnsureTimecardWeekInput
  const jobId = text(input?.jobId)
  const weekEndDate = text(input?.weekEndDate)
  if (!jobId) throw new HttpsError('invalid-argument', 'jobId is required')
  if (!weekEndDate) throw new HttpsError('invalid-argument', 'weekEndDate is required')

  const user = await getAuthorizedUser(request.auth.uid)
  const jobDetails = await getJobDetails(jobId)
  if (!canCreateTimecardWeekForJob(user, jobId, jobDetails)) {
    throw new HttpsError('permission-denied', 'You are not assigned to this job.')
  }

  const ownerForemanUserId = getOwnerForemanUserId(user, input?.ownerForemanUserId)
  const ownerForemanName = getOwnerForemanName(user, input?.ownerForemanName)
  let jobCode = textOrNull(input?.jobCode)
  let jobName = textOrNull(input?.jobName)

  if (!jobCode || !jobName) {
    jobCode = jobCode || textOrNull(jobDetails?.number)
    jobName = jobName || textOrNull(jobDetails?.name)
  }

  const existingQuery = db
    .collection('timecardWeeks')
    .where('jobId', '==', jobId)
    .where('weekEndDate', '==', weekEndDate)

  const existingSnap = await existingQuery.limit(1).get()

  const existingDoc = existingSnap.docs[0]
  if (existingDoc) {
    const existingData = existingDoc.data() || {}
    if (text(existingData.status) !== 'submitted') {
      const weekStartDate = text(existingData.weekStartDate) || getWeekStartFromSaturday(weekEndDate)
      await copyPreviousWeekCardsIntoDraft({
        targetWeekId: existingDoc.id,
        targetWeekRef: existingDoc.ref,
        jobId,
        weekEndDate,
        weekStartDate,
        ownerForemanUserId,
      })
    }

    return { id: existingDoc.id }
  }

  const weekStartDate = getWeekStartFromSaturday(weekEndDate)
  const createdRef = await db.collection('timecardWeeks').add({
    jobId,
    jobCode,
    jobName,
    ownerForemanUserId,
    ownerForemanName,
    weekStartDate,
    weekEndDate,
    status: 'draft',
    employeeCardCount: 0,
    createdByUserId: request.auth.uid,
    updatedByUserId: request.auth.uid,
    submittedByUserId: null,
    submittedAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  await copyPreviousWeekCardsIntoDraft({
    targetWeekId: createdRef.id,
    targetWeekRef: createdRef,
    jobId,
    weekEndDate,
    weekStartDate,
    ownerForemanUserId,
  })
  return { id: createdRef.id }
})

export const createTimecardCardRecord = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }

  const weekId = text(request.data?.weekId)
  const weekStartDate = text(request.data?.weekStartDate)
  const card = request.data?.card
  if (!weekId) throw new HttpsError('invalid-argument', 'weekId is required')
  if (!weekStartDate) throw new HttpsError('invalid-argument', 'weekStartDate is required')
  if (!card || typeof card !== 'object') throw new HttpsError('invalid-argument', 'card is required')

  const { weekRef, week, jobId } = await getWeekDoc(weekId)
  const user = await getAuthorizedUser(request.auth.uid)
  await assertCanAccessWeek(user, jobId)

  if (text(week.status) === 'submitted' && !(user.role === 'admin' || user.role === 'payroll')) {
    throw new HttpsError('failed-precondition', SUBMITTED_WEEK_LOCKED_MESSAGE)
  }

  const createdRef = db.collection('timecardWeeks').doc(weekId).collection('cards').doc()
  await createdRef.set({
    ...sanitizeCardPayload(card, weekStartDate),
    createdAt: FieldValue.serverTimestamp(),
  })

  await weekRef.update({
    employeeCardCount: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
    updatedByUserId: request.auth.uid,
  })

  return { id: createdRef.id }
})

export const updateTimecardCardRecord = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }

  const weekId = text(request.data?.weekId)
  const cardId = text(request.data?.cardId)
  const weekStartDate = text(request.data?.weekStartDate)
  const card = request.data?.card
  if (!weekId) throw new HttpsError('invalid-argument', 'weekId is required')
  if (!cardId) throw new HttpsError('invalid-argument', 'cardId is required')
  if (!weekStartDate) throw new HttpsError('invalid-argument', 'weekStartDate is required')
  if (!card || typeof card !== 'object') throw new HttpsError('invalid-argument', 'card is required')

  const { weekRef, week, jobId } = await getWeekDoc(weekId)
  const user = await getAuthorizedUser(request.auth.uid)
  await assertCanAccessWeek(user, jobId)

  if (text(week.status) === 'submitted' && !(user.role === 'admin' || user.role === 'payroll')) {
    throw new HttpsError('failed-precondition', SUBMITTED_WEEK_LOCKED_MESSAGE)
  }

  const cardRef = db.collection('timecardWeeks').doc(weekId).collection('cards').doc(cardId)
  const cardSnap = await cardRef.get()
  if (!cardSnap.exists) {
    throw new HttpsError('not-found', 'Timecard card not found.')
  }

  await cardRef.update(sanitizeCardPayload(card, weekStartDate))
  await weekRef.update({
    updatedAt: FieldValue.serverTimestamp(),
    updatedByUserId: request.auth.uid,
  })

  return { success: true }
})

export const deleteTimecardCardRecord = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }

  const weekId = text(request.data?.weekId)
  const cardId = text(request.data?.cardId)
  if (!weekId) throw new HttpsError('invalid-argument', 'weekId is required')
  if (!cardId) throw new HttpsError('invalid-argument', 'cardId is required')

  const { weekRef, week, jobId } = await getWeekDoc(weekId)
  const user = await getAuthorizedUser(request.auth.uid)
  await assertCanAccessWeek(user, jobId)

  if (text(week.status) === 'submitted' && !(user.role === 'admin' || user.role === 'payroll')) {
    throw new HttpsError('failed-precondition', SUBMITTED_WEEK_LOCKED_MESSAGE)
  }

  const cardRef = db.collection('timecardWeeks').doc(weekId).collection('cards').doc(cardId)
  const cardSnap = await cardRef.get()
  if (!cardSnap.exists) {
    throw new HttpsError('not-found', 'Timecard card not found.')
  }

  await cardRef.delete()
  await weekRef.update({
    employeeCardCount: FieldValue.increment(-1),
    updatedAt: FieldValue.serverTimestamp(),
    updatedByUserId: request.auth.uid,
  })

  return { success: true }
})

export const deleteTimecardWeekRecord = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }

  const weekId = text(request.data?.weekId)
  if (!weekId) throw new HttpsError('invalid-argument', 'weekId is required')

  const { weekRef, week } = await getWeekDoc(weekId)
  const user = await getAuthorizedUser(request.auth.uid)
  if (!(user.role === 'admin' || user.role === 'payroll')) {
    throw new HttpsError('permission-denied', 'Only admins or payroll can delete timecard weeks.')
  }

  if (text(week.status) === 'submitted') {
    throw new HttpsError('failed-precondition', 'Submitted weeks cannot be deleted.')
  }

  const cardsSnap = await db.collection('timecardWeeks').doc(weekId).collection('cards').get()
  const batch = db.batch()
  cardsSnap.docs.forEach((cardDoc) => {
    batch.delete(cardDoc.ref)
  })
  batch.delete(weekRef)
  await batch.commit()

  return { success: true }
})

interface ReopenTimecardWeekDependencies {
  getWeekDoc: typeof getWeekDoc
  getAuthorizedUser: typeof getAuthorizedUser
  runTransaction<T>(updateFunction: (transaction: Transaction) => Promise<T>): Promise<T>
}

const defaultReopenTimecardWeekDependencies: ReopenTimecardWeekDependencies = {
  getWeekDoc,
  getAuthorizedUser,
  runTransaction: (updateFunction) => db.runTransaction(updateFunction),
}

export async function handleReopenTimecardWeekRecord(
  request: CallableRequestLike,
  deps: ReopenTimecardWeekDependencies = defaultReopenTimecardWeekDependencies,
) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }
  const requestingUserId = request.auth.uid

  const weekId = text(request.data?.weekId)
  if (!weekId) throw new HttpsError('invalid-argument', 'weekId is required')

  const { weekRef } = await deps.getWeekDoc(weekId)
  const user = await deps.getAuthorizedUser(requestingUserId)
  if (user.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admins can re-open submitted timecard weeks.')
  }

  return deps.runTransaction(async (transaction) => {
    const latestWeekSnap = await transaction.get(weekRef)
    if (!latestWeekSnap.exists) {
      throw new HttpsError('not-found', 'Timecard week not found.')
    }

    const latestWeek = latestWeekSnap.data() || {}
    if (text(latestWeek.status) !== 'submitted') {
      return { success: true, reopened: false }
    }

    const operationId = buildSubmittedEmailOperationId('timecardWeekSubmittedEmail', weekId)
    if (isSubmittedEmailOperationInProgress(latestWeek, operationId)) {
      throw new HttpsError(
        'failed-precondition',
        'The submission email is still being prepared. Wait for it to finish before re-opening this week.',
      )
    }

    transaction.update(weekRef, {
      status: 'draft',
      lastSubmittedAt: latestWeek.submittedAt ?? null,
      lastSubmittedByName: textOrNull(latestWeek.submittedByName),
      lastSubmittedByUserId: textOrNull(latestWeek.submittedByUserId),
      lastSubmittedEmailAttemptedAt: latestWeek.submittedEmailAttemptedAt ?? null,
      lastSubmittedEmailSentAt: latestWeek.submittedEmailSentAt ?? null,
      submittedAt: null,
      submittedByName: null,
      submittedByUserId: null,
      submittedEmailAttemptedAt: FieldValue.delete(),
      submittedEmailError: FieldValue.delete(),
      submittedEmailInProgressAt: FieldValue.delete(),
      submittedEmailOperationId: FieldValue.delete(),
      submittedEmailSentAt: FieldValue.delete(),
      reopenedAt: FieldValue.serverTimestamp(),
      reopenedByName: textOrNull(user.displayName),
      reopenedByUserId: requestingUserId,
      reopenCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUserId: requestingUserId,
    })

    return { success: true, reopened: true }
  })
}

export const reopenTimecardWeekRecord = onCall(async (request) => (
  handleReopenTimecardWeekRecord(request)
))

interface SubmitTimecardWeekDependencies {
  getWeekDoc: typeof getWeekDoc
  getAuthorizedUser: typeof getAuthorizedUser
  getJobDetails: typeof getJobDetails
  listWeekCards: typeof listWeekCards
  claimSubmittedEmailOperation: typeof claimSubmittedEmailOperation
  sendSubmittedWeekEmail: typeof sendSubmittedWeekEmail
  buildSubmittedEmailStatusUpdate: typeof buildSubmittedEmailStatusUpdate
}

const defaultSubmitTimecardWeekDependencies: SubmitTimecardWeekDependencies = {
  getWeekDoc,
  getAuthorizedUser,
  getJobDetails,
  listWeekCards,
  claimSubmittedEmailOperation,
  sendSubmittedWeekEmail,
  buildSubmittedEmailStatusUpdate,
}

export async function handleSubmitTimecardWeekRecord(
  request: CallableRequestLike,
  deps: SubmitTimecardWeekDependencies = defaultSubmitTimecardWeekDependencies,
) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }

  const weekId = text(request.data?.weekId)
  if (!weekId) throw new HttpsError('invalid-argument', 'weekId is required')

  const { weekRef, week, jobId } = await deps.getWeekDoc(weekId)
  const user = await deps.getAuthorizedUser(request.auth.uid)
  await assertCanAccessWeek(user, jobId, deps.getJobDetails)
  const cards = await deps.listWeekCards(weekId)
  const requiredFieldIssues = findTimecardRequiredFieldIssues(cards)
  if (requiredFieldIssues.length) {
    throw new HttpsError(
      'failed-precondition',
      buildTimecardRequiredFieldsMessage(requiredFieldIssues),
      { issues: requiredFieldIssues },
    )
  }

  const operationId = buildSubmittedEmailOperationId('timecardWeekSubmittedEmail', weekId)
  const operationContext = {
    weekId,
    jobId,
    operation: 'submitTimecardWeekRecord',
    operationId,
  }

  const claimStatus = await deps.claimSubmittedEmailOperation(db, [weekRef], operationId, operationContext)
  const claimMessage = getSubmittedEmailClaimShortCircuitMessage(claimStatus)
  if (claimMessage) {
    return {
      success: true,
      emailSent: claimStatus === 'already-sent',
      emailMessage: claimMessage,
    }
  }

  const submittedByUserId = request.auth.uid
  const submittedByName = user.displayName

  await weekRef.update({
    status: 'submitted',
    submittedAt: FieldValue.serverTimestamp(),
    submittedByUserId,
    submittedByName,
    updatedByUserId: request.auth.uid,
    updatedAt: FieldValue.serverTimestamp(),
  })

  try {
    const emailResult = await deps.sendSubmittedWeekEmail(weekId, {
      ...week,
      submittedByUserId,
      submittedByName,
      status: 'submitted',
    }, jobId, submittedByName, user.email)

    await weekRef.update(deps.buildSubmittedEmailStatusUpdate({
      emailSent: emailResult.emailSent,
      emailMessage: emailResult.emailMessage,
      operationId,
    }, FieldValue))

    return emailResult
  } catch (error: any) {
    const emailMessage = `Week submitted, but the notification email failed: ${error?.message || 'Unknown error'}`
    console.error('[submitTimecardWeekRecord] Notification email failed', { weekId, jobId, error })

    await weekRef.update(deps.buildSubmittedEmailStatusUpdate({
      emailSent: false,
      emailMessage,
      operationId,
    }, FieldValue))

    return {
      success: true,
      emailSent: false,
      emailMessage,
    }
  }
}

export const submitTimecardWeekRecord = onCall({ secrets: getGraphEmailSecrets() }, async (request) => (
  handleSubmitTimecardWeekRecord(request)
))
