import { formOutputIssues } from './formOutputTemplate'
import { canSubmitForm, validateFormAccess } from './formAccess'
import { resolveFormSubmissionRecipients, publicRecipientConsentSnapshot } from './formRecipients'
import { createHash, randomUUID } from 'node:crypto'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import sharp from 'sharp'
import { db, storageBucket } from './runtime'
import { buildCurrentFunctionUser } from './roleAccess'
import { targetFunctionRoleCanOpenJobDashboard } from './targetJobAccess'
import { isFunctionShopJob } from './jobIdentity'
import {
  formId,
  attachedPhotoCount,
  respondentDefinition,
  validateFormAnswers,
  validateFormDefinition,
  type FormRecord,
  type FormVersion,
  type FormAnswers,
  type FormGroupInstance,
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
function photoSlots(record: FormRecord, answers: FormAnswers = record.answers) {
  return record.definition.fields.flatMap((field) => {
    if (field.kind === 'photo')
      return ((answers[field.id] || []) as string[]).map((assetId) => ({
        assetId,
        fieldId: field.id,
        groupId: '',
        instanceId: '',
      }))
    if (field.kind !== 'repeat') return []
    return ((answers[field.id] || []) as FormGroupInstance[]).flatMap((instance) =>
      (field.fields || [])
        .filter((child) => child.kind === 'photo')
        .flatMap((child) =>
          ((instance.answers[child.id] || []) as string[]).map((assetId) => ({
            assetId,
            fieldId: child.id,
            groupId: field.id,
            instanceId: instance.instanceId,
          })),
        ),
    )
  })
}
function photoTarget(record: FormRecord, data: Record<string, unknown>) {
  const group = data.groupId
    ? record.definition.fields.find((field) => field.id === data.groupId && field.kind === 'repeat')
    : undefined
  const instance = group
    ? ((record.answers[group.id] || []) as FormGroupInstance[]).find(
        (item) => item.instanceId === data.instanceId,
      )
    : undefined
  const field = (group ? group.fields : record.definition.fields)?.find(
    (item) => item.id === data.fieldId && item.kind === 'photo',
  )
  if (!field || (data.groupId && !instance))
    fail('failed-precondition', 'Choose a saved photo field and site instance.')
  return { group, instance, field, answers: instance ? instance.answers : record.answers }
}
async function output(record: FormRecord): Promise<FormRecord> {
  const delivery = await db.doc('formDeliveries/' + record.id).get()
  const safe = { ...record } as FormRecord & {
    publicCapabilityHash?: string
    publicExpiresAt?: number
    publicRecipientConsents?: unknown
  }
  delete safe.publicCapabilityHash
  delete safe.publicExpiresAt
  delete safe.publicRecipientConsents
  return {
    ...safe,
    definition: respondentDefinition(record.definition),
    emailStatus: delivery.data()?.status || 'not-submitted',
  }
}
export const formTemplates = onCall({ memory: '512MiB', timeoutSeconds: 60 }, async (request) => {
  const incoming = payload(request.data || {})
  if (incoming.action === 'respondent') {
    const id = validId(incoming.id),
      snapshot = await templates.doc(id).get(),
      stored = snapshot.data()
    if (!stored || stored.archived || !stored.latestVersion)
      fail('not-found', 'This form is unavailable.')
    const version = incoming.version === undefined ? stored.latestVersion : incoming.version
    if (!Number.isSafeInteger(version) || Number(version) < 1)
      fail('invalid-argument', 'Invalid form version.')
    const issued = await snapshot.ref
      .collection('versions')
      .doc('v' + version)
      .get()
    if (!issued.exists) fail('not-found', 'This form version is unavailable.')
    const definition = issued.data() as FormVersion
    const current =
      version === stored.latestVersion
        ? issued
        : await snapshot.ref
            .collection('versions')
            .doc('v' + stored.latestVersion)
            .get()
    const access = current.data()?.access
    const profile =
      validateFormAccess(access).respondents === 'signed-in' && request.auth?.uid
        ? await user(request.auth.uid)
        : undefined
    if (!canSubmitForm(access, profile) || !canSubmitForm(definition.access, profile))
      throw new HttpsError('unauthenticated', 'Sign in to complete this form.')
    return { id, latestVersion: version, definition: respondentDefinition(definition) }
  }
  const profile = await user(request.auth?.uid),
    data = payload(request.data || {})
  if (data.action === 'list') {
    const docs = (await templates.limit(100).get()).docs
    const list = []
    for (const doc of docs) {
      const stored = doc.data()
      if (profile.role === 'admin') {
        const issued = stored.latestVersion
          ? await doc.ref
              .collection('versions')
              .doc('v' + stored.latestVersion)
              .get()
          : undefined
        list.push({
          id: doc.id,
          ...stored,
          ...(issued?.exists ? { definition: issued.data() as FormVersion } : {}),
        })
      } else if (!stored.archived && stored.latestVersion) {
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
    if (data.action === 'duplicate') {
      if (!snapshot.exists || stored?.archived)
        fail('failed-precondition', 'Choose an active template to duplicate.')
      const targetId = validId(data.targetId)
      if (!requestId(targetId) || targetId === id)
        fail('invalid-argument', 'Choose a new copy identity.')
      const target = templates.doc(targetId),
        existing = await tx.get(target)
      if (existing.exists) {
        const copy = existing.data()!
        if (
          copy.duplicateOf !== id ||
          copy.duplicateRevision !== data.revision ||
          copy.createdBy !== profile.uid
        )
          fail('already-exists', 'This copy identity already exists.')
        return { id: targetId, ...copy }
      }
      revision(stored!.revision, data.revision)
      const draft = validate(() => validateFormDefinition(stored!.draft))
      draft.title = draft.title.slice(0, 153) + ' (copy)'
      const ids = new Map(draft.fields.map((field) => [field.id, randomUUID()]))
      for (const field of draft.fields) {
        field.id = ids.get(field.id)!
        if (field.requiredWhen) field.requiredWhen.fieldId = ids.get(field.requiredWhen.fieldId)!
      }
      if (draft.output?.template)
        draft.output.template = draft.output.template.replace(
          /{{(.*?)}}/gs,
          (_match, key: string) => '{{' + (ids.get(key.trim()) || key.trim()) + '}}',
        )
      const copy = {
        draft,
        revision: 1,
        latestVersion: 0,
        archived: false,
        used: false,
        updatedAt: Date.now(),
        createdBy: profile.uid,
        duplicateOf: id,
        duplicateRevision: data.revision,
      }
      tx.create(target, copy)
      return { id: targetId, ...copy }
    }
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
      const outputErrors = formOutputIssues(stored!.draft).filter(
        (issue) => issue.severity === 'error',
      )
      if (outputErrors.length)
        fail('invalid-argument', outputErrors.map((issue) => issue.message).join(' '))
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
async function authorizedFormJob(profile: Awaited<ReturnType<typeof user>>, value: unknown) {
  if (value === undefined) return undefined
  const jobId = validId(value),
    job = await db.doc('jobs/' + jobId).get()
  const assigned = new Set(profile.assignedJobIds)
  if (job.data()?.assignedForemanIds?.includes(profile.uid)) assigned.add(jobId)
  if (
    !job.exists ||
    !targetFunctionRoleCanOpenJobDashboard({
      role: profile.role,
      jobId,
      assignedJobIds: [...assigned],
      isShopJob: isFunctionShopJob(job.data()!),
    })
  )
    fail('permission-denied', 'You cannot use a form for this job.')
  return jobId
}
export const formWorkspace = onCall(
  { memory: '512MiB', timeoutSeconds: 60, maxInstances: 10 },
  async (request) => {
    const data = payload(request.data || {})
    const capability =
      typeof data.publicCapability === 'string' && /^[a-f0-9]{64}$/.test(data.publicCapability)
        ? data.publicCapability
        : ''
    let profile: Awaited<ReturnType<typeof user>>
    if (capability) {
      if (data.dashboardJobId !== undefined)
        fail('permission-denied', 'Public forms cannot select private job context.')
      profile = {
        uid: 'public-' + hash(capability),
        role: 'none',
        active: true,
        assignedJobIds: [],
        displayName: null,
      }
      if (data.action !== 'create') {
        const saved = (await records.doc(validId(data.id)).get()).data()
        if (
          !saved ||
          saved.publicCapabilityHash !== hash(capability) ||
          saved.publicExpiresAt < Date.now()
        )
          fail('permission-denied', 'This form session expired. Start a new response.')
        const active = await templates.doc(saved.templateId).get()
        if (!active.exists || active.data()?.archived)
          fail('failed-precondition', 'This form is no longer accepting responses.')
        const latest = await active.ref
          .collection('versions')
          .doc('v' + active.data()?.latestVersion)
          .get()
        if (validateFormAccess(latest.data()?.access).respondents !== 'public')
          fail('permission-denied', 'This form now requires sign in.')
      }
    } else profile = await user(request.auth?.uid)
    const dashboardJobId = await authorizedFormJob(profile, data.dashboardJobId)
    if (data.action === 'list') {
      const docs = await records.where('ownerUid', '==', profile.uid).limit(100).get()
      return {
        records: (
          await Promise.all(
            docs.docs
              .filter((doc) => dashboardJobId === undefined || doc.data().jobId === dashboardJobId)
              .map(async (doc) => {
                const record = doc.data() as FormRecord
                if (record.jobId) {
                  try {
                    await authorizedFormJob(profile, record.jobId)
                  } catch (error) {
                    if (error instanceof HttpsError && error.code === 'permission-denied')
                      return undefined
                    throw error
                  }
                }
                return output(record)
              }),
          )
        ).filter(Boolean),
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
      const id = hash(
          profile.uid + ':' + data.requestId + (dashboardJobId ? ':job:' + dashboardJobId : ''),
        ),
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
        const liveVersion =
          current.data()?.latestVersion === data.version
            ? issued
            : await tx.get(template.collection('versions').doc('v' + current.data()?.latestVersion))
        if (
          !liveVersion.exists ||
          !canSubmitForm(liveVersion.data()?.access, capability ? undefined : profile)
        )
          fail('permission-denied', 'This form audience changed. Open the current form link.')
        if (!canSubmitForm(definition.access, capability ? undefined : profile))
          fail('permission-denied', 'You cannot complete this form.')
        if (capability && validateFormAccess(definition.access).respondents !== 'public')
          fail('permission-denied', 'This form requires sign in.')
        let respondentIdentity: { name: string; email: string } | undefined
        if (capability && validateFormAccess(definition.access).identity === 'identified') {
          const identity = payload(data.respondentIdentity)
          const name = typeof identity.name === 'string' ? identity.name.trim() : ''
          const email =
            typeof identity.email === 'string' ? identity.email.trim().toLowerCase() : ''
          if (
            !name ||
            name.length > 160 ||
            email.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
          )
            fail(
              'invalid-argument',
              'Enter your name and email address. These contact details are self-reported, not verified.',
            )
          respondentIdentity = { name, email }
        }
        if (capability) {
          const bucket = db.doc(
            'formPublicRateLimits/' +
              hash(request.rawRequest?.ip || 'unknown') +
              '-' +
              Math.floor(now / 3600000),
          )
          const usage = await tx.get(bucket)
          if (Number(usage.data()?.count || 0) >= 20)
            throw new HttpsError('resource-exhausted', 'Too many form starts. Try later.')
          tx.set(bucket, { count: Number(usage.data()?.count || 0) + 1, expiresAt: now + 7200000 })
        }
        const record: FormRecord = {
          id,
          ownerUid: profile.uid,
          ...(dashboardJobId ? { jobId: dashboardJobId } : {}),
          templateId,
          templateVersion: Number(data.version),
          definition,
          answers: validateFormAnswers(definition, {}, false),
          revision: 1,
          status: 'draft',
          createdAt: now,
          updatedAt: now,
          ...(capability
            ? { publicCapabilityHash: hash(capability), publicExpiresAt: now + 4 * 3600000 }
            : {}),
          ...(respondentIdentity ? { respondentIdentity } : {}),
        }
        tx.create(ref, record)
        tx.update(template, { used: true })
        return record
      })
      return output(record)
    }
    const id = validId(data.id),
      ref = records.doc(id)
    const storedJob = (await ref.get()).data()?.jobId
    if (storedJob) await authorizedFormJob(profile, storedJob)
    if (dashboardJobId !== undefined && storedJob !== dashboardJobId)
      fail('permission-denied', 'This form record belongs to another job.')
    if (data.action === 'get')
      return output(allowedRecord((await ref.get()).data() as FormRecord | undefined, profile))
    if (data.action === 'photo') {
      const record = allowedRecord((await ref.get()).data() as FormRecord | undefined, profile)
      const assetId = validId(data.assetId)
      if (!photoSlots(record).some((photo) => photo.assetId === assetId))
        fail('permission-denied', 'This photo is not attached to this record.')
      const asset = (await assets.doc(assetId).get()).data()
      const slot = photoSlots(record).find((photo) => photo.assetId === assetId)
      if (
        !asset ||
        asset.recordId !== id ||
        asset.ownerUid !== record.ownerUid ||
        asset.path !== 'form-photos/' + id + '/' + assetId + '.webp' ||
        !slot ||
        asset.fieldId !== slot.fieldId ||
        (asset.groupId || '') !== slot.groupId ||
        (asset.instanceId || '') !== slot.instanceId
      )
        fail('not-found', 'Photo not found.')
      const [bytes] = await storageBucket.file(asset.path).download()
      if (bytes.length > 2 * 1024 * 1024)
        fail('failed-precondition', 'This photo exceeds the view limit.')
      return { base64: bytes.toString('base64'), contentType: 'image/webp' }
    }
    if (data.action === 'upload') {
      const record = allowedRecord(
        (await ref.get()).data() as FormRecord | undefined,
        profile,
        true,
      )
      revision(record.revision, data.revision)
      if (record.status !== 'draft')
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
      photoTarget(record, data)
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
          const target = photoTarget(current, data)
          const list = target.answers[String(data.fieldId)] as string[]
          if (
            list.length >= 5 ||
            attachedPhotoCount(current.definition, current.answers) >= 20 ||
            Number((current as FormRecord & { uploadedCount?: number }).uploadedCount || 0) >= 40
          )
            fail('failed-precondition', 'The photo limit has been reached.')
          tx.create(assets.doc(assetId), {
            recordId: id,
            fieldId: data.fieldId,
            ...(target.group
              ? { groupId: target.group.id, instanceId: target.instance!.instanceId }
              : {}),
            path,
            ownerUid: profile.uid,
          })
          tx.update(ref, {
            answers: target.group
              ? {
                  ...current.answers,
                  [target.group.id]: (current.answers[target.group.id] as FormGroupInstance[]).map(
                    (instance) =>
                      instance.instanceId === target.instance!.instanceId
                        ? {
                            ...instance,
                            answers: {
                              ...instance.answers,
                              [String(data.fieldId)]: [...list, assetId],
                            },
                          }
                        : instance,
                  ),
                }
              : { ...current.answers, [String(data.fieldId)]: [...list, assetId] },
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
    const pendingRecord = (await ref.get()).data() as FormRecord | undefined
    const consents =
      data.action === 'submit' && capability && pendingRecord
        ? await publicRecipientConsentSnapshot(db, pendingRecord.id)
        : []
    const submissionRecipients =
      data.action === 'submit' && pendingRecord
        ? await resolveFormSubmissionRecipients(
            db,
            pendingRecord.definition,
            pendingRecord.answers,
            pendingRecord.jobId,
            {
              publicRespondent: !!capability,
              verifiedEmails: consents.map((proof) => proof.email),
            },
          )
        : []
    function enteredAddresses(
      fields: FormRecord['definition']['fields'],
      answers: FormAnswers,
    ): string[] {
      return fields.flatMap((field) =>
        field.kind === 'recipients'
          ? ((answers[field.id] || []) as string[])
          : field.kind === 'repeat'
            ? ((answers[field.id] || []) as FormGroupInstance[]).flatMap((instance) =>
                enteredAddresses(field.fields || [], instance.answers),
              )
            : [],
      )
    }
    const publicRecipientConsents = consents.filter((proof) =>
      submissionRecipients.includes(proof.email),
    )
    const recipientExclusionCount =
      capability && pendingRecord
        ? [
            ...new Set(
              enteredAddresses(pendingRecord.definition.fields, pendingRecord.answers).map(
                (email) => email.trim().toLowerCase(),
              ),
            ),
          ].filter((email) => !submissionRecipients.includes(email)).length
        : 0
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
      const photos = photoSlots(current, answers)
      const snapshots = photos.length
        ? await tx.getAll(...photos.map((photo) => assets.doc(photo.assetId)))
        : []
      snapshots.forEach((snapshot, index) => {
        const photo = snapshot.data()
        if (
          !photo ||
          photo.recordId !== id ||
          photo.fieldId !== photos[index]!.fieldId ||
          (photo.groupId || '') !== photos[index]!.groupId ||
          (photo.instanceId || '') !== photos[index]!.instanceId ||
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
        ...(capability ? { publicRecipientConsents, recipientExclusionCount } : {}),
      }
      tx.create(db.doc('formSubmissions/' + id), next)
      tx.create(db.doc('formDeliveries/' + id), {
        submissionId: id,
        recipients: submissionRecipients,
        ...(capability ? { publicRecipientConsents, recipientExclusionCount } : {}),
        status: submissionRecipients.length ? 'queued' : 'not-configured',
        attempts: 0,
        updatedAt: now,
      })
      tx.set(ref, next)
      return next
    })
    return output(record)
  },
)
