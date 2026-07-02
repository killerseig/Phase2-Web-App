import * as admin from 'firebase-admin'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { EMAIL } from './constants'
import { buildTimecardsEmail, isEmailEnabled, sendEmail } from './emailService'
import { getEmailSettings, getJobDetails, getJobNotificationRecipients } from './firestoreService'
import { getGraphEmailSecrets } from './functionConfig'
import {
  buildTimecardCsv,
  buildTimecardCsvFilename,
  buildTimecardPdfBuffer,
  buildTimecardPdfFilename,
  prepareTimecardsForPdfCsvExport,
} from './operationsFunctions'
import { db } from './runtime'

type TimecardRole = 'admin' | 'foreman' | 'none'

interface AuthorizedTimecardUser {
  uid: string
  role: TimecardRole
  active: boolean
  assignedJobIds: string[]
  displayName: string | null
}

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

const SUBMITTED_WEEK_LOCKED_MESSAGE = 'Week has already been submitted and can no longer be changed.'

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
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

function normalizeRole(value: unknown): TimecardRole {
  const role = text(value).toLowerCase()
  if (role === 'admin' || role === 'foreman') return role
  if (role === 'project-manager') return 'foreman'
  return 'none'
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

async function getAuthorizedUser(uid: string): Promise<AuthorizedTimecardUser> {
  const userSnap = await db.collection('users').doc(uid).get()
  if (!userSnap.exists) {
    throw new HttpsError('failed-precondition', 'Your user profile was not found.')
  }

  const data = userSnap.data() || {}
  const role = normalizeRole(data.role)
  const active = data.active === true
  const assignedJobIds = Array.isArray(data.assignedJobIds)
    ? data.assignedJobIds
        .filter((value: unknown): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
    : []
  const displayName = [text(data.firstName), text(data.lastName)].filter(Boolean).join(' ') || textOrNull(data.email)

  if (!active) {
    throw new HttpsError('permission-denied', 'Your account is inactive.')
  }

  if (!['admin', 'foreman'].includes(role)) {
    throw new HttpsError('permission-denied', 'Your account does not have access to timecards.')
  }

  return {
    uid,
    role,
    active,
    assignedJobIds,
    displayName,
  }
}

function assertCanAccessWeek(user: AuthorizedTimecardUser, week: any) {
  if (user.role === 'admin') return
  if (textOrNull(week?.ownerForemanUserId) === user.uid) return
  throw new HttpsError('permission-denied', 'You can only change your own timecard week.')
}

function getOwnerForemanUserId(user: AuthorizedTimecardUser, inputOwnerId: unknown) {
  if (user.role === 'foreman') return user.uid
  return textOrNull(inputOwnerId ?? user.uid)
}

function getOwnerForemanName(user: AuthorizedTimecardUser, inputOwnerName: unknown) {
  if (user.role === 'foreman') return user.displayName
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
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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

async function copyPreviousWeekCardsIntoDraft(input: {
  targetWeekId: string
  targetWeekRef: admin.firestore.DocumentReference
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

  let previousWeekQuery = db
    .collection('timecardWeeks')
    .where('jobId', '==', input.jobId)
    .where('weekEndDate', '==', getPreviousSaturday(input.weekEndDate))

  if (input.ownerForemanUserId) {
    previousWeekQuery = previousWeekQuery.where('ownerForemanUserId', '==', input.ownerForemanUserId)
  }

  const previousWeekSnap = await previousWeekQuery.limit(1).get()
  const previousWeekDoc = previousWeekSnap.docs[0]
  if (!previousWeekDoc) return 0

  const previousCardsSnap = await db
    .collection('timecardWeeks')
    .doc(previousWeekDoc.id)
    .collection('cards')
    .get()

  if (previousCardsSnap.empty) return 0

  const batch = db.batch()
  previousCardsSnap.docs
    .sort((left, right) => numberOrZero(left.data()?.sortIndex) - numberOrZero(right.data()?.sortIndex))
    .forEach((cardDoc, index) => {
      const nextCardRef = db.collection('timecardWeeks').doc(input.targetWeekId).collection('cards').doc()
      batch.set(nextCardRef, {
        ...sanitizeCardPayload(cloneCardForNewWeek(cardDoc.data(), input.weekStartDate), input.weekStartDate, index),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    })

  batch.update(input.targetWeekRef, {
    employeeCardCount: previousCardsSnap.size,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  await batch.commit()
  return previousCardsSnap.size
}

async function sendSubmittedWeekEmail(
  weekId: string,
  week: any,
  jobId: string,
  submittedByName: string | null,
): Promise<SubmitTimecardWeekResponse> {
  if (!isEmailEnabled()) {
    return {
      success: true,
      emailSent: false,
      emailMessage: 'Week submitted. Notification email is disabled in system settings.',
    }
  }

  const settings = await getEmailSettings()
  const recipients = normalizeRecipients(
    settings.globalNotificationRecipients.timecards,
    await getJobNotificationRecipients(jobId, 'timecards'),
  )

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
    to: recipients,
    subject: `${EMAIL.SUBJECTS.TIMECARD} - ${normalizedTimecards.length} timecard(s) - Week of ${weekStart}`,
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
  const ownerForemanUserId = getOwnerForemanUserId(user, input?.ownerForemanUserId)
  const ownerForemanName = getOwnerForemanName(user, input?.ownerForemanName)
  let jobCode = textOrNull(input?.jobCode)
  let jobName = textOrNull(input?.jobName)

  if (!jobCode || !jobName) {
    const jobDetails = await getJobDetails(jobId)
    jobCode = jobCode || textOrNull(jobDetails?.number)
    jobName = jobName || textOrNull(jobDetails?.name)
  }

  let existingQuery = db
    .collection('timecardWeeks')
    .where('jobId', '==', jobId)
    .where('weekEndDate', '==', weekEndDate)

  if (user.role === 'foreman') {
    existingQuery = existingQuery.where('ownerForemanUserId', '==', ownerForemanUserId)
  }

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
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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

  const { weekRef, week } = await getWeekDoc(weekId)
  const user = await getAuthorizedUser(request.auth.uid)
  assertCanAccessWeek(user, week)

  if (text(week.status) === 'submitted' && user.role === 'foreman') {
    throw new HttpsError('failed-precondition', SUBMITTED_WEEK_LOCKED_MESSAGE)
  }

  const createdRef = db.collection('timecardWeeks').doc(weekId).collection('cards').doc()
  await createdRef.set({
    ...sanitizeCardPayload(card, weekStartDate),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  await weekRef.update({
    employeeCardCount: admin.firestore.FieldValue.increment(1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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

  const { weekRef, week } = await getWeekDoc(weekId)
  const user = await getAuthorizedUser(request.auth.uid)
  assertCanAccessWeek(user, week)

  if (text(week.status) === 'submitted' && user.role === 'foreman') {
    throw new HttpsError('failed-precondition', SUBMITTED_WEEK_LOCKED_MESSAGE)
  }

  const cardRef = db.collection('timecardWeeks').doc(weekId).collection('cards').doc(cardId)
  const cardSnap = await cardRef.get()
  if (!cardSnap.exists) {
    throw new HttpsError('not-found', 'Timecard card not found.')
  }

  await cardRef.update(sanitizeCardPayload(card, weekStartDate))
  await weekRef.update({
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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

  const { weekRef, week } = await getWeekDoc(weekId)
  const user = await getAuthorizedUser(request.auth.uid)
  assertCanAccessWeek(user, week)

  if (text(week.status) === 'submitted' && user.role === 'foreman') {
    throw new HttpsError('failed-precondition', SUBMITTED_WEEK_LOCKED_MESSAGE)
  }

  const cardRef = db.collection('timecardWeeks').doc(weekId).collection('cards').doc(cardId)
  const cardSnap = await cardRef.get()
  if (!cardSnap.exists) {
    throw new HttpsError('not-found', 'Timecard card not found.')
  }

  await cardRef.delete()
  await weekRef.update({
    employeeCardCount: admin.firestore.FieldValue.increment(-1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
  if (user.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admins can delete timecard weeks.')
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

export const submitTimecardWeekRecord = onCall({ secrets: getGraphEmailSecrets() }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }

  const weekId = text(request.data?.weekId)
  if (!weekId) throw new HttpsError('invalid-argument', 'weekId is required')

  const { weekRef, week, jobId } = await getWeekDoc(weekId)
  const user = await getAuthorizedUser(request.auth.uid)
  assertCanAccessWeek(user, week)

  const submittedByUserId = textOrNull(request.data?.actor?.userId ?? request.auth.uid)
  const submittedByName = textOrNull(request.data?.actor?.displayName ?? user.displayName)

  await weekRef.update({
    status: 'submitted',
    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    submittedByUserId,
    submittedByName,
    updatedByUserId: request.auth.uid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  try {
    const emailResult = await sendSubmittedWeekEmail(weekId, {
      ...week,
      submittedByUserId,
      submittedByName,
      status: 'submitted',
    }, jobId, submittedByName)

    await weekRef.update({
      submittedEmailAttemptedAt: admin.firestore.FieldValue.serverTimestamp(),
      submittedEmailSentAt: emailResult.emailSent ? admin.firestore.FieldValue.serverTimestamp() : null,
      submittedEmailError: emailResult.emailSent ? admin.firestore.FieldValue.delete() : emailResult.emailMessage,
    })

    return emailResult
  } catch (error: any) {
    const emailMessage = `Week submitted, but the notification email failed: ${error?.message || 'Unknown error'}`
    console.error('[submitTimecardWeekRecord] Notification email failed', { weekId, jobId, error })

    await weekRef.update({
      submittedEmailAttemptedAt: admin.firestore.FieldValue.serverTimestamp(),
      submittedEmailSentAt: null,
      submittedEmailError: emailMessage,
    })

    return {
      success: true,
      emailSent: false,
      emailMessage,
    }
  }
})
