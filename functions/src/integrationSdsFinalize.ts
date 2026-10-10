import { createHash, randomUUID } from 'node:crypto'
import { db, storageBucket } from './runtime'
import { sdsText, folderPath, type SdsFolder } from './sdsModel'
import { validateDocument } from './documentFormats'
import { importPath, SDS_MASTER_CAPACITY } from './sdsIntake'
import { evaluateIntegrationRequest, type IntegrationCredential } from './apiScopePolicy'
import { buildCurrentFunctionUser } from './roleAccess'
import type { IntegrationEnvelope } from './integrationApiRequest'

/** Commits only server-validated, key/actor/folder-bound staging. No public storage URLs. */
export async function finalizeIntegrationSds(
  request: IntegrationEnvelope,
  actorUid: string,
  keyId: string,
  secret: string,
) {
  const id = request.resourceId
  const uploadId = request.payload.uploadId
  if (
    !id ||
    typeof uploadId !== 'string' ||
    !/^[a-f0-9]{64}$/.test(uploadId) ||
    !['create', 'revision'].includes(String(request.payload.mode))
  )
    throw new Error('Choose an explicit document and create/revision mode.')
  const stageRef = db.doc(`sdsIntegrationUploads/${uploadId}`),
    sheetRef = db.doc(`sdsDocuments/${id}`)
  const stage = await stageRef.get(),
    staged = stage.data()
  const assertStage = (value: typeof staged) => {
    if (
      !value ||
      value.keyId !== keyId ||
      value.actorUid !== actorUid ||
      value.folderId !== request.folderId ||
      value.status !== 'staged' ||
      value.expiresAt <= Date.now()
    )
      throw new Error('Staged upload unavailable or outside scope.')
  }
  assertStage(staged)
  const stagedFile = storageBucket.file(`sds-uploads/${actorUid}/${uploadId}.pdf`)
  const [metadata] = await stagedFile.getMetadata()
  if (
    Number(metadata.size) < 1 ||
    Number(metadata.size) > 20 * 1024 * 1024 ||
    metadata.contentType !== 'application/pdf' ||
    metadata.metadata?.keyId !== keyId ||
    metadata.metadata?.folderId !== request.folderId
  )
    throw new Error('Invalid staged PDF.')
  const [bytes] = await stagedFile.download(),
    checksum = createHash('sha256').update(bytes).digest('hex')
  if (bytes.length !== staged!.size || checksum !== staged!.sha256)
    throw new Error('Staged PDF bytes changed.')
  const validated = await validateDocument(bytes, 'pdf')
  const revisionDate = sdsText(request.payload.revisionDate ?? '', 'Revision date', 10)
  if (
    revisionDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(revisionDate) ||
      !Number.isFinite(Date.parse(revisionDate)) ||
      new Date(revisionDate).toISOString().slice(0, 10) !== revisionDate)
  )
    throw new Error('Invalid revision date.')
  const order = request.payload.order ?? 0
  if (!Number.isInteger(order) || Math.abs(Number(order)) > 1000000)
    throw new Error('Invalid order.')
  const sourcePath =
    request.payload.sourcePath === undefined ? undefined : importPath(request.payload.sourcePath)
  const values = {
    name: sdsText(request.payload.name, 'File name', 160, true),
    manufacturer: sdsText(request.payload.manufacturer ?? '', 'Manufacturer', 160),
    productCode: sdsText(request.payload.productCode ?? '', 'Product identifier', 100),
    language: sdsText(request.payload.language, 'Language', 40, true),
    folderId: request.folderId!,
    order: Number(order),
    revisionDate,
    provenance: sdsText(request.payload.provenance ?? '', 'Provenance', 1000),
    currencyStatus: 'unverified',
    ...(sourcePath ? { sourcePath } : {}),
  }
  const revisionId = randomUUID(),
    filePath = `sds-files/${id}/${revisionId}.pdf`
  const masterCount = (await db.collection('sdsDocuments').count().get()).data().count
  await storageBucket
    .file(filePath)
    .save(bytes, {
      resumable: false,
      contentType: 'application/pdf',
      metadata: { cacheControl: 'private, max-age=0' },
    })
  try {
    await db.runTransaction(async (tx) => {
      const stateRef = db.doc('sdsState/master'),
        keyRef = db.doc(`integrationKeys/${keyId}`),
        actorRef = db.doc(`users/${actorUid}`)
      const [currentStage, current, state, key, actor, folders] = await Promise.all([
        tx.get(stageRef),
        tx.get(sheetRef),
        tx.get(stateRef),
        tx.get(keyRef),
        tx.get(actorRef),
        tx.get(db.collection('sdsFolders')),
      ])
      assertStage(currentStage.data())
      const profile = buildCurrentFunctionUser(actorUid, actor.data() ?? {})
      if (
        !key.exists ||
        key.data()?.actorUid !== actorUid ||
        !actor.exists ||
        !profile.active ||
        profile.role !== 'admin' ||
        !evaluateIntegrationRequest(
          { ...key.data(), id: keyId } as IntegrationCredential,
          secret,
          request,
          Date.now(),
        ).allowed
      )
        throw new Error('Integration access revoked.')
      if (
        !Number.isSafeInteger(request.payload.version) ||
        request.payload.version !== (state.data()?.version ?? 0)
      )
        throw new Error('Master library version changed.')
      folderPath(
        values.folderId,
        folders.docs.map((doc) => ({ ...doc.data(), id: doc.id }) as SdsFolder),
      )
      if (request.payload.mode === 'create') {
        if (
          current.exists ||
          request.payload.expectedRevisionId !== undefined ||
          masterCount >= SDS_MASTER_CAPACITY
        )
          throw new Error('Cannot create this document.')
      } else if (
        !current.exists ||
        current.data()?.folderId !== request.folderId ||
        typeof request.payload.expectedRevisionId !== 'string' ||
        request.payload.expectedRevisionId !== current.data()?.revisionId
      )
        throw new Error('Document revision or folder changed.')
      const saved = {
        ...current.data(),
        ...values,
        ...validated,
        id,
        revisionId,
        extension: 'pdf',
        mimeType: 'application/pdf',
        originalName: staged!.originalName ?? '',
        size: bytes.length,
        checksum,
        archived: current.data()?.archived ?? false,
        updatedAt: new Date().toISOString(),
        updatedBy: actorUid,
      }
      tx.set(sheetRef, saved)
      tx.create(sheetRef.collection('revisions').doc(revisionId), { ...saved, filePath })
      tx.set(stateRef, { version: Number(request.payload.version) + 1 })
      tx.update(stageRef, {
        status: 'consumed',
        documentId: id,
        revisionId,
        consumedAt: Date.now(),
      })
    })
  } catch (error) {
    await storageBucket
      .file(filePath)
      .delete()
      .catch(() => undefined)
    throw error
  }
  await stagedFile.delete().catch(() => undefined)
  return { id, revisionId, version: Number(request.payload.version) + 1, state: 'library-saved' }
}
