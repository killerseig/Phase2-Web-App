import {
  createE2EJob,
  deleteE2EJob,
  isE2EActive,
  setE2EJobActive,
  subscribeE2EVisibleJobs,
  subscribeE2EGlobalNotificationRecipients,
  updateE2EGlobalNotificationRecipients,
  updateE2EJob,
  updateE2EJobNotificationRecipients,
} from '@/testing/e2eRuntime'
import {
  collection,
  deleteDoc,
  doc,
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
import { httpsCallable } from 'firebase/functions'
import { requireFirebaseServices } from '@/firebase'
import type {
  GlobalNotificationModuleKey,
  GlobalNotificationRecipients,
  JobRecord,
  JobType,
  NotificationModuleKey,
  NotificationRecipients,
} from '@/types/domain'
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

export const NOTIFICATION_MODULE_KEYS: NotificationModuleKey[] = [
  'dailyLogs',
  'timecards',
  'shopOrders',
]

function normalizeAssignedIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value.filter(
        (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
      ),
    ),
  )
}

function normalizeTextValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
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

function normalizeGlobalNotificationRecipients(
  value: unknown,
  legacyFallbacks?: Partial<NotificationRecipients>,
): GlobalNotificationRecipients {
  const data = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

  return {
    ...normalizeNotificationRecipients(data, legacyFallbacks),
    newJobs: normalizeNotificationRecipientList(data.newJobs),
    fieldUserAssignments: normalizeNotificationRecipientList(data.fieldUserAssignments),
  }
}

function normalizeJob(id: string, data: DocumentData): JobRecord {
  const notificationRecipients = normalizeNotificationRecipients(data.notificationRecipients, {
    dailyLogs: data.dailyLogRecipients,
  })

  return {
    id,
    name: typeof data.name === 'string' ? data.name : 'Untitled Job',
    code: normalizeTextValue(data.code ?? data.number),
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
    timecardPeriodEndDate:
      typeof data.timecardPeriodEndDate === 'string' ? data.timecardPeriodEndDate : null,
    notificationRecipients,
    adminDailyLogRecipients: Array.isArray(data.adminDailyLogRecipients)
      ? data.adminDailyLogRecipients.filter(
          (entry: unknown): entry is string => typeof entry === 'string',
        )
      : [],
    dailyLogRecipients: Array.isArray(data.dailyLogRecipients)
      ? data.dailyLogRecipients.filter(
          (entry: unknown): entry is string => typeof entry === 'string',
        )
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
    if (leftCode !== rightCode)
      return leftCode.localeCompare(rightCode, undefined, { numeric: true })

    return left.name.localeCompare(right.name)
  })
}

function normalizeCallableJob(raw: unknown): JobRecord | null {
  if (!raw || typeof raw !== 'object') return null

  const data = raw as DocumentData & { id?: unknown }
  const id = typeof data.id === 'string' ? data.id.trim() : ''
  if (!id) return null

  return normalizeJob(id, data)
}

async function listVisibleJobsFromFunction(): Promise<JobRecord[]> {
  const { functions } = requireFirebaseServices()
  const callable = httpsCallable<Record<string, never>, { jobs?: unknown[] }>(
    functions,
    'listVisibleJobsForCurrentUser',
  )
  const result = await callable({})
  const jobs = Array.isArray(result.data?.jobs) ? result.data.jobs : []
  return sortJobs(
    jobs.map((entry) => normalizeCallableJob(entry)).filter((entry): entry is JobRecord => !!entry),
  )
}

async function getVisibleJobFromFunction(jobId: string): Promise<JobRecord | null> {
  const { functions } = requireFirebaseServices()
  const callable = httpsCallable<{ jobId: string }, { job?: unknown | null }>(
    functions,
    'getVisibleJobForCurrentUser',
  )
  const result = await callable({ jobId })
  return normalizeCallableJob(result.data?.job)
}

function buildJobsQuery(assignedOnlyForUid?: string) {
  const { db } = requireFirebaseServices()
  if (assignedOnlyForUid) {
    return query(
      collection(db, 'jobs'),
      where('assignedForemanIds', 'array-contains', assignedOnlyForUid),
    )
  }

  return query(collection(db, 'jobs'))
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

    const nextAssignedJobIds = normalizeAssignedIds(userSnapshot.data().assignedJobIds).filter(
      (entry) => entry !== jobId,
    )
    batch.update(userRef, { assignedJobIds: nextAssignedJobIds })
  }

  await batch.commit()
}

export function subscribeVisibleJobs(
  options: { assignedOnlyForUid?: string; assignedJobIds?: string[] } | undefined,
  onUpdate: (jobs: JobRecord[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  if (isE2EActive()) {
    return subscribeE2EVisibleJobs(options, onUpdate)
  }

  const normalizedAssignedJobIds = normalizeAssignedIds(options?.assignedJobIds)
  const assignedOnlyForUid = options?.assignedOnlyForUid

  if (options || normalizedAssignedJobIds.length > 0 || assignedOnlyForUid) {
    let active = true

    void listVisibleJobsFromFunction()
      .then((nextJobs) => {
        if (!active) return
        onUpdate(nextJobs)
      })
      .catch((error) => {
        if (!active) return
        onError?.(error)
      })

    return () => {
      active = false
    }
  }

  return onSnapshot(
    buildJobsQuery(),
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
    try {
      return await getVisibleJobFromFunction(jobId)
    } catch {
      // Report the original Firestore error so the message still points at the read that failed.
    }
    throw new Error(normalizeError(error, 'Failed to load job.'))
  }
}

export function subscribeJob(
  jobId: string,
  onUpdate: (job: JobRecord | null) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  const { db } = requireFirebaseServices()
  let active = true

  const unsubscribe = onSnapshot(
    doc(db, 'jobs', jobId),
    (snapshot) => {
      if (!active) return
      if (!snapshot.exists()) {
        onUpdate(null)
        return
      }

      onUpdate(normalizeJob(snapshot.id, snapshot.data()))
    },
    (error) => {
      void getVisibleJobFromFunction(jobId)
        .then((job) => {
          if (!active) return
          onUpdate(job)
        })
        .catch(() => {
          if (!active) return
          onError?.(error)
        })
    },
  )

  return () => {
    active = false
    unsubscribe()
  }
}

export function subscribeGlobalNotificationRecipients(
  onUpdate: (recipients: GlobalNotificationRecipients) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  if (isE2EActive()) {
    return subscribeE2EGlobalNotificationRecipients(onUpdate)
  }

  const { db } = requireFirebaseServices()

  return onSnapshot(
    doc(db, 'settings', 'email'),
    (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() : {}
      onUpdate(
        normalizeGlobalNotificationRecipients(data?.globalNotificationRecipients, {
          dailyLogs: data?.dailyLogSubmitRecipients,
          timecards: data?.timecardSubmitRecipients,
          shopOrders: data?.shopOrderSubmitRecipients,
        }),
      )
    },
    (error) => {
      onError?.(error)
    },
  )
}

export async function createJobRecord(input: JobUpsertInput): Promise<string> {
  if (isE2EActive()) {
    return createE2EJob(input)
  }

  try {
    const { functions } = requireFirebaseServices()
    const payload = sanitizeJobPayload(input)
    const callable = httpsCallable<
      { job: ReturnType<typeof sanitizeJobPayload> },
      { id?: unknown }
    >(functions, 'createJobRecordCallable')

    const result = await callable({ job: payload })
    if (typeof result.data?.id !== 'string' || !result.data.id.trim()) {
      throw new Error('Job was created, but the server did not return a job id.')
    }

    return result.data.id
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to create job.'))
  }
}

export async function updateJobRecord(jobId: string, input: JobUpsertInput): Promise<void> {
  if (isE2EActive()) {
    await updateE2EJob(jobId, input)
    return
  }

  try {
    const { functions } = requireFirebaseServices()
    const payload = sanitizeJobPayload(input)
    const callable = httpsCallable<
      { jobId: string; job: ReturnType<typeof sanitizeJobPayload> },
      { success: boolean }
    >(functions, 'updateJobRecordCallable')

    await callable({ jobId, job: payload })
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to update job.'))
  }
}

export async function setJobActive(jobId: string, active: boolean): Promise<void> {
  if (isE2EActive()) {
    await setE2EJobActive(jobId, active)
    return
  }

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
  if (isE2EActive()) {
    await deleteE2EJob(jobId)
    return
  }

  try {
    await removeJobAssignments(jobId)
    const { db } = requireFirebaseServices()
    await deleteDoc(doc(db, 'jobs', jobId))
  } catch (error) {
    throw new Error(normalizeError(error, 'Failed to delete job.'))
  }
}

export async function updateJobDailyLogRecipients(
  jobId: string,
  recipients: string[],
): Promise<void> {
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

export async function updateJobAdminDailyLogRecipients(
  jobId: string,
  recipients: string[],
): Promise<void> {
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
  if (isE2EActive()) {
    await updateE2EJobNotificationRecipients(jobId, moduleKey, recipients)
    return
  }

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
  moduleKey: GlobalNotificationModuleKey,
  recipients: string[],
): Promise<void> {
  if (isE2EActive()) {
    await updateE2EGlobalNotificationRecipients(moduleKey, recipients)
    return
  }

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
