import { createHash, randomUUID } from 'node:crypto'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import sharp from 'sharp'
import { db, storageBucket } from './runtime'
import { buildCurrentFunctionUser } from './roleAccess'
import {
  formId,
  attachedPhotoCount,
  respondentDefinition,
  validateFormAnswers,
  validateFormDefinition,
  type FormRecord,
  type FormVersion,
} from './formModel'
const templates = db.collection('formTemplates'),
  records = db.collection('formRecords'),
  assets = db.collection('formAssets')
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const requestId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value)
function fail(
  code:
    | 'invalid-argument'
    | 'failed-precondition'
    | 'aborted'
    | 'permission-denied'
    | 'not-found'
    | 'already-exists',
  message: string,
): never {
  throw new HttpsError(code, message)
}
async function user(uid?: string, admin = false) {
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to use forms.')
  const snapshot = await db.doc('users/' + uid).get(),
    profile = buildCurrentFunctionUser(uid, snapshot.data() || {})
  if (
    !snapshot.exists ||
    !profile.active ||
    (admin
      ? profile.role !== 'admin'
      : !['admin', 'project-manager', 'foreman', 'shop-foreman'].includes(profile.role))
  )
    fail('permission-denied', 'Your account cannot use this form workflow.')
  return profile
}
function revision(actual: number, expected: unknown) {
  if (actual !== expected) fail('aborted', 'Another edit changed this draft. Reload before saving.')
}
function payload(value: unknown): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Buffer.byteLength(JSON.stringify(value)) > 3000000
  )
    fail('invalid-argument', 'Invalid form request.')
  return value as Record<string, unknown>
}
function validId(value: unknown): string {
  if (!formId(value)) fail('invalid-argument', 'Choose a valid form or record.')
  return value
}
function validate<T>(action: () => T): T {
  try {
    return action()
  } catch (error) {
    fail('invalid-argument', error instanceof Error ? error.message : 'Check this form.')
  }
}
function allowedRecord(
  record: FormRecord | undefined,
  profile: Awaited<ReturnType<typeof user>>,
  write = false,
): FormRecord {
  if (!record) fail('not-found', 'Form record not found.')
  if (record.ownerUid !== profile.uid && (write || profile.role !== 'admin'))
    fail('permission-denied', 'This form record belongs to another user.')
  return record
}
async function output(record: FormRecord): Promise<FormRecord> {
  const delivery = await db.doc('formDeliveries/' + record.id).get()
  return {
    ...record,
    definition: respondentDefinition(record.definition),
    emailStatus: delivery.data()?.status || 'not-submitted',
  }
}
export const formTemplates = onCall({ memory: '512MiB', timeoutSeconds: 60 }, async (request) => {
  const profile = await user(request.auth?.uid),
    data = payload(request.data || {})
  if (data.action === 'list') {
    const docs = (await templates.limit(100).get()).docs
    const list = []
    for (const doc of docs) {
      const stored = doc.data()
      if (profile.role === 'admin') list.push({ id: doc.id, ...stored })
      else if (!stored.archived && stored.latestVersion) {
        const issued = await doc.ref
          .collection('versions')
          .doc('v' + stored.latestVersion)
          .get()
        list.push({
          id: doc.id,
          definition: respondentDefinition(issued.data() as FormVersion),
          latestVersion: stored.latestVersion,
        })
      }
    }
    return { templates: list }
  }
  await user(profile.uid, true)
  const id = validId(data.id),
    ref = templates.doc(id)
  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref),
      stored = snapshot.data()
    revision(stored?.revision || 0, data.revision)
    if (data.action === 'save') {
      if (stored?.archived) fail('failed-precondition', 'Archived forms cannot be edited.')
      const draft = validate(() => validateFormDefinition(data.definition))
      const next = {
        draft,
        revision: (stored?.revision || 0) + 1,
        latestVersion: stored?.latestVersion || 0,
        archived: false,
        used: stored?.used || false,
        updatedAt: Date.now(),
      }
      tx.set(ref, next)
      return { id, ...next }
    }
    if (!snapshot.exists) fail('not-found', 'Form template not found.')
    if (data.action === 'issue') {
      if (stored!.archived) fail('failed-precondition', 'Archived forms cannot be issued.')
      const draft = validate(() => validateFormDefinition(stored!.draft))
      const version = stored!.latestVersion + 1
      tx.create(ref.collection('versions').doc('v' + version), {
        ...draft,
        version,
        createdAt: new Date().toISOString(),
      })
      tx.update(ref, { latestVersion: version, revision: stored!.revision + 1 })
      return { id, latestVersion: version, revision: stored!.revision + 1 }
    }
    if (data.action === 'remove') {
      if (stored!.used || stored!.latestVersion)
        tx.update(ref, { archived: true, revision: stored!.revision + 1 })
      else tx.delete(ref)
      return { archived: !!(stored!.used || stored!.latestVersion) }
    }
    fail('invalid-argument', 'Unknown template action.')
  })
})
export const formWorkspace = onCall(
  { memory: '512MiB', timeoutSeconds: 60, maxInstances: 10 },
  async (request) => {
    const profile = await user(request.auth?.uid),
      data = payload(request.data || {})
    if (data.action === 'list') {
      const docs = await records.where('ownerUid', '==', profile.uid).limit(100).get()
      return {
        records: await Promise.all(docs.docs.map((doc) => output(doc.data() as FormRecord))),
      }
    }
    if (data.action === 'create') {
      const templateId = validId(data.templateId)
      if (
        !requestId(data.requestId) ||
        !Number.isSafeInteger(data.version) ||
        Number(data.version) < 1
      )
        fail('invalid-argument', 'Choose an issued form version.')
      const id = hash(profile.uid + ':' + data.requestId),
        ref = records.doc(id),
        template = templates.doc(templateId)
      const record = await db.runTransaction(async (tx) => {
        const [existing, current, issued] = await tx.getAll(
          ref,
          template,
          template.collection('versions').doc('v' + data.version),
        )
        if (existing.exists) {
          const old = existing.data() as FormRecord
          if (old.templateId !== templateId || old.templateVersion !== data.version)
            fail('already-exists', 'This draft request was already used.')
          return old
        }
        if (!current.exists || current.data()?.archived || !issued.exists)
          fail('failed-precondition', 'This form version is not available for new drafts.')
        const definition = issued.data() as FormVersion,
          now = Date.now()
        const record: FormRecord = {
          id,
          ownerUid: profile.uid,
          templateId,
          templateVersion: Number(data.version),
          definition,
          answers: validateFormAnswers(definition, {}, false),
          revision: 1,
          status: 'draft',
          createdAt: now,
          updatedAt: now,
        }
        tx.create(ref, record)
        tx.update(template, { used: true })
        return record
      })
      return output(record)
    }
    const id = validId(data.id),
      ref = records.doc(id)
    if (data.action === 'get')
      return output(allowedRecord((await ref.get()).data() as FormRecord | undefined, profile))
    if (data.action === 'photo') {
      const record = allowedRecord((await ref.get()).data() as FormRecord | undefined, profile)
      const assetId = validId(data.assetId)
      if (
        !record.definition.fields.some(
          (field) =>
            field.kind === 'photo' &&
            Array.isArray(record.answers[field.id]) &&
            (record.answers[field.id] as string[]).includes(assetId),
        )
      )
        fail('permission-denied', 'This photo is not attached to this record.')
      const asset = (await assets.doc(assetId).get()).data()
      if (!asset || asset.recordId !== id) fail('not-found', 'Photo not found.')
      const [bytes] = await storageBucket.file(asset.path).download()
      return { base64: bytes.toString('base64'), contentType: 'image/webp' }
    }
    if (data.action === 'upload') {
      const record = allowedRecord(
        (await ref.get()).data() as FormRecord | undefined,
        profile,
        true,
      )
      revision(record.revision, data.revision)
      if (
        record.status !== 'draft' ||
        !record.definition.fields.some(
          (field) => field.id === data.fieldId && field.kind === 'photo',
        )
      )
        fail('failed-precondition', 'Photos can be attached only to photo fields on your draft.')
      if (
        typeof data.base64 !== 'string' ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(data.base64) ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(String(data.contentType))
      )
        fail('invalid-argument', 'Choose a JPEG, PNG or WebP photo.')
      const input = Buffer.from(data.base64, 'base64')
      if (input.length > 2 * 1024 * 1024 || !input.length)
        fail('invalid-argument', 'Photos must be at most 2 MB.')
      let bytes: Buffer
      try {
        bytes = await sharp(input, { limitInputPixels: 16000000, animated: false })
          .rotate()
          .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer()
      } catch {
        fail('invalid-argument', 'This image could not be read.')
      }
      const assetId = randomUUID(),
        path = 'form-photos/' + id + '/' + assetId + '.webp',
        file = storageBucket.file(path)
      await file.save(bytes!, {
        contentType: 'image/webp',
        resumable: false,
        metadata: {
          metadata: { recordId: id, fieldId: String(data.fieldId), ownerUid: profile.uid },
        },
      })
      try {
        await db.runTransaction(async (tx) => {
          const current = allowedRecord(
            (await tx.get(ref)).data() as FormRecord | undefined,
            profile,
            true,
          )
          revision(current.revision, data.revision)
          if (current.status !== 'draft')
            fail('failed-precondition', 'Submitted photos cannot be changed.')
          const list = current.answers[String(data.fieldId)] as string[]
          if (
            list.length >= 5 ||
            attachedPhotoCount(current.definition, current.answers) >= 20 ||
            Number((current as FormRecord & { uploadedCount?: number }).uploadedCount || 0) >= 40
          )
            fail('failed-precondition', 'The photo limit has been reached.')
          tx.create(assets.doc(assetId), {
            recordId: id,
            fieldId: data.fieldId,
            path,
            ownerUid: profile.uid,
          })
          tx.update(ref, {
            answers: { ...current.answers, [String(data.fieldId)]: [...list, assetId] },
            revision: current.revision + 1,
            updatedAt: Date.now(),
            uploadedCount:
              Number((current as FormRecord & { uploadedCount?: number }).uploadedCount || 0) + 1,
          })
        })
      } catch (error) {
        await file.delete({ ignoreNotFound: true })
        throw error
      }
      return output((await ref.get()).data() as FormRecord)
    }
    const record = await db.runTransaction(async (tx) => {
      const current = allowedRecord(
        (await tx.get(ref)).data() as FormRecord | undefined,
        profile,
        true,
      )
      if (!requestId(data.requestId))
        fail('invalid-argument', 'A stable request identifier is required.')
      if (data.action === 'submit' && current.status === 'submitted') {
        const saved = current as FormRecord & { submissionRequestId: string }
        if (saved.submissionRequestId !== data.requestId)
          fail('already-exists', 'This form was already submitted.')
        return current
      }
      if (current.status !== 'draft') fail('failed-precondition', 'Submitted forms are immutable.')
      const answers = validate(() =>
        validateFormAnswers(
          current.definition,
          data.action === 'save' ? data.answers : current.answers,
          data.action === 'submit',
        ),
      )
      const fingerprint = hash(JSON.stringify(answers))
      const previous = current as FormRecord & {
        saveRequestId?: string
        answerFingerprint?: string
      }
      if (data.action === 'save' && previous.saveRequestId === data.requestId) {
        if (previous.answerFingerprint !== fingerprint)
          fail('already-exists', 'This save request was already used with different answers.')
        return current
      }
      revision(current.revision, data.revision)
      const photos = current.definition.fields
        .filter((field) => field.kind === 'photo')
        .flatMap((field) =>
          (answers[field.id] as string[]).map((assetId) => ({ assetId, fieldId: field.id })),
        )
      const snapshots = photos.length
        ? await tx.getAll(...photos.map((photo) => assets.doc(photo.assetId)))
        : []
      snapshots.forEach((snapshot, index) => {
        const photo = snapshot.data()
        if (
          !photo ||
          photo.recordId !== id ||
          photo.fieldId !== photos[index]!.fieldId ||
          photo.ownerUid !== profile.uid
        )
          fail('permission-denied', 'A photo belongs to another form record.')
      })
      const now = Date.now()
      if (data.action === 'save') {
        const next = {
          ...current,
          answers,
          revision: current.revision + 1,
          updatedAt: now,
          saveRequestId: data.requestId,
          answerFingerprint: fingerprint,
        }
        tx.set(ref, next)
        return next
      }
      if (data.action !== 'submit') fail('invalid-argument', 'Unknown form action.')
      const next = {
        ...current,
        answers,
        status: 'submitted' as const,
        revision: current.revision + 1,
        updatedAt: now,
        submittedAt: now,
        submissionRequestId: data.requestId,
      }
      tx.create(db.doc('formSubmissions/' + id), next)
      tx.create(db.doc('formDeliveries/' + id), {
        submissionId: id,
        recipients: current.definition.recipients,
        status: current.definition.recipients.length ? 'queued' : 'not-configured',
        attempts: 0,
        updatedAt: now,
      })
      tx.set(ref, next)
      return next
    })
    return output(record)
  },
)
