import { db } from '../firebase'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore'
import type { Job as JobModel, JobType, TimecardStatus } from '@/types/models'
import { assertJobAccess } from './serviceGuards'
import { normalizeError } from './serviceUtils'

// Export type for backward compatibility, but use new models.ts types
export type Job = JobModel

/**
 * Normalize Firestore job document to Job type
 */
function normalize(id: string, data: DocumentData): Job {
  return {
    id,
    name: data.name,
    code: data.code ?? null,
    accountNumber: data.accountNumber ?? null,
    type: (data.type ?? 'general') as JobType,
    active: data.active ?? true,
    
    // Foreman & timecard tracking
    assignedForemanIds: data.assignedForemanIds ?? [],
    timecardStatus: data.timecardStatus ?? 'pending',
    timecardSubmittedAt: data.timecardSubmittedAt,
    timecardPeriodEndDate: data.timecardPeriodEndDate,
    timecardLastSentWeekEnding: data.timecardLastSentWeekEnding,
    
    createdAt: data.createdAt,
    archivedAt: data.archivedAt,
    dailyLogRecipients: data.dailyLogRecipients ?? [],
  }
}

export async function getJob(jobId: string): Promise<Job | null> {
  try {
    assertJobAccess(jobId)
    const ref = doc(db, 'jobs', jobId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return null
    return normalize(snap.id, snap.data())
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load job'))
  }
}

export async function listAllJobs(includeArchived = true, options?: { assignedOnlyForUid?: string }): Promise<Job[]> {
  try {
    const assignedUid = options?.assignedOnlyForUid

    const jobsQ = assignedUid
      ? query(collection(db, 'jobs'), where('assignedForemanIds', 'array-contains', assignedUid))
      : query(collection(db, 'jobs'), orderBy('name', 'asc'))

    const snap = await getDocs(jobsQ)
    
    let jobs = snap.docs.map((d) => normalize(d.id, d.data()))
    
    // Filter to active jobs only if not including archived
    if (!includeArchived) {
      jobs = jobs.filter(j => j.active)
    }

    // For foreman-restricted queries we sort client-side to avoid composite indexes
    if (assignedUid) {
      jobs = jobs.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }
    
    return jobs
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load jobs'))
  }
}

export async function createJob(
  name: string,
  options?: {
    code?: string
    accountNumber?: string
    type?: JobType
    assignedForemanIds?: string[]
  }
): Promise<string> {
  try {
    const ref = await addDoc(collection(db, 'jobs'), {
      name: name.trim(),
      code: options?.code?.trim() || null,
      accountNumber: options?.accountNumber?.trim() || null,
      type: options?.type ?? 'general',
      active: true,
      
      // Foreman & timecard tracking
      assignedForemanIds: options?.assignedForemanIds ?? [],
      timecardStatus: 'pending',
      timecardSubmittedAt: null,
      timecardPeriodEndDate: null,
      timecardLastSentWeekEnding: null,
      
      createdAt: serverTimestamp(),
      archivedAt: null,
      dailyLogRecipients: [],
    })
    return ref.id
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to create job'))
  }
}

export async function setJobActive(jobId: string, active: boolean) {
  try {
    const ref = doc(db, 'jobs', jobId)
    await updateDoc(ref, {
      active,
      archivedAt: active ? null : serverTimestamp(),
    })
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to update job status'))
  }
}

export async function updateJob(jobId: string, updates: { name?: string; code?: string }) {
  try {
    const ref = doc(db, 'jobs', jobId)
    const data: any = {}
    if (updates.name !== undefined) data.name = updates.name.trim()
    if (updates.code !== undefined) data.code = updates.code?.trim() || null
    await updateDoc(ref, data)
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to update job'))
  }
}

export async function deleteJob(jobId: string) {
  try {
    const ref = doc(db, 'jobs', jobId)
    await deleteDoc(ref)
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to delete job'))
  }
}

/**
 * Get daily log email recipients for a job
 */
export async function getDailyLogRecipients(jobId: string): Promise<string[]> {
  try {
    const job = await getJob(jobId)
    return job?.dailyLogRecipients ?? []
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load daily log recipients'))
  }
}

/**
 * Update daily log email recipients for a job
 */
export async function updateDailyLogRecipients(jobId: string, recipients: string[]): Promise<void> {
  try {
    const ref = doc(db, 'jobs', jobId)
    await updateDoc(ref, {
      dailyLogRecipients: recipients,
    })
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to update daily log recipients'))
  }
}


// ============================================================================
// FOREMAN ASSIGNMENT & MANAGEMENT
// ============================================================================

/**
 * Assign a foreman to a job
 */
export async function assignForemanToJob(jobId: string, foremanId: string): Promise<void> {
  try {
    const ref = doc(db, 'jobs', jobId)
    const job = await getJob(jobId)
    if (!job) throw new Error('Job not found')
    
    const currentForemen = job.assignedForemanIds ?? []
    if (!currentForemen.includes(foremanId)) {
      currentForemen.push(foremanId)
      await updateDoc(ref, { assignedForemanIds: currentForemen })
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'Job not found') {
      throw err
    }
    throw new Error(normalizeError(err, 'Failed to assign foreman'))
  }
}

/**
 * Remove a foreman from a job
 */
export async function removeForemanFromJob(jobId: string, foremanId: string): Promise<void> {
  try {
    const ref = doc(db, 'jobs', jobId)
    const job = await getJob(jobId)
    if (!job) throw new Error('Job not found')
    
    const currentForemen = job.assignedForemanIds ?? []
    const updated = currentForemen.filter(id => id !== foremanId)
    await updateDoc(ref, { assignedForemanIds: updated })
  } catch (err) {
    if (err instanceof Error && err.message === 'Job not found') {
      throw err
    }
    throw new Error(normalizeError(err, 'Failed to remove foreman'))
  }
}

/**
 * Get all foremen assigned to a job
 */
export async function getJobForemen(jobId: string): Promise<string[]> {
  try {
    const job = await getJob(jobId)
    return job?.assignedForemanIds ?? []
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load job foremen'))
  }
}

/**
 * Set which foremen are assigned to a job (replaces all)
 */
export async function setJobForemen(jobId: string, foremanIds: string[]): Promise<void> {
  try {
    const ref = doc(db, 'jobs', jobId)
    await updateDoc(ref, { assignedForemanIds: foremanIds })
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to set job foremen'))
  }
}

// ============================================================================
// TIMECARD STATUS MANAGEMENT
// ============================================================================

/**
 * Get the current timecard submission status for a job
 */
export async function getTimecardStatus(jobId: string): Promise<TimecardStatus | null> {
  try {
    const job = await getJob(jobId)
    return job?.timecardStatus ?? null
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load timecard status'))
  }
}

/**
 * Update timecard submission status
 */
export async function updateTimecardStatus(jobId: string, status: TimecardStatus): Promise<void> {
  try {
    const ref = doc(db, 'jobs', jobId)
    const payload: any = {
      timecardStatus: status,
    }
    
    // Set submission timestamp when status changes to 'submitted'
    if (status === 'submitted') {
      payload.timecardSubmittedAt = serverTimestamp()
    }
    
    await updateDoc(ref, payload)
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to update timecard status'))
  }
}

/**
 * Mark timecards as sent for a specific week (used for red/green job status)
 */
export async function markTimecardsSent(jobId: string, weekEndingDate: string): Promise<void> {
  try {
    const ref = doc(db, 'jobs', jobId)
    await updateDoc(ref, {
      timecardStatus: 'submitted',
      timecardSubmittedAt: serverTimestamp(),
      timecardPeriodEndDate: weekEndingDate,
      timecardLastSentWeekEnding: weekEndingDate,
    })
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to mark timecards as sent'))
  }
}

/**
 * Set the current timecard period end date (Saturday)
 */
export async function setTimecardPeriodEndDate(jobId: string, dateStr: string): Promise<void> {
  try {
    const ref = doc(db, 'jobs', jobId)
    await updateDoc(ref, {
      timecardPeriodEndDate: dateStr,
    })
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to set timecard period'))
  }
}

/**
 * Get the current timecard period end date
 */
export async function getTimecardPeriodEndDate(jobId: string): Promise<string | null> {
  try {
    const job = await getJob(jobId)
    return job?.timecardPeriodEndDate ?? null
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load timecard period'))
  }
}

// ============================================================================
// JOB TYPE & ACCOUNT VALIDATION
// ============================================================================

/**
 * Update job code and account number with validation
 */
export async function updateJobCodeAndAccount(
  jobId: string,
  code: string | null,
  accountNumber: string | null
): Promise<void> {
  try {
    const ref = doc(db, 'jobs', jobId)
    
    // Validation: if code is 3-digit GL code, account must be null
    const isGLCode = code && /^\d{3}$/.test(code)
    if (isGLCode && accountNumber) {
      throw new Error('Account number must be null when using a 3-digit GL code')
    }
    
    await updateDoc(ref, {
      code: code?.trim() || null,
      accountNumber: accountNumber?.trim() || null,
    })
  } catch (err) {
    if (err instanceof Error && err.message.includes('Account number must be null')) {
      throw err
    }
    throw new Error(normalizeError(err, 'Failed to update job code/account'))
  }
}

/**
 * Update job type (general or subcontractor)
 */
export async function updateJobType(jobId: string, type: JobType): Promise<void> {
  try {
    const ref = doc(db, 'jobs', jobId)
    await updateDoc(ref, { type })
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to update job type'))
  }
}
