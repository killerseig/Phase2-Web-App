import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore'
import { requireFirebaseServices } from '@/firebase'
import type { JobRecord, JobType, NotificationModuleKey, NotificationRecipients } from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

export interface JobUpsertInput {
  name: string
  code: string
  type: JobType | string
  gc: string
  jobAddress: string
  startDate: string
  finishDate: string
  productionBurden: string
  assignedForemanIds: string[]
  notificationRecipients: NotificationRecipients
  active: boolean
}

export const NOTIFICATION_MODULE_KEYS: NotificationModuleKey[] = ['dailyLogs', 'timecards', 'shopOrders']

function normalizeAssignedIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)),
  )
}

function normalizeTextValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length ? value : null
}

function normalizeBurdenValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  const parsed = Number(typeof value === 'string' ? value.trim() : '')
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function normalizeNotificationRecipientList(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => entry.length > 0),
    ),
  )
}

function normalizeNotificationRecipients(
  value: unknown,
  legacyFallbacks?: Partial<NotificationRecipients>,
): NotificationRecipients {
  const data = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

  return {
    dailyLogs: normalizeNotificationRecipientList(data.dailyLogs ?? legacyFallbacks?.dailyLogs),
    timecards: normalizeNotificationRecipientList(data.timecards ?? legacyFallbacks?.timecards),
    shopOrders: normalizeNotificationRecipientList(data.shopOrders ?? legacyFallbacks?.shopOrders),
  }
}

function normalizeJob(id: string, data: DocumentData): JobRecord {
  const notificationRecipients = normalizeNotificationRecipients(data.notificationRecipients, {
    dailyLogs: data.dailyLogRecipients,
  })

  return {
    id,
    name: typeof data.name === 'string' ? data.name : 'Untitled Job',
    code: normalizeTextValue(data.code),
    gc: normalizeTextValue(data.gc),
    type: typeof data.type === 'string' ? data.type : 'general',
    projectManager: normalizeTextValue(data.projectManager),
    foreman: normalizeTextValue(data.foreman),
    jobAddress: normalizeTextValue(data.jobAddress),
    startDate: normalizeTextValue(data.startDate),
    finishDate: normalizeTextValue(data.finishDate),
    productionBurden: normalizeBurdenValue(data.productionBurden),
    active: data.active !== false,
    assignedForemanIds: normalizeAssignedIds(data.assignedForemanIds),
    timecardStatus: typeof data.timecardStatus === 'string' ? data.timecardStatus : null,
    timecardPeriodEndDate: typeof data.timecardPeriodEndDate === 'string' ? data.timecardPeriodEndDate : null,
    notificationRecipients,
    adminDailyLogRecipients: Array.isArray(data.adminDailyLogRecipients)
      ? data.adminDailyLogRecipients.filter((entry: unknown): entry is string => typeof entry === 'string')
      : [],
    dailyLogRecipients: Array.isArray(data.dailyLogRecipients)
      ? data.dailyLogRecipients.filter((entry: unknown): entry is string => typeof entry === 'string')
      : [],
  }
}

function sortJobs(jobs: JobRecord[]): JobRecord[] {
  return jobs.slice().sort((left, right) => {
    const leftActive = left.active !== false ? 0 : 1
    const rightActive = right.active !== false ? 0 : 1
    if (leftActive !== rightActive) return leftActive - rightActive

    const leftCode = left.code ?? ''
    const rightCode = right.code ?? ''
    if (leftCode !== rightCode) return leftCode.localeCompare(rightCode, undefined, { numeric: true })

    return left.name.localeCompare(right.name)
  })
}

function buildJobsQuery(assignedOnlyForUid?: string) {
  const { db } = requireFirebaseServices()
  if (assignedOnlyForUid) {
    return query(collection(db, 'jobs'), where('assignedForemanIds', 'array-contains', assignedOnlyForUid))
  }

  return query(collection(db, 'jobs'))
}

function chunkJobIds(jobIds: string[], chunkSize = 30) {
  const chunks: string[][] = []
  for (let index = 0; index < jobIds.length; index += chunkSize) {
    chunks.push(jobIds.slice(index, index + chunkSize))
  }
  return chunks
}

function sanitizeJobPayload(input: JobUpsertInput) {
  const burden = Number(input.productionBurden.trim())

  return {
    name: input.name.trim(),
    code: input.code.trim() || null,
    type: input.type || 'general',
    gc: input.gc.trim() || null,
    jobAddress: input.jobAddress.trim() || null,
    startDate: input.startDate.trim() || null,
    finishDate: input.finishDate.trim() || null,
    productionBurden: Number.isFinite(burden) ? burden : null,
    assignedForemanIds: normalizeAssignedIds(input.assignedForemanIds),
    notificationRecipients: normalizeNotificationRecipients(input.notificationRecipients),
    active: input.active,
  }
}

function sanitizeRecipientList(recipients: string[]) {
  return normalizeNotificationRecipientList(recipients)
}

async function syncJobForemanAssignments(jobId: string, nextAssignedForemanIds: string[]) {
  const { db } = requireFirebaseServices()
  const jobRef = doc(db, 'jobs', jobId)
  const jobSnapshot = await getDoc(jobRef)

  if (!jobSnapshot.exists()) {
    throw new Error('Job not found.')
  }

  const previousAssignedForemanIds = normalizeAssignedIds(jobSnapshot.data().assignedForemanIds)
  const effectiveAssignedForemanIds = normalizeAssignedIds(nextAssignedForemanIds)
  const changedForemanIds = Array.from(new Set([...previousAssignedForemanIds, ...effectiveAssignedForemanIds]))

  const batch = writeBatch(db)
  batch.update(jobRef, { assignedForemanIds: effectiveAssignedForemanIds })

  for (const foremanId of changedForemanIds) {
    const userRef = doc(db, 'users', foremanId)
    const userSnapshot = await getDoc(userRef)
    if (!userSnapshot.exists()) continue

    const currentAssignedJobIds = normalizeAssignedIds(userSnapshot.data().assignedJobIds)
    const nextAssignedJobIds = new Set(currentAssignedJobIds)

    if (effectiveAssignedForemanIds.includes(foremanId)) {
      nextAssignedJobIds.add(jobId)
    } else {
      nextAssignedJobIds.delete(jobId)
    }

    batch.update(userRef, { assignedJobIds: Array.from(nextAssignedJobIds) })
  }

  await batch.commit()
}

async function removeJobAssignments(jobId: string) {
  const { db } = requireFirebaseServices()
  const jobSnapshot = await getDoc(doc(db, 'jobs', jobId))
  if (!jobSnapshot.exists()) return

  const assignedForemanIds = normalizeAssignedIds(jobSnapshot.data().assignedForemanIds)
  if (!assignedForemanIds.length) return

  const batch = writeBatch(db)

  for (const foremanId of assignedForemanIds) {
    const userRef = doc(db, 'users', foremanId)
    const userSnapshot = await getDoc(userRef)
    if (!userSnapshot.exists()) continue

    const nextAssignedJobIds = normalizeAssignedIds(userSnapshot.data().assignedJobIds).filter((entry) => entry !== jobId)
    batch.update(userRef, { assignedJobIds: nextAssignedJobIds })
  }

  await batch.commit()
}

export function subscribeVisibleJobs(
  options: { assignedOnlyForUid?: string; assignedJobIds?: string[] } | undefined,
  onUpdate: (jobs: JobRecord[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const normalizedAssignedJobIds = normalizeAssignedIds(options?.assignedJobIds)
  if (normalizedAssignedJobIds.length > 0) {
    const { db } = requireFirebaseServices()
    const chunkedJobIds = chunkJobIds(normalizedAssignedJobIds)
    const chunkResults: JobRecord[][] = Array.from({ length: chunkedJobIds.length }, () => [])
    const unsubscribes = chunkedJobIds.map((jobIdChunk, chunkIndex) =>
      onSnapshot(
        query(collection(db, 'jobs'), where(documentId(), 'in', jobIdChunk)),
        (snapshot) => {
          chunkResults[chunkIndex] = snapshot.docs.map((item) => normalizeJob(item.id, item.data()))
          onUpdate(sortJobs(chunkResults.flat()))
        },
        (error) => {
          onError?.(error)
        },
      ),
    )

    if (chunkedJobIds.length === 0) {
      onUpdate([])
    }

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe())
    }
  }

  return onSnapshot(
    buildJobsQuery(options?.assignedOnlyForUid),
    (snapshot) => {
      onUpdate(sortJobs(snapshot.docs.map((item) => normalizeJob(item.id, item.data()))))
    },
    (error) => {
      onError?.(error)
    },
  )
}

export async function getJob(jobId: string): Promise<JobRecord | null> {
  try {
    const { db } = requireFirebaseServices()
    const snapshot = await getDoc(doc(db, 'jobs', jobId))
    if (!snapshot.exists()) return null
    return normalizeJob(snapshot.id, snapshot.data())
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to load job.'))
  }
}

export function subscribeJob(
  jobId: string,
  onUpdate: (job: JobRecord | null) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const { db } = requireFirebaseServices()

  return onSnapshot(
    doc(db, 'jobs', jobId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate(null)
        return
      }

      onUpdate(normalizeJob(snapshot.id, snapshot.data()))
    },
    (error) => {
      onError?.(error)
    },
  )
}

export function subscribeGlobalNotificationRecipients(
  onUpdate: (recipients: NotificationRecipients) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const { db } = requireFirebaseServices()

  return onSnapshot(
    doc(db, 'settings', 'email'),
    (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() : {}
      onUpdate(
        normalizeNotificationRecipients(
          data?.globalNotificationRecipients,
          {
            dailyLogs: data?.dailyLogSubmitRecipients,
            timecards: data?.timecardSubmitRecipients,
            shopOrders: data?.shopOrderSubmitRecipients,
          },
        ),
      )
    },
    (error) => {
      onError?.(error)
    },
  )
}

export async function createJobRecord(input: JobUpsertInput): Promise<string> {
  try {
    const { db } = requireFirebaseServices()
    const payload = sanitizeJobPayload(input)

    const created = await addDoc(collection(db, 'jobs'), {
      name: payload.name,
      code: payload.code,
      type: payload.type,
      gc: payload.gc,
      jobAddress: payload.jobAddress,
      startDate: payload.startDate,
      finishDate: payload.finishDate,
      productionBurden: payload.productionBurden,
      active: payload.active,
      archivedAt: payload.active ? null : serverTimestamp(),
      assignedForemanIds: payload.assignedForemanIds,
      timecardStatus: 'pending',
      timecardSubmittedAt: null,
      timecardPeriodEndDate: null,
      timecardLastSentWeekEnding: null,
      notificationRecipients: payload.notificationRecipients,
      adminDailyLogRecipients: [],
      dailyLogRecipients: payload.notificationRecipients.dailyLogs,
      createdAt: serverTimestamp(),
    })

    if (payload.assignedForemanIds.length) {
      await syncJobForemanAssignments(created.id, payload.assignedForemanIds)
    }

    return created.id
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to create job.'))
  }
}

export async function updateJobRecord(jobId: string, input: JobUpsertInput): Promise<void> {
  try {
    const { db } = requireFirebaseServices()
    const payload = sanitizeJobPayload(input)

    await updateDoc(doc(db, 'jobs', jobId), {
      name: payload.name,
      code: payload.code,
      type: payload.type,
      gc: payload.gc,
      jobAddress: payload.jobAddress,
      startDate: payload.startDate,
      finishDate: payload.finishDate,
      productionBurden: payload.productionBurden,
      active: payload.active,
      archivedAt: payload.active ? null : serverTimestamp(),
      notificationRecipients: payload.notificationRecipients,
      dailyLogRecipients: payload.notificationRecipients.dailyLogs,
    })

    await syncJobForemanAssignments(jobId, payload.assignedForemanIds)
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to update job.'))
  }
}

export async function setJobActive(jobId: string, active: boolean): Promise<void> {
  try {
    const { db } = requireFirebaseServices()
    await updateDoc(doc(db, 'jobs', jobId), {
      active,
      archivedAt: active ? null : serverTimestamp(),
    })
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to update job status.'))
  }
}

export async function deleteJobRecord(jobId: string): Promise<void> {
  try {
    await removeJobAssignments(jobId)
    const { db } = requireFirebaseServices()
    await deleteDoc(doc(db, 'jobs', jobId))
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to delete job.'))
  }
}

export async function updateJobDailyLogRecipients(jobId: string, recipients: string[]): Promise<void> {
  try {
    const { db } = requireFirebaseServices()
    await updateDoc(doc(db, 'jobs', jobId), {
      dailyLogRecipients: sanitizeRecipientList(recipients),
      'notificationRecipients.dailyLogs': sanitizeRecipientList(recipients),
    })
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to update daily log recipients.'))
  }
}

export async function updateJobAdminDailyLogRecipients(jobId: string, recipients: string[]): Promise<void> {
  try {
    const { db } = requireFirebaseServices()
    await updateDoc(doc(db, 'jobs', jobId), {
      adminDailyLogRecipients: sanitizeRecipientList(recipients),
    })
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to update office recipients.'))
  }
}

export async function updateJobNotificationRecipients(
  jobId: string,
  moduleKey: NotificationModuleKey,
  recipients: string[],
): Promise<void> {
  try {
    const { db } = requireFirebaseServices()
    const sanitized = sanitizeRecipientList(recipients)
    const payload: Record<string, unknown> = {
      [`notificationRecipients.${moduleKey}`]: sanitized,
    }

    if (moduleKey === 'dailyLogs') {
      payload.dailyLogRecipients = sanitized
    }

    await updateDoc(doc(db, 'jobs', jobId), payload)
  } catch (error) {
    throw new Error(normalizeError(error, `Failed to update ${moduleKey} recipients.`))
  }
}

export async function updateGlobalNotificationRecipients(
  moduleKey: NotificationModuleKey,
  recipients: string[],
): Promise<void> {
  try {
    const { db } = requireFirebaseServices()
    const sanitized = sanitizeRecipientList(recipients)
    const payload: Record<string, unknown> = {
      globalNotificationRecipients: {
        [moduleKey]: sanitized,
      },
    }

    if (moduleKey === 'dailyLogs') {
      payload.dailyLogSubmitRecipients = sanitized
    } else if (moduleKey === 'timecards') {
      payload.timecardSubmitRecipients = sanitized
    } else if (moduleKey === 'shopOrders') {
      payload.shopOrderSubmitRecipients = sanitized
    }

    await setDoc(doc(db, 'settings', 'email'), payload, { merge: true })
  } catch (error) {
    throw new Error(normalizeError(error, `Failed to update all-jobs ${moduleKey} recipients.`))
  }
}
