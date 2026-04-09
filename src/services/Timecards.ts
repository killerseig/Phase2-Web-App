/**
 * Timecards Service (Phase 3)
 * Manages weekly (Sunday-Saturday) timecards
 * Location: jobs/{jobId}/timecards/{timecardId}
 */

import { db } from '@/firebase'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  onSnapshot,
  type Unsubscribe,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore'
import { ROLES } from '@/constants/app'
import { DEFAULT_PRODUCTION_BURDEN, normalizeProductionBurden } from '@/constants/timecards'
import { useAuthStore } from '@/stores/auth'
import type { Timecard, TimecardInput, TimecardDay, TimecardTotals } from '@/types/models'
import { calculateWeekStartDate } from '@/utils/modelValidation'
import {
  buildTimecardInputFromRosterEmployee,
  matchesRosterEmployeeTimecard,
} from '@/utils/timecardWorkbook'
import { buildTimecardOfficeCsv } from '@/utils/timecardOfficeExport'
import { listActiveRosterEmployees } from './JobRoster'
import { getJob } from './Jobs'
import { assertJobAccess, requireUser } from './serviceGuards'
import { jobCollectionPath, jobDocumentPath } from './servicePaths'
import { normalizeError } from './serviceUtils'

/**
 * Normalize Firestore document to Timecard type
 */
function normalize(id: string, data: DocumentData): Timecard {
  return {
    id,
    jobId: data.jobId,
    
    // Weekly tracking
    weekStartDate: data.weekStartDate,
    weekEndingDate: data.weekEndingDate,
    
    // Submission tracking
    status: (data.status ?? 'draft') as 'draft' | 'submitted',
    createdByUid: data.createdByUid,
    submittedAt: data.submittedAt,
    
    // Employee reference
    employeeRosterId: data.employeeRosterId ?? '',
    employeeNumber: data.employeeNumber ?? '',
    employeeName: data.employeeName ?? '',
    firstName: data.firstName ?? '',
    lastName: data.lastName ?? '',
    occupation: data.occupation ?? '',
    employeeWage: data.employeeWage ?? null,
    productionBurden: data.productionBurden == null ? DEFAULT_PRODUCTION_BURDEN : normalizeProductionBurden(data.productionBurden),
    subcontractedEmployee: data.subcontractedEmployee ?? false,
    regularHoursOverride: data.regularHoursOverride ?? null,
    overtimeHoursOverride: data.overtimeHoursOverride ?? null,
    footerJobOrGl: data.footerJobOrGl ?? '',
    footerAccount: data.footerAccount ?? '',
    footerOffice: data.footerOffice ?? '',
    footerAmount: data.footerAmount ?? '',
    
    // Job entries
    jobs: Array.isArray(data.jobs) ? data.jobs : [],
    
    // Daily entries
    days: Array.isArray(data.days) ? data.days : [],
    totals: data.totals ?? { hours: [], production: [], hoursTotal: 0, productionTotal: 0, lineTotal: 0 },
    
    // Notes
    notes: data.notes ?? '',
    
    // Archival
    archived: data.archived ?? false,
    archivedAt: data.archivedAt,
    
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

/**
 * Calculate totals from a days array
 */
function calculateTotals(days: TimecardDay[]): TimecardTotals {
  if (!Array.isArray(days) || days.length !== 7) {
    return {
      hours: Array(7).fill(0),
      production: Array(7).fill(0),
      hoursTotal: 0,
      productionTotal: 0,
      lineTotal: 0,
    }
  }

  const hours = days.map(d => d.hours || 0)
  const production = days.map(d => d.production || 0)
  const lineTotals = days.map(d => d.lineTotal || 0)

  return {
    hours,
    production,
    hoursTotal: hours.reduce((sum, h) => sum + h, 0),
    productionTotal: production.reduce((sum, p) => sum + p, 0),
    lineTotal: lineTotals.reduce((sum, l) => sum + l, 0),
  }
}

// ============================================================================
// QUERY & RETRIEVAL
// ============================================================================

/**
 * List timecards for a job in a specific week
 */
export async function listTimecardsByJobAndWeek(
  jobId: string,
  weekEndingDate: string
): Promise<Timecard[]> {
  try {
    assertJobAccess(jobId)
    const constraints: QueryConstraint[] = [
      where('weekEndingDate', '==', weekEndingDate),
      where('archived', '==', false),
    ]
    const visibleCreatorUid = getForemanVisibleCreatorUid()
    if (visibleCreatorUid) {
      constraints.push(where('createdByUid', '==', visibleCreatorUid))
    } else {
      constraints.push(orderBy('employeeNumber', 'asc'))
    }

    const q = query(
      collection(db, ...jobCollectionPath(jobId, 'timecards')),
      ...constraints,
    )

    const snap = await getDocs(q)
    const timecards = snap.docs.map(d => normalize(d.id, d.data()))
    return visibleCreatorUid ? sortByEmployeeNumber(timecards) : timecards
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load timecards for week'))
  }
}

/**
 * List all workspace timecards for a job/week without filtering by creator.
 * This matches the upcoming workbook-style foreman experience where a job/week
 * is shared across all active roster employees rather than scoped per creator.
 */
export async function listWorkspaceTimecardsByJobAndWeek(
  jobId: string,
  weekEndingDate: string,
): Promise<Timecard[]> {
  try {
    assertJobAccess(jobId)
    const q = query(
      collection(db, ...jobCollectionPath(jobId, 'timecards')),
      where('weekEndingDate', '==', weekEndingDate),
      where('archived', '==', false),
      orderBy('employeeNumber', 'asc'),
    )

    const snap = await getDocs(q)
    return snap.docs.map((entry) => normalize(entry.id, entry.data()))
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load workspace timecards for week'))
  }
}

/**
 * Get a single timecard by ID
 */
export async function getTimecard(jobId: string, timecardId: string): Promise<Timecard | null> {
  try {
    assertJobAccess(jobId)
    const ref = doc(db, ...jobDocumentPath(jobId, 'timecards', timecardId))
    const snap = await getDoc(ref)
    if (!snap.exists()) return null
    return normalize(snap.id, snap.data())
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load timecard'))
  }
}

/**
 * List timecards for a job, most recent first
 */
export async function listJobTimecards(
  jobId: string,
  options?: { max?: number; includeArchived?: boolean }
): Promise<Timecard[]> {
  try {
    assertJobAccess(jobId)
    const includeArchived = options?.includeArchived ?? false
    const maxResults = options?.max ?? 50
    const visibleCreatorUid = getForemanVisibleCreatorUid()

    const constraints: QueryConstraint[] = []
    if (!includeArchived) {
      constraints.push(where('archived', '==', false))
    }
    if (visibleCreatorUid) {
      constraints.push(where('createdByUid', '==', visibleCreatorUid))
    } else {
      constraints.push(orderBy('weekEndingDate', 'desc'))
      constraints.push(limit(maxResults))
    }

    const q = query(
      collection(db, ...jobCollectionPath(jobId, 'timecards')),
      ...constraints,
    )

    const snap = await getDocs(q)
    const timecards = snap.docs.map(d => normalize(d.id, d.data()))
    return visibleCreatorUid
      ? sortByWeekEndingDesc(timecards).slice(0, maxResults)
      : timecards
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load timecards'))
  }
}

/**
 * List submitted timecards for a job (ready for export/approval)
 */
export async function listSubmittedTimecards(jobId: string): Promise<Timecard[]> {
  try {
    assertJobAccess(jobId)
    const constraints: QueryConstraint[] = [
      where('status', '==', 'submitted'),
      where('archived', '==', false),
    ]
    const visibleCreatorUid = getForemanVisibleCreatorUid()
    if (visibleCreatorUid) {
      constraints.push(where('createdByUid', '==', visibleCreatorUid))
    } else {
      constraints.push(orderBy('weekEndingDate', 'desc'))
    }

    const q = query(
      collection(db, ...jobCollectionPath(jobId, 'timecards')),
      ...constraints,
    )

    const snap = await getDocs(q)
    const timecards = snap.docs.map(d => normalize(d.id, d.data()))
    return visibleCreatorUid ? sortByWeekEndingDesc(timecards) : timecards
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load submitted timecards'))
  }
}

/**
 * Real-time listener for timecards in a week
 */
export function watchTimecardsByWeek(
  jobId: string,
  weekEndingDate: string,
  onUpdate: (timecards: Timecard[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  assertJobAccess(jobId)
  const constraints: QueryConstraint[] = [
    where('weekEndingDate', '==', weekEndingDate),
    where('archived', '==', false),
  ]
  const visibleCreatorUid = getForemanVisibleCreatorUid()
  if (visibleCreatorUid) {
    constraints.push(where('createdByUid', '==', visibleCreatorUid))
  } else {
    constraints.push(orderBy('employeeNumber', 'asc'))
  }

  const q = query(
    collection(db, ...jobCollectionPath(jobId, 'timecards')),
    ...constraints,
  )

  return onSnapshot(
    q,
    (snap) => {
      const timecards = snap.docs.map((d) => normalize(d.id, d.data()))
      onUpdate(visibleCreatorUid ? sortByEmployeeNumber(timecards) : timecards)
    },
    (err) => {
      onError?.(new Error(normalizeError(err, 'Failed to subscribe to timecards')))
    }
  )
}

/**
 * Real-time listener for the shared job/week workspace timecards without creator scoping.
 * This supports the workbook-style weekly workspace where all active roster employees
 * should appear for the selected job and week.
 */
export function watchWorkspaceTimecardsByWeek(
  jobId: string,
  weekEndingDate: string,
  onUpdate: (timecards: Timecard[]) => void,
  onError?: (error: unknown) => void,
): Unsubscribe {
  assertJobAccess(jobId)

  const q = query(
    collection(db, ...jobCollectionPath(jobId, 'timecards')),
    where('weekEndingDate', '==', weekEndingDate),
    where('archived', '==', false),
    orderBy('employeeNumber', 'asc'),
  )

  return onSnapshot(
    q,
    (snap) => {
      onUpdate(snap.docs.map((entry) => normalize(entry.id, entry.data())))
    },
    (err) => {
      onError?.(new Error(normalizeError(err, 'Failed to subscribe to workspace timecards')))
    },
  )
}

// ============================================================================
// CREATE & UPDATE
// ============================================================================

/**
 * Create a new timecard
 */
export async function createTimecard(jobId: string, input: TimecardInput): Promise<string> {
  try {
    assertJobAccess(jobId)
    const u = requireUser()

    // Calculate totals from days
    const totals = calculateTotals(input.days)

    // Calculate week start from week end
    const weekStartDate = calculateWeekStartDate(input.weekEndingDate)

    const ref = await addDoc(collection(db, ...jobCollectionPath(jobId, 'timecards')), {
      jobId,

      // Weekly tracking
      weekStartDate,
      weekEndingDate: input.weekEndingDate,

      // Submission
      status: 'draft',
      uid: u.uid,
      createdByUid: u.uid,
      submittedAt: null,

      // Employee reference
      employeeRosterId: input.employeeRosterId,
      employeeNumber: input.employeeNumber,
      employeeName: input.employeeName,
      firstName: input.firstName ?? '',
      lastName: input.lastName ?? '',
      occupation: input.occupation,
      employeeWage: input.employeeWage ?? null,
      productionBurden: normalizeProductionBurden(input.productionBurden),
      subcontractedEmployee: input.subcontractedEmployee ?? false,
      regularHoursOverride: input.regularHoursOverride ?? null,
      overtimeHoursOverride: input.overtimeHoursOverride ?? null,
      footerJobOrGl: input.footerJobOrGl ?? '',
      footerAccount: input.footerAccount ?? '',
      footerOffice: input.footerOffice ?? '',
      footerAmount: input.footerAmount ?? '',

      // Job entries
      jobs: input.jobs ?? [],

      // Daily entries & totals
      days: input.days,
      totals,

      // Notes
      notes: input.notes ?? '',

      // Archival
      archived: false,
      archivedAt: null,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    return ref.id
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to create timecard'))
  }
}

/**
 * Create a weekly timecard from an active roster employee using the fixed
 * workbook-style line template.
 */
export async function createTimecardForRosterEmployee(
  jobId: string,
  employee: Awaited<ReturnType<typeof listActiveRosterEmployees>>[number],
  weekEndingDate: string,
): Promise<string> {
  const job = await getJob(jobId)
  return createTimecard(
    jobId,
    buildTimecardInputFromRosterEmployee(
      employee,
      weekEndingDate,
      normalizeProductionBurden(job?.productionBurden),
    ),
  )
}

/**
 * Update a timecard
 */
export async function updateTimecard(
  jobId: string,
  timecardId: string,
  updates: Partial<TimecardInput>
): Promise<void> {
  try {
    assertJobAccess(jobId)
    requireUser()
    const ref = doc(db, ...jobDocumentPath(jobId, 'timecards', timecardId))

    const payload: Record<string, unknown> = {}

    if ('days' in updates && updates.days) {
      payload.days = updates.days
      // Recalculate totals when days change
      payload.totals = calculateTotals(updates.days)
    }

    if ('jobs' in updates) payload.jobs = updates.jobs ?? []
    if ('notes' in updates) payload.notes = updates.notes ?? ''
    if ('employeeNumber' in updates) payload.employeeNumber = updates.employeeNumber
    if ('employeeName' in updates) payload.employeeName = updates.employeeName
    if ('firstName' in updates) payload.firstName = updates.firstName ?? ''
    if ('lastName' in updates) payload.lastName = updates.lastName ?? ''
    if ('occupation' in updates) payload.occupation = updates.occupation
    if ('employeeWage' in updates) payload.employeeWage = updates.employeeWage ?? null
    if ('productionBurden' in updates) payload.productionBurden = normalizeProductionBurden(updates.productionBurden)
    if ('subcontractedEmployee' in updates) payload.subcontractedEmployee = updates.subcontractedEmployee ?? false
    if ('regularHoursOverride' in updates) payload.regularHoursOverride = updates.regularHoursOverride ?? null
    if ('overtimeHoursOverride' in updates) payload.overtimeHoursOverride = updates.overtimeHoursOverride ?? null
    if ('footerJobOrGl' in updates) payload.footerJobOrGl = updates.footerJobOrGl ?? ''
    if ('footerAccount' in updates) payload.footerAccount = updates.footerAccount ?? ''
    if ('footerOffice' in updates) payload.footerOffice = updates.footerOffice ?? ''
    if ('footerAmount' in updates) payload.footerAmount = updates.footerAmount ?? ''

    payload.updatedAt = serverTimestamp()

    await updateDoc(ref, payload)
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to update timecard'))
  }
}

/**
 * Ensure every active roster employee for the selected job has a weekly timecard.
 * This is the data foundation for the workbook-style workspace where all active
 * employees must be accounted for each week.
 */
export async function ensureWeekTimecardsForActiveRoster(
  jobId: string,
  weekEndingDate: string,
): Promise<{
  activeEmployeeCount: number
  existingTimecardCount: number
  createdIds: string[]
}> {
  try {
    assertJobAccess(jobId)
    const [activeEmployees, existingTimecards] = await Promise.all([
      listActiveRosterEmployees(jobId),
      listWorkspaceTimecardsByJobAndWeek(jobId, weekEndingDate),
    ])

    const createdIds: string[] = []

    for (const employee of activeEmployees) {
      const alreadyExists = existingTimecards.some((timecard) => matchesRosterEmployeeTimecard(employee, timecard))
      if (alreadyExists) continue

      const createdId = await createTimecardForRosterEmployee(jobId, employee, weekEndingDate)
      createdIds.push(createdId)
    }

    return {
      activeEmployeeCount: activeEmployees.length,
      existingTimecardCount: existingTimecards.length,
      createdIds,
    }
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to ensure weekly timecards for active roster'))
  }
}

/**
 * Update just the days array (and recalculate totals)
 */
export async function updateTimecardDays(
  jobId: string,
  timecardId: string,
  days: TimecardDay[]
): Promise<void> {
  try {
    assertJobAccess(jobId)
    const u = requireUser()
    const ref = doc(db, ...jobDocumentPath(jobId, 'timecards', timecardId))

    const totals = calculateTotals(days)

    await updateDoc(ref, {
      uid: u.uid,
      days,
      totals,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to update timecard days'))
  }
}

// ============================================================================
// AUTO-GENERATION & COPYING (Phase 4)
// ============================================================================

/**
 * Get the previous week's timecards for a job to use as template
 * @param jobId Job ID
 * @param weekEndingDate Current week's Saturday (to look back one week)
 * @returns Array of timecards from the previous week
 */
export async function getPreviousWeekTimecards(
  jobId: string,
  weekEndingDate: string
): Promise<Timecard[]> {
  try {
    assertJobAccess(jobId)
    // Calculate previous week's Saturday
    const currentWeekEnd = new Date(weekEndingDate + 'T00:00:00Z')
    const previousWeekEnd = new Date(currentWeekEnd)
    previousWeekEnd.setUTCDate(previousWeekEnd.getUTCDate() - 7)
    
    const year = previousWeekEnd.getUTCFullYear()
    const month = String(previousWeekEnd.getUTCMonth() + 1).padStart(2, '0')
    const day = String(previousWeekEnd.getUTCDate()).padStart(2, '0')
    const previousWeekEndDate = `${year}-${month}-${day}`
    
    return listTimecardsByJobAndWeek(jobId, previousWeekEndDate)
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load previous week timecards'))
  }
}

/**
 * Create a new timecard by copying from a previous timecard
 * Copies employee info and accounting codes but zeros out all hours
 * @param jobId Job ID
 * @param sourceTimecard The previous timecard to copy from
 * @param newWeekEndingDate The Saturday of the new week
 * @returns ID of the newly created timecard
 */
export async function createTimecardFromCopy(
  jobId: string,
  sourceTimecard: Timecard,
  newWeekEndingDate: string
): Promise<string> {
  try {
    assertJobAccess(jobId)
    const newWeekStart = new Date(newWeekEndingDate + 'T00:00:00Z')
    newWeekStart.setUTCDate(newWeekStart.getUTCDate() - 6)

    const makeDateForIndex = (index: number) => {
      const d = new Date(newWeekStart)
      d.setUTCDate(newWeekStart.getUTCDate() + index)
      const year = d.getUTCFullYear()
      const month = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    // Create new summary days array for the new week
    const newDays: TimecardDay[] = Array.from({ length: 7 }, (_, index) => ({
      date: makeDateForIndex(index),
      dayOfWeek: index,
      hours: 0,
      production: 0,
      unitCost: 0,
      lineTotal: 0,
      notes: '',
    }))

    // Copy jobs/accounting metadata but reset daily work values
    const copiedJobs = (sourceTimecard.jobs ?? []).map(job => ({
      jobNumber: job.jobNumber ?? '',
      subsectionArea: job.subsectionArea ?? job.area ?? '',
      area: job.area ?? job.subsectionArea ?? '',
      account: job.account ?? job.acct ?? '',
      acct: job.acct ?? job.account ?? '',
      div: job.div ?? '',
      days: Array.from({ length: 7 }, (_, index) => {
        const sourceDay = job.days?.[index]
        return {
          date: makeDateForIndex(index),
          dayOfWeek: index,
          hours: 0,
          production: 0,
          unitCost: sourceDay?.unitCost ?? 0,
          lineTotal: 0,
          notes: '',
        }
      }),
    }))
    
    // Create the timecard input
    const timecardInput: TimecardInput = {
      weekEndingDate: newWeekEndingDate,
      employeeRosterId: sourceTimecard.employeeRosterId,
      employeeNumber: sourceTimecard.employeeNumber,
      employeeName: sourceTimecard.employeeName,
      firstName: sourceTimecard.firstName ?? '',
      lastName: sourceTimecard.lastName ?? '',
      occupation: sourceTimecard.occupation,
      employeeWage: sourceTimecard.employeeWage ?? null,
      productionBurden: sourceTimecard.productionBurden ?? DEFAULT_PRODUCTION_BURDEN,
      subcontractedEmployee: sourceTimecard.subcontractedEmployee ?? false,
      regularHoursOverride: null,
      overtimeHoursOverride: null,
      footerJobOrGl: '',
      footerAccount: '',
      footerOffice: '',
      footerAmount: '',
      jobs: copiedJobs,
      days: newDays,
      notes: '', // Don't copy notes, start fresh
    }
    
    return createTimecard(jobId, timecardInput)
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to copy timecard'))
  }
}

/**
 * Auto-generate timecards for a new week based on previous week
 * Creates draft timecards for all employees who had timecards last week
 * @param jobId Job ID
 * @param newWeekEndingDate Saturday of the new week (YYYY-MM-DD)
 * @returns Array of newly created timecard IDs
 */
export async function autoGenerateTimecards(
  jobId: string,
  newWeekEndingDate: string
): Promise<string[]> {
  try {
    assertJobAccess(jobId)
    // Get previous week's timecards
    const previousWeekTimecards = await getPreviousWeekTimecards(jobId, newWeekEndingDate)
    
    if (previousWeekTimecards.length === 0) {
      return [] // No timecards to copy
    }
    
    // Create new timecards for each employee from previous week
    const newTimecardIds: string[] = []
    
    for (const prevTimecard of previousWeekTimecards) {
      const newId = await createTimecardFromCopy(
        jobId,
        prevTimecard,
        newWeekEndingDate
      )
      newTimecardIds.push(newId)
    }
    
    return newTimecardIds
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to auto-generate timecards'))
  }
}

/**
 * Submit all draft timecards for a specific week
 * @param jobId Job ID
 * @param weekEndingDate Saturday of the week (YYYY-MM-DD)
 * @returns Number of timecards submitted
 */
export async function submitAllWeekTimecards(
  jobId: string,
  weekEndingDate: string
): Promise<number> {
  try {
    assertJobAccess(jobId)
    const timecards = await listTimecardsByJobAndWeek(jobId, weekEndingDate)
    const draftTimecards = timecards.filter(tc => tc.status === 'draft')
    
    let submitCount = 0
    for (const timecard of draftTimecards) {
      await submitTimecard(jobId, timecard.id)
      submitCount++
    }
    
    return submitCount
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to submit week timecards'))
  }
}

/**
 * Submit a timecard (change status to submitted)
 */
export async function submitTimecard(jobId: string, timecardId: string): Promise<void> {
  try {
    assertJobAccess(jobId)
    const u = requireUser()
    const ref = doc(db, ...jobDocumentPath(jobId, 'timecards', timecardId))

    await updateDoc(ref, {
      uid: u.uid,
      status: 'submitted',
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to submit timecard'))
  }
}

/**
 * Archive a timecard
 */
export async function archiveTimecard(jobId: string, timecardId: string): Promise<void> {
  try {
    assertJobAccess(jobId)
    const u = requireUser()
    const ref = doc(db, ...jobDocumentPath(jobId, 'timecards', timecardId))

    await updateDoc(ref, {
      uid: u.uid,
      archived: true,
      archivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to archive timecard'))
  }
}

/**
 * Unarchive a timecard
 */
export async function unarchiveTimecard(jobId: string, timecardId: string): Promise<void> {
  try {
    assertJobAccess(jobId)
    requireUser()
    const ref = doc(db, ...jobDocumentPath(jobId, 'timecards', timecardId))

    await updateDoc(ref, {
      archived: false,
      archivedAt: null,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to unarchive timecard'))
  }
}

/**
 * Delete a timecard (only drafts)
 */
export async function deleteTimecard(jobId: string, timecardId: string): Promise<void> {
  try {
    assertJobAccess(jobId)
    const u = requireUser()
    const ref = doc(db, ...jobDocumentPath(jobId, 'timecards', timecardId))
    const snap = await getDoc(ref)

    if (!snap.exists()) throw new Error('Timecard not found')
    const data = snap.data()

    // Only allow deletion of draft timecards by creator
    if (data.status !== 'draft' || data.createdByUid !== u.uid) {
      throw new Error('Cannot delete submitted or archived timecards')
    }

    await deleteDoc(ref)
  } catch (err) {
    if (err instanceof Error && (err.message === 'Timecard not found' || err.message.includes('Cannot delete'))) {
      throw err
    }
    throw new Error(normalizeError(err, 'Failed to delete timecard'))
  }
}

// ============================================================================
// EXPORT & REPORTING
// ============================================================================

/**
 * Export weekly timecards to the office import CSV format.
 */
export async function exportTimecardsToCsv(
  jobId: string,
  weekEndingDate: string
): Promise<string> {
  try {
    assertJobAccess(jobId)
    const timecards = await listTimecardsByJobAndWeek(jobId, weekEndingDate)
    return buildTimecardOfficeCsv(timecards)
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to export timecards'))
  }
}

/**
 * Submit all draft workspace timecards for a shared job/week without creator scoping.
 * This supports the workbook-style weekly workspace used by foremen.
 */
export async function submitWorkspaceWeekTimecards(
  jobId: string,
  weekEndingDate: string,
): Promise<number> {
  try {
    assertJobAccess(jobId)
    const timecards = await listWorkspaceTimecardsByJobAndWeek(jobId, weekEndingDate)
    const draftTimecards = timecards.filter((timecard) => timecard.status === 'draft')

    let submitCount = 0
    for (const timecard of draftTimecards) {
      await submitTimecard(jobId, timecard.id)
      submitCount++
    }

    return submitCount
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to submit workspace timecards'))
  }
}

/**
 * Export all submitted timecards for a job using the office import CSV format.
 */
export async function exportAllSubmittedTimecardsToCsv(jobId: string): Promise<string> {
  try {
    assertJobAccess(jobId)
    const timecards = await listSubmittedTimecards(jobId)

    if (timecards.length === 0) return ''
    return buildTimecardOfficeCsv(timecards)
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to export submitted timecards'))
  }
}

/**
 * Get timecard statistics for a week
 */
export async function getWeeklyStats(
  jobId: string,
  weekEndingDate: string
): Promise<{
  totalTimecards: number
  submittedCount: number
  draftCount: number
  totalHours: number
  totalProduction: number
}> {
  try {
    assertJobAccess(jobId)
    const timecards = await listTimecardsByJobAndWeek(jobId, weekEndingDate)

    const submitted = timecards.filter(tc => tc.status === 'submitted')
    const drafts = timecards.filter(tc => tc.status === 'draft')

    return {
      totalTimecards: timecards.length,
      submittedCount: submitted.length,
      draftCount: drafts.length,
      totalHours: submitted.reduce((sum, tc) => sum + tc.totals.hoursTotal, 0),
      totalProduction: submitted.reduce((sum, tc) => sum + tc.totals.productionTotal, 0),
    }
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load weekly timecard stats'))
  }
}

function getForemanVisibleCreatorUid(): string | null {
  const authStore = useAuthStore()
  if (authStore.role !== ROLES.FOREMAN) return null
  return requireUser().uid
}

function sortByEmployeeNumber(timecards: Timecard[]): Timecard[] {
  return timecards.slice().sort((left, right) => (
    String(left.employeeNumber || '').localeCompare(String(right.employeeNumber || ''))
    || String(left.employeeName || '').localeCompare(String(right.employeeName || ''))
  ))
}

function sortByWeekEndingDesc(timecards: Timecard[]): Timecard[] {
  return timecards.slice().sort((left, right) => (
    String(right.weekEndingDate || '').localeCompare(String(left.weekEndingDate || ''))
    || String(left.employeeNumber || '').localeCompare(String(right.employeeNumber || ''))
    || String(left.employeeName || '').localeCompare(String(right.employeeName || ''))
  ))
}

