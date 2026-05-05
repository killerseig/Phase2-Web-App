import * as admin from 'firebase-admin'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { db } from './runtime'

type DailyLogRole = 'admin' | 'controller' | 'foreman' | 'none'
type DailyLogStatus = 'draft' | 'submitted'
type DailyLogAttachmentType = 'photo' | 'ptp' | 'qc' | 'other'

interface AuthorizedDailyLogUser {
  uid: string
  role: DailyLogRole
  active: boolean
  assignedJobIds: string[]
  displayName: string | null
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function textOrNull(value: unknown) {
  const normalized = text(value)
  return normalized || null
}

function normalizeRecipientList(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    ),
  )
}

function normalizeRole(value: unknown): DailyLogRole {
  const role = text(value).toLowerCase()
  if (role === 'admin' || role === 'controller' || role === 'foreman') return role
  return 'none'
}

function toStatus(value: unknown): DailyLogStatus {
  return value === 'submitted' ? 'submitted' : 'draft'
}

function sanitizeLineCount(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.round(parsed))
}

function sanitizeAttachmentType(value: unknown): DailyLogAttachmentType {
  return value === 'ptp' || value === 'qc' || value === 'other' ? value : 'photo'
}

function summarizeManpowerLines(lines: Array<{ trade: string; count: number; areas: string }>) {
  const summary = lines
    .filter((line) => line.trade.length > 0 && line.count > 0)
    .map((line) => (line.areas ? `${line.trade}: ${line.count} (${line.areas})` : `${line.trade}: ${line.count}`))

  return summary.join('; ')
}

function sanitizePayload(payload: any) {
  const manpowerLines = Array.isArray(payload?.manpowerLines)
    ? payload.manpowerLines.map((line: any) => ({
        trade: text(line?.trade),
        count: sanitizeLineCount(line?.count),
        areas: text(line?.areas),
        addedByUserId: textOrNull(line?.addedByUserId),
      }))
    : []

  const indoorClimateReadings = Array.isArray(payload?.indoorClimateReadings)
    ? payload.indoorClimateReadings.map((reading: any) => ({
        area: text(reading?.area),
        high: text(reading?.high),
        low: text(reading?.low),
        humidity: text(reading?.humidity),
      }))
    : []

  const attachments = Array.isArray(payload?.attachments)
    ? payload.attachments
        .map((attachment: any) => ({
          name: text(attachment?.name),
          url: text(attachment?.url),
          path: text(attachment?.path),
          type: sanitizeAttachmentType(attachment?.type),
          description: text(attachment?.description),
          createdAt: attachment?.createdAt ?? null,
        }))
        .filter((attachment: { name: string; url: string; path: string }) => attachment.name && attachment.url && attachment.path)
    : []

  return {
    jobSiteNumbers: text(payload?.jobSiteNumbers),
    foremanOnSite: text(payload?.foremanOnSite),
    siteForemanAssistant: text(payload?.siteForemanAssistant),
    projectName: text(payload?.projectName),
    manpower: summarizeManpowerLines(manpowerLines),
    weeklySchedule: text(payload?.weeklySchedule),
    manpowerAssessment: text(payload?.manpowerAssessment),
    indoorClimateReadings,
    manpowerLines,
    safetyConcerns: text(payload?.safetyConcerns),
    ahaReviewed: text(payload?.ahaReviewed),
    scheduleConcerns: text(payload?.scheduleConcerns),
    budgetConcerns: text(payload?.budgetConcerns),
    deliveriesReceived: text(payload?.deliveriesReceived),
    deliveriesNeeded: text(payload?.deliveriesNeeded),
    newWorkAuthorizations: text(payload?.newWorkAuthorizations),
    qcInspection: text(payload?.qcAreasInspected),
    qcAssignedTo: text(payload?.qcAssignedTo),
    qcAreasInspected: text(payload?.qcAreasInspected),
    qcIssuesIdentified: text(payload?.qcIssuesIdentified),
    qcIssuesResolved: text(payload?.qcIssuesResolved),
    notesCorrespondence: text(payload?.notesCorrespondence),
    actionItems: text(payload?.actionItems),
    attachments,
  }
}

async function getAuthorizedUser(uid: string): Promise<AuthorizedDailyLogUser> {
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

  if (!['admin', 'controller', 'foreman'].includes(role)) {
    throw new HttpsError('permission-denied', 'Your account does not have access to daily logs.')
  }

  return {
    uid,
    role,
    active,
    assignedJobIds,
    displayName,
  }
}

function assertCanWriteJob(user: AuthorizedDailyLogUser, jobId: string) {
  if (user.role === 'admin' || user.role === 'controller') return
  if (user.role === 'foreman' && user.assignedJobIds.includes(jobId)) return
  throw new HttpsError('permission-denied', 'You are not assigned to this job.')
}

async function getNextSequenceNumber(jobId: string, logDate: string) {
  const snapshot = await db
    .collection('dailyLogs')
    .where('jobId', '==', jobId)
    .where('logDate', '==', logDate)
    .get()

  const maxExisting = snapshot.docs.reduce((maxValue, entry) => {
    const parsed = Number(entry.data()?.sequenceNumber)
    const sequenceNumber = Number.isFinite(parsed) && parsed >= 1 ? Math.round(parsed) : 1
    return Math.max(maxValue, sequenceNumber)
  }, 0)

  return maxExisting + 1
}

async function getDailyLogDoc(dailyLogId: string) {
  const logRef = db.collection('dailyLogs').doc(dailyLogId)
  const logSnap = await logRef.get()
  if (!logSnap.exists) {
    throw new HttpsError('not-found', 'Daily log not found.')
  }

  const log = logSnap.data() || {}
  const jobId = text(log.jobId)
  if (!jobId) {
    throw new HttpsError('failed-precondition', 'Daily log is missing its job assignment.')
  }

  return { logRef, logSnap, log, jobId }
}

export const createDailyLogRecordCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }

  const jobId = text(request.data?.jobId)
  const logDate = text(request.data?.logDate)
  if (!jobId) throw new HttpsError('invalid-argument', 'jobId is required')
  if (!logDate) throw new HttpsError('invalid-argument', 'logDate is required')

  const user = await getAuthorizedUser(request.auth.uid)
  assertCanWriteJob(user, jobId)

  const sequenceNumber = await getNextSequenceNumber(jobId, logDate)
  const created = await db.collection('dailyLogs').add({
    jobId,
    jobCode: textOrNull(request.data?.jobCode),
    jobName: textOrNull(request.data?.jobName),
    logDate,
    sequenceNumber,
    status: 'draft',
    foremanUserId: textOrNull(request.data?.foremanUserId ?? request.auth.uid),
    foremanName: textOrNull(request.data?.foremanName ?? user.displayName),
    createdByUserId: request.auth.uid,
    updatedByUserId: request.auth.uid,
    submittedByUserId: null,
    additionalRecipients: normalizeRecipientList(request.data?.additionalRecipients),
    payload: sanitizePayload(request.data?.payload),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    submittedAt: null,
  })

  return { id: created.id }
})

export const updateDailyLogRecordCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }

  const dailyLogId = text(request.data?.dailyLogId)
  if (!dailyLogId) throw new HttpsError('invalid-argument', 'dailyLogId is required')

  const { logRef, log, jobId } = await getDailyLogDoc(dailyLogId)
  const user = await getAuthorizedUser(request.auth.uid)
  assertCanWriteJob(user, jobId)

  if (toStatus(log.status) === 'submitted' && user.role === 'foreman') {
    throw new HttpsError('failed-precondition', 'Submitted daily logs cannot be changed by foremen.')
  }

  const payload: Record<string, unknown> = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedByUserId: request.auth.uid,
  }

  if ('payload' in request.data && request.data?.payload) {
    payload.payload = sanitizePayload(request.data.payload)
  }

  if ('additionalRecipients' in request.data) {
    payload.additionalRecipients = normalizeRecipientList(request.data?.additionalRecipients)
  }

  if ('status' in request.data && request.data?.status) {
    const status = toStatus(request.data.status)
    payload.status = status

    if (status === 'submitted') {
      payload.submittedAt = admin.firestore.FieldValue.serverTimestamp()
      payload.submittedByUserId = textOrNull(request.data?.actor?.userId ?? request.auth.uid)
      payload.submittedByName = textOrNull(request.data?.actor?.displayName ?? user.displayName)
    }
  }

  await logRef.update(payload)
  return { success: true }
})

export const deleteDailyLogRecordCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }

  const dailyLogId = text(request.data?.dailyLogId)
  if (!dailyLogId) throw new HttpsError('invalid-argument', 'dailyLogId is required')

  const { logRef, log, jobId } = await getDailyLogDoc(dailyLogId)
  const user = await getAuthorizedUser(request.auth.uid)
  assertCanWriteJob(user, jobId)

  if (toStatus(log.status) === 'submitted' && user.role === 'foreman') {
    throw new HttpsError('failed-precondition', 'Submitted daily logs cannot be deleted by foremen.')
  }

  await logRef.delete()
  return { success: true }
})
