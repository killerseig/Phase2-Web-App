import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'

const projectId = process.env.GCLOUD_PROJECT || 'demo-phase2-security'
assert.match(
  projectId,
  /^demo-[a-z0-9-]+$/,
  'Synthetic integration keys are restricted to demo projects.',
)
for (const name of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST'])
  assert.match(process.env[name] || '', /^(127\.0\.0\.1|localhost):\d+$/, `${name} must be local.`)
process.env.GCLOUD_PROJECT = projectId
const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { initializeApp, deleteApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getStorage } = require('firebase-admin/storage')
const { PDFDocument } = require('pdf-lib')
const app = initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` })
const db = getFirestore(),
  bucket = getStorage().bucket()
const { scopedIntegrationApi } = require('../functions/integrationApi.js')
const prefix = `integration-test-${randomUUID()}`
const actorUid = `${prefix}-admin`,
  keyId = `${prefix}-key`,
  formId = randomUUID(),
  folderId = `${prefix}-folder`,
  sheetId = `${prefix}-sheet`
const secret = randomBytes(32).toString('base64url') // synthetic, emulator-only; never printed
const keyRef = db.doc(`integrationKeys/${keyId}`)
const stateRef = db.doc('sdsState/master'),
  previousState = await stateRef.get()
let server, stagedPath
const createdDocumentId = randomUUID(),
  uploadIds = []
const alternateKeyId = `${prefix}-other`,
  alternateActor = `${prefix}-otheradmin`,
  alternateFolder = `${prefix}-otherfolder`
let checks = 0
const check = (value, expected) => {
  assert.deepEqual(value, expected)
  checks++
}
try {
  await db.doc(`users/${actorUid}`).set({ role: 'admin', active: true })
  await keyRef.set({
    actorUid,
    secretHash: createHash('sha256').update(secret).digest('hex'),
    scopes: ['forms:draft:write', 'sds:metadata:write', 'sds:upload:stage', 'sds:upload:commit'],
    createdAt: Date.now() - 1000,
    expiresAt: Date.now() + 3600000,
    formIds: [formId],
    sdsFolderIds: [folderId],
  })
  await db.doc(`sdsFolders/${folderId}`).set({ name: 'Synthetic staging', parentId: '', order: 0 })
  server = createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    req.rawBody = Buffer.concat(chunks)
    req.body = JSON.parse(req.rawBody.toString() || '{}')
    req.get = (name) => req.headers[name.toLowerCase()]
    res.set = (name, value) => {
      res.setHeader(name, value)
      return res
    }
    res.status = (status) => {
      res.statusCode = status
      return res
    }
    res.json = (value) => {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(value))
      return res
    }
    try {
      await scopedIntegrationApi(req, res)
    } catch {
      res.statusCode = 500
      res.end('{"error":"handler failure"}')
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const call = async (
    operation,
    payload = {},
    identifiers = {},
    requestId = randomUUID(),
    bearer = `${keyId}.${secret}`,
  ) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, operation, payload, ...identifiers }),
    })
    return { status: response.status, body: await response.json(), requestId }
  }
  const definition = {
    title: 'Synthetic API draft',
    description: 'Synthetic body marker',
    recipients: [],
    fields: [{ id: 'note', kind: 'text', label: 'Note', required: false, options: [] }],
  }
  const created = await call('forms.draft.create', { definition }, { resourceId: formId })
  check(created.status, 200)
  check(created.body, { id: formId, revision: 1, state: 'draft' })
  const replay = await call(
    'forms.draft.create',
    { definition },
    { resourceId: formId },
    created.requestId,
  )
  check(replay.body, created.body)
  check((await db.doc(`formTemplates/${formId}`).get()).data().revision, 1)
  const changed = { ...definition, title: 'Updated synthetic API draft' }
  check(
    (await call('forms.draft.update', { definition: changed, revision: 1 }, { resourceId: formId }))
      .status,
    200,
  )
  check(
    (await call('forms.draft.update', { definition: changed, revision: 1 }, { resourceId: formId }))
      .status,
    409,
  )
  check((await call('forms.publish', {}, { resourceId: formId })).status, 403)
  check(
    (await call('forms.draft.update', { definition, revision: 0 }, { resourceId: randomUUID() }))
      .status,
    403,
  )
  check((await db.doc(`formTemplates/${formId}`).get()).data().latestVersion, 0)
  const stateVersion = previousState.data()?.version ?? 0
  await db.doc(`sdsDocuments/${sheetId}`).set({
    folderId,
    name: 'Before',
    manufacturer: '',
    productCode: '',
    language: 'English',
    revisionDate: '',
    archived: false,
    revisionId: 'synthetic',
  })
  check(
    (
      await call(
        'sds.metadata.update',
        { name: 'After', language: 'English', version: stateVersion },
        { resourceId: sheetId, folderId },
      )
    ).status,
    200,
  )
  check((await db.doc(`sdsDocuments/${sheetId}`).get()).data().name, 'After')
  check(
    (
      await call(
        'sds.metadata.update',
        { name: 'Forbidden', language: 'English', version: stateVersion + 1 },
        { resourceId: sheetId, folderId: 'outside' },
      )
    ).status,
    403,
  )
  const pdf = await PDFDocument.create()
  pdf.addPage([100, 100])
  const bytes = Buffer.from(await pdf.save())
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const uploadPayload = {
    base64: bytes.toString('base64'),
    expectedSize: bytes.length,
    expectedSha256: sha256,
  }
  const staged = await call('sds.upload.stage', uploadPayload, { folderId })
  uploadIds.push(staged.body.uploadId)
  check(staged.status, 200)
  check(staged.body.state, 'staged-only')
  stagedPath = `sds-uploads/${actorUid}/${staged.body.uploadId}.pdf`
  check(Buffer.from((await bucket.file(stagedPath).download())[0]), bytes)
  check(
    (await call('sds.upload.stage', uploadPayload, { folderId }, staged.requestId)).body,
    staged.body,
  )
  const createPayload = {
    uploadId: staged.body.uploadId,
    mode: 'create',
    name: 'Synthetic committed SDS',
    language: 'English',
    revisionDate: '',
    version: stateVersion + 1,
    sourcePath: 'synthetic/created.pdf',
    provenance: 'Synthetic verification fixture',
  }
  const initialKey = (await keyRef.get()).data()
  await db.doc(`integrationKeys/${alternateKeyId}`).set(initialKey)
  check(
    (
      await call(
        'sds.upload.finalize',
        createPayload,
        { resourceId: createdDocumentId, folderId },
        randomUUID(),
        `${alternateKeyId}.${secret}`,
      )
    ).status,
    409,
  )
  await db.doc(`users/${alternateActor}`).set({ role: 'admin', active: true })
  await keyRef.update({ actorUid: alternateActor })
  check(
    (await call('sds.upload.finalize', createPayload, { resourceId: createdDocumentId, folderId }))
      .status,
    409,
  )
  await keyRef.update({ actorUid })
  await db
    .doc(`sdsFolders/${alternateFolder}`)
    .set({ name: 'Synthetic other folder', parentId: '', order: 0 })
  await keyRef.update({ sdsFolderIds: [folderId, alternateFolder] })
  check(
    (
      await call('sds.upload.finalize', createPayload, {
        resourceId: createdDocumentId,
        folderId: alternateFolder,
      })
    ).status,
    409,
  )
  const finalized = await call('sds.upload.finalize', createPayload, {
    resourceId: createdDocumentId,
    folderId,
  })
  check(finalized.status, 200)
  check(finalized.body.state, 'library-saved')
  check(
    (
      await call(
        'sds.upload.finalize',
        createPayload,
        { resourceId: createdDocumentId, folderId },
        finalized.requestId,
      )
    ).body,
    finalized.body,
  )
  const createdDoc = (await db.doc(`sdsDocuments/${createdDocumentId}`).get()).data()
  check(createdDoc.revisionId, finalized.body.revisionId)
  check(createdDoc.currencyStatus, 'unverified')
  const createdRevision = (
    await db.doc(`sdsDocuments/${createdDocumentId}/revisions/${createdDoc.revisionId}`).get()
  ).data()
  check(Buffer.from((await bucket.file(createdRevision.filePath).download())[0]), bytes)
  check(
    (await db.doc(`sdsIntegrationUploads/${staged.body.uploadId}`).get()).data().status,
    'consumed',
  )
  check(
    (
      await call(
        'sds.upload.finalize',
        { ...createPayload, version: stateVersion + 2 },
        { resourceId: randomUUID(), folderId },
      )
    ).status,
    409,
  )
  pdf.addPage([110, 110])
  const revisedBytes = Buffer.from(await pdf.save())
  const revisedStage = await call(
    'sds.upload.stage',
    {
      base64: revisedBytes.toString('base64'),
      expectedSize: revisedBytes.length,
      expectedSha256: createHash('sha256').update(revisedBytes).digest('hex'),
    },
    { folderId },
  )
  check(revisedStage.status, 200)
  uploadIds.push(revisedStage.body.uploadId)
  const revisionPayload = {
    ...createPayload,
    uploadId: revisedStage.body.uploadId,
    mode: 'revision',
    version: stateVersion + 2,
    expectedRevisionId: finalized.body.revisionId,
    revisionDate: '2026-10-01',
  }
  check(
    (
      await call(
        'sds.upload.finalize',
        { ...revisionPayload, expectedRevisionId: 'stale' },
        { resourceId: createdDocumentId, folderId },
      )
    ).status,
    409,
  )
  const revised = await call('sds.upload.finalize', revisionPayload, {
    resourceId: createdDocumentId,
    folderId,
  })
  check(revised.status, 200)
  assert.notEqual(revised.body.revisionId, finalized.body.revisionId)
  checks++
  check(
    (
      await db.doc(`sdsDocuments/${createdDocumentId}/revisions/${finalized.body.revisionId}`).get()
    ).data().checksum,
    sha256,
  )
  check((await db.doc(`sdsDocuments/${createdDocumentId}`).get()).data().pageCount, 2)
  check(
    (
      await call(
        'sds.upload.stage',
        { ...uploadPayload, expectedSha256: '0'.repeat(64) },
        { folderId },
      )
    ).status,
    409,
  )
  await keyRef
    .collection('quota')
    .doc(String(Math.floor(Date.now() / 3600000)))
    .set({ requests: 60, bytes: 0 })
  check((await call('forms.draft.create', { definition })).status, 409)
  await keyRef.update({ revokedAt: Date.now() })
  check((await call('forms.draft.create', { definition })).status, 403)
  const audits = await db.collection('integrationAudit').where('keyId', '==', keyId).get()
  assert.ok(audits.size >= 6)
  checks++
  const auditText = JSON.stringify(audits.docs.map((doc) => doc.data()))
  assert.ok(!auditText.includes(secret))
  assert.ok(!auditText.includes('Synthetic body marker'))
  assert.ok(!auditText.includes(uploadPayload.base64))
  checks += 3
  console.log(
    `Integration API emulator verification: ${checks} checks passed; synthetic credentials only, no publication.`,
  )
} finally {
  if (server) await new Promise((resolve) => server.close(resolve))
  if (stagedPath)
    await bucket
      .file(stagedPath)
      .delete()
      .catch(() => undefined)
  await db.recursiveDelete(keyRef)
  await db.recursiveDelete(db.doc(`integrationKeys/${alternateKeyId}`))
  const alternateAudits = await db
    .collection('integrationAudit')
    .where('keyId', '==', alternateKeyId)
    .get()
  await Promise.all(alternateAudits.docs.map((doc) => doc.ref.delete()))
  await Promise.all([
    db.doc(`users/${alternateActor}`).delete(),
    db.doc(`sdsFolders/${alternateFolder}`).delete(),
  ])
  for (const uploadId of uploadIds) {
    await db.doc(`sdsIntegrationUploads/${uploadId}`).delete()
    await bucket
      .file(`sds-uploads/${actorUid}/${uploadId}.pdf`)
      .delete()
      .catch(() => undefined)
  }
  const [revisionFiles] = await bucket.getFiles({ prefix: `sds-files/${createdDocumentId}/` })
  await Promise.all(revisionFiles.map((file) => file.delete()))
  await db.recursiveDelete(db.doc(`sdsDocuments/${createdDocumentId}`))
  const audits = await db.collection('integrationAudit').where('keyId', '==', keyId).get()
  await Promise.all(audits.docs.map((doc) => doc.ref.delete()))
  await Promise.all([
    db.doc(`users/${actorUid}`).delete(),
    db.doc(`formTemplates/${formId}`).delete(),
    db.doc(`sdsFolders/${folderId}`).delete(),
    db.doc(`sdsDocuments/${sheetId}`).delete(),
  ])
  if (previousState.exists) await stateRef.set(previousState.data())
  else await stateRef.delete()
  await deleteApp(app)
}
