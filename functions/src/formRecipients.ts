import type { Firestore } from 'firebase-admin/firestore'
import type { FormAnswers, FormDefinition, FormField } from './formModel'
import { normalizeStoredRole } from './roleAccess'

export const FORM_RESPONDENT_RECIPIENT_LIMIT = 10
export const FORM_TOTAL_RECIPIENT_LIMIT = 100
export const formRecipientGroups = ['job-foremen', 'job-project-managers', 'job-everyone'] as const
export type FormRecipientGroup = (typeof formRecipientGroups)[number]
interface RecipientUser {
  uid: string
  email?: unknown
  active?: unknown
  role?: unknown
  assignedJobIds?: unknown
}
interface RecipientJob {
  id: string
  assignedForemanIds?: unknown
}
const ids = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeFormRecipientEmails(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) throw new Error('Recipient addresses must be a list.')
  if (value.length > limit) throw new Error(`At most ${limit} recipient addresses are allowed.`)
  const emails = value.map((address) => {
    if (typeof address !== 'string') throw new Error('Invalid recipient address.')
    const normalized = address.trim().toLowerCase()
    if (normalized.length > 254 || !emailPattern.test(normalized))
      throw new Error('Invalid recipient address.')
    return normalized
  })
  return [...new Set(emails)]
}

export function respondentRecipients(fields: FormField[], answers: FormAnswers): string[] {
  const result: string[] = []
  for (const field of fields) {
    const value = answers[field.id]
    if (field.kind === 'recipients' && value !== undefined) {
      result.push(...normalizeFormRecipientEmails(value, FORM_RESPONDENT_RECIPIENT_LIMIT))
    }
    if (field.kind === 'repeat' && Array.isArray(value)) {
      for (const instance of value) {
        if (typeof instance === 'object' && instance && 'answers' in instance)
          result.push(...respondentRecipients(field.fields ?? [], instance.answers))
      }
    }
  }
  return normalizeFormRecipientEmails(result, FORM_RESPONDENT_RECIPIENT_LIMIT)
}

/** Notification routing only: this function never grants access to entries or photos. */
export function resolveRecipientEmails(
  definition: FormDefinition,
  answers: FormAnswers,
  job: RecipientJob | null,
  users: RecipientUser[],
  options: { publicRespondent?: boolean; verifiedEmails?: string[]; publicRecordId?: string } = {},
): string[] {
  const groups = definition.recipientGroups ?? []
  if (groups.some((group) => !formRecipientGroups.includes(group)))
    throw new Error('Invalid recipient group.')
  if (groups.length && !job) throw new Error('Job recipient groups require a valid job context.')
  const fixed = normalizeFormRecipientEmails(definition.recipients, 20)
  const additional = respondentRecipients(definition.fields, answers)
  const groupEmails: string[] = []
  if (job && groups.length) {
    for (const user of users) {
      if (user.active === false) continue
      const role = normalizeStoredRole(user.role)
      const assigned = ids(user.assignedJobIds).includes(job.id)
      const foremanAssigned =
        role === 'foreman' && (assigned || ids(job.assignedForemanIds).includes(user.uid))
      const selected =
        (groups.includes('job-everyone') && (assigned || foremanAssigned)) ||
        (groups.includes('job-foremen') && foremanAssigned) ||
        (groups.includes('job-project-managers') && role === 'project-manager' && assigned)
      if (
        !selected ||
        typeof user.email !== 'string' ||
        !emailPattern.test(user.email.trim()) ||
        user.email.trim().length > 254
      )
        continue
      groupEmails.push(user.email.trim().toLowerCase())
    }
  }
  // Public input cannot turn the notification service into an arbitrary mail relay.
  // Unverified addresses remain part of the immutable answers, but do not receive mail.
  const approved = [...new Set([...fixed, ...groupEmails])]
  const publicApprovedExtras = additional.filter((email) => options.verifiedEmails?.includes(email))
  const combined = [
    ...new Set([...approved, ...(options.publicRespondent ? publicApprovedExtras : additional)]),
  ]
  if (combined.length > FORM_TOTAL_RECIPIENT_LIMIT)
    throw new Error('Too many submission recipients. Narrow the job recipient groups.')
  return combined
}

/** Queries only explicit assignment membership; never scans the company directory. */
export async function resolveFormSubmissionRecipients(
  db: Firestore,
  definition: FormDefinition,
  answers: FormAnswers,
  jobId?: string,
  options: { publicRespondent?: boolean; verifiedEmails?: string[]; publicRecordId?: string } = {},
): Promise<string[]> {
  if (options.publicRespondent && options.publicRecordId && options.verifiedEmails === undefined) {
    options = {
      ...options,
      verifiedEmails: (await publicRecipientConsentSnapshot(db, options.publicRecordId)).map(
        (proof) => proof.email,
      ),
    }
  }
  if (!definition.recipientGroups?.length)
    return resolveRecipientEmails(definition, answers, null, [], options)
  if (!jobId) throw new Error('Job recipient groups require a valid job context.')
  const jobSnapshot = await db.collection('jobs').doc(jobId).get()
  if (!jobSnapshot.exists) throw new Error('Job recipient groups require a valid job context.')
  const job: RecipientJob = {
    id: jobSnapshot.id,
    assignedForemanIds: jobSnapshot.data()?.assignedForemanIds,
  }
  const assignedSnapshot = await db
    .collection('users')
    .where('assignedJobIds', 'array-contains', jobId)
    .limit(101)
    .get()
  if (assignedSnapshot.size > FORM_TOTAL_RECIPIENT_LIMIT)
    throw new Error('Job recipient group is too large. Narrow its membership.')
  const users = new Map<string, RecipientUser>()
  for (const doc of assignedSnapshot.docs) users.set(doc.id, { ...doc.data(), uid: doc.id })
  const foremanIds = [...new Set(ids(job.assignedForemanIds))]
  if (foremanIds.length > FORM_TOTAL_RECIPIENT_LIMIT)
    throw new Error('Job recipient group is too large.')
  if (foremanIds.length) {
    const snapshots = await db.getAll(...foremanIds.map((uid) => db.collection('users').doc(uid)))
    for (const doc of snapshots) if (doc.exists) users.set(doc.id, { ...doc.data(), uid: doc.id })
  }
  return resolveRecipientEmails(definition, answers, job, [...users.values()], options)
}

/** Copy only these provenance fields into the immutable submission/delivery, never code hashes. */
export async function publicRecipientConsentSnapshot(db: Firestore, recordId: string) {
  const record = await db.doc(`formRecords/${recordId}`).get()
  const saved = record.data()
  const proofs = await db
    .collection('formRecipientVerifications')
    .where('recordId', '==', recordId)
    .limit(10)
    .get()
  return proofs.docs
    .filter((doc) => {
      const proof = doc.data()
      return (
        proof.verified === true &&
        proof.approvalExpiresAt > Date.now() &&
        saved &&
        proof.templateId === saved.templateId &&
        proof.templateVersion === saved.templateVersion &&
        proof.capabilityHash === saved.publicCapabilityHash
      )
    })
    .map((doc) => {
      const proof = doc.data()
      return {
        proofId: doc.id,
        email: proof.email as string,
        recordId,
        templateId: proof.templateId as string,
        templateVersion: proof.templateVersion as number,
        verifiedAt: proof.verifiedAt as number,
        approvalExpiresAt: proof.approvalExpiresAt as number,
      }
    })
}
