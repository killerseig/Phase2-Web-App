import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { COLLECTIONS } from './constants'
import { isFunctionShopJob } from './jobIdentity'
import {
  buildCurrentFunctionUser,
  currentFunctionUserHasAnyRole,
  type CurrentFunctionUser,
} from './roleAccess'
import {
  targetFunctionRoleCanCreateJobs,
  targetFunctionRoleCanOpenJobDashboard,
  targetFunctionRoleCanEditJobSetup,
  targetFunctionRoleCanSeeJobListEntry,
} from './targetJobAccess'
import { targetFunctionRoleCanBeAssignedJobs } from './targetRoleCapabilities'
import { db } from './runtime'

interface VisibleJobRecord {
  id: string
  name: string
  code: string | null
  gc: string | null
  type: string
  projectManager: string | null
  foreman: string | null
  jobAddress: string | null
  startDate: string | null
  finishDate: string | null
  productionBurden: number | null
  active: boolean
  assignedForemanIds: string[]
  timecardStatus: string | null
  timecardPeriodEndDate: string | null
  notificationRecipients: {
    dailyLogs: string[]
    timecards: string[]
    shopOrders: string[]
  }
  adminDailyLogRecipients: string[]
  dailyLogRecipients: string[]
}

function text(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function textOrNull(value: unknown) {
  const normalized = text(value)
  return normalized || null
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0 && !entry.includes('/')),
    ),
  )
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

function normalizeNotificationRecipients(value: unknown, legacyDailyLogs: unknown) {
  const data = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

  return {
    dailyLogs: normalizeRecipientList(data.dailyLogs ?? legacyDailyLogs),
    timecards: normalizeRecipientList(data.timecards),
    shopOrders: normalizeRecipientList(data.shopOrders),
  }
}

function normalizeJobInput(value: unknown) {
  const data = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

  return {
    name: text(data.name),
    code: textOrNull(data.code),
    type: text(data.type) || 'general',
    gc: textOrNull(data.gc),
    jobAddress: textOrNull(data.jobAddress),
    startDate: textOrNull(data.startDate),
    finishDate: textOrNull(data.finishDate),
    productionBurden: numberOrNull(data.productionBurden),
    assignedForemanIds: normalizeIdList(data.assignedForemanIds),
    notificationRecipients: normalizeNotificationRecipients(data.notificationRecipients, data.dailyLogRecipients),
    active: data.active !== false,
  }
}

function normalizeJob(id: string, data: Record<string, unknown>): VisibleJobRecord {
  const code = textOrNull(data.code) ?? textOrNull(data.number)

  return {
    id,
    name: text(data.name) || 'Untitled Job',
    code,
    gc: textOrNull(data.gc),
    type: text(data.type) || 'general',
    projectManager: textOrNull(data.projectManager),
    foreman: textOrNull(data.foreman),
    jobAddress: textOrNull(data.jobAddress),
    startDate: textOrNull(data.startDate),
    finishDate: textOrNull(data.finishDate),
    productionBurden: numberOrNull(data.productionBurden),
    active: data.active !== false,
    assignedForemanIds: normalizeIdList(data.assignedForemanIds),
    timecardStatus: textOrNull(data.timecardStatus),
    timecardPeriodEndDate: textOrNull(data.timecardPeriodEndDate),
    notificationRecipients: normalizeNotificationRecipients(data.notificationRecipients, data.dailyLogRecipients),
    adminDailyLogRecipients: normalizeRecipientList(data.adminDailyLogRecipients),
    dailyLogRecipients: normalizeRecipientList(data.dailyLogRecipients),
  }
}

function sortJobs(jobs: VisibleJobRecord[]) {
  return jobs.slice().sort((left, right) => {
    const leftActive = left.active !== false ? 0 : 1
    const rightActive = right.active !== false ? 0 : 1
    if (leftActive !== rightActive) return leftActive - rightActive

    const codeComparison = (left.code ?? '').localeCompare(right.code ?? '', undefined, { numeric: true })
    if (codeComparison !== 0) return codeComparison

    return left.name.localeCompare(right.name)
  })
}

async function getAuthorizedUser(uid: string): Promise<CurrentFunctionUser> {
  const userSnap = await db.collection(COLLECTIONS.USERS).doc(uid).get()
  if (!userSnap.exists) {
    throw new HttpsError('failed-precondition', 'Your user profile was not found.')
  }

  const user = buildCurrentFunctionUser(uid, userSnap.data() || {})
  if (!user.active) {
    throw new HttpsError('permission-denied', 'Your account is inactive.')
  }

  if (!currentFunctionUserHasAnyRole(user, ['admin', 'payroll', 'shop-foreman', 'project-manager', 'foreman'])) {
    throw new HttpsError('permission-denied', 'Your account does not have access to jobs.')
  }

  return user
}

function buildAccessAssignedJobIds(user: CurrentFunctionUser, job: VisibleJobRecord) {
  const assignedJobIds = new Set(user.assignedJobIds)
  if (job.assignedForemanIds.includes(user.uid)) {
    assignedJobIds.add(job.id)
  }
  return Array.from(assignedJobIds)
}

function canSeeJob(user: CurrentFunctionUser, job: VisibleJobRecord) {
  return targetFunctionRoleCanSeeJobListEntry({
    assignedJobIds: buildAccessAssignedJobIds(user, job),
    isShopJob: isFunctionShopJob({ name: job.name, number: job.code }),
    jobId: job.id,
    role: user.role,
  })
}

function canOpenJob(user: CurrentFunctionUser, job: VisibleJobRecord) {
  return targetFunctionRoleCanOpenJobDashboard({
    assignedJobIds: buildAccessAssignedJobIds(user, job),
    isShopJob: isFunctionShopJob({ name: job.name, number: job.code }),
    jobId: job.id,
    role: user.role,
  }) || canSeeJob(user, job)
}

function canEditJob(user: CurrentFunctionUser, job: VisibleJobRecord) {
  return targetFunctionRoleCanEditJobSetup({
    assignedJobIds: buildAccessAssignedJobIds(user, job),
    isShopJob: isFunctionShopJob({ name: job.name, number: job.code }),
    jobId: job.id,
    role: user.role,
  })
}

async function syncJobForemanAssignments(jobId: string, previousAssignedForemanIds: string[], nextAssignedForemanIds: string[]) {
  const effectiveAssignedForemanIds = normalizeIdList(nextAssignedForemanIds)
  const changedForemanIds = Array.from(new Set([...previousAssignedForemanIds, ...effectiveAssignedForemanIds]))
  const batch = db.batch()

  for (const foremanId of changedForemanIds) {
    const userRef = db.collection(COLLECTIONS.USERS).doc(foremanId)
    const userSnapshot = await userRef.get()
    if (!userSnapshot.exists) continue

    const currentAssignedJobIds = normalizeIdList(userSnapshot.data()?.assignedJobIds)
    const nextAssignedJobIds = new Set(currentAssignedJobIds)

    if (effectiveAssignedForemanIds.includes(foremanId)) {
      nextAssignedJobIds.add(jobId)
    } else {
      nextAssignedJobIds.delete(jobId)
    }

    batch.update(userRef, { assignedJobIds: Array.from(nextAssignedJobIds) })
  }

  return batch
}

async function filterAssignableUserIds(userIds: string[]) {
  const assignableUserIds: string[] = []

  await Promise.all(normalizeIdList(userIds).map(async (userId) => {
    const snapshot = await db.collection(COLLECTIONS.USERS).doc(userId).get()
    if (!snapshot.exists) return

    const user = buildCurrentFunctionUser(snapshot.id, snapshot.data() || {})
    if (!user.active || !targetFunctionRoleCanBeAssignedJobs(user.role)) return

    assignableUserIds.push(userId)
  }))

  return normalizeIdList(assignableUserIds)
}

async function readAssignedJobsById(assignedJobIds: string[]) {
  const jobsById = new Map<string, VisibleJobRecord>()

  await Promise.all(assignedJobIds.map(async (jobId) => {
    const snapshot = await db.collection(COLLECTIONS.JOBS).doc(jobId).get()
    if (!snapshot.exists) return
    jobsById.set(snapshot.id, normalizeJob(snapshot.id, snapshot.data() || {}))
  }))

  return jobsById
}

async function readJobsAssignedOnJobRecord(uid: string) {
  const snapshot = await db
    .collection(COLLECTIONS.JOBS)
    .where('assignedForemanIds', 'array-contains', uid)
    .get()

  return snapshot.docs.map((entry) => normalizeJob(entry.id, entry.data() || {}))
}

export const listVisibleJobsForCurrentUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }

  const user = await getAuthorizedUser(request.auth.uid)
  const jobsById = new Map<string, VisibleJobRecord>()

  if (targetFunctionRoleCanSeeJobListEntry({
    assignedJobIds: user.assignedJobIds,
    isShopJob: false,
    jobId: '__all__',
    role: user.role,
  })) {
    const snapshot = await db.collection(COLLECTIONS.JOBS).get()
    snapshot.docs.forEach((entry) => {
      jobsById.set(entry.id, normalizeJob(entry.id, entry.data() || {}))
    })
  } else {
    const assignedByUserProfile = await readAssignedJobsById(normalizeIdList(user.assignedJobIds))
    assignedByUserProfile.forEach((job, jobId) => jobsById.set(jobId, job))

    const assignedOnJobRecords = await readJobsAssignedOnJobRecord(user.uid)
    assignedOnJobRecords.forEach((job) => jobsById.set(job.id, job))
  }

  return {
    jobs: sortJobs(Array.from(jobsById.values()).filter((job) => canSeeJob(user, job))),
  }
})

export const getVisibleJobForCurrentUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }

  const jobId = text(request.data?.jobId)
  if (!jobId || jobId.includes('/')) {
    throw new HttpsError('invalid-argument', 'jobId is required.')
  }

  const user = await getAuthorizedUser(request.auth.uid)
  const snapshot = await db.collection(COLLECTIONS.JOBS).doc(jobId).get()
  if (!snapshot.exists) {
    return { job: null }
  }

  const job = normalizeJob(snapshot.id, snapshot.data() || {})
  if (!canOpenJob(user, job)) {
    throw new HttpsError('permission-denied', 'Your account does not have access to this job.')
  }

  return { job }
})

export const createJobRecordCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }

  const user = await getAuthorizedUser(request.auth.uid)
  if (!targetFunctionRoleCanCreateJobs(user.role)) {
    throw new HttpsError('permission-denied', 'Your account cannot create jobs.')
  }

  const input = normalizeJobInput(request.data?.job)
  if (!input.name) {
    throw new HttpsError('invalid-argument', 'Job name is required.')
  }

  const isAdmin = currentFunctionUserHasAnyRole(user, ['admin'])
  const nextActive = isAdmin ? input.active : true
  const jobRef = db.collection(COLLECTIONS.JOBS).doc()
  const assignedForemanIds = await filterAssignableUserIds(input.assignedForemanIds)
  const assignmentBatch = await syncJobForemanAssignments(jobRef.id, [], assignedForemanIds)

  assignmentBatch.set(jobRef, {
    name: input.name,
    code: input.code,
    type: input.type,
    gc: input.gc,
    jobAddress: input.jobAddress,
    startDate: input.startDate,
    finishDate: input.finishDate,
    productionBurden: input.productionBurden,
    active: nextActive,
    archivedAt: nextActive ? null : FieldValue.serverTimestamp(),
    assignedForemanIds,
    timecardStatus: 'pending',
    timecardSubmittedAt: null,
    timecardPeriodEndDate: null,
    timecardLastSentWeekEnding: null,
    notificationRecipients: input.notificationRecipients,
    adminDailyLogRecipients: [],
    dailyLogRecipients: input.notificationRecipients.dailyLogs,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  await assignmentBatch.commit()

  return { id: jobRef.id }
})

export const updateJobRecordCallable = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.')
  }

  const jobId = text(request.data?.jobId)
  if (!jobId || jobId.includes('/')) {
    throw new HttpsError('invalid-argument', 'jobId is required.')
  }

  const user = await getAuthorizedUser(request.auth.uid)
  const jobRef = db.collection(COLLECTIONS.JOBS).doc(jobId)
  const snapshot = await jobRef.get()

  if (!snapshot.exists) {
    throw new HttpsError('not-found', 'Job not found.')
  }

  const existingJob = normalizeJob(snapshot.id, snapshot.data() || {})
  if (!canEditJob(user, existingJob)) {
    throw new HttpsError('permission-denied', 'Your account cannot edit this job.')
  }

  const input = normalizeJobInput(request.data?.job)
  if (!input.name) {
    throw new HttpsError('invalid-argument', 'Job name is required.')
  }

  const isAdmin = currentFunctionUserHasAnyRole(user, ['admin'])
  const nextActive = isAdmin ? input.active : existingJob.active
  const assignedForemanIds = await filterAssignableUserIds(input.assignedForemanIds)
  const assignmentBatch = await syncJobForemanAssignments(jobId, existingJob.assignedForemanIds, assignedForemanIds)

  assignmentBatch.update(jobRef, {
    name: input.name,
    code: input.code,
    type: input.type,
    gc: input.gc,
    jobAddress: input.jobAddress,
    startDate: input.startDate,
    finishDate: input.finishDate,
    productionBurden: input.productionBurden,
    active: nextActive,
    archivedAt: nextActive ? null : snapshot.data()?.archivedAt ?? null,
    assignedForemanIds,
    notificationRecipients: input.notificationRecipients,
    dailyLogRecipients: input.notificationRecipients.dailyLogs,
  })

  await assignmentBatch.commit()

  return { success: true }
})
