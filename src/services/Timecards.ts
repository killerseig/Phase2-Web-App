/**
 * Timecards Service (Phase 3)
 * Manages weekly (Sunday-Saturday) timecards
 * Location: jobs/{jobId}/timecards/{timecardId}
 */

import { auth, db } from '../firebase'
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
} from 'firebase/firestore'
import type { Timecard, TimecardInput, TimecardDay, TimecardTotals } from '@/types/models'
import { calculateWeekStartDate } from '@/utils/modelValidation'

/**
 * Helper to require authenticated user
 */
function requireUser() {
  const u = auth.currentUser
  if (!u) throw new Error('Not signed in')
  return u
}

/**
 * Normalize Firestore document to Timecard type
 */
function normalize(id: string, data: any): Timecard {
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
    occupation: data.occupation ?? '',
    
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
  const q = query(
    collection(db, `jobs/${jobId}/timecards`),
    where('weekEndingDate', '==', weekEndingDate),
    where('archived', '==', false),
    orderBy('employeeNumber', 'asc')
  )

  const snap = await getDocs(q)
  return snap.docs.map(d => normalize(d.id, d.data()))
}

/**
 * Get a single timecard by ID
 */
export async function getTimecard(jobId: string, timecardId: string): Promise<Timecard | null> {
  const ref = doc(db, `jobs/${jobId}/timecards`, timecardId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return normalize(snap.id, snap.data())
}

/**
 * List timecards for a job, most recent first
 */
export async function listJobTimecards(
  jobId: string,
  options?: { max?: number; includeArchived?: boolean }
): Promise<Timecard[]> {
  const includeArchived = options?.includeArchived ?? false
  const maxResults = options?.max ?? 50

  let q = query(
    collection(db, `jobs/${jobId}/timecards`),
    orderBy('weekEndingDate', 'desc'),
    limit(maxResults)
  )

  // If not including archived, add where clause
  if (!includeArchived) {
    q = query(
      collection(db, `jobs/${jobId}/timecards`),
      where('archived', '==', false),
      orderBy('weekEndingDate', 'desc'),
      limit(maxResults)
    )
  }

  const snap = await getDocs(q)
  return snap.docs.map(d => normalize(d.id, d.data()))
}

/**
 * List submitted timecards for a job (ready for export/approval)
 */
export async function listSubmittedTimecards(jobId: string): Promise<Timecard[]> {
  const q = query(
    collection(db, `jobs/${jobId}/timecards`),
    where('status', '==', 'submitted'),
    where('archived', '==', false),
    orderBy('weekEndingDate', 'desc')
  )

  const snap = await getDocs(q)
  return snap.docs.map(d => normalize(d.id, d.data()))
}

/**
 * Real-time listener for timecards in a week
 */
export async function watchTimecardsByWeek(
  jobId: string,
  weekEndingDate: string,
  onUpdate: (timecards: Timecard[]) => void
): Promise<Unsubscribe> {
  const q = query(
    collection(db, `jobs/${jobId}/timecards`),
    where('weekEndingDate', '==', weekEndingDate),
    where('archived', '==', false),
    orderBy('employeeNumber', 'asc')
  )

  return onSnapshot(q, snap => {
    const timecards = snap.docs.map(d => normalize(d.id, d.data()))
    onUpdate(timecards)
  })
}

// ============================================================================
// CREATE & UPDATE
// ============================================================================

/**
 * Create a new timecard
 */
export async function createTimecard(jobId: string, input: TimecardInput): Promise<string> {
  const u = requireUser()

  // Calculate totals from days
  const totals = calculateTotals(input.days)

  // Calculate week start from week end
  const weekStartDate = calculateWeekStartDate(input.weekEndingDate)

  const ref = await addDoc(collection(db, `jobs/${jobId}/timecards`), {
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
    occupation: input.occupation,

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
}

/**
 * Update a timecard
 */
export async function updateTimecard(
  jobId: string,
  timecardId: string,
  updates: Partial<TimecardInput>
): Promise<void> {
  const u = requireUser()
  const ref = doc(db, `jobs/${jobId}/timecards`, timecardId)

  const payload: any = {}

  if ('days' in updates && updates.days) {
    payload.days = updates.days
    // Recalculate totals when days change
    payload.totals = calculateTotals(updates.days)
  }

  if ('jobs' in updates) payload.jobs = updates.jobs ?? []
  if ('notes' in updates) payload.notes = updates.notes ?? ''
  if ('employeeNumber' in updates) payload.employeeNumber = updates.employeeNumber
  if ('employeeName' in updates) payload.employeeName = updates.employeeName
  if ('occupation' in updates) payload.occupation = updates.occupation

  payload.updatedAt = serverTimestamp()

  await updateDoc(ref, payload)
}

/**
 * Update just the days array (and recalculate totals)
 */
export async function updateTimecardDays(
  jobId: string,
  timecardId: string,
  days: TimecardDay[]
): Promise<void> {
  const u = requireUser()
  const ref = doc(db, `jobs/${jobId}/timecards`, timecardId)

  const totals = calculateTotals(days)

  await updateDoc(ref, {
    uid: u.uid,
    days,
    totals,
    updatedAt: serverTimestamp(),
  })
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
  // Calculate previous week's Saturday
  const currentWeekEnd = new Date(weekEndingDate + 'T00:00:00Z')
  const previousWeekEnd = new Date(currentWeekEnd)
  previousWeekEnd.setUTCDate(previousWeekEnd.getUTCDate() - 7)
  
  const year = previousWeekEnd.getUTCFullYear()
  const month = String(previousWeekEnd.getUTCMonth() + 1).padStart(2, '0')
  const day = String(previousWeekEnd.getUTCDate()).padStart(2, '0')
  const previousWeekEndDate = `${year}-${month}-${day}`
  
  return listTimecardsByJobAndWeek(jobId, previousWeekEndDate)
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
  // Create new days array with zeroed hours
  const newDays = sourceTimecard.days.map((day, index) => {
    // Calculate new date for this day
    const weekStart = new Date(newWeekEndingDate + 'T00:00:00Z')
    weekStart.setUTCDate(weekStart.getUTCDate() - 6) // Go back to Sunday
    weekStart.setUTCDate(weekStart.getUTCDate() + index)
    
    const year = weekStart.getUTCFullYear()
    const month = String(weekStart.getUTCMonth() + 1).padStart(2, '0')
    const dateDay = String(weekStart.getUTCDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${dateDay}`
    
    return {
      ...day,
      date: dateStr,
      hours: 0, // ZERO OUT hours
      lineTotal: 0,
      notes: '',
    }
  })
  
  // Create the timecard input
  const timecardInput: TimecardInput = {
    weekEndingDate: newWeekEndingDate,
    employeeRosterId: sourceTimecard.employeeRosterId,
    employeeNumber: sourceTimecard.employeeNumber,
    employeeName: sourceTimecard.employeeName,
    occupation: sourceTimecard.occupation,
    days: newDays,
    notes: '', // Don't copy notes, start fresh
  }
  
  return createTimecard(jobId, timecardInput)
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
  const timecards = await listTimecardsByJobAndWeek(jobId, weekEndingDate)
  const draftTimecards = timecards.filter(tc => tc.status === 'draft')
  
  let submitCount = 0
  for (const timecard of draftTimecards) {
    await submitTimecard(jobId, timecard.id)
    submitCount++
  }
  
  return submitCount
}

/**
 * Submit a timecard (change status to submitted)
 */
export async function submitTimecard(jobId: string, timecardId: string): Promise<void> {
  const u = requireUser()
  const ref = doc(db, `jobs/${jobId}/timecards`, timecardId)

  await updateDoc(ref, {
    uid: u.uid,
    status: 'submitted',
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Archive a timecard
 */
export async function archiveTimecard(jobId: string, timecardId: string): Promise<void> {
  const u = requireUser()
  const ref = doc(db, `jobs/${jobId}/timecards`, timecardId)

  await updateDoc(ref, {
    uid: u.uid,
    archived: true,
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Unarchive a timecard
 */
export async function unarchiveTimecard(jobId: string, timecardId: string): Promise<void> {
  requireUser()
  const ref = doc(db, `jobs/${jobId}/timecards`, timecardId)

  await updateDoc(ref, {
    archived: false,
    archivedAt: null,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Delete a timecard (only drafts)
 */
export async function deleteTimecard(jobId: string, timecardId: string): Promise<void> {
  const u = requireUser()
  const ref = doc(db, `jobs/${jobId}/timecards`, timecardId)
  const snap = await getDoc(ref)

  if (!snap.exists()) throw new Error('Timecard not found')
  const data = snap.data()

  // Only allow deletion of draft timecards by creator
  if (data.status !== 'draft' || data.createdByUid !== u.uid) {
    throw new Error('Cannot delete submitted or archived timecards')
  }

  await deleteDoc(ref)
}

// ============================================================================
// EXPORT & REPORTING
// ============================================================================

/**
 * Export timecards to CSV format for Plexis
 * Format: Employee#, Name, Occupation, Sun, Mon, Tue, Wed, Thu, Fri, Sat, Total Hours, Total Production
 */
export async function exportTimecardsToCsv(
  jobId: string,
  weekEndingDate: string
): Promise<string> {
  const timecards = await listTimecardsByJobAndWeek(jobId, weekEndingDate)

  // CSV header
  const headers = [
    'Employee #',
    'Name',
    'Occupation',
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Total Hours',
    'Total Production',
  ]

  // CSV rows
  const rows = timecards.map(tc => [
    tc.employeeNumber,
    tc.employeeName,
    tc.occupation,
    tc.days[0]?.hours ?? '',
    tc.days[1]?.hours ?? '',
    tc.days[2]?.hours ?? '',
    tc.days[3]?.hours ?? '',
    tc.days[4]?.hours ?? '',
    tc.days[5]?.hours ?? '',
    tc.days[6]?.hours ?? '',
    tc.totals.hoursTotal.toString(),
    tc.totals.productionTotal.toString(),
  ])

  // Combine with proper CSV escaping
  const csv = [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(r => r.map(v => `"${v}"`).join(',')),
  ].join('\n')

  return csv
}

/**
 * Export all submitted timecards for a job to CSV
 */
export async function exportAllSubmittedTimecardsToCsv(jobId: string): Promise<string> {
  const timecards = await listSubmittedTimecards(jobId)

  if (timecards.length === 0) return ''

  // CSV header
  const headers = [
    'Week Ending',
    'Employee #',
    'Name',
    'Occupation',
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Total Hours',
    'Total Production',
  ]

  // CSV rows (grouped by week for clarity)
  const rows = timecards.map(tc => [
    tc.weekEndingDate,
    tc.employeeNumber,
    tc.employeeName,
    tc.occupation,
    tc.days[0]?.hours ?? '',
    tc.days[1]?.hours ?? '',
    tc.days[2]?.hours ?? '',
    tc.days[3]?.hours ?? '',
    tc.days[4]?.hours ?? '',
    tc.days[5]?.hours ?? '',
    tc.days[6]?.hours ?? '',
    tc.totals.hoursTotal.toString(),
    tc.totals.productionTotal.toString(),
  ])

  // Combine with proper CSV escaping
  const csv = [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(r => r.map(v => `"${v}"`).join(',')),
  ].join('\n')

  return csv
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
}

// ============================================================================
// BACKWARD COMPATIBILITY (Phase 3 Transition)
// These exports maintain compatibility with old view code
// TODO: Remove these in Phase 3D when views are updated to new models
// ============================================================================

/**
 * @deprecated Use watchTimecardsByWeek instead (new API)
 * Legacy wrapper that matches old listTimecardsByJobAndWeek signature
 */
export async function listTimecardsByJobAndWeekLegacy(
  jobId: string,
  weekStart: string,
  onUpdate: (timecards: any[]) => void
): Promise<Unsubscribe> {
  // Map old weekStart (Monday) to new weekEndingDate (Saturday)
  // Assume weekStart is the Monday, so Saturday is weekStart + 5 days
  const startDate = new Date(weekStart + 'T00:00:00Z')
  startDate.setUTCDate(startDate.getUTCDate() + 5) // Add 5 days to get Saturday
  
  const year = startDate.getUTCFullYear()
  const month = String(startDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(startDate.getUTCDate()).padStart(2, '0')
  const weekEndingDate = `${year}-${month}-${day}`
  
  return watchTimecardsByWeek(jobId, weekEndingDate, onUpdate)
}

// Export old types for compatibility
export type TimecardLine = {
  jobNumber: string
  area: string
  account: string
  mon: number
  tue: number
  wed: number
  thu: number
  fri: number
  sat: number
  sun: number
  production?: number
  note?: string
}

/**
 * @deprecated Use createTimecard instead (new API)
 * Legacy wrapper for old upsertTimecard function
 */
export async function upsertTimecard(jobId: string, input: any): Promise<string> {
  // Map old format to new
  const days: TimecardDay[] = [
    { date: '', dayOfWeek: 0, hours: input.sun ?? 0, production: 0, unitCost: 0, lineTotal: 0 },
    { date: '', dayOfWeek: 1, hours: input.mon ?? 0, production: 0, unitCost: 0, lineTotal: 0 },
    { date: '', dayOfWeek: 2, hours: input.tue ?? 0, production: 0, unitCost: 0, lineTotal: 0 },
    { date: '', dayOfWeek: 3, hours: input.wed ?? 0, production: 0, unitCost: 0, lineTotal: 0 },
    { date: '', dayOfWeek: 4, hours: input.thu ?? 0, production: 0, unitCost: 0, lineTotal: 0 },
    { date: '', dayOfWeek: 5, hours: input.fri ?? 0, production: 0, unitCost: 0, lineTotal: 0 },
    { date: '', dayOfWeek: 6, hours: input.sat ?? 0, production: 0, unitCost: 0, lineTotal: 0 },
  ]
  
  const timecardInput: TimecardInput = {
    weekEndingDate: input.weekEnding,
    employeeRosterId: input.employeeId,
    employeeNumber: '',
    employeeName: input.employeeName,
    occupation: input.occupation,
    days,
    notes: input.notes ?? '',
  }
  
  return await createTimecard(jobId, timecardInput)
}
