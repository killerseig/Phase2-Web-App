export interface SubmittedEmailStatusResult {
  emailSent: boolean
  emailMessage: string
  operationId?: string | null
}

export interface FirestoreStatusSentinels {
  serverTimestamp(): unknown
  delete(): unknown
}

type SubmittedEmailOperation = 'dailyLogSubmittedEmail' | 'shopOrderSubmittedEmail' | 'timecardWeekSubmittedEmail'

export const SUBMITTED_EMAIL_IN_PROGRESS_TIMEOUT_MS = 10 * 60 * 1000

export interface SubmittedEmailOperationRecord {
  submittedEmailOperationId?: unknown
  submittedEmailInProgressAt?: unknown
  submittedEmailSentAt?: unknown
  submittedEmailError?: unknown
}

export function buildSubmittedEmailOperationId(operation: SubmittedEmailOperation, recordId: string): string {
  const safeRecordId = recordId.trim().replace(/\s+/g, '-')
  return `${operation}:${safeRecordId}`
}

export function isSubmittedEmailOperationAlreadySent(
  record: SubmittedEmailOperationRecord | null | undefined,
  operationId: string,
): boolean {
  return record?.submittedEmailOperationId === operationId && Boolean(record.submittedEmailSentAt)
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
    const candidate = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number }
    if (typeof candidate.toDate === 'function') {
      const date = candidate.toDate()
      return Number.isNaN(date.getTime()) ? null : date.getTime()
    }
    if (typeof candidate.seconds === 'number' && Number.isFinite(candidate.seconds)) {
      return (candidate.seconds * 1000) + Math.floor((candidate.nanoseconds || 0) / 1000000)
    }
  }
  return null
}

export function isSubmittedEmailOperationInProgress(
  record: SubmittedEmailOperationRecord | null | undefined,
  operationId: string,
  now: Date = new Date(),
  timeoutMs: number = SUBMITTED_EMAIL_IN_PROGRESS_TIMEOUT_MS,
): boolean {
  if (record?.submittedEmailOperationId !== operationId) return false
  if (!record.submittedEmailInProgressAt || record.submittedEmailSentAt || record.submittedEmailError) return false

  const inProgressAt = timestampToMillis(record.submittedEmailInProgressAt)
  if (inProgressAt === null) return true

  return now.getTime() - inProgressAt < timeoutMs
}

export function buildSubmittedEmailClaimUpdate(
  operationId: string,
  sentinels: FirestoreStatusSentinels,
): Record<string, unknown> {
  return {
    submittedEmailOperationId: operationId,
    submittedEmailAttemptedAt: sentinels.serverTimestamp(),
    submittedEmailInProgressAt: sentinels.serverTimestamp(),
    submittedEmailSentAt: null,
    submittedEmailError: sentinels.delete(),
  }
}

export function buildSubmittedEmailStatusUpdate(
  result: SubmittedEmailStatusResult,
  sentinels: FirestoreStatusSentinels,
): Record<string, unknown> {
  return {
    ...(result.operationId ? { submittedEmailOperationId: result.operationId } : {}),
    submittedEmailAttemptedAt: sentinels.serverTimestamp(),
    submittedEmailInProgressAt: sentinels.delete(),
    submittedEmailSentAt: result.emailSent ? sentinels.serverTimestamp() : null,
    submittedEmailError: result.emailSent ? sentinels.delete() : result.emailMessage,
  }
}
