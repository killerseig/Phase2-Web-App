import { auth, db } from '../firebase'
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
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import type { Job as JobModel, JobType, TimecardStatus } from '@/types/models'

// Export type for backward compatibility, but use new models.ts types
export type Job = JobModel

function requireUser() {
  const u = auth.currentUser
  if (!u) throw new Error('Not signed in')
  return u
}

/**
 * Normalize Firestore job document to Job type
 */
function normalize(id: string, data: any): Job {
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
    
    createdAt: data.createdAt,
    archivedAt: data.archivedAt,
    dailyLogRecipients: data.dailyLogRecipients ?? [],
  }
}

export async function getJob(jobId: string): Promise<Job | null> {
  const ref = doc(db, 'jobs', jobId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return normalize(snap.id, snap.data())
}

export async function listAllJobs(includeArchived = true): Promise<Job[]> {
  // Fetch all jobs sorted by name
  const jobsQ = query(collection(db, 'jobs'), orderBy('name', 'asc'))
  const snap = await getDocs(jobsQ)
  
  let jobs = snap.docs.map((d) => normalize(d.id, d.data()))
  
  // Filter to active jobs only if not including archived
  if (!includeArchived) {
    jobs = jobs.filter(j => j.active)
  }
  
  return jobs
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
    
    createdAt: serverTimestamp(),
    archivedAt: null,
    dailyLogRecipients: [],
  })
  return ref.id
}

export async function setJobActive(jobId: string, active: boolean) {
  const ref = doc(db, 'jobs', jobId)
  await updateDoc(ref, {
    active,
    archivedAt: active ? null : serverTimestamp(),
  })
}

export async function updateJob(jobId: string, updates: { name?: string; code?: string }) {
  const ref = doc(db, 'jobs', jobId)
  const data: any = {}
  if (updates.name !== undefined) data.name = updates.name.trim()
  if (updates.code !== undefined) data.code = updates.code?.trim() || null
  await updateDoc(ref, data)
}

export async function deleteJob(jobId: string) {
  const ref = doc(db, 'jobs', jobId)
  await deleteDoc(ref)
}

/**
 * Get daily log email recipients for a job
 */
export async function getDailyLogRecipients(jobId: string): Promise<string[]> {
  const job = await getJob(jobId)
  return job?.dailyLogRecipients ?? []
}

/**
 * Update daily log email recipients for a job
 */
export async function updateDailyLogRecipients(jobId: string, recipients: string[]): Promise<void> {
  const ref = doc(db, 'jobs', jobId)
  await updateDoc(ref, {
    dailyLogRecipients: recipients,
  })
}

// ============================================================================
// FOREMAN ASSIGNMENT & MANAGEMENT
// ============================================================================

/**
 * Assign a foreman to a job
 */
export async function assignForemanToJob(jobId: string, foremanId: string): Promise<void> {
  const ref = doc(db, 'jobs', jobId)
  const job = await getJob(jobId)
  if (!job) throw new Error('Job not found')
  
  const currentForemen = job.assignedForemanIds ?? []
  if (!currentForemen.includes(foremanId)) {
    currentForemen.push(foremanId)
    await updateDoc(ref, { assignedForemanIds: currentForemen })
  }
}

/**
 * Remove a foreman from a job
 */
export async function removeForemanFromJob(jobId: string, foremanId: string): Promise<void> {
  const ref = doc(db, 'jobs', jobId)
  const job = await getJob(jobId)
  if (!job) throw new Error('Job not found')
  
  const currentForemen = job.assignedForemanIds ?? []
  const updated = currentForemen.filter(id => id !== foremanId)
  await updateDoc(ref, { assignedForemanIds: updated })
}

/**
 * Get all foremen assigned to a job
 */
export async function getJobForemen(jobId: string): Promise<string[]> {
  const job = await getJob(jobId)
  return job?.assignedForemanIds ?? []
}

/**
 * Set which foremen are assigned to a job (replaces all)
 */
export async function setJobForemen(jobId: string, foremanIds: string[]): Promise<void> {
  const ref = doc(db, 'jobs', jobId)
  await updateDoc(ref, { assignedForemanIds: foremanIds })
}

// ============================================================================
// TIMECARD STATUS MANAGEMENT
// ============================================================================

/**
 * Get the current timecard submission status for a job
 */
export async function getTimecardStatus(jobId: string): Promise<TimecardStatus | null> {
  const job = await getJob(jobId)
  return job?.timecardStatus ?? null
}

/**
 * Update timecard submission status
 */
export async function updateTimecardStatus(jobId: string, status: TimecardStatus): Promise<void> {
  const ref = doc(db, 'jobs', jobId)
  const payload: any = {
    timecardStatus: status,
  }
  
  // Set submission timestamp when status changes to 'submitted'
  if (status === 'submitted') {
    payload.timecardSubmittedAt = serverTimestamp()
  }
  
  await updateDoc(ref, payload)
}

/**
 * Set the current timecard period end date (Saturday)
 */
export async function setTimecardPeriodEndDate(jobId: string, dateStr: string): Promise<void> {
  const ref = doc(db, 'jobs', jobId)
  await updateDoc(ref, {
    timecardPeriodEndDate: dateStr,
  })
}

/**
 * Get the current timecard period end date
 */
export async function getTimecardPeriodEndDate(jobId: string): Promise<string | null> {
  const job = await getJob(jobId)
  return job?.timecardPeriodEndDate ?? null
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
}

/**
 * Update job type (general or subcontractor)
 */
export async function updateJobType(jobId: string, type: JobType): Promise<void> {
  const ref = doc(db, 'jobs', jobId)
  await updateDoc(ref, { type })
}
