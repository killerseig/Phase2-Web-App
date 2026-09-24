import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https'
import { Timestamp } from 'firebase-admin/firestore'
import { getApp } from 'firebase-admin/app'
import { pipeline } from 'node:stream/promises'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import {
  DOCUMENT_MIME,
  documentExtension,
  validateDocument,
  printable,
  imageToPdf,
} from './documentFormats'
import { db, storageBucket } from './runtime'
import { buildCurrentFunctionUser, type CurrentFunctionUser } from './roleAccess'
import { VALID_ROLES } from './constants'
import { buildSdsBook } from './sdsBook'
import {
  folderPath,
  orderedSheets,
  sdsCanAccessJob,
  sdsId,
  sdsText,
  validateSelections,
  type SdsBookEntry,
  type SdsFolder,
  type SdsSheet,
} from './sdsModel'

const stateRef = db.doc('sdsState/master')
const foldersRef = db.collection('sdsFolders')
const sheetsRef = db.collection('sdsDocuments')
const exportsRef = db.collection('sdsExports')
const MAX_PDF_BYTES = 20 * 1024 * 1024

async function userFor(uid: string | undefined) {
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to use the SDS library.')
  const profile = await db.doc(`users/${uid}`).get()
  const user = buildCurrentFunctionUser(uid, profile.data() || {})
  if (!profile.exists || !user.active || user.role === 'none')
    throw new HttpsError('permission-denied', 'Your account does not have workspace access.')
  return user
}
function requireAdmin(user: CurrentFunctionUser) {
  if (user.role !== 'admin')
    throw new HttpsError(
      'permission-denied',
      'Only Admin can manage the master library and shared role resources.',
    )
}
async function jobFor(user: CurrentFunctionUser, jobId: string) {
  if (!jobId) return null
  const job = await db.doc(`jobs/${jobId}`).get()
  if (!job.exists || !sdsCanAccessJob(user, jobId, job.data() || {}))
    throw new HttpsError('permission-denied', 'You do not have access to this job.')
  return job.data()!
}
function version(value: unknown) {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    throw new HttpsError('invalid-argument', 'Reload before saving.')
  return Number(value)
}
function checkVersion(actual: number, expected: unknown) {
  if (actual !== version(expected))
    throw new HttpsError(
      'aborted',
      'Someone else saved changes. Reload and review before saving again.',
    )
}
function order(value: unknown) {
  if (!Number.isInteger(value) || Math.abs(Number(value)) > 1000000)
    throw new HttpsError(
      'invalid-argument',
      'Order must be a whole number between -1,000,000 and 1,000,000.',
    )
  return Number(value)
}
async function fileUrl(
  user: CurrentFunctionUser,
  jobId: string,
  path: string,
  filename: string,
  download: boolean,
  metadata: { extension?: string; originalName?: string } = {},
) {
  const ticket = randomBytes(32).toString('hex')
  await db.doc(`sdsDownloads/${createHash('sha256').update(ticket).digest('hex')}`).set({
    uid: user.uid,
    jobId,
    path,
    filename,
    download,
    extension: metadata.extension ?? 'pdf',
    originalName: metadata.originalName ?? '',
    expiresAt: Timestamp.fromMillis(Date.now() + 5 * 60 * 1000),
  })
  const project = process.env.GCLOUD_PROJECT || getApp().options.projectId
  const base =
    process.env.FUNCTIONS_EMULATOR === 'true'
      ? `http://127.0.0.1:5001/${project}/us-central1`
      : `https://us-central1-${project}.cloudfunctions.net`
  const extension = documentExtension(metadata.extension ?? 'pdf')
  return {
    url: `${base}/downloadSdsFile?ticket=${ticket}`,
    extension,
    mimeType: DOCUMENT_MIME[extension],
  }
}

// Short-lived opaque links work in the native PDF viewer without public files
// or service-account signing grants. Recheck access even after a link is issued.
export const downloadSdsFile = onRequest(
  { timeoutSeconds: 120, memory: '256MiB' },
  async (request, response) => {
    response
      .set('Cache-Control', 'private, no-store')
      .set('Referrer-Policy', 'no-referrer')
      .set('X-Content-Type-Options', 'nosniff')
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.status(405).send('Method not allowed.')
      return
    }
    const ticket = request.query.ticket
    if (typeof ticket !== 'string' || !/^[a-f0-9]{64}$/.test(ticket)) {
      response.status(403).send('This file link is invalid or expired.')
      return
    }
    const ref = db.doc(`sdsDownloads/${createHash('sha256').update(ticket).digest('hex')}`)
    try {
      const record = (await ref.get()).data()
      if (!record || record.expiresAt.toMillis() <= Date.now()) {
        if (record) await ref.delete()
        response.status(403).send('This file link expired. Open it again from the SDS library.')
        return
      }
      const user = await userFor(record.uid)
      await jobFor(user, record.jobId)
      const file = storageBucket.file(record.path)
      const [metadata] = await file.getMetadata()
      const extension = documentExtension(record.extension ?? 'pdf')
      const filename = record.originalName || `${record.filename}.${extension}`
      response
        .set('Content-Type', DOCUMENT_MIME[extension])
        .set('Content-Length', String(metadata.size))
      response.set(
        'Content-Disposition',
        `${record.download || ['docx', 'xlsx'].includes(extension) ? 'attachment' : 'inline'}; filename="${filename.replace(/[^a-zA-Z0-9 ._-]/g, '_').slice(0, 180)}"`,
      )
      if (request.method === 'HEAD') {
        response.end()
        return
      }
      await pipeline(file.createReadStream(), response)
    } catch {
      if (!response.headersSent && !response.destroyed)
        response
          .status(403)
          .send('This file is unavailable or your access has changed. Reopen Documents.')
    }
  },
)

/** New SDS namespace only: no existing job records or workflow permissions are mutated. */
export const sdsWorkspace = onCall({ timeoutSeconds: 120, memory: '512MiB' }, async (request) => {
  const user = await userFor(request.auth?.uid)
  const data = request.data ?? {}
  const action = data.action
  const jobId = sdsId(data.jobId, true)
  if (jobId) await jobFor(user, jobId)

  if (action === 'load') {
    return db.runTransaction(async (tx) => {
      const [state, folders, sheets] = await Promise.all([
        tx.get(stateRef),
        tx.get(foldersRef),
        tx.get(sheetsRef),
      ])
      const binder = jobId ? await tx.get(db.doc(`sdsBinders/${jobId}`)) : null
      const lastRequest = await tx.get(db.doc(`sdsExportRequests/${user.uid}`))
      const lastExport = lastRequest.exists
        ? await tx.get(exportsRef.doc(lastRequest.data()!.exportId))
        : null
      return {
        version: state.data()?.version ?? 0,
        folders: folders.docs.map((doc) => ({ ...doc.data(), id: doc.id })),
        sheets: sheets.docs.map((doc) => ({ ...doc.data(), id: doc.id })),
        binder: {
          version: binder?.data()?.version ?? 0,
          selections: binder?.data()?.selections ?? [],
        },
        exportId: lastExport?.data()?.jobId === jobId ? lastExport.id : '',
      }
    })
  }

  if (action === 'saveFolder') {
    requireAdmin(user)
    const id = sdsId(data.id, true) || randomUUID()
    const folder: SdsFolder = {
      id,
      name: sdsText(data.name, 'Folder name', 100, true),
      parentId: sdsId(data.parentId, true),
      order: order(data.order),
    }
    await db.runTransaction(async (tx) => {
      const [state, snapshot] = await Promise.all([tx.get(stateRef), tx.get(foldersRef)])
      checkVersion(state.data()?.version ?? 0, data.version)
      const folders = snapshot.docs
        .map((d) => ({ ...d.data(), id: d.id }) as SdsFolder)
        .filter((f) => f.id !== id)
      if (
        folders.some(
          (f) =>
            f.parentId === folder.parentId &&
            f.name.toLocaleLowerCase() === folder.name.toLocaleLowerCase(),
        )
      )
        throw new HttpsError('already-exists', 'A folder with this name already exists here.')
      folders.push(folder)
      if (folders.length > 200)
        throw new HttpsError('resource-exhausted', 'The library supports up to 200 folders.')
      folders.forEach((f) => folderPath(f.id, folders))
      tx.set(foldersRef.doc(id), folder)
      tx.set(stateRef, { version: data.version + 1 })
    })
    return { id }
  }

  if (action === 'deleteFolder') {
    requireAdmin(user)
    const id = sdsId(data.id)
    await db.runTransaction(async (tx) => {
      const [state, folders, sheets] = await Promise.all([
        tx.get(stateRef),
        tx.get(foldersRef),
        tx.get(sheetsRef),
      ])
      checkVersion(state.data()?.version ?? 0, data.version)
      if (
        folders.docs.some((f) => f.data().parentId === id) ||
        sheets.docs.some((s) => s.data().folderId === id)
      )
        throw new HttpsError(
          'failed-precondition',
          'Move all sheets (including archived sheets) and subfolders before removing this folder.',
        )
      tx.delete(foldersRef.doc(id))
      tx.set(stateRef, { version: data.version + 1 })
    })
    return { ok: true }
  }

  if (action === 'saveSheet') {
    requireAdmin(user)
    const id = sdsId(data.id, true) || randomUUID()
    const uploadId = sdsId(data.uploadId, true)
    const revisionId = uploadId ? randomUUID() : ''
    const extension = documentExtension(data.uploadExtension || 'pdf')
    const filePath = revisionId ? `sds-files/${id}/${revisionId}.${extension}` : ''
    const revisionDate = sdsText(data.revisionDate, 'Revision date', 10)
    if (
      revisionDate &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(revisionDate) ||
        !Number.isFinite(Date.parse(revisionDate)) ||
        new Date(revisionDate).toISOString().slice(0, 10) !== revisionDate)
    )
      throw new HttpsError('invalid-argument', 'Enter a valid revision date or leave it blank.')
    const values = {
      name: sdsText(data.name, 'File name', 160, true),
      manufacturer: sdsText(data.manufacturer ?? '', 'Manufacturer', 160),
      productCode: sdsText(data.productCode, 'Product identifier', 100),
      language: sdsText(data.language, 'Language', 40, true),
      folderId: sdsId(data.folderId, true),
      order: order(data.order),
      archived: data.archived === true,
    }
    let fileInfo: Record<string, unknown> | null = null
    if (uploadId) {
      const staged = storageBucket.file(`sds-uploads/${user.uid}/${uploadId}.${extension}`)
      const [metadata] = await staged.getMetadata()
      if (
        Number(metadata.size) > MAX_PDF_BYTES ||
        metadata.contentType !== DOCUMENT_MIME[extension]
      )
        throw new HttpsError(
          'invalid-argument',
          'The upload type does not match its extension, or it exceeds 20 MB.',
        )
      const [bytes] = await staged.download()
      const validated = await validateDocument(bytes, extension)
      const originalName = sdsText(data.originalName ?? '', 'Original file name', 180)
        .replace(/[\\/\x00-\x1F]/g, '_')
        .replace(/\.[^.]*$/, '')
        .slice(0, 160)
      fileInfo = {
        ...validated,
        extension,
        mimeType: DOCUMENT_MIME[extension],
        originalName: originalName ? `${originalName}.${extension}` : '',
        size: bytes.length,
        checksum: createHash('sha256').update(bytes).digest('hex'),
      }
      // Server-owned files are immutable and never receive Firebase download tokens.
      await storageBucket.file(filePath).save(bytes, {
        resumable: false,
        contentType: DOCUMENT_MIME[extension],
        metadata: { cacheControl: 'private, max-age=0' },
      })
    }
    try {
      await db.runTransaction(async (tx) => {
        const [state, current, folders, sheets] = await Promise.all([
          tx.get(stateRef),
          tx.get(sheetsRef.doc(id)),
          tx.get(foldersRef),
          tx.get(sheetsRef),
        ])
        checkVersion(state.data()?.version ?? 0, data.version)
        folderPath(
          values.folderId,
          folders.docs.map((d) => ({ ...d.data(), id: d.id }) as SdsFolder),
        )
        if (!current.exists && !revisionId)
          throw new HttpsError('invalid-argument', 'A file is required for a new document.')
        if (!current.exists && sheets.size >= 1000)
          throw new HttpsError('resource-exhausted', 'The library supports up to 1,000 sheets.')
        if (!revisionId && revisionDate !== current.data()?.revisionDate)
          throw new HttpsError('invalid-argument', 'Upload a file to change its revision date.')
        const saved = {
          ...current.data(),
          ...values,
          ...(fileInfo ?? {}),
          id,
          revisionId: revisionId || current.data()!.revisionId,
          revisionDate,
          updatedAt: new Date().toISOString(),
          updatedBy: user.uid,
        }
        tx.set(sheetsRef.doc(id), saved)
        if (revisionId)
          tx.create(sheetsRef.doc(id).collection('revisions').doc(revisionId), {
            ...saved,
            ...fileInfo,
            filePath,
          })
        tx.set(stateRef, { version: data.version + 1 })
      })
    } catch (error) {
      if (filePath)
        await storageBucket
          .file(filePath)
          .delete()
          .catch(() => undefined)
      throw error
    }
    if (uploadId)
      await storageBucket
        .file(`sds-uploads/${user.uid}/${uploadId}.pdf`)
        .delete()
        .catch(() => undefined)
    return { id }
  }

  if (action === 'saveSelection') {
    if (!jobId) throw new HttpsError('invalid-argument', 'Choose a job first.')
    const selections = validateSelections(data.selections)
    await db.runTransaction(async (tx) => {
      const binderRef = db.doc(`sdsBinders/${jobId}`)
      const [binder, sheets] = await Promise.all([tx.get(binderRef), tx.get(sheetsRef)])
      checkVersion(binder.data()?.version ?? 0, data.version)
      const previous = validateSelections(binder.data()?.selections ?? [])
      for (const selection of selections) {
        const sheet = sheets.docs.find((d) => d.id === selection.documentId)?.data()
        const retained = previous.some(
          (s) => s.documentId === selection.documentId && s.revisionId === selection.revisionId,
        )
        if (!sheet || (!retained && (sheet.archived || sheet.revisionId !== selection.revisionId)))
          throw new HttpsError(
            'failed-precondition',
            'The library changed. Reload and review your selection.',
          )
      }
      tx.set(binderRef, {
        selections,
        version: data.version + 1,
        updatedBy: user.uid,
        updatedAt: new Date().toISOString(),
      })
    })
    return { ok: true }
  }

  if (action === 'openSheet') {
    const id = sdsId(data.id)
    const sheet = await sheetsRef.doc(id).get()
    if (!sheet.exists) throw new HttpsError('not-found', 'Sheet not found.')
    let revisionId = sheet.data()!.revisionId
    if (jobId) {
      const binder = await db.doc(`sdsBinders/${jobId}`).get()
      const selected = validateSelections(binder.data()?.selections ?? []).find(
        (s) => s.documentId === id,
      )
      // Edit mode can inspect a current master sheet before selecting it.
      revisionId = selected?.revisionId ?? revisionId
    }
    const revision = await sheetsRef.doc(id).collection('revisions').doc(revisionId).get()
    if (!revision.exists) throw new HttpsError('not-found', 'PDF revision is unavailable.')
    return fileUrl(
      user,
      jobId,
      revision.data()!.filePath,
      sheet.data()!.name,
      data.download === true,
      revision.data()!,
    )
  }

  if (action === 'requestExport') {
    const id = sdsId(data.requestId)
    const job = await jobFor(user, jobId)
    await db.runTransaction(async (tx) => {
      const exportRef = exportsRef.doc(id)
      const existing = await tx.get(exportRef)
      if (existing.exists) {
        if (existing.data()!.createdBy !== user.uid || existing.data()!.jobId !== jobId)
          throw new HttpsError('permission-denied', 'This export belongs to another request.')
        return
      }
      const userExportRef = db.doc(`sdsExportRequests/${user.uid}`)
      const last = await tx.get(userExportRef)
      if (last.exists) {
        const previous = await tx.get(exportsRef.doc(last.data()!.exportId))
        const record = previous.data()
        if (
          record &&
          ['queued', 'running'].includes(record.status) &&
          Date.now() - Date.parse(record.createdAt) < 12 * 60 * 1000
        ) {
          throw new HttpsError(
            'resource-exhausted',
            'A book is already being prepared for your account. Wait for it to finish before requesting another.',
          )
        }
      }
      const [foldersSnap, sheetsSnap] = await Promise.all([tx.get(foldersRef), tx.get(sheetsRef)])
      const binder = jobId ? await tx.get(db.doc(`sdsBinders/${jobId}`)) : null
      if (jobId) checkVersion(binder?.data()?.version ?? 0, data.version)
      const folders = foldersSnap.docs.map((d) => ({ ...d.data(), id: d.id }) as SdsFolder)
      const sheets = sheetsSnap.docs.map((d) => ({ ...d.data(), id: d.id }) as SdsSheet)
      const selections = jobId
        ? validateSelections(binder?.data()?.selections ?? [])
        : sheets
            .filter((s) => !s.archived)
            .map((s) => ({ documentId: s.id, revisionId: s.revisionId }))
      if (!selections.length)
        throw new HttpsError('failed-precondition', 'Select at least one sheet before exporting.')
      const included = orderedSheets(
        sheets.filter((s) => selections.some((v) => v.documentId === s.id)),
        folders,
      )
      if (included.length !== selections.length || included.some((s) => s.archived))
        throw new HttpsError(
          'failed-precondition',
          'A selected sheet is unavailable or archived. Review the job selection before exporting.',
        )
      const entries: SdsBookEntry[] = []
      const excludedFiles: string[] = []
      for (const sheet of included) {
        const revisionId = selections.find((s) => s.documentId === sheet.id)!.revisionId
        const revision = await tx.get(
          sheetsRef.doc(sheet.id).collection('revisions').doc(revisionId),
        )
        if (!revision.exists)
          throw new HttpsError('failed-precondition', `The PDF for ${sheet.name} is unavailable.`)
        if (!printable(revision.data()!.extension)) {
          if (data.printableOnly !== true)
            throw new HttpsError(
              'failed-precondition',
              'Books can contain only PDFs and images. Confirm excluding other file types before exporting.',
            )
          excludedFiles.push(sheet.name)
          continue
        }
        entries.push({
          documentId: sheet.id,
          revisionId,
          title: sheet.name,
          manufacturer: revision.data()!.manufacturer,
          revisionDate: revision.data()!.revisionDate,
          folders: folderPath(sheet.folderId, folders).map((f) => f.name),
          filePath: revision.data()!.filePath,
          extension: revision.data()!.extension ?? 'pdf',
        })
      }
      if (!entries.length)
        throw new HttpsError(
          'failed-precondition',
          'There are no PDFs or images to include in a book.',
        )
      if (Buffer.byteLength(JSON.stringify(entries)) > 750000)
        throw new HttpsError(
          'resource-exhausted',
          'This book is too large. Reduce the selected sheets or folder depth.',
        )
      tx.create(exportRef, {
        excludedFiles,
        createdBy: user.uid,
        jobId,
        title: job
          ? `${job.code || job.number || ''} ${job.name || 'Job'} — SDS Book`.trim()
          : 'Company Document Book',
        createdAt: new Date().toISOString(),
        status: 'queued',
        entries,
      })
      tx.set(userExportRef, { exportId: id })
    })
    return { id }
  }

  if (action === 'exportStatus') {
    const snapshot = await exportsRef.doc(sdsId(data.id)).get()
    const record = snapshot.data()
    if (!record || record.createdBy !== user.uid)
      throw new HttpsError('permission-denied', 'Export is unavailable.')
    await jobFor(user, record.jobId)
    if (record.status === 'complete')
      return {
        status: 'complete',
        pageCount: record.pageCount,
        ...(data.link === true
          ? await fileUrl(user, record.jobId, record.filePath, record.title, data.download === true)
          : {}),
      }
    if (Date.now() - Date.parse(record.createdAt) > 12 * 60 * 1000 && record.status !== 'failed')
      return { status: 'failed', error: 'This export timed out. Please request a new book.' }
    return { status: record.status, error: record.error ?? '' }
  }

  if (action === 'listResources' || action === 'saveResource' || action === 'deleteResource') {
    const role = sdsText(data.role, 'Role', 40, true)
    if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number]) || role === 'none')
      throw new HttpsError('invalid-argument', 'Unknown role.')
    if (user.role !== 'admin' && user.role !== role)
      throw new HttpsError('permission-denied', 'You cannot access resources for another role.')
    const resources = db.collection('roleResources').doc(role).collection('items')
    if (action === 'listResources') {
      const snapshot = await resources.get()
      return { resources: snapshot.docs.map((d) => ({ ...d.data(), id: d.id })) }
    }
    requireAdmin(user)
    const id = sdsId(data.id, true) || randomUUID()
    if (action === 'deleteResource') {
      await resources.doc(id).delete()
      return { ok: true }
    }
    const url = sdsText(data.url, 'Resource URL', 2000)
    if (url && !/^https:\/\/[^\s]+$/.test(url) && !/^\/(?!\/)[^\s\\]*$/.test(url))
      throw new HttpsError('invalid-argument', 'Use an https:// link or an internal /path.')
    await resources.doc(id).set({
      title: sdsText(data.title, 'Title', 160, true),
      description: sdsText(data.description, 'Description', 2000),
      url,
      updatedBy: user.uid,
      updatedAt: new Date().toISOString(),
    })
    return { id }
  }
  throw new HttpsError('invalid-argument', 'Unknown SDS action.')
})

export const generateSdsBook = onDocumentCreated(
  { document: 'sdsExports/{exportId}', timeoutSeconds: 540, memory: '1GiB', retry: true },
  async (event) => {
    const ref = event.data?.ref
    if (!ref) return
    const lease = randomUUID()
    const claimed = await db.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data()
      if (!current || current.status === 'complete' || current.status === 'failed') return null
      if (current.status === 'running' && Date.now() - Number(current.startedAt) < 10 * 60 * 1000)
        throw new Error('Export worker still running; retry later.')
      tx.update(ref, { status: 'running', lease, startedAt: Date.now() })
      return current
    })
    if (!claimed) return
    try {
      const user = await userFor(claimed.createdBy)
      await jobFor(user, claimed.jobId)
      const book = await buildSdsBook(
        claimed.title,
        claimed.createdAt,
        claimed.entries,
        async (entry) => {
          const file = storageBucket.file(entry.filePath)
          const [metadata] = await file.getMetadata()
          if (Number(metadata.size) > MAX_PDF_BYTES) throw new Error('Source PDF exceeds 20 MB.')
          const bytes = (await file.download())[0]
          return entry.extension && entry.extension !== 'pdf' ? imageToPdf(bytes) : bytes
        },
      )
      const path = `sds-books/${ref.id}/${lease}.pdf`
      await storageBucket.file(path).save(book.bytes, {
        resumable: false,
        contentType: 'application/pdf',
        metadata: { cacheControl: 'private, max-age=0' },
      })
      await db.runTransaction(async (tx) => {
        if ((await tx.get(ref)).data()?.lease !== lease) return
        tx.update(ref, {
          status: 'complete',
          filePath: path,
          manifest: book.manifest,
          pageCount: book.pageCount,
          completedAt: new Date().toISOString(),
        })
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 500) : 'The book could not be generated.'
      await db.runTransaction(async (tx) => {
        if ((await tx.get(ref)).data()?.lease === lease)
          tx.update(ref, { status: 'failed', error: message })
      })
    }
  },
)
