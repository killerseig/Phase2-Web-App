import { FieldValue } from 'firebase-admin/firestore'
import { randomBytes } from 'node:crypto'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { getJobDetails } from './firestoreService'
import { db, storageBucket } from './runtime'
import { getExpectedDailyLogThumbnailPath } from './dailyLogEmailPhotos'

const GALLERY_SHARES_COLLECTION = 'dailyLogGalleryShares'
const GALLERY_SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/
const FIRESTORE_DOCUMENT_ID_PATTERN = /^[^/]{1,128}$/

type GalleryAttachmentType = 'photo' | 'ptp' | 'qc' | 'other'

interface GalleryAttachment {
  name: string
  url: string
  thumbnailUrl?: string
  type: GalleryAttachmentType
  description: string
}

interface EnsureDailyLogGalleryShareInput {
  dailyLogId: string
  jobId: string
  jobDetails?: any
  log?: any
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeSequenceNumber(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return Math.round(parsed)
}

function normalizeAttachmentType(value: unknown): GalleryAttachmentType {
  return value === 'ptp' || value === 'qc' || value === 'other' ? value : 'photo'
}

export function isTrustedStorageObjectUrl(value: string, objectPath: string, bucketName: string) {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') return false

    if (parsed.hostname === 'firebasestorage.googleapis.com') {
      const match = /^\/v0\/b\/([^/]+)\/o\/(.+)$/.exec(parsed.pathname)
      if (!match) return false
      return (
        decodeURIComponent(match[1] || '') === bucketName &&
        decodeURIComponent(match[2] || '') === objectPath
      )
    }

    if (parsed.hostname === 'storage.googleapis.com') {
      const expectedPath = `/${encodeURIComponent(bucketName)}/${objectPath
        .split('/')
        .map((part) => encodeURIComponent(part))
        .join('/')}`
      return parsed.pathname === expectedPath
    }

    return false
  } catch {
    return false
  }
}

function normalizeAttachment(
  value: unknown,
  dailyLogId: string,
  bucketName: string,
): GalleryAttachment | null {
  if (!value || typeof value !== 'object') return null

  const record = value as Record<string, unknown>
  const name = text(record.name) || 'Daily log photo'
  const url = text(record.url)
  const thumbnailUrl = text(record.thumbnailUrl)
  const path = text(record.path)
  const expectedThumbnailPath = getExpectedDailyLogThumbnailPath(path, dailyLogId)
  const thumbnailPath = text(record.thumbnailPath)

  // Gallery images are served from Firebase download URLs. Reject non-web
  // schemes so a stored value can never become an executable public link.
  if (!expectedThumbnailPath || !isTrustedStorageObjectUrl(url, path, bucketName)) {
    return null
  }

  const hasTrustedThumbnail =
    (!thumbnailPath || thumbnailPath === expectedThumbnailPath) &&
    isTrustedStorageObjectUrl(thumbnailUrl, expectedThumbnailPath, bucketName)

  return {
    name,
    url,
    ...(hasTrustedThumbnail ? { thumbnailUrl } : {}),
    type: normalizeAttachmentType(record.type),
    description: text(record.description),
  }
}

function serializeDate(value: unknown): string | null {
  if (typeof (value as { toDate?: () => Date })?.toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString()
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
  }

  return null
}

function getDailyLogAttachments(
  log: any,
  dailyLogId: string,
  bucketName: string,
): GalleryAttachment[] {
  const payload = log?.payload && typeof log.payload === 'object' ? log.payload : log
  const attachments = Array.isArray(payload?.attachments)
    ? payload.attachments
    : Array.isArray(log?.attachments)
      ? log.attachments
      : []
  return attachments
    .map((attachment: unknown) => normalizeAttachment(attachment, dailyLogId, bucketName))
    .filter(
      (attachment: GalleryAttachment | null): attachment is GalleryAttachment =>
        attachment !== null,
    )
}

export function buildPublicDailyLogGalleryPayload(
  jobDetails: any,
  log: any,
  dailyLogId = text(log?.id),
  bucketName = storageBucket.name,
) {
  const payload = log?.payload && typeof log.payload === 'object' ? log.payload : log

  return {
    jobName:
      text(jobDetails?.name) || text(log?.jobName) || text(payload?.projectName) || 'Phase 2 Job',
    jobCode: text(jobDetails?.number) || text(jobDetails?.code) || text(log?.jobCode),
    logDate: text(log?.logDate),
    sequenceNumber: normalizeSequenceNumber(log?.sequenceNumber),
    foremanName:
      text(payload?.foremanOnSite) ||
      text(log?.foremanName) ||
      text(log?.submittedByName) ||
      'Phase 2 Foreman',
    submittedAt: serializeDate(log?.submittedAt),
    attachments: getDailyLogAttachments(log, dailyLogId, bucketName),
  }
}

async function getDailyLogReference(jobId: string, dailyLogId: string) {
  const directReference = db.collection('dailyLogs').doc(dailyLogId)
  const directSnapshot = await directReference.get()
  if (directSnapshot.exists && text(directSnapshot.data()?.jobId) === jobId) {
    return directReference
  }

  const nestedReference = db.collection('jobs').doc(jobId).collection('dailyLogs').doc(dailyLogId)
  const nestedSnapshot = await nestedReference.get()
  if (nestedSnapshot.exists) return nestedReference

  throw new HttpsError('not-found', 'Daily log not found.')
}

export async function ensureDailyLogGalleryShare({
  dailyLogId,
  jobId,
}: EnsureDailyLogGalleryShareInput): Promise<string> {
  const normalizedDailyLogId = text(dailyLogId)
  const normalizedJobId = text(jobId)
  if (!normalizedDailyLogId || !normalizedJobId) {
    throw new HttpsError('invalid-argument', 'Daily log and job are required for the gallery.')
  }

  const logReference = await getDailyLogReference(normalizedJobId, normalizedDailyLogId)
  let shareId = ''

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(logReference)
    if (!snapshot.exists || text(snapshot.data()?.status) !== 'submitted') {
      throw new HttpsError('failed-precondition', 'Only submitted daily logs can be shared.')
    }

    const existingShareId = text(snapshot.data()?.galleryShareId)
    shareId = GALLERY_SHARE_ID_PATTERN.test(existingShareId)
      ? existingShareId
      : randomBytes(32).toString('base64url')

    const shareReference = db.collection(GALLERY_SHARES_COLLECTION).doc(shareId)
    transaction.set(
      logReference,
      {
        galleryShareId: shareId,
        galleryPublishedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    transaction.set(
      shareReference,
      {
        dailyLogPath: logReference.path,
        jobId: normalizedJobId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  })

  return shareId
}

function isAllowedDailyLogPath(value: string): boolean {
  return /^dailyLogs\/[^/]+$/.test(value) || /^jobs\/[^/]+\/dailyLogs\/[^/]+$/.test(value)
}

function dailyLogBelongsToSharedJob(dailyLogPath: string, log: any, jobId: string): boolean {
  const storedJobId = text(log?.jobId)
  if (storedJobId) return storedJobId === jobId

  // Legacy nested daily logs did not always duplicate the job ID in the document.
  // In that layout the parent document path remains the authoritative assignment.
  const nestedPathMatch = /^jobs\/([^/]+)\/dailyLogs\/[^/]+$/.exec(dailyLogPath)
  return nestedPathMatch?.[1] === jobId
}

export async function loadPublicDailyLogGallery(shareId: string) {
  const normalizedShareId = text(shareId)
  if (!GALLERY_SHARE_ID_PATTERN.test(normalizedShareId)) {
    throw new HttpsError('not-found', 'Photo gallery not found.')
  }

  const shareSnapshot = await db.collection(GALLERY_SHARES_COLLECTION).doc(normalizedShareId).get()
  const share = shareSnapshot.data() || {}
  const dailyLogPath = text(share.dailyLogPath)
  const jobId = text(share.jobId)
  if (!shareSnapshot.exists || !jobId || !isAllowedDailyLogPath(dailyLogPath)) {
    throw new HttpsError('not-found', 'Photo gallery not found.')
  }

  const logSnapshot = await db.doc(dailyLogPath).get()
  const log = logSnapshot.data() || {}
  if (
    !logSnapshot.exists ||
    text(log.status) !== 'submitted' ||
    !dailyLogBelongsToSharedJob(dailyLogPath, log, jobId)
  ) {
    throw new HttpsError('not-found', 'Photo gallery not found.')
  }

  const jobDetails = await getJobDetails(jobId)
  return buildPublicDailyLogGalleryPayload(jobDetails, log, logSnapshot.id)
}

export async function loadLegacyPublicDailyLogGallery(jobId: string, dailyLogId: string) {
  const normalizedJobId = text(jobId)
  const normalizedDailyLogId = text(dailyLogId)
  if (
    !FIRESTORE_DOCUMENT_ID_PATTERN.test(normalizedJobId) ||
    !FIRESTORE_DOCUMENT_ID_PATTERN.test(normalizedDailyLogId)
  ) {
    throw new HttpsError('not-found', 'Photo gallery not found.')
  }

  const logReference = await getDailyLogReference(normalizedJobId, normalizedDailyLogId)
  const logSnapshot = await logReference.get()
  const log = logSnapshot.data() || {}
  if (
    !logSnapshot.exists ||
    text(log.status) !== 'submitted' ||
    !dailyLogBelongsToSharedJob(logReference.path, log, normalizedJobId)
  ) {
    throw new HttpsError('not-found', 'Photo gallery not found.')
  }

  const jobDetails = await getJobDetails(normalizedJobId)
  return buildPublicDailyLogGalleryPayload(jobDetails, log, logSnapshot.id)
}

export const getPublicDailyLogGallery = onCall(async (request) => {
  const shareId = text(request.data?.shareId)
  if (shareId) return loadPublicDailyLogGallery(shareId)

  return loadLegacyPublicDailyLogGallery(text(request.data?.jobId), text(request.data?.dailyLogId))
})
