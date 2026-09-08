import sharp from 'sharp'
import { storageBucket } from './runtime'

export type DailyLogPhotoSectionKey = 'photo' | 'ptp' | 'qc'

export interface DailyLogInlinePhotoPreview {
  section: DailyLogPhotoSectionKey
  position: number
  contentId: string
}

export interface DailyLogInlinePhotoAttachment {
  name: string
  contentType: 'image/jpeg'
  contentBytes: string
  contentId: string
  isInline: true
}

export interface PreparedDailyLogInlinePhotos {
  previews: DailyLogInlinePhotoPreview[]
  attachments: DailyLogInlinePhotoAttachment[]
}

interface DailyLogPhotoCandidate {
  section: DailyLogPhotoSectionKey
  position: number
  originalPath: string
  thumbnailPath: string
}

interface DailyLogEmailPhotoDependencies {
  downloadObject: (path: string, maxBytes: number) => Promise<Buffer>
  createBoundedJpeg: (source: Buffer, maxBytes: number) => Promise<Buffer | null>
}

export const DAILY_LOG_EMAIL_PHOTO_PREVIEW_LIMIT = 6
export const DAILY_LOG_EMAIL_INLINE_IMAGE_TARGET_BYTES = 96 * 1024
export const DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_BYTES = 128 * 1024
export const DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_TOTAL_BYTES = 2 * 1024 * 1024

const DAILY_LOG_GALLERY_IMAGE_MAX_BYTES = 10 * 1024 * 1024
const DAILY_LOG_STORED_THUMBNAIL_MAX_BYTES = 300 * 1024
const MIN_REMAINING_INLINE_IMAGE_BYTES = 16 * 1024

const JPEG_ATTEMPTS = [
  { maxDimension: 480, quality: 68 },
  { maxDimension: 400, quality: 60 },
  { maxDimension: 320, quality: 52 },
  { maxDimension: 240, quality: 44 },
  { maxDimension: 200, quality: 38 },
  { maxDimension: 160, quality: 32 },
] as const

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function normalizeDailyLogPhotoSection(value: unknown): DailyLogPhotoSectionKey {
  if (value === 'ptp' || value === 'qc') return value
  return 'photo'
}

export function getExpectedDailyLogThumbnailPath(originalPath: string, dailyLogId: string): string {
  const normalizedDailyLogId = text(dailyLogId)
  if (!normalizedDailyLogId || normalizedDailyLogId.includes('/')) return ''

  const prefix = `daily-logs/${normalizedDailyLogId}/`
  if (!originalPath.startsWith(prefix)) return ''

  const fileName = originalPath.slice(prefix.length)
  if (!fileName || fileName.includes('/') || fileName.length > 512) return ''
  return `${prefix}thumbnails/${fileName}`
}

export function selectDailyLogEmailPhotoCandidates(
  dailyLogId: string,
  dailyLog: unknown,
): DailyLogPhotoCandidate[] {
  const root = objectRecord(dailyLog)
  const payload = objectRecord(root.payload)
  const rawAttachments = Array.isArray(payload.attachments)
    ? payload.attachments
    : Array.isArray(root.attachments)
      ? root.attachments
      : []

  const records = rawAttachments.map(objectRecord)
  const sections: DailyLogPhotoSectionKey[] = ['photo', 'ptp', 'qc']

  return sections.flatMap((section) =>
    records
      .filter((record) => normalizeDailyLogPhotoSection(record.type) === section)
      .slice(0, DAILY_LOG_EMAIL_PHOTO_PREVIEW_LIMIT)
      .flatMap((record, index) => {
        const originalPath = text(record.path)
        const expectedThumbnailPath = getExpectedDailyLogThumbnailPath(originalPath, dailyLogId)
        if (!expectedThumbnailPath) return []

        const suppliedThumbnailPath = text(record.thumbnailPath)
        return [
          {
            section,
            position: index + 1,
            originalPath,
            thumbnailPath:
              suppliedThumbnailPath === expectedThumbnailPath
                ? suppliedThumbnailPath
                : expectedThumbnailPath,
          },
        ]
      }),
  )
}

function isMissingStorageObject(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const record = error as { code?: unknown }
  const code = String(record.code ?? '')
  return code === '404' || code === 'storage/object-not-found' || code === 'object-not-found'
}

async function downloadObject(path: string, maxBytes: number): Promise<Buffer> {
  const file = storageBucket.file(path)
  const [metadata] = await file.getMetadata()
  const declaredSize = Number(metadata.size)
  if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
    throw new Error('Stored Daily Log photo exceeds the email processing limit.')
  }

  const [contents] = await file.download()
  if (contents.length > maxBytes) {
    throw new Error('Stored Daily Log photo exceeds the email processing limit.')
  }
  return contents
}

async function createBoundedJpeg(source: Buffer, maxBytes: number): Promise<Buffer | null> {
  const hardLimit = Math.min(DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_BYTES, maxBytes)
  if (hardLimit < MIN_REMAINING_INLINE_IMAGE_BYTES) return null

  const targetBytes = Math.min(DAILY_LOG_EMAIL_INLINE_IMAGE_TARGET_BYTES, hardLimit)
  let smallest: Buffer | null = null

  for (const attempt of JPEG_ATTEMPTS) {
    const output = await sharp(source, {
      failOn: 'warning',
      limitInputPixels: 80_000_000,
      sequentialRead: true,
    })
      .rotate()
      .flatten({ background: '#ffffff' })
      .resize({
        width: attempt.maxDimension,
        height: attempt.maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: attempt.quality, mozjpeg: true })
      .toBuffer()

    if (!smallest || output.length < smallest.length) smallest = output
    if (output.length <= targetBytes) return output
  }

  return smallest && smallest.length <= hardLimit ? smallest : null
}

const defaultDependencies: DailyLogEmailPhotoDependencies = {
  downloadObject,
  createBoundedJpeg,
}

export async function prepareDailyLogInlinePhotos(
  dailyLogId: string,
  dailyLog: unknown,
  dependencies: DailyLogEmailPhotoDependencies = defaultDependencies,
): Promise<PreparedDailyLogInlinePhotos> {
  const candidates = selectDailyLogEmailPhotoCandidates(dailyLogId, dailyLog)
  const previews: DailyLogInlinePhotoPreview[] = []
  const attachments: DailyLogInlinePhotoAttachment[] = []
  let totalBytes = 0

  for (const candidate of candidates) {
    const remainingBytes = DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_TOTAL_BYTES - totalBytes
    if (remainingBytes < MIN_REMAINING_INLINE_IMAGE_BYTES) break

    let source: Buffer | null = null
    try {
      source = await dependencies.downloadObject(
        candidate.thumbnailPath,
        DAILY_LOG_STORED_THUMBNAIL_MAX_BYTES,
      )
    } catch (error) {
      // A missing legacy derivative is expected. Other thumbnail failures also fall back to the
      // trusted original so a transient derivative issue does not remove the photo from email.
      if (!isMissingStorageObject(error)) source = null
    }

    if (!source) {
      try {
        source = await dependencies.downloadObject(
          candidate.originalPath,
          DAILY_LOG_GALLERY_IMAGE_MAX_BYTES,
        )
      } catch {
        continue
      }
    }

    let jpeg: Buffer | null = null
    try {
      jpeg = await dependencies.createBoundedJpeg(
        source,
        Math.min(DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_BYTES, remainingBytes),
      )
    } catch {
      continue
    }
    if (!jpeg || jpeg.length > remainingBytes) continue

    const contentId = `daily-log-${candidate.section}-${candidate.position}@phase2.local`
    totalBytes += jpeg.length
    previews.push({
      section: candidate.section,
      position: candidate.position,
      contentId,
    })
    attachments.push({
      name: `daily-log-${candidate.section}-${candidate.position}.jpg`,
      contentType: 'image/jpeg',
      contentBytes: jpeg.toString('base64'),
      contentId,
      isInline: true,
    })
  }

  return { previews, attachments }
}
