import { auth, db } from '../firebase'
import {
  addDoc,
  collection,
  getDoc,
  getDocs,
  doc,
  limit,
  orderBy,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  where,
} from 'firebase/firestore'
import type { Attachment, ManpowerLine } from '@/types/documents'
import { useJobAccess } from '@/composables/useJobAccess'

export type DailyLogStatus = 'draft' | 'submitted'


export function toMillis(ts: any): number {
  if (!ts) return 0
  if (typeof ts === 'number') return ts
  if (typeof ts === 'string') return new Date(ts).getTime()
  if (typeof ts?.toMillis === 'function') return ts.toMillis()
  try {
    const d = ts.toDate?.() ?? ts
    const asDate = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d
    return asDate instanceof Date ? asDate.getTime() : 0
  } catch {
    return 0
  }
}

export function formatTimestamp(ts: any): string {
  if (!ts) return ''
  const date = ts?.toDate?.() ?? ts
  const parsed = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) return ''
  return parsed.toLocaleString()
}

export type DailyLog = {
  id: string
  jobId: string
  uid: string
  status: DailyLogStatus
  logDate: string // YYYY-MM-DD

  jobSiteNumbers: string
  foremanOnSite: string
  siteForemanAssistant: string
  projectName: string

  manpower: string
  weeklySchedule: string
  manpowerAssessment: string

  manpowerLines?: ManpowerLine[]

  safetyConcerns: string
  ahaReviewed: string
  scheduleConcerns: string
  budgetConcerns: string

  deliveriesReceived: string
  deliveriesNeeded: string
  newWorkAuthorizations: string
  qcInspection: string

  notesCorrespondence: string
  actionItems: string

  attachments?: Attachment[]

  createdAt?: any
  updatedAt?: any
  submittedAt?: any
}

// Draft input does NOT include logDate (we pass it separately)
export type DailyLogDraftInput = Omit<
  DailyLog,
  'id' | 'uid' | 'jobId' | 'status' | 'logDate' | 'createdAt' | 'updatedAt' | 'submittedAt'
>

function requireUser() {
  const u = auth.currentUser
  if (!u) throw new Error('Not signed in')
  return u
}

const jobAccess = useJobAccess()

const assertJobAccess = (jobId: string) => {
  if (!jobAccess.canAccessJob(jobId)) {
    throw new Error('You do not have access to this job')
  }
}

function normalize(id: string, data: any): DailyLog {
  return {
    id,
    jobId: data.jobId,
    uid: data.uid,
    status: (data.status ?? 'draft') as DailyLogStatus,
    logDate: data.logDate,

    jobSiteNumbers: data.jobSiteNumbers ?? '',
    foremanOnSite: data.foremanOnSite ?? '',
    siteForemanAssistant: data.siteForemanAssistant ?? '',
    projectName: data.projectName ?? '',

    manpower: data.manpower ?? '',
    weeklySchedule: data.weeklySchedule ?? '',
    manpowerAssessment: data.manpowerAssessment ?? '',

    manpowerLines: Array.isArray(data.manpowerLines) ? data.manpowerLines : [],

    safetyConcerns: data.safetyConcerns ?? '',
    ahaReviewed: data.ahaReviewed ?? '',
    scheduleConcerns: data.scheduleConcerns ?? '',
    budgetConcerns: data.budgetConcerns ?? '',

    deliveriesReceived: data.deliveriesReceived ?? '',
    deliveriesNeeded: data.deliveriesNeeded ?? '',
    newWorkAuthorizations: data.newWorkAuthorizations ?? '',
    qcInspection: data.qcInspection ?? '',

    notesCorrespondence: data.notesCorrespondence ?? '',
    actionItems: data.actionItems ?? '',
    commentsAboutShip: data.commentsAboutShip ?? '',

    attachments: Array.isArray(data.attachments) ? data.attachments : [],

    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    submittedAt: data.submittedAt,
  }
}

export async function listMyDailyLogs(jobId: string, max = 25): Promise<DailyLog[]> {
  assertJobAccess(jobId)
  const u = requireUser()

  const q = query(
    collection(db, `jobs/${jobId}/dailyLogs`),
    where('uid', '==', u.uid),
    orderBy('logDate', 'desc'),
    limit(max)
  )

  const snap = await getDocs(q)
  return snap.docs.map((d) => normalize(d.id, d.data()))
}

export async function listAllDailyLogs(jobId: string, max = 25): Promise<DailyLog[]> {
  assertJobAccess(jobId)
  const u = requireUser()

  // Get all submitted logs (visible to everyone)
  const submittedQuery = query(
    collection(db, `jobs/${jobId}/dailyLogs`),
    where('status', '==', 'submitted')
  )

  // Get user's own draft logs
  const myDraftsQuery = query(
    collection(db, `jobs/${jobId}/dailyLogs`),
    where('uid', '==', u.uid),
    where('status', '==', 'draft')
  )

  const [submittedSnap, myDraftsSnap] = await Promise.all([
    getDocs(submittedQuery),
    getDocs(myDraftsQuery)
  ])

  // Combine and deduplicate by ID, then sort by date descending
  const logsMap = new Map<string, DailyLog>()
  submittedSnap.docs.forEach(d => logsMap.set(d.id, normalize(d.id, d.data())))
  myDraftsSnap.docs.forEach(d => logsMap.set(d.id, normalize(d.id, d.data())))

  return Array.from(logsMap.values())
    .sort((a, b) => new Date(b.logDate).getTime() - new Date(a.logDate).getTime())
    .slice(0, max)
}

export async function listDailyLogsForDate(jobId: string, logDate: string): Promise<DailyLog[]> {
  assertJobAccess(jobId)
  const u = requireUser()

  const submittedQuery = query(
    collection(db, `jobs/${jobId}/dailyLogs`),
    where('logDate', '==', logDate),
    where('status', '==', 'submitted')
  )

  const myDraftsQuery = query(
    collection(db, `jobs/${jobId}/dailyLogs`),
    where('logDate', '==', logDate),
    where('status', '==', 'draft'),
    where('uid', '==', u.uid)
  )

  const [submittedSnap, draftsSnap] = await Promise.all([
    getDocs(submittedQuery),
    getDocs(myDraftsQuery)
  ])

  const logsMap = new Map<string, DailyLog>()
  submittedSnap.docs.forEach((d) => logsMap.set(d.id, normalize(d.id, d.data())))
  draftsSnap.docs.forEach((d) => logsMap.set(d.id, normalize(d.id, d.data())))

  const rank = (s: DailyLog['status']) => (s === 'submitted' ? 0 : 1)

  return Array.from(logsMap.values()).sort((a, b) => {
    if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status)
    const aTs = toMillis(a.submittedAt || a.updatedAt || a.createdAt)
    const bTs = toMillis(b.submittedAt || b.updatedAt || b.createdAt)
    return bTs - aTs
  })
}

export async function getMyDailyLogByDate(jobId: string, logDate: string): Promise<DailyLog | null> {
  assertJobAccess(jobId)
  const u = requireUser()

  // Prefer draft for that date (most recent)
  const draftQuery = query(
    collection(db, `jobs/${jobId}/dailyLogs`),
    where('uid', '==', u.uid),
    where('logDate', '==', logDate),
    where('status', '==', 'draft')
  )

  const draftSnap = await getDocs(draftQuery)
  if (!draftSnap.empty) {
    // Pick latest by createdAt to avoid needing a composite index
    const latestDraft = draftSnap.docs.reduce<
      { doc: (typeof draftSnap.docs)[number]; ts: number } | null
    >((latest, doc) => {
      const ts = doc.data()?.createdAt?.toMillis?.() ?? 0
      if (!latest || ts > latest.ts) return { doc, ts }
      return latest
    }, null)

    const d = latestDraft?.doc ?? draftSnap.docs[0]
    return normalize(d.id, d.data())
  }

  // Otherwise fall back to latest submitted for that date
  const submittedQuery = query(
    collection(db, `jobs/${jobId}/dailyLogs`),
    where('uid', '==', u.uid),
    where('logDate', '==', logDate),
    where('status', '==', 'submitted')
  )

  const submittedSnap = await getDocs(submittedQuery)
  if (submittedSnap.empty) return null

  const latestSubmitted = submittedSnap.docs.reduce<
    { doc: (typeof submittedSnap.docs)[number]; ts: number } | null
  >((latest, doc) => {
    const ts = doc.data()?.submittedAt?.toMillis?.() ?? 0
    if (!latest || ts > latest.ts) return { doc, ts }
    return latest
  }, null)

  const d = latestSubmitted?.doc ?? submittedSnap.docs[0]
  return normalize(d.id, d.data())
}

export async function createDailyLog(jobId: string, logDate: string, input: DailyLogDraftInput) {
  assertJobAccess(jobId)
  const u = requireUser()

  const ref = await addDoc(collection(db, `jobs/${jobId}/dailyLogs`), {
    jobId,
    uid: u.uid,
    status: 'draft',
    ...input,
    logDate, // only set once

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    submittedAt: null,
  })

  return ref.id
}

export async function updateDailyLog(jobId: string, dailyLogId: string, updates: Partial<DailyLogDraftInput>) {
  assertJobAccess(jobId)
  requireUser()
  const ref = doc(db, `jobs/${jobId}/dailyLogs`, dailyLogId)
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

export async function submitDailyLog(jobId: string, dailyLogId: string) {
  assertJobAccess(jobId)
  requireUser()
  const ref = doc(db, `jobs/${jobId}/dailyLogs`, dailyLogId)

  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Daily log not found')

  await updateDoc(ref, {
    status: 'submitted',
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function deleteDailyLog(jobId: string, dailyLogId: string) {
  assertJobAccess(jobId)
  requireUser()
  const ref = doc(db, `jobs/${jobId}/dailyLogs`, dailyLogId)
  await deleteDoc(ref)
}

export async function cleanupDeletedLogs(jobId: string) {
  assertJobAccess(jobId)
  requireUser()
  
  const q = query(
    collection(db, `jobs/${jobId}/dailyLogs`),
    where('status', '==', 'deleted')
  )
  
  const snap = await getDocs(q)
  const batch = [];
  for (const doc of snap.docs) {
    batch.push(deleteDoc(doc.ref))
  }
  await Promise.all(batch)
}

export async function getDailyLogById(jobId: string, dailyLogId: string): Promise<DailyLog | null> {
  assertJobAccess(jobId)
  const u = requireUser()
  const ref = doc(db, `jobs/${jobId}/dailyLogs`, dailyLogId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  
  const log = normalize(snap.id, snap.data())
  
  // Draft logs are only accessible to their owner
  if (log.status === 'draft' && log.uid !== u.uid) {
    throw new Error('Access denied: This is a private draft')
  }
  
  return log
}

export function subscribeToDailyLog(
  jobId: string,
  dailyLogId: string,
  onData: (log: DailyLog) => void,
  onError?: (error: any) => void
) {
  assertJobAccess(jobId)
  const u = requireUser()
  const ref = doc(db, `jobs/${jobId}/dailyLogs`, dailyLogId)
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return
      const log = normalize(snap.id, snap.data())
      
      // Draft logs are only accessible to their owner
      if (log.status === 'draft' && log.uid !== u.uid) {
        if (onError) onError(new Error('Access denied: This is a private draft'))
        return
      }
      
      onData(log)
    },
    onError
  )
}
