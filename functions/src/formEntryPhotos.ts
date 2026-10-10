import sharp from 'sharp'
import { HttpsError } from 'firebase-functions/v2/https'
import { db, storageBucket } from './runtime'
import { photoAnswerIds, type FormRecord } from './formModel'
import type { DailyLogInlinePhotoAttachment } from './dailyLogEmailPhotos'
/** Caller must authorize the entry before reading bytes; validate membership and storage ownership again. */
export async function readEntryPhoto(record: FormRecord, assetId: string): Promise<Buffer> {
  if (!photoAnswerIds(record.definition, record.answers).includes(assetId))
    throw new HttpsError('permission-denied', 'Photo unavailable.')
  const asset = (await db.doc('formAssets/' + assetId).get()).data()
  const path = 'form-photos/' + record.id + '/' + assetId + '.webp'
  if (
    !asset ||
    asset.recordId !== record.id ||
    asset.ownerUid !== record.ownerUid ||
    asset.path !== path
  )
    throw new HttpsError('permission-denied', 'Photo unavailable.')
  const file = storageBucket.file(path),
    [metadata] = await file.getMetadata()
  if (!Number.isFinite(Number(metadata.size)) || Number(metadata.size) > 2 * 1024 * 1024)
    throw new HttpsError('resource-exhausted', 'Photo exceeds size limit.')
  const [bytes] = await file.download()
  if (bytes.length > 2 * 1024 * 1024)
    throw new HttpsError('resource-exhausted', 'Photo exceeds size limit.')
  return bytes
}
export async function entryPdfPhotos(record: FormRecord): Promise<DailyLogInlinePhotoAttachment[]> {
  const photos: DailyLogInlinePhotoAttachment[] = []
  for (const assetId of photoAnswerIds(record.definition, record.answers)) {
    const bytes = await sharp(await readEntryPhoto(record, assetId))
      .rotate()
      .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer()
    photos.push({
      name: assetId + '.jpg',
      contentType: 'image/jpeg',
      contentBytes: bytes.toString('base64'),
      contentId: 'entry-photo-' + assetId,
      isInline: true,
    })
  }
  return photos
}
