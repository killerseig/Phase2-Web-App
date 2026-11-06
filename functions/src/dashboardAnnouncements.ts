import { createHash } from 'node:crypto'
import { HttpsError } from 'firebase-functions/v2/https'
import { FieldPath, type Transaction } from 'firebase-admin/firestore'
import { db } from './runtime'
import { buildCurrentFunctionUser, type CurrentFunctionUser } from './roleAccess'
import { validAnnouncementRecipientId } from './sharedDashboardModel'
import type { AnnouncementDraft, PublishedAnnouncement } from './sharedDashboardModel'

const pageSize = 50
export function announcementId(uid: string, draftId: string) { return createHash('sha256').update(JSON.stringify([uid, draftId])).digest('hex') }
export async function publishDashboardAnnouncement(tx: Transaction, user: CurrentFunctionUser, data: Record<string, unknown>) {
  if (user.role !== 'admin') throw new HttpsError('permission-denied', 'Only Admin can publish announcements.')
  if (data.scope !== 'personal' || typeof data.draftId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(data.draftId) ||
    Object.keys(data).some(key => !['scope', 'action', 'draftId', 'version'].includes(key)))
    throw new HttpsError('invalid-argument', 'Choose one of your saved announcement drafts.')
  const id = announcementId(user.uid, data.draftId)
  const destination = db.doc('dashboardAnnouncements/' + id)
  const existing = await tx.get(destination)
  // A retry cannot duplicate or edit the already published snapshot.
  if (existing.exists) return { id }
  const personal = await tx.get(db.doc('sharedDashboardPersonalData/' + user.uid))
  const content = personal.data() || {}
  if (!Number.isSafeInteger(data.version) || data.version !== Number(content.version || 0))
    throw new HttpsError('aborted', 'This dashboard changed elsewhere. Reload and review before publishing.')
  const draft = (content.announcementDrafts || []).find((item: AnnouncementDraft) => item.id === data.draftId) as AnnouncementDraft | undefined
  if (!draft || !['everyone', 'job', 'people'].includes(draft.audience || ''))
    throw new HttpsError('failed-precondition', 'Save a draft with an announcement audience first.')
  if (draft.audience === 'job') {
    const job = await tx.get(db.doc('jobs/' + draft.jobId))
    if (!job.exists) throw new HttpsError('failed-precondition', 'Choose an available job before publishing.')
  }
  if (draft.audience === 'people') await validateAnnouncementRecipients(tx, draft.recipientIds || [])
  tx.create(destination, {
    title: draft.title, body: draft.body, audience: draft.audience,
    ...(draft.audience === 'job' ? { jobId: draft.jobId } : {}),
    ...(draft.audience === 'people' ? { recipientIds: draft.recipientIds } : {}),
    publishedAt: Date.now(), createdBy: user.uid, draftId: draft.id,
  })
  return { id }
}

export async function listDashboardAnnouncements(tx: Transaction, user: CurrentFunctionUser, selectedJobId?: string) {
  // Assignment is narrower than the ability to open a job (no Admin/Payroll/Shop bypass).
  const assignedOnJobs = await tx.get(db.collection('jobs').where('assignedForemanIds', 'array-contains', user.uid))
  const assignedIds = new Set(assignedOnJobs.docs.map(doc => doc.id))
  const profileIds = [...new Set(user.assignedJobIds)].filter(id => /^[a-zA-Z0-9_-]{1,128}$/.test(id))
  for (let start = 0; start < profileIds.length; start += 100) {
    const jobs = await tx.getAll(...profileIds.slice(start, start + 100).map(id => db.doc('jobs/' + id)))
    for (const job of jobs) if (job.exists) assignedIds.add(job.id)
  }
  const ids = selectedJobId !== undefined ? (assignedIds.has(selectedJobId) ? [selectedJobId] : []) : [...assignedIds]
  const announcements = db.collection('dashboardAnnouncements')
  const queries = [announcements.where('audience', '==', 'everyone').orderBy('publishedAt', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(pageSize)]
  queries.push(announcements.where('recipientIds', 'array-contains', user.uid).orderBy('publishedAt', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(pageSize))
  for (let start = 0; start < ids.length; start += 30)
    queries.push(announcements.where('jobId', 'in', ids.slice(start, start + 30)).orderBy('publishedAt', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(pageSize))
  const results = await Promise.all(queries.map(query => tx.get(query)))
  const visible = new Map<string, PublishedAnnouncement>()
  for (const result of results) for (const doc of result.docs) {
    const item = doc.data()
    if (item.audience !== 'everyone' && !(item.audience === 'job' && ids.includes(item.jobId)) && !(item.audience === 'people' && Array.isArray(item.recipientIds) && item.recipientIds.includes(user.uid))) continue
    visible.set(doc.id, { id: doc.id, title: item.title, body: item.body, audience: item.audience,
      ...(item.audience === 'job' ? { jobId: item.jobId } : {}), publishedAt: item.publishedAt })
  }
  return { items: [...visible.values()].sort((a, b) => b.publishedAt - a.publishedAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)).slice(0, pageSize), limit: pageSize }
}

export async function validateAnnouncementRecipients(tx: Transaction, ids: string[]) {
  if (!ids.length || ids.length > 25 || ids.some(id => !validAnnouncementRecipientId(id)) || new Set(ids).size !== ids.length)
    throw new HttpsError('invalid-argument', 'Choose between one and 25 distinct people.')
  const profiles = await tx.getAll(...ids.map(id => db.doc('users/' + id)))
  if (profiles.some(profile => !profile.exists || !buildCurrentFunctionUser(profile.id, profile.data()!).active || buildCurrentFunctionUser(profile.id, profile.data()!).role === 'none'))
    throw new HttpsError('failed-precondition', 'Choose active users with dashboard access.')
}

export async function listAnnouncementRecipients(tx: Transaction, user: CurrentFunctionUser, data: Record<string, unknown>) {
  if (user.role !== 'admin') throw new HttpsError('permission-denied', 'Only Admin can choose announcement recipients.')
  if (data.scope !== 'personal' || (data.cursor !== undefined && !validAnnouncementRecipientId(data.cursor)) ||
    (data.search !== undefined && (typeof data.search !== 'string' || data.search.length > 100)) ||
    Object.keys(data).some(key => !['scope', 'action', 'search', 'cursor'].includes(key)))
    throw new HttpsError('invalid-argument', 'Use a valid recipient search.')
  const search = typeof data.search === 'string' ? data.search.trim().toLowerCase() : ''
  let query = db.collection('users').orderBy(FieldPath.documentId()).limit(100)
  if (data.cursor) query = query.startAfter(data.cursor)
  const profiles = await tx.get(query)
  const items: { uid: string; name: string; email: string; role: string }[] = []
  let scanned = 0
  for (const profile of profiles.docs) {
    scanned++
    const current = buildCurrentFunctionUser(profile.id, profile.data())
    if (!validAnnouncementRecipientId(profile.id) || !current.active || current.role === 'none') continue
    const email = typeof profile.data().email === 'string' ? profile.data().email : ''
    const name = current.displayName || profile.id
    if (!`${name} ${email} ${current.role}`.toLowerCase().includes(search)) continue
    items.push({ uid: profile.id, name, email, role: current.role })
    if (items.length === 50) break
  }
  return { items, nextCursor: scanned < profiles.size || profiles.size === 100 ? profiles.docs[scanned - 1]?.id || null : null }
}
