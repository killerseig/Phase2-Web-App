import {
  FieldValue,
  Timestamp,
  type DocumentReference,
  type Transaction,
} from 'firebase-admin/firestore'

import { EMAIL_STYLES } from './constants'
import type { EmailDeliveryFailureClassification } from './emailDeliveryErrors'

export type JobEventNotificationKey = 'newJobs' | 'fieldUserAssignments'

export const JOB_NOTIFICATION_CLAIM_LEASE_MS = 10 * 60 * 1000
const JOB_NOTIFICATION_EVENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

export type JobNotificationClaimDisposition = 'claim' | 'failed-permanent' | 'in-progress' | 'sent'

export interface JobNotificationRecord {
  id: string
  name: string
  code: string | null
  type: string
  gc: string | null
  jobAddress: string | null
  startDate: string | null
  finishDate: string | null
  assignedFieldUserIds: string[]
}

export interface JobNotificationEmailOptions {
  to: string[]
  subject: string
  html: string
}

export interface JobNotificationHandlerDependencies {
  isEmailEnabled: () => boolean
  getGlobalRecipients: (notificationKey: JobEventNotificationKey) => Promise<string[]>
  getFieldUserNames: (userIds: string[]) => Promise<string[]>
  claimEvent: (
    eventKey: string,
    metadata: { notificationKey: JobEventNotificationKey; jobId: string },
  ) => Promise<boolean>
  completeEvent: (eventKey: string) => Promise<void>
  failEvent: (eventKey: string, failure: EmailDeliveryFailureClassification) => Promise<void>
  releaseEvent: (eventKey: string) => Promise<void>
  classifySendError: (error: unknown) => EmailDeliveryFailureClassification
  sendEmail: (options: JobNotificationEmailOptions) => Promise<void>
}

export type JobNotificationOutcome =
  | 'sent'
  | 'failed-permanent'
  | 'skipped-duplicate'
  | 'skipped-email-disabled'
  | 'skipped-missing-job'
  | 'skipped-no-new-assignments'
  | 'skipped-no-recipients'

function text(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function textOrNull(value: unknown) {
  return text(value) || null
}

function normalizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0 && !entry.includes('/')),
    ),
  )
}

export function isValidJobNotificationRecipient(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function timestampToMillis(value: unknown): number | null {
  if (!value) return null
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  if (typeof value === 'object') {
    const candidate = value as {
      nanoseconds?: number
      seconds?: number
      toDate?: () => Date
      toMillis?: () => number
    }
    if (typeof candidate.toMillis === 'function') {
      const millis = candidate.toMillis()
      return Number.isFinite(millis) ? millis : null
    }
    if (typeof candidate.toDate === 'function') {
      const date = candidate.toDate()
      return Number.isNaN(date.getTime()) ? null : date.getTime()
    }
    if (typeof candidate.seconds === 'number' && Number.isFinite(candidate.seconds)) {
      return candidate.seconds * 1000 + Math.floor((candidate.nanoseconds || 0) / 1_000_000)
    }
  }
  return null
}

export function getJobNotificationClaimDisposition(
  value: unknown,
  nowMs: number = Date.now(),
  leaseMs: number = JOB_NOTIFICATION_CLAIM_LEASE_MS,
): JobNotificationClaimDisposition {
  if (!value || typeof value !== 'object') return 'claim'
  const data = value as Record<string, unknown>

  if (data.status === 'sent') return 'sent'
  if (data.status === 'failed-permanent') return 'failed-permanent'
  if (data.status !== 'processing') return 'claim'

  const leaseExpiresAt = timestampToMillis(data.leaseExpiresAt)
  if (leaseExpiresAt !== null) {
    return leaseExpiresAt > nowMs ? 'in-progress' : 'claim'
  }

  const claimedAt = timestampToMillis(data.claimedAt)
  if (claimedAt === null) return 'claim'
  return nowMs - claimedAt < leaseMs ? 'in-progress' : 'claim'
}

function normalizeAttemptCount(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0
}

export async function claimJobNotificationEventInTransaction(
  transaction: Pick<Transaction, 'get' | 'set'>,
  eventRef: DocumentReference,
  eventKey: string,
  metadata: { notificationKey: JobEventNotificationKey; jobId: string },
  now: Date = new Date(),
) {
  const snapshot = await transaction.get(eventRef)
  const existing = snapshot.exists ? snapshot.data() : null
  const disposition = getJobNotificationClaimDisposition(existing, now.getTime())

  if (disposition === 'sent' || disposition === 'failed-permanent') return false
  if (disposition === 'in-progress') {
    throw new Error(`Notification event ${eventKey} is already processing.`)
  }

  transaction.set(
    eventRef,
    {
      eventKey,
      jobId: metadata.jobId,
      notificationKey: metadata.notificationKey,
      status: 'processing',
      attemptCount: normalizeAttemptCount(existing?.attemptCount) + 1,
      claimedAt: FieldValue.serverTimestamp(),
      leaseExpiresAt: Timestamp.fromMillis(now.getTime() + JOB_NOTIFICATION_CLAIM_LEASE_MS),
      // A Firestore TTL policy can safely remove old dedupe records after the event retry horizon.
      expiresAt: Timestamp.fromMillis(now.getTime() + JOB_NOTIFICATION_EVENT_RETENTION_MS),
    },
    { merge: true },
  )

  return true
}

function normalizeRecipients(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim().toLowerCase())
        .filter(isValidJobNotificationRecipient),
    ),
  )
}

function escapeHtml(value: unknown) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatJobType(value: string) {
  return (
    value
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(' ') || 'General'
  )
}

function formatJobLabel(job: Pick<JobNotificationRecord, 'code' | 'name'>) {
  return [job.code ? `#${job.code}` : '', job.name].filter(Boolean).join(' ')
}

function renderRow(label: string, value: string | null) {
  return `
    <tr>
      <th style="width: 180px;">${escapeHtml(label)}</th>
      <td>${value ? escapeHtml(value) : '&mdash;'}</td>
    </tr>
  `
}

function renderFieldUserList(names: string[]) {
  if (!names.length) return '<p style="margin: 0; color: #666;">No field users assigned.</p>'

  return `
    <ul style="margin: 0; padding-left: 22px;">
      ${names.map((name) => `<li>${escapeHtml(name)}</li>`).join('')}
    </ul>
  `
}

function buildNotificationEmail(options: {
  heading: string
  previewText: string
  intro: string
  job: JobNotificationRecord
  fieldUserHeading: string
  fieldUserNames: string[]
}) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        ${EMAIL_STYLES}
      </head>
      <body>
        <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${escapeHtml(options.previewText)}</div>
        <div class="email-container">
          <div class="header"><h1>${escapeHtml(options.heading)}</h1></div>
          <div class="content">
            <p>${escapeHtml(options.intro)}</p>
            <table>
              ${renderRow('Job Number', options.job.code)}
              ${renderRow('Job Name', options.job.name)}
              ${renderRow('Job Type', formatJobType(options.job.type))}
              ${renderRow('General Contractor', options.job.gc)}
              ${renderRow('Job Address', options.job.jobAddress)}
              ${renderRow('Start Date', options.job.startDate)}
              ${renderRow('Finish Date', options.job.finishDate)}
            </table>
            <h2 style="font-size: 18px; margin: 24px 0 10px;">${escapeHtml(options.fieldUserHeading)}</h2>
            ${renderFieldUserList(options.fieldUserNames)}
          </div>
          <div class="footer"><p>This is an automated Phase 2 notification.</p></div>
        </div>
      </body>
    </html>
  `
}

export function normalizeJobNotificationRecord(
  jobId: string,
  value: unknown,
): JobNotificationRecord | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>

  return {
    id: text(jobId),
    name: text(data.name) || 'Untitled Job',
    code: textOrNull(data.code ?? data.number),
    type: text(data.type) || 'general',
    gc: textOrNull(data.gc),
    jobAddress: textOrNull(data.jobAddress),
    startDate: textOrNull(data.startDate),
    finishDate: textOrNull(data.finishDate),
    assignedFieldUserIds: normalizeIdList(data.assignedForemanIds),
  }
}

export function getNewlyAssignedFieldUserIds(beforeValue: unknown, afterValue: unknown) {
  const before = normalizeJobNotificationRecord('', beforeValue)
  const after = normalizeJobNotificationRecord('', afterValue)
  if (!after) return []

  const previousIds = new Set(before?.assignedFieldUserIds ?? [])
  return after.assignedFieldUserIds.filter((userId) => !previousIds.has(userId))
}

export function buildNewJobNotificationSubject(job: JobNotificationRecord) {
  return `New Job | ${formatJobLabel(job)}`
}

export function buildFieldUserAssignmentNotificationSubject(job: JobNotificationRecord) {
  return `Field User Assignment | ${formatJobLabel(job)}`
}

export function buildNewJobNotificationEmail(job: JobNotificationRecord, fieldUserNames: string[]) {
  const subject = buildNewJobNotificationSubject(job)
  return buildNotificationEmail({
    heading: 'New Job Created',
    previewText: subject,
    intro: 'A new job was added to Phase 2.',
    job,
    fieldUserHeading: 'Initial Assigned Field Users',
    fieldUserNames,
  })
}

export function buildFieldUserAssignmentNotificationEmail(
  job: JobNotificationRecord,
  fieldUserNames: string[],
) {
  const subject = buildFieldUserAssignmentNotificationSubject(job)
  return buildNotificationEmail({
    heading: 'Field User Assignment',
    previewText: subject,
    intro:
      fieldUserNames.length === 1
        ? 'A field user was assigned to this job.'
        : 'Field users were assigned to this job.',
    job,
    fieldUserHeading: 'Newly Assigned Field Users',
    fieldUserNames,
  })
}

async function deliverOnce(options: {
  eventKey: string
  jobId: string
  notificationKey: JobEventNotificationKey
  recipients: string[]
  subject: string
  html: string
  deps: JobNotificationHandlerDependencies
}): Promise<JobNotificationOutcome> {
  const claimed = await options.deps.claimEvent(options.eventKey, {
    notificationKey: options.notificationKey,
    jobId: options.jobId,
  })
  if (!claimed) return 'skipped-duplicate'

  try {
    await options.deps.sendEmail({
      to: options.recipients,
      subject: options.subject,
      html: options.html,
    })
  } catch (error) {
    const failure = options.deps.classifySendError(error)
    if (!failure.retryable) {
      await options.deps.failEvent(options.eventKey, failure)
      return 'failed-permanent'
    }

    try {
      await options.deps.releaseEvent(options.eventKey)
    } catch (releaseError) {
      console.error('[jobNotification] Failed to release notification claim after a send error', {
        eventKey: options.eventKey,
        releaseError,
      })
    }
    throw error
  }

  try {
    await options.deps.completeEvent(options.eventKey)
  } catch (error) {
    // The email is already sent. Keep the claim so a retry cannot send it twice.
    console.error(
      '[jobNotification] Email sent, but the notification claim could not be completed',
      {
        eventKey: options.eventKey,
        error,
      },
    )
  }

  return 'sent'
}

export async function handleNewJobNotification(
  input: { eventId: string; jobId: string; jobData: unknown },
  deps: JobNotificationHandlerDependencies,
): Promise<JobNotificationOutcome> {
  if (!deps.isEmailEnabled()) return 'skipped-email-disabled'

  const job = normalizeJobNotificationRecord(input.jobId, input.jobData)
  if (!job) return 'skipped-missing-job'

  const recipients = normalizeRecipients(await deps.getGlobalRecipients('newJobs'))
  if (!recipients.length) return 'skipped-no-recipients'

  const fieldUserNames = job.assignedFieldUserIds.length
    ? await deps.getFieldUserNames(job.assignedFieldUserIds)
    : []

  return deliverOnce({
    eventKey: `newJobs:${input.eventId}`,
    jobId: job.id,
    notificationKey: 'newJobs',
    recipients,
    subject: buildNewJobNotificationSubject(job),
    html: buildNewJobNotificationEmail(job, fieldUserNames),
    deps,
  })
}

export async function handleFieldUserAssignmentNotification(
  input: { eventId: string; jobId: string; beforeData: unknown; afterData: unknown },
  deps: JobNotificationHandlerDependencies,
): Promise<JobNotificationOutcome> {
  if (!deps.isEmailEnabled()) return 'skipped-email-disabled'

  const job = normalizeJobNotificationRecord(input.jobId, input.afterData)
  if (!job) return 'skipped-missing-job'

  const newlyAssignedIds = getNewlyAssignedFieldUserIds(input.beforeData, input.afterData)
  if (!newlyAssignedIds.length) return 'skipped-no-new-assignments'

  const recipients = normalizeRecipients(await deps.getGlobalRecipients('fieldUserAssignments'))
  if (!recipients.length) return 'skipped-no-recipients'

  const fieldUserNames = await deps.getFieldUserNames(newlyAssignedIds)

  return deliverOnce({
    eventKey: `fieldUserAssignments:${input.eventId}`,
    jobId: job.id,
    notificationKey: 'fieldUserAssignments',
    recipients,
    subject: buildFieldUserAssignmentNotificationSubject(job),
    html: buildFieldUserAssignmentNotificationEmail(job, fieldUserNames),
    deps,
  })
}
