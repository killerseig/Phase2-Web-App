import { validateFormDefinition, validateFormAnswers } from './formModel'
import { buildFormSubmissionPdf } from './formSubmissionPdf'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { db, storageBucket } from './runtime'
import { formId, respondentDefinition, type FormRecord } from './formModel'
import { buildCurrentFunctionUser } from './roleAccess'
import { targetFunctionRoleCanOpenJobDashboard } from './targetJobAccess'
import { isFunctionShopJob } from './jobIdentity'

const denied = () =>
  new HttpsError('permission-denied', 'This submission is unavailable or you do not have access.')
async function authorizedRecord(id: string, uid?: string): Promise<FormRecord> {
  // Never consult share tokens or historical requireLogin flags. All entries
  // and photo bytes belong to an active signed-in owner or Admin.
  if (!uid || !formId(id)) throw denied()
  const [snapshot, profile] = await Promise.all([
    db.doc('formSubmissions/' + id).get(),
    db.doc('users/' + uid).get(),
  ])
  const record = snapshot.data() as FormRecord | undefined,
    user = buildCurrentFunctionUser(uid, profile.data() || {})
  if (
    !record ||
    record.status !== 'submitted' ||
    !profile.exists ||
    !user.active ||
    !['admin', 'project-manager', 'foreman', 'shop-foreman'].includes(user.role) ||
    (record.ownerUid !== uid && user.role !== 'admin')
  )
    throw denied()
  if (record.jobId) {
    const job = await db.doc('jobs/' + record.jobId).get(),
      assigned = new Set(user.assignedJobIds)
    if (job.data()?.assignedForemanIds?.includes(user.uid)) assigned.add(record.jobId)
    if (
      !job.exists ||
      !targetFunctionRoleCanOpenJobDashboard({
        role: user.role,
        jobId: record.jobId,
        assignedJobIds: [...assigned],
        isShopJob: isFunctionShopJob(job.data()!),
      })
    )
      throw denied()
  }
  return record
}
export const formSubmissionViewer = onCall({ timeoutSeconds: 120 }, async (request) => {
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
  if (!['get', 'photo'].includes(action)) throw denied()
  const record = await authorizedRecord(id, request.auth.uid)
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
  if (
    !formId(assetId) ||
    !record.definition.fields.some(
      (field) =>
        field.kind === 'photo' &&
        Array.isArray(record.answers[field.id]) &&
        (record.answers[field.id] as string[]).includes(assetId),
    )
  )
    throw denied()
  const asset = (await db.doc('formAssets/' + assetId).get()).data(),
    expected = 'form-photos/' + id + '/' + assetId + '.webp'
  if (
    !asset ||
    asset.recordId !== id ||
    asset.ownerUid !== record.ownerUid ||
    asset.path !== expected ||
    !record.definition.fields.some(
      (field) =>
        field.kind === 'photo' &&
        field.id === asset.fieldId &&
        (record.answers[field.id] as string[]).includes(assetId),
    )
  )
    throw denied()
  const file = storageBucket.file(expected),
    [metadata] = await file.getMetadata()
  if (!Number.isFinite(Number(metadata.size)) || Number(metadata.size) > 2 * 1024 * 1024)
    throw denied()
  const [bytes] = await file.download()
  if (bytes.length > 2 * 1024 * 1024) throw denied()
  return { base64: bytes.toString('base64'), contentType: 'image/webp' }
})
