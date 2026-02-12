import { db } from '../firebase'
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
  type DocumentData,
} from 'firebase/firestore'
import type { Attachment, ManpowerLine } from '@/types/documents'
import { assertJobAccess, requireUser } from './serviceGuards'
import { normalizeError } from './serviceUtils'

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
  commentsAboutShip?: string

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

function normalize(id: string, data: DocumentData): DailyLog {
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
  try {
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
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load daily logs'))
  }
}

export async function listAllDailyLogs(jobId: string, max = 25): Promise<DailyLog[]> {
  try {
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
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load daily logs'))
  }
}

export async function listDailyLogsForDate(jobId: string, logDate: string): Promise<DailyLog[]> {
  try {
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
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load daily logs'))
  }
}

export async function getMyDailyLogByDate(jobId: string, logDate: string): Promise<DailyLog | null> {
  try {
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
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to load daily log'))
  }
}

export async function createDailyLog(jobId: string, logDate: string, input: DailyLogDraftInput) {
  try {
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
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to create daily log'))
  }
}

export async function updateDailyLog(jobId: string, dailyLogId: string, updates: Partial<DailyLogDraftInput>) {
  try {
    assertJobAccess(jobId)
    requireUser()
    const ref = doc(db, `jobs/${jobId}/dailyLogs`, dailyLogId)
    await updateDoc(ref, {
      ...updates,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to update daily log'))
  }
}

export async function submitDailyLog(jobId: string, dailyLogId: string) {
  try {
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
  } catch (err) {
    if (err instanceof Error && err.message === 'Daily log not found') {
      throw err
    }
    throw new Error(normalizeError(err, 'Failed to submit daily log'))
  }
}

export async function deleteDailyLog(jobId: string, dailyLogId: string) {
  try {
    assertJobAccess(jobId)
    requireUser()
    const ref = doc(db, `jobs/${jobId}/dailyLogs`, dailyLogId)
    await deleteDoc(ref)
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to delete daily log'))
  }
}

export async function cleanupDeletedLogs(jobId: string) {
  try {
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
  } catch (err) {
    throw new Error(normalizeError(err, 'Failed to cleanup daily logs'))
  }
}

export async function getDailyLogById(jobId: string, dailyLogId: string): Promise<DailyLog | null> {
  try {
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
  } catch (err) {
    if (err instanceof Error && err.message.includes('Access denied')) {
      throw err
    }
    throw new Error(normalizeError(err, 'Failed to load daily log'))
  }
}

export function subscribeToDailyLog(
  jobId: string,
  dailyLogId: string,
  onData: (log: DailyLog) => void,
  onError?: (error: any) => void
) {
  try {
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
  } catch (err) {
    if (onError) onError(err)
    throw new Error(normalizeError(err, 'Failed to subscribe to daily log'))
  }
}
