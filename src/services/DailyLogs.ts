import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import { requireFirebaseServices } from '@/firebase'
import {
  createEmptyDailyLogPayload,
  createEmptyIndoorClimateReading,
  createEmptyManpowerLine,
} from '@/features/dailyLogs/schema'
import type {
  DailyLogAttachmentRecord,
  DailyLogAttachmentType,
  DailyLogIndoorClimateReadingRecord,
  DailyLogManpowerLineRecord,
  DailyLogPayload,
  DailyLogRecord,
  DailyLogStatus,
} from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

export interface CreateDailyLogInput {
  jobId: string
  jobCode: string | null
  jobName: string | null
  logDate: string
  foremanUserId: string | null
  foremanName: string | null
  additionalRecipients?: string[]
  payload: DailyLogPayload
}

export interface UpdateDailyLogInput {
  payload?: DailyLogPayload
  status?: DailyLogStatus
  additionalRecipients?: string[]
}

export interface DailyLogActor {
  userId: string | null
  displayName: string | null
}

function toNullableText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length ? value.trim() : null
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

function sanitizeLineCount(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, Math.round(parsed))
}

function sanitizeAttachmentType(value: unknown): DailyLogAttachmentType {
  return value === 'ptp' || value === 'qc' || value === 'other' ? value : 'photo'
}

function sanitizeManpowerLine(line: DailyLogManpowerLineRecord): DailyLogManpowerLineRecord {
  return {
    trade: line.trade.trim(),
    count: sanitizeLineCount(line.count),
    areas: line.areas.trim(),
    addedByUserId: toNullableText(line.addedByUserId),
  }
}

function sanitizeIndoorClimateReading(reading: DailyLogIndoorClimateReadingRecord): DailyLogIndoorClimateReadingRecord {
  return {
    area: reading.area.trim(),
    high: reading.high.trim(),
    low: reading.low.trim(),
    humidity: reading.humidity.trim(),
  }
}

function sanitizeAttachment(attachment: DailyLogAttachmentRecord): DailyLogAttachmentRecord {
  return {
    name: attachment.name.trim(),
    url: attachment.url.trim(),
    path: attachment.path.trim(),
    type: sanitizeAttachmentType(attachment.type),
    description: attachment.description.trim(),
    createdAt: attachment.createdAt,
  }
}

function summarizeManpowerLines(lines: DailyLogManpowerLineRecord[]) {
  const summary = lines
    .filter((line) => line.trade.trim().length > 0 && sanitizeLineCount(line.count) > 0)
    .map((line) => {
      const trade = line.trade.trim()
      const count = sanitizeLineCount(line.count)
      const areas = line.areas.trim()
      return areas ? `${trade}: ${count} (${areas})` : `${trade}: ${count}`
    })

  return summary.join('; ')
}

function sanitizePayload(payload: DailyLogPayload): DailyLogPayload {
  const nextPayload = createEmptyDailyLogPayload(payload)
  nextPayload.jobSiteNumbers = nextPayload.jobSiteNumbers.trim()
  nextPayload.foremanOnSite = nextPayload.foremanOnSite.trim()
  nextPayload.siteForemanAssistant = nextPayload.siteForemanAssistant.trim()
  nextPayload.projectName = nextPayload.projectName.trim()
  nextPayload.weeklySchedule = nextPayload.weeklySchedule.trim()
  nextPayload.manpowerAssessment = nextPayload.manpowerAssessment.trim()
  nextPayload.manpowerLines = nextPayload.manpowerLines.map((line) => sanitizeManpowerLine(line))
  nextPayload.indoorClimateReadings = nextPayload.indoorClimateReadings.map((reading) => sanitizeIndoorClimateReading(reading))
  nextPayload.safetyConcerns = nextPayload.safetyConcerns.trim()
  nextPayload.ahaReviewed = nextPayload.ahaReviewed.trim()
  nextPayload.scheduleConcerns = nextPayload.scheduleConcerns.trim()
  nextPayload.budgetConcerns = nextPayload.budgetConcerns.trim()
  nextPayload.deliveriesReceived = nextPayload.deliveriesReceived.trim()
  nextPayload.deliveriesNeeded = nextPayload.deliveriesNeeded.trim()
  nextPayload.newWorkAuthorizations = nextPayload.newWorkAuthorizations.trim()
  nextPayload.qcAssignedTo = nextPayload.qcAssignedTo.trim()
  nextPayload.qcAreasInspected = nextPayload.qcAreasInspected.trim()
  nextPayload.qcIssuesIdentified = nextPayload.qcIssuesIdentified.trim()
  nextPayload.qcIssuesResolved = nextPayload.qcIssuesResolved.trim()
  nextPayload.notesCorrespondence = nextPayload.notesCorrespondence.trim()
  nextPayload.actionItems = nextPayload.actionItems.trim()
  nextPayload.attachments = nextPayload.attachments
    .map((attachment) => sanitizeAttachment(attachment))
    .filter((attachment) => attachment.name.length > 0 && attachment.path.length > 0 && attachment.url.length > 0)
  nextPayload.manpower = summarizeManpowerLines(nextPayload.manpowerLines)
  nextPayload.qcInspection = nextPayload.qcAreasInspected
  return nextPayload
}

function serializeAttachmentCreatedAt(value: unknown): string | null {
  if (typeof (value as { toDate?: () => Date })?.toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString()
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'string') {
    return value
  }

  return null
}

function serializePayloadForCallable(payload: DailyLogPayload) {
  const sanitized = sanitizePayload(payload)
  return {
    ...sanitized,
    attachments: sanitized.attachments.map((attachment) => ({
      ...attachment,
      createdAt: serializeAttachmentCreatedAt(attachment.createdAt),
    })),
  }
}

function normalizeManpowerLine(value: unknown): DailyLogManpowerLineRecord {
  if (!value || typeof value !== 'object') {
    return createEmptyManpowerLine()
  }

  const record = value as Record<string, unknown>
  return {
    trade: typeof record.trade === 'string' ? record.trade.trim() : '',
    count: sanitizeLineCount(record.count),
    areas: typeof record.areas === 'string' ? record.areas.trim() : '',
    addedByUserId: toNullableText(record.addedByUserId),
  }
}

function normalizeIndoorClimateReading(value: unknown): DailyLogIndoorClimateReadingRecord {
  if (!value || typeof value !== 'object') {
    return createEmptyIndoorClimateReading()
  }

  const record = value as Record<string, unknown>
  return {
    area: typeof record.area === 'string' ? record.area.trim() : '',
    high: typeof record.high === 'string' ? record.high.trim() : '',
    low: typeof record.low === 'string' ? record.low.trim() : '',
    humidity: typeof record.humidity === 'string' ? record.humidity.trim() : '',
  }
}

function normalizeAttachment(value: unknown): DailyLogAttachmentRecord | null {
  if (!value || typeof value !== 'object') return null

  const record = value as Record<string, unknown>
  const name = typeof record.name === 'string' ? record.name.trim() : ''
  const url = typeof record.url === 'string' ? record.url.trim() : ''
  const path = typeof record.path === 'string' ? record.path.trim() : ''

  if (!name || !url || !path) return null

  return {
    name,
    url,
    path,
    type: sanitizeAttachmentType(record.type),
    description: typeof record.description === 'string' ? record.description.trim() : '',
    createdAt: record.createdAt,
  }
}

function normalizePayload(data: DocumentData): DailyLogPayload {
  const payloadSource = data.payload && typeof data.payload === 'object'
    ? (data.payload as Record<string, unknown>)
    : (data as Record<string, unknown>)

  return sanitizePayload(createEmptyDailyLogPayload({
    jobSiteNumbers: typeof payloadSource.jobSiteNumbers === 'string' ? payloadSource.jobSiteNumbers : '',
    foremanOnSite: typeof payloadSource.foremanOnSite === 'string' ? payloadSource.foremanOnSite : '',
    siteForemanAssistant: typeof payloadSource.siteForemanAssistant === 'string' ? payloadSource.siteForemanAssistant : '',
    projectName: typeof payloadSource.projectName === 'string' ? payloadSource.projectName : '',
    manpower: typeof payloadSource.manpower === 'string' ? payloadSource.manpower : '',
    weeklySchedule: typeof payloadSource.weeklySchedule === 'string' ? payloadSource.weeklySchedule : '',
    manpowerAssessment: typeof payloadSource.manpowerAssessment === 'string' ? payloadSource.manpowerAssessment : '',
    indoorClimateReadings: Array.isArray(payloadSource.indoorClimateReadings)
      ? payloadSource.indoorClimateReadings.map((entry) => normalizeIndoorClimateReading(entry))
      : undefined,
    manpowerLines: Array.isArray(payloadSource.manpowerLines)
      ? payloadSource.manpowerLines.map((entry) => normalizeManpowerLine(entry))
      : undefined,
    safetyConcerns: typeof payloadSource.safetyConcerns === 'string' ? payloadSource.safetyConcerns : '',
    ahaReviewed: typeof payloadSource.ahaReviewed === 'string' ? payloadSource.ahaReviewed : '',
    scheduleConcerns: typeof payloadSource.scheduleConcerns === 'string' ? payloadSource.scheduleConcerns : '',
    budgetConcerns: typeof payloadSource.budgetConcerns === 'string' ? payloadSource.budgetConcerns : '',
    deliveriesReceived: typeof payloadSource.deliveriesReceived === 'string' ? payloadSource.deliveriesReceived : '',
    deliveriesNeeded: typeof payloadSource.deliveriesNeeded === 'string' ? payloadSource.deliveriesNeeded : '',
    newWorkAuthorizations: typeof payloadSource.newWorkAuthorizations === 'string' ? payloadSource.newWorkAuthorizations : '',
    qcInspection: typeof payloadSource.qcInspection === 'string' ? payloadSource.qcInspection : '',
    qcAssignedTo: typeof payloadSource.qcAssignedTo === 'string' ? payloadSource.qcAssignedTo : '',
    qcAreasInspected: typeof payloadSource.qcAreasInspected === 'string' ? payloadSource.qcAreasInspected : '',
    qcIssuesIdentified: typeof payloadSource.qcIssuesIdentified === 'string' ? payloadSource.qcIssuesIdentified : '',
    qcIssuesResolved: typeof payloadSource.qcIssuesResolved === 'string' ? payloadSource.qcIssuesResolved : '',
    notesCorrespondence: typeof payloadSource.notesCorrespondence === 'string' ? payloadSource.notesCorrespondence : '',
    actionItems: typeof payloadSource.actionItems === 'string' ? payloadSource.actionItems : '',
    attachments: Array.isArray(payloadSource.attachments)
      ? payloadSource.attachments
        .map((entry) => normalizeAttachment(entry))
        .filter((entry): entry is DailyLogAttachmentRecord => entry !== null)
      : undefined,
  }))
}

function normalizeSequenceNumber(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return Math.round(parsed)
}

function normalizeDailyLog(id: string, data: DocumentData): DailyLogRecord {
  return {
    id,
    jobId: typeof data.jobId === 'string' ? data.jobId : '',
    jobCode: toNullableText(data.jobCode),
    jobName: toNullableText(data.jobName),
    logDate: typeof data.logDate === 'string' ? data.logDate : '',
    sequenceNumber: normalizeSequenceNumber(data.sequenceNumber),
    status: data.status === 'submitted' ? 'submitted' : 'draft',
    foremanUserId: toNullableText(data.foremanUserId ?? data.uid),
    foremanName: toNullableText(data.foremanName ?? data.foremanOnSite),
    additionalRecipients: normalizeRecipientList(data.additionalRecipients),
    payload: normalizePayload(data),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    submittedAt: data.submittedAt,
  }
}

function toMillis(value: unknown): number {
  if (typeof (value as { toMillis?: () => number })?.toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis()
  }

  if (typeof (value as { toDate?: () => Date })?.toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime()
  }

  if (value instanceof Date) return value.getTime()

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime()
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function sortDailyLogs(logs: DailyLogRecord[]) {
  return logs
    .slice()
    .sort((left, right) => {
      const rank = (status: string) => (status === 'submitted' ? 0 : 1)
      if (rank(left.status) !== rank(right.status)) return rank(left.status) - rank(right.status)

      const rightTimestamp = toMillis(right.submittedAt) || toMillis(right.updatedAt) || toMillis(right.createdAt)
      const leftTimestamp = toMillis(left.submittedAt) || toMillis(left.updatedAt) || toMillis(left.createdAt)
      if (rightTimestamp !== leftTimestamp) return rightTimestamp - leftTimestamp

      if (right.sequenceNumber !== left.sequenceNumber) return right.sequenceNumber - left.sequenceNumber
      return right.id.localeCompare(left.id)
    })
}

export function subscribeDailyLogsForDate(
  jobId: string,
  logDate: string,
  onUpdate: (logs: DailyLogRecord[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const { db } = requireFirebaseServices()

  return onSnapshot(
    query(collection(db, 'dailyLogs'), where('jobId', '==', jobId), where('logDate', '==', logDate)),
    (snapshot) => {
      onUpdate(sortDailyLogs(snapshot.docs.map((entry) => normalizeDailyLog(entry.id, entry.data()))))
    },
    (error) => {
      onError?.(error)
    },
  )
}

export async function createDailyLogRecord(input: CreateDailyLogInput): Promise<string> {
  try {
    const { functions } = requireFirebaseServices()
    const callable = httpsCallable<
      CreateDailyLogInput,
      { id: string }
    >(functions, 'createDailyLogRecordCallable')

    const result = await callable({
      ...input,
      additionalRecipients: normalizeRecipientList(input.additionalRecipients),
      payload: serializePayloadForCallable(input.payload),
    })

    const id = String(result.data?.id || '').trim()
    if (!id) {
      throw new Error('Daily log did not return an id.')
    }

    return id
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to create daily log.'))
  }
}

export async function updateDailyLogRecord(
  dailyLogId: string,
  input: UpdateDailyLogInput,
  actor?: DailyLogActor,
): Promise<void> {
  try {
    const { functions } = requireFirebaseServices()
    const callable = httpsCallable<
      {
        dailyLogId: string
        payload?: DailyLogPayload
        status?: DailyLogStatus
        additionalRecipients?: string[]
        actor?: DailyLogActor
      },
      { success: boolean }
    >(functions, 'updateDailyLogRecordCallable')

    await callable({
      dailyLogId,
      ...(input.payload ? { payload: serializePayloadForCallable(input.payload) } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...('additionalRecipients' in input ? { additionalRecipients: normalizeRecipientList(input.additionalRecipients) } : {}),
      ...(actor ? { actor } : {}),
    })
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to update daily log.'))
  }
}

export async function deleteDailyLogRecord(dailyLogId: string): Promise<void> {
  try {
    const { functions } = requireFirebaseServices()
    const callable = httpsCallable<{ dailyLogId: string }, { success: boolean }>(
      functions,
      'deleteDailyLogRecordCallable',
    )
    await callable({ dailyLogId })
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to delete daily log.'))
  }
}

export async function uploadDailyLogAttachment(
  file: File,
  jobId: string,
  dailyLogId: string,
  type: DailyLogAttachmentType,
  description: string,
): Promise<DailyLogAttachmentRecord> {
  try {
    const { auth, storage } = requireFirebaseServices()
    const currentUserId = auth.currentUser?.uid
    if (!currentUserId) {
      throw new Error('You must be signed in to upload attachments.')
    }

    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_')
    const storagePath = `daily-logs/${dailyLogId}/${Date.now()}-${safeName}`
    const reference = storageRef(storage, storagePath)

    await uploadBytes(reference, file, {
      contentType: file.type || undefined,
      customMetadata: {
        jobId,
        dailyLogId,
        type,
        description: description.trim(),
        uploadedBy: currentUserId,
        uploadedAt: new Date().toISOString(),
      },
    })

    return {
      name: file.name,
      url: await getDownloadURL(reference),
      path: storagePath,
      type,
      description: description.trim(),
      createdAt: new Date(),
    }
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to upload daily log attachment.'))
  }
}

export async function deleteDailyLogAttachment(path: string): Promise<void> {
  try {
    const { storage } = requireFirebaseServices()
    await deleteObject(storageRef(storage, path))
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to delete daily log attachment.'))
  }
}
