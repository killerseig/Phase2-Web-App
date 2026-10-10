import { HttpsError } from 'firebase-functions/v2/https'
import { db } from './runtime'
import { buildCurrentFunctionUser } from './roleAccess'
import { formId, type FormRecord } from './formModel'
import { canReadFormEntry } from './formAccess'
import { targetFunctionRoleCanOpenJobDashboard } from './targetJobAccess'
import { isFunctionShopJob } from './jobIdentity'
const denied = () =>
  new HttpsError('permission-denied', 'This entry is unavailable or you do not have access.')
async function reader(uid?: string) {
  if (!uid) throw denied()
  const snapshot = await db.doc('users/' + uid).get()
  const user = buildCurrentFunctionUser(uid, snapshot.data() || {})
  if (!snapshot.exists || !user.active) throw denied()
  return user
}
async function currentEntryPolicy(templateId: string, fallback: unknown) {
  const template = await db.doc('formTemplates/' + templateId).get()
  const version = template.data()?.latestVersion
  if (!version) return fallback
  const issued = await template.ref
    .collection('versions')
    .doc('v' + version)
    .get()
  return issued.data()?.access || fallback
}
async function jobAllowed(record: FormRecord, user: Awaited<ReturnType<typeof reader>>) {
  if (!record.jobId) return true
  const job = await db.doc('jobs/' + record.jobId).get()
  const assigned = new Set(user.assignedJobIds)
  if (job.data()?.assignedForemanIds?.includes(user.uid)) assigned.add(record.jobId)
  return (
    job.exists &&
    targetFunctionRoleCanOpenJobDashboard({
      role: user.role,
      jobId: record.jobId,
      assignedJobIds: [...assigned],
      isShopJob: isFunctionShopJob(job.data()!),
    })
  )
}
export async function authorizeFormEntry(id: string, uid?: string): Promise<FormRecord> {
  if (!formId(id)) throw denied()
  const user = await reader(uid)
  const record = (await db.doc('formSubmissions/' + id).get()).data() as FormRecord | undefined
  if (!record || record.status !== 'submitted') throw denied()
  if (
    !canReadFormEntry(
      await currentEntryPolicy(record.templateId, record.definition.access),
      record.ownerUid,
      user,
    )
  )
    throw denied()
  if (!(await jobAllowed(record, user))) throw denied()
  return record
}
export interface FormEntryPage {
  records: FormRecord[]
  nextCursor: string | null
  snapshotBefore: number
  complete: boolean
}
/** Scan a bounded ID range and filter every entry; empty pages may still have a next cursor. */
export async function authorizeFormEntriesPage(
  templateId: string,
  uid?: string,
  cursor?: unknown,
  snapshotBefore?: unknown,
): Promise<FormEntryPage> {
  if (!formId(templateId) || (cursor != null && cursor !== '' && !formId(cursor))) throw denied()
  const user = await reader(uid)
  const template = (await db.doc('formTemplates/' + templateId).get()).data()
  const policy = await currentEntryPolicy(templateId, template?.draft?.access)
  if (!template || !canReadFormEntry(policy, '', user)) throw denied()
  const boundary = snapshotBefore == null ? Date.now() : Number(snapshotBefore)
  if (!Number.isSafeInteger(boundary) || boundary < 0 || boundary > Date.now() + 1000)
    throw new HttpsError('invalid-argument', 'Invalid entry snapshot.')
  let query = db
    .collection('formSubmissions')
    .where('templateId', '==', templateId)
    .orderBy('__name__')
    .limit(101)
  if (cursor) query = query.startAfter(cursor)
  const snapshot = await query.get()
  const scanned = snapshot.docs.slice(0, 100)
  const allowed = scanned
    .map((doc) => doc.data() as FormRecord)
    .filter(
      (record) =>
        record.status === 'submitted' &&
        (record.submittedAt || 0) <= boundary &&
        canReadFormEntry(policy, record.ownerUid, user),
    )
  const records = (
    await Promise.all(
      allowed.map(async (record) => ((await jobAllowed(record, user)) ? record : undefined)),
    )
  ).filter((record): record is FormRecord => !!record)
  const nextCursor = snapshot.docs.length > 100 ? scanned[scanned.length - 1]!.id : null
  return { records, nextCursor, snapshotBefore: boundary, complete: nextCursor === null }
}
