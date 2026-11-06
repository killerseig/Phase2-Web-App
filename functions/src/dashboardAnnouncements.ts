import { createHash } from 'node:crypto'
import { HttpsError } from 'firebase-functions/v2/https'
import { FieldPath, type Transaction } from 'firebase-admin/firestore'
import { db } from './runtime'
import type { CurrentFunctionUser } from './roleAccess'
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
  if (!draft || !['everyone', 'job'].includes(draft.audience || ''))
    throw new HttpsError('failed-precondition', 'Save a draft with an announcement audience first.')
  if (draft.audience === 'job') {
    const job = await tx.get(db.doc('jobs/' + draft.jobId))
    if (!job.exists) throw new HttpsError('failed-precondition', 'Choose an available job before publishing.')
  }
  tx.create(destination, {
    title: draft.title, body: draft.body, audience: draft.audience,
    ...(draft.audience === 'job' ? { jobId: draft.jobId } : {}),
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
  for (let start = 0; start < ids.length; start += 30)
    queries.push(announcements.where('jobId', 'in', ids.slice(start, start + 30)).orderBy('publishedAt', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(pageSize))
  const results = await Promise.all(queries.map(query => tx.get(query)))
  const visible = new Map<string, PublishedAnnouncement>()
  for (const result of results) for (const doc of result.docs) {
    const item = doc.data()
    if (item.audience !== 'everyone' && !(item.audience === 'job' && ids.includes(item.jobId))) continue
    visible.set(doc.id, { id: doc.id, title: item.title, body: item.body, audience: item.audience,
      ...(item.audience === 'job' ? { jobId: item.jobId } : {}), publishedAt: item.publishedAt })
  }
  return { items: [...visible.values()].sort((a, b) => b.publishedAt - a.publishedAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)).slice(0, pageSize), limit: pageSize }
}
