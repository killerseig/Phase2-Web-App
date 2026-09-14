import { httpsCallable } from 'firebase/functions'
import { requireFirebaseServices } from '@/firebase'
import { getE2EPublicDailyLogGallery, isE2EActive } from '@/testing/e2eRuntime'
import type { DailyLogAttachmentType, PublicDailyLogGalleryRecord } from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeAttachmentType(value: unknown): DailyLogAttachmentType {
  return value === 'ptp' || value === 'qc' || value === 'other' ? value : 'photo'
}

function normalizeGallery(value: unknown): PublicDailyLogGalleryRecord {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const rawAttachments = Array.isArray(record.attachments) ? record.attachments : []
  const attachments = rawAttachments.flatMap((attachment) => {
    if (!attachment || typeof attachment !== 'object') return []
    const item = attachment as Record<string, unknown>
    const url = text(item.url)
    if (!url) return []

    return [
      {
        name: text(item.name) || 'Daily log photo',
        url,
        thumbnailUrl: text(item.thumbnailUrl) || undefined,
        type: normalizeAttachmentType(item.type),
        description: text(item.description),
      },
    ]
  })
  const sequenceNumber = Number(record.sequenceNumber)

  return {
    jobName: text(record.jobName) || 'Phase 2 Job',
    jobCode: text(record.jobCode),
    logDate: text(record.logDate),
    sequenceNumber:
      Number.isFinite(sequenceNumber) && sequenceNumber >= 1 ? Math.round(sequenceNumber) : 1,
    foremanName: text(record.foremanName) || 'Phase 2 Foreman',
    submittedAt: text(record.submittedAt) || null,
    attachments,
  }
}

export async function fetchPublicDailyLogGallery(
  shareId: string,
): Promise<PublicDailyLogGalleryRecord> {
  const normalizedShareId = shareId.trim()
  if (!normalizedShareId) throw new Error('This photo gallery link is incomplete.')

  if (isE2EActive()) {
    const gallery = getE2EPublicDailyLogGallery(normalizedShareId)
    if (!gallery) throw new Error('This photo gallery is unavailable.')
    return normalizeGallery(gallery)
  }

  try {
    const { functions } = requireFirebaseServices()
    const callable = httpsCallable<{ shareId: string }, PublicDailyLogGalleryRecord>(
      functions,
      'getPublicDailyLogGallery',
    )
    const result = await callable({ shareId: normalizedShareId })
    return normalizeGallery(result.data)
  } catch (error) {
    throw new Error(normalizeError(error, 'This photo gallery is unavailable.'))
  }
}

export async function fetchLegacyPublicDailyLogGallery(
  jobId: string,
  dailyLogId: string,
): Promise<PublicDailyLogGalleryRecord> {
  const normalizedJobId = jobId.trim()
  const normalizedDailyLogId = dailyLogId.trim()
  if (!normalizedJobId || !normalizedDailyLogId) {
    throw new Error('This photo gallery link is incomplete.')
  }

  throw new Error('This older photo link is no longer available. Ask the sender for a new gallery link.')
}
