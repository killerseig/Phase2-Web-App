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

export type DailyLogStatus = 'draft' | 'submitted'

export type ManpowerLine = {
  trade: string
  count: number
  areas: string
  addedByUserId?: string
}

export type Attachment = {
  name: string
  url: string
  path: string
  type?: 'photo' | 'ptp' | 'other'
  createdAt?: any
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

export async function getMyDailyLogByDate(jobId: string, logDate: string): Promise<DailyLog | null> {
  const u = requireUser()

  const q = query(
    collection(db, `jobs/${jobId}/dailyLogs`),
    where('uid', '==', u.uid),
    where('logDate', '==', logDate),
    limit(1)
  )

  const snap = await getDocs(q)
  if (snap.empty) return null

  const d = snap.docs[0]
  return normalize(d.id, d.data())
}

export async function createDailyLog(jobId: string, logDate: string, input: DailyLogDraftInput) {
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
  requireUser()
  const ref = doc(db, `jobs/${jobId}/dailyLogs`, dailyLogId)
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

export async function submitDailyLog(jobId: string, dailyLogId: string) {
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
  requireUser()
  const ref = doc(db, `jobs/${jobId}/dailyLogs`, dailyLogId)
  await deleteDoc(ref)
}

export async function cleanupDeletedLogs(jobId: string) {
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
