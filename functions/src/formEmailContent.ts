import { buildFormSubmissionPdf } from './formSubmissionPdf'
import { buildFormEmailHtml, buildFormEmailText, type FormPhotoPreview } from './formEmailRender'
export { buildFormEmailHtml, buildFormEmailText } from './formEmailRender'
import { db, storageBucket } from './runtime'
import {
  type FormRecord,
  type FormField,
  type FormAnswers,
  type FormGroupInstance,
} from './formModel'
import { getAppBaseUrl } from './functionConfig'
import { buildSubmissionEmailRouting, type SendEmailOptions } from './emailService'
import { EMAIL } from './constants'
import sharp from 'sharp'
import { formTranslationEmailContent } from './formTranslationEmail'
import type { FormTranslation } from './formTranslation'
import {
  prepareDailyLogInlinePhotos,
  DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_TOTAL_BYTES,
  DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_BYTES,
  DAILY_LOG_EMAIL_INLINE_IMAGE_TARGET_BYTES,
  type DailyLogInlinePhotoAttachment,
} from './dailyLogEmailPhotos'

interface FormPhotoAsset {
  recordId: string
  fieldId: string
  ownerUid: string
  path: string
  groupId?: string
  instanceId?: string
}
export interface FormEmailDependencies {
  translate?: (record: FormRecord) => Promise<FormTranslation>
  loadAsset: (id: string) => Promise<FormPhotoAsset | undefined>
  download: (path: string, maxBytes: number) => Promise<Buffer>
  ownerEmail: (uid: string) => Promise<unknown>
  appBaseUrl: () => string
}
export class FormEmailPreparationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FormEmailPreparationError'
  }
}
const defaults: FormEmailDependencies = {
  loadAsset: async (id) =>
    (await db.doc('formAssets/' + id).get()).data() as FormPhotoAsset | undefined,
  download: async (path, maxBytes) => {
    const file = storageBucket.file(path)
    const [metadata] = await file.getMetadata()
    if (!Number.isFinite(Number(metadata.size)) || Number(metadata.size) > maxBytes)
      throw new Error('Stored form photo exceeds the email processing limit.')
    const [contents] = await file.download()
    if (contents.length > maxBytes)
      throw new Error('Stored form photo exceeds the email processing limit.')
    return contents
  },
  ownerEmail: async (uid) => (await db.doc('users/' + uid).get()).data()?.email,
  appBaseUrl: () =>
    process.env.FIRESTORE_EMULATOR_HOST ? 'http://127.0.0.1:5173' : getAppBaseUrl(),
}
// Match the existing Daily Log encoder without changing its source or behavior.
function photoIds(answers: FormAnswers, fieldId: string): string[] {
  const value = answers[fieldId]
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}
function photoFields(
  fields: FormField[],
  answers: FormAnswers,
  groupId?: string,
  instanceId?: string,
): { field: FormField; answers: FormAnswers; groupId?: string; instanceId?: string }[] {
  return fields.flatMap((field) =>
    field.kind === 'repeat'
      ? ((answers[field.id] || []) as FormGroupInstance[]).flatMap((instance) =>
          photoFields(field.fields || [], instance.answers, field.id, instance.instanceId),
        )
      : field.kind === 'photo'
        ? [{ field, answers, groupId, instanceId }]
        : [],
  )
}
async function createBoundedJpeg(source: Buffer, maxBytes: number): Promise<Buffer | null> {
  const hardLimit = Math.min(DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_BYTES, maxBytes)
  if (hardLimit < 16 * 1024) return null
  const targetBytes = Math.min(DAILY_LOG_EMAIL_INLINE_IMAGE_TARGET_BYTES, hardLimit)
  let smallest: Buffer | null = null
  for (const [maxDimension, quality] of [
    [480, 68],
    [400, 60],
    [320, 52],
    [240, 44],
    [200, 38],
    [160, 32],
  ]) {
    const output = await sharp(source, {
      failOn: 'warning',
      limitInputPixels: 80_000_000,
      sequentialRead: true,
    })
      .rotate()
      .flatten({ background: '#ffffff' })
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer()
    if (!smallest || output.length < smallest.length) smallest = output
    if (output.length <= targetBytes) return output
  }
  return smallest && smallest.length <= hardLimit ? smallest : null
}
/** PDF attachments include every submitted photo, independent of capped HTML thumbnails. */
export async function prepareFormPdfPhotos(
  record: FormRecord,
  deps: FormEmailDependencies,
): Promise<DailyLogInlinePhotoAttachment[]> {
  const result: DailyLogInlinePhotoAttachment[] = []
  for (const { field, answers, groupId, instanceId } of photoFields(
    record.definition.fields,
    record.answers,
  )) {
    for (const id of photoIds(answers, field.id)) {
      if (result.length >= 20 || !/^[A-Za-z0-9_-]{1,128}$/.test(id))
        throw new FormEmailPreparationError(
          'The complete photo PDF exceeds the supported photo limit. The submission is retained.',
        )
      const asset = await deps.loadAsset(id),
        expected = 'form-photos/' + record.id + '/' + id + '.webp'
      if (
        !asset ||
        asset.recordId !== record.id ||
        asset.ownerUid !== record.ownerUid ||
        asset.fieldId !== field.id ||
        asset.groupId !== groupId ||
        asset.instanceId !== instanceId ||
        asset.path !== expected
      )
        throw new FormEmailPreparationError(
          'A submitted photo could not be verified for the complete PDF. The submission is retained.',
        )
      let jpeg: Buffer | null
      try {
        jpeg = await createBoundedJpeg(await deps.download(expected, 2 * 1024 * 1024), 24 * 1024)
      } catch {
        throw new FormEmailPreparationError(
          'A submitted photo could not be prepared for the complete PDF. The submission is retained.',
        )
      }
      if (!jpeg)
        throw new FormEmailPreparationError(
          'A submitted photo cannot fit the complete email PDF budget. The submission is retained; download the full entry PDF.',
        )
      const contentId = 'entry-photo-' + id
      result.push({
        name: contentId + '.jpg',
        contentType: 'image/jpeg',
        contentBytes: jpeg.toString('base64'),
        contentId,
        isInline: true,
      })
    }
  }
  return result
}

function recordUrl(record: FormRecord, base: string) {
  const url = new URL(base)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new FormEmailPreparationError('Invalid application URL for form delivery.')
  return new URL('/form-submissions/' + encodeURIComponent(record.id), url).toString()
}
/** Graph uses HTML, as Daily Logs does. Text is the equivalent capture/export representation. */
export interface PreparedFormEmail extends SendEmailOptions {
  text: string
}
export async function prepareFormEmail(
  record: FormRecord,
  recipients: string[],
  deps: FormEmailDependencies = defaults,
): Promise<PreparedFormEmail> {
  const url = recordUrl(record, deps.appBaseUrl()),
    previews: FormPhotoPreview[] = [],
    attachments: DailyLogInlinePhotoAttachment[] = []
  let totalBytes = 0
  for (const { field, answers, groupId, instanceId } of photoFields(
    record.definition.fields,
    record.answers,
  )) {
    if (field.kind !== 'photo' || totalBytes >= DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_TOTAL_BYTES)
      continue
    const permitted = new Map<string, string>()
    // Resolve only server-owned, submitted references. Never accept storage URLs/paths from answers.
    for (const id of photoIds(answers, field.id).slice(0, EMAIL.DAILY_LOG_PHOTO_PREVIEW_LIMIT)) {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) continue
      const asset = await deps.loadAsset(id)
      const expected = 'form-photos/' + record.id + '/' + id + '.webp'
      if (
        asset?.recordId === record.id &&
        asset.fieldId === field.id &&
        asset.ownerUid === record.ownerUid &&
        asset.groupId === groupId &&
        asset.instanceId === instanceId &&
        asset.path === expected
      )
        permitted.set('daily-logs/' + record.id + '/' + id + '.webp', expected)
    }
    // Adapt the trusted path lookup, preserving Daily Logs' exact JPEG resizing/quality and fallback behavior.
    const prepared = await prepareDailyLogInlinePhotos(
      record.id,
      {
        attachments: photoIds(answers, field.id)
          .slice(0, EMAIL.DAILY_LOG_PHOTO_PREVIEW_LIMIT)
          .map((id) => ({ type: 'photo', path: 'daily-logs/' + record.id + '/' + id + '.webp' })),
      },
      {
        downloadObject: async (path, maxBytes) => {
          const trusted = permitted.get(path)
          if (!trusted) throw Object.assign(new Error('Photo unavailable'), { code: 404 })
          return deps.download(trusted, Math.min(maxBytes, 2 * 1024 * 1024))
        },
        createBoundedJpeg,
      },
    )
    for (const [index, attachment] of prepared.attachments.entries()) {
      const bytes = Buffer.from(attachment.contentBytes, 'base64').length
      if (totalBytes + bytes > DAILY_LOG_EMAIL_INLINE_IMAGE_MAX_TOTAL_BYTES) break
      totalBytes += bytes
      const assetId = photoIds(answers, field.id)[prepared.previews[index]!.position - 1]!
      const contentId = 'entry-photo-' + assetId
      previews.push({
        fieldId: field.id,
        groupId,
        instanceId,
        position: prepared.previews[index]!.position,
        contentId,
      })
      attachments.push({
        ...attachment,
        name: contentId + '.jpg',
        contentId,
      })
    }
  }
  const routing = buildSubmissionEmailRouting(recipients, await deps.ownerEmail(record.ownerUid))
  let translation: FormTranslation | undefined
  if (deps.translate) {
    try {
      translation = await deps.translate(record)
    } catch {
      throw new FormEmailPreparationError(
        'The English rendering could not be prepared. The submission is retained for retry.',
      )
    }
  }
  const pdf = record.definition.output?.pdf
    ? await buildFormSubmissionPdf(record, await prepareFormPdfPhotos(record, deps), translation)
    : undefined
  const html = buildFormEmailHtml(record, previews, url)
  const outputAttachments: NonNullable<SendEmailOptions['attachments']> = [
    ...attachments.filter((attachment) => html.includes('cid:' + attachment.contentId)),
    ...(pdf
      ? [
          {
            name: 'completed-form.pdf',
            contentType: 'application/pdf',
            contentBytes: pdf.toString('base64'),
            isInline: false,
          },
        ]
      : []),
  ]
  const options: PreparedFormEmail = {
    ...routing,
    subject: record.definition.title,
    html,
    text: buildFormEmailText(record, url),
    dailyLogPhotoFallbackHtml: buildFormEmailHtml(record, [], url),
    ...(outputAttachments.length ? { attachments: outputAttachments } : {}),
  }
  if (translation) {
    const rendering = formTranslationEmailContent(record, translation)
    if (rendering.html) {
      options.html = options.html.replace(/(<body[^>]*>)/, '$1' + rendering.html)
      options.dailyLogPhotoFallbackHtml = options.dailyLogPhotoFallbackHtml!.replace(
        /(<body[^>]*>)/,
        '$1' + rendering.html,
      )
      options.text = rendering.text + options.text
    }
  }
  return fitFormEmailPayload(options)
}

export function fitFormEmailPayload(options: PreparedFormEmail): PreparedFormEmail {
  const bytes = () =>
    Buffer.byteLength(
      JSON.stringify({
        message: {
          subject: options.subject,
          body: { contentType: 'HTML', content: options.html },
          toRecipients: (Array.isArray(options.to) ? options.to : [options.to]).map((address) => ({
            emailAddress: { address },
          })),
          ...(options.replyTo ? { replyTo: [{ emailAddress: { address: options.replyTo } }] } : {}),
          attachments: options.attachments?.map((attachment) => ({
            '@odata.type': '#microsoft.graph.fileAttachment',
            ...attachment,
          })),
        },
        saveToSentItems: true,
      }),
      'utf8',
    ) + 4096
  if (bytes() > EMAIL.DAILY_LOG_MAX_PAYLOAD_BYTES) {
    options.html = options.dailyLogPhotoFallbackHtml!
    options.attachments = options.attachments?.filter((attachment) => !attachment.isInline)
    if (!options.attachments?.length) delete options.attachments
  }
  if (bytes() > EMAIL.DAILY_LOG_MAX_PAYLOAD_BYTES)
    throw new FormEmailPreparationError(
      'This completed form email exceeds the 900 KB message limit. The submission is retained; contact Admin.',
    )
  return options
}
