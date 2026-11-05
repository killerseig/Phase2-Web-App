import { validateFormDefinition, validateFormAnswers } from './formModel'
import { buildFormSubmissionPdf } from './formSubmissionPdf'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { db } from './runtime'
import { formId, respondentDefinition, type FormRecord } from './formModel'
import { buildCurrentFunctionUser } from './roleAccess'
import { authorizeFormEntry } from './formEntryAccess'
import { readEntryPhoto, entryPdfPhotos } from './formEntryPhotos'
import { translationSource, currentFormTranslation, type FormTranslation } from './formTranslation'

const denied = () =>
  new HttpsError('permission-denied', 'This submission is unavailable or you do not have access.')
// Photo decoding and PDF generation need dedicated memory; do not share it across concurrent exports.
const FORM_ENTRY_VIEWER_OPTIONS = { memory: '512MiB', concurrency: 1, timeoutSeconds: 120 } as const
export const formSubmissionViewer = onCall(FORM_ENTRY_VIEWER_OPTIONS, async (request) => {
  if (!request.auth?.uid) throw denied()
  const { id, action, assetId } = request.data || {}
  if (action === 'preview-pdf') {
    if (!request.auth?.uid) throw denied()
    const profile = (await db.doc('users/' + request.auth.uid).get()).data(),
      user = buildCurrentFunctionUser(request.auth.uid, profile || {})
    if (!user.active || user.role !== 'admin') throw denied()
    let definition, answers
    try {
      definition = validateFormDefinition(request.data.definition)
      answers = validateFormAnswers(definition, request.data.answers, false)
    } catch {
      throw new HttpsError(
        'invalid-argument',
        'Correct the form definition and preview answers before generating a PDF.',
      )
    }
    const record: FormRecord = {
      id: 'preview',
      ownerUid: request.auth.uid,
      templateId: 'preview',
      templateVersion: 1,
      definition: { ...definition, version: 1, createdAt: '' },
      answers,
      revision: 1,
      status: 'submitted',
      createdAt: 0,
      updatedAt: 0,
    }
    const pdf = await buildFormSubmissionPdf(record)
    if (pdf.length > 512 * 1024)
      throw new HttpsError('resource-exhausted', 'This PDF preview exceeds the local size limit.')
    return { base64: pdf.toString('base64'), contentType: 'application/pdf' }
  }
  if (!['get', 'photo', 'pdf'].includes(action)) throw denied()
  const record = await authorizeFormEntry(id, request.auth.uid)
  if (action === 'get') {
    const definition = respondentDefinition(record.definition)
    return {
      id: record.id,
      templateVersion: record.templateVersion,
      definition: {
        ...definition,
        ...(definition.output ? { output: { ...definition.output, requireLogin: true } } : {}),
      },
      answers: record.answers,
      submittedAt: record.submittedAt,
      requireLogin: true,
    }
  }
  if (action === 'pdf') {
    let translation: FormTranslation | undefined
    if (request.data?.language === 'en') {
      const { sourceHash } = translationSource(record)
      translation = currentFormTranslation(
        record,
        (await db.doc('formTranslations/' + record.id + '/versions/' + sourceHash).get()).data(),
      )
      if (translation?.status !== 'ready')
        throw new HttpsError(
          'failed-precondition',
          'Prepare an English rendering before downloading the English and original PDF.',
        )
      await authorizeFormEntry(record.id, request.auth.uid)
    }
    const bytes = await buildFormSubmissionPdf(record, await entryPdfPhotos(record), translation)
    await authorizeFormEntry(record.id, request.auth.uid)
    if (bytes.length > 7 * 1024 * 1024)
      throw new HttpsError('resource-exhausted', 'This PDF exceeds the download size limit.')
    return {
      base64: bytes.toString('base64'),
      contentType: 'application/pdf',
      filename: 'form-entry-' + record.id + (translation ? '-english-original' : '') + '.pdf',
    }
  }
  if (!formId(assetId)) throw denied()
  const bytes = await readEntryPhoto(record, assetId)
  return { base64: bytes.toString('base64'), contentType: 'image/webp' }
})
