import { HttpsError } from 'firebase-functions/v2/https'
import type { Transaction } from 'firebase-admin/firestore'
import { db } from './runtime'
import type { CurrentFunctionUser } from './roleAccess'
import { validateAnnouncementDrafts, type AnnouncementDraft } from './sharedDashboardModel'
import { announcementId, validateAnnouncementRecipients } from './dashboardAnnouncements'

// Author-owned content is independent of dashboard layout/widget availability.
// Keep the existing document and version so older dashboard clients stay compatible.
export async function manageAnnouncementDrafts(
  tx: Transaction,
  user: CurrentFunctionUser,
  data: Record<string, unknown>,
) {
  if (user.role !== 'admin')
    throw new HttpsError('permission-denied', 'Only Admin can manage announcement drafts.')
  const saving = data.action === 'save-announcement-drafts'
  const allowed = saving
    ? ['action', 'scope', 'version', 'announcementDrafts']
    : ['action', 'scope']
  if (data.scope !== 'personal' || Object.keys(data).some((key) => !allowed.includes(key)))
    throw new HttpsError('invalid-argument', 'Use your own announcement drafts.')
  const ref = db.doc('sharedDashboardPersonalData/' + user.uid)
  const snapshot = await tx.get(ref)
  const content = snapshot.data() || {}
  const version = Number(content.version || 0)
  if (!saving) {
    const drafts: AnnouncementDraft[] = content.announcementDrafts || []
    const publications = drafts.length
      ? await tx.getAll(
          ...drafts.map((draft) =>
            db.doc('dashboardAnnouncements/' + announcementId(user.uid, draft.id)),
          ),
        )
      : []
    return {
      version,
      announcementDrafts: drafts,
      publishedDraftIds: drafts
        .filter((_, index) => publications[index]?.exists)
        .map((draft) => draft.id),
    }
  }
  if (!Number.isSafeInteger(data.version) || data.version !== version)
    throw new HttpsError(
      'aborted',
      'Your saved content changed elsewhere. Reload and review before saving.',
    )
  let entries: AnnouncementDraft[]
  try {
    entries = validateAnnouncementDrafts(data.announcementDrafts)
  } catch (error) {
    throw new HttpsError(
      'invalid-argument',
      error instanceof Error ? error.message : 'Invalid announcement drafts.',
    )
  }
  for (const entry of entries) {
    if (entry.audience === 'job' && !(await tx.get(db.doc('jobs/' + entry.jobId))).exists)
      throw new HttpsError('invalid-argument', 'Choose an available job.')
    if (entry.audience === 'people')
      await validateAnnouncementRecipients(tx, entry.recipientIds || [])
  }
  const notes = Object.fromEntries(
    Object.entries(content.notes || {})
      .filter(([key]) => key.startsWith('personal:'))
      .map(([key, value]) => [key.slice(9), value]),
  )
  // Preserve older dashboard clients' template-backed note display in the save
  // response. Layout shape/availability is never a prerequisite for authoring.
  const template = await tx.get(db.doc('sharedDashboardPersonal/' + user.uid))
  const fallback = template.exists
    ? template
    : await tx.get(db.doc('dashboardPersonal/' + user.uid))
  const widgets = fallback.data()?.widgets
  if (Array.isArray(widgets))
    for (const widget of widgets) {
      if (
        widget?.type === 'notes' &&
        typeof widget.id === 'string' &&
        typeof widget.text === 'string' &&
        !(widget.id in notes)
      )
        notes[widget.id] = widget.text
    }
  tx.set(ref, {
    ...content,
    announcementDrafts: entries,
    version: version + 1,
    updatedBy: user.uid,
    updatedAt: Date.now(),
  })
  return {
    version: version + 1,
    announcementDrafts: entries,
    notes,
    events: content.calendars?.personal || [],
    tasks: content.tasks || [],
  }
}
