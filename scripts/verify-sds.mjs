import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth'
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  getDoc,
  setDoc,
  terminate,
} from 'firebase/firestore'
import { getStorage, connectStorageEmulator, ref, uploadBytes, getBytes } from 'firebase/storage'

const projectId = 'demo-phase2-security'
for (const key of [
  'FIRESTORE_EMULATOR_HOST',
  'FIREBASE_AUTH_EMULATOR_HOST',
  'FIREBASE_STORAGE_EMULATOR_HOST',
]) {
  assert.match(
    process.env[key] || '',
    /^(127\.0\.0\.1|localhost):\d+$/,
    `${key} must point to a local emulator`,
  )
}
process.env.GCLOUD_PROJECT = projectId
const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { initializeApp: initializeAdmin } = require('firebase-admin/app')
const { getFirestore: getAdminFirestore, Timestamp } = require('firebase-admin/firestore')
const { getStorage: getAdminStorage } = require('firebase-admin/storage')
const { PDFDocument, PDFName, PDFArray } = require('pdf-lib')
const { createHash } = require('node:crypto')
initializeAdmin({ projectId, storageBucket: `${projectId}.appspot.com` })
const db = getAdminFirestore()
const bucket = getAdminStorage().bucket()
const { sdsWorkspace, generateSdsBook, downloadSdsFile } = require('../functions/sdsFunctions.js')
const { buildSdsBook } = require('../functions/sdsBook.js')
const clients = []
let checks = 0
let server
const call = (actor, action, data = {}) =>
  sdsWorkspace.run({ auth: actor ? { uid: actor.uid } : undefined, data: { ...data, action } })
async function denied(label, operation, code = /permission-denied|unauthenticated|unauthorized/) {
  await assert.rejects(operation, (error) => {
    assert.match(error.code || '', code, `${label}: ${error}`)
    return true
  })
  checks++
}
async function client(role, jobs = [], active = true) {
  const app = initializeApp(
    { projectId, apiKey: 'test-key', storageBucket: `${projectId}.appspot.com` },
    `sds-${clients.length}`,
  )
  const auth = getAuth(app)
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, {
    disableWarnings: true,
  })
  const firestore = getFirestore(app)
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':')
  connectFirestoreEmulator(firestore, host, Number(port))
  const storage = getStorage(app)
  const [storageHost, storagePort] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':')
  connectStorageEmulator(storage, storageHost, Number(storagePort))
  const { user } = await signInAnonymously(auth)
  if (role) await db.doc(`users/${user.uid}`).set({ role, active, assignedJobIds: jobs })
  const actor = { app, firestore, storage, uid: user.uid }
  clients.push(actor)
  return actor
}

try {
  const admin = await client('admin')
  const foreman = await client('foreman', ['sds-job'])
  const payroll = await client('payroll')
  const shop = await client('shop-foreman')
  const pm = await client('project-manager', ['sds-job'])
  const outsider = await client('foreman', ['elsewhere'])
  const assignedOnJob = await client('foreman')
  const inactive = await client('admin', [], false)
  const anonymous = await client(null)
  const job = {
    name: 'SDS test job',
    code: '812',
    active: true,
    assignedForemanIds: [assignedOnJob.uid],
  }
  await db.doc('jobs/sds-job').set(job)
  await db.doc('jobs/elsewhere').set({ name: 'Other', assignedForemanIds: [] })
  await denied('Unauthenticated library', () => call(null, 'load'))
  await denied('Profile-less library', () => call(anonymous, 'load'))
  await denied('Inactive library', () => call(inactive, 'load'))
  await denied('Non-admin master edit', () =>
    call(foreman, 'saveFolder', { name: 'Forged', order: 0, version: 0 }),
  )
  const initial = await call(admin, 'load')
  assert.equal(initial.version, 0)
  await call(admin, 'saveFolder', {
    id: 'folder-a',
    name: 'Adhesives',
    order: 1,
    parentId: '',
    version: 0,
  })
  await call(admin, 'saveFolder', {
    id: 'folder-b',
    name: 'Interior',
    order: 1,
    parentId: 'folder-a',
    version: 1,
  })
  await denied(
    'Folder cycle',
    () =>
      call(admin, 'saveFolder', {
        id: 'folder-a',
        name: 'Adhesives',
        order: 1,
        parentId: 'folder-b',
        version: 2,
      }),
    /failed-precondition/,
  )
  await denied(
    'Duplicate sibling name',
    () => call(admin, 'saveFolder', { name: 'Adhesives', order: 2, parentId: '', version: 2 }),
    /already-exists/,
  )
  await denied(
    'Concurrent master change',
    () => call(admin, 'saveFolder', { name: 'Stale', order: 1, version: 0 }),
    /aborted/,
  )
  const source = await PDFDocument.create()
  source.addPage([612, 792])
  source.addPage([792, 612])
  const pdf = await source.save()
  const stage = async (actor, id, bytes = pdf, contentType = 'application/pdf') =>
    uploadBytes(ref(actor.storage, `sds-uploads/${actor.uid}/${id}.pdf`), bytes, { contentType })
  await denied('Non-admin upload', () => stage(foreman, 'fake'))
  await denied('Inactive Admin upload', () => stage(inactive, 'fake'))
  await denied('Wrong upload type', () => stage(admin, 'fake', pdf, 'text/html'))
  await stage(admin, 'pdf-a')
  await denied('Upload overwrite', () => stage(admin, 'pdf-a'))
  const input = {
    id: 'sheet-a',
    name: 'Adhésif A',
    manufacturer: 'Manufacturer A',
    productCode: 'A-01',
    language: 'English',
    revisionDate: '2026-09-01',
    folderId: 'folder-b',
    order: 1,
    version: 2,
    uploadId: 'pdf-a',
  }
  await call(admin, 'saveSheet', input)
  const state = await call(foreman, 'load', { jobId: 'sds-job' })
  const firstRevision = state.sheets[0].revisionId
  await stage(admin, 'pdf-b')
  await call(admin, 'saveSheet', {
    ...input,
    id: 'sheet-b',
    name: 'Adhesive B',
    version: 3,
    uploadId: 'pdf-b',
    order: 2,
  })
  const selection = [{ documentId: 'sheet-a', revisionId: firstRevision }]
  let binderVersion = 0
  for (const actor of [foreman, payroll, shop, pm, assignedOnJob]) {
    await call(actor, 'saveSelection', {
      jobId: 'sds-job',
      selections: selection,
      version: binderVersion++,
    })
    checks++
  }
  await denied('Cross-job selection', () =>
    call(outsider, 'saveSelection', { jobId: 'sds-job', selections: [], version: binderVersion }),
  )
  await denied(
    'Stale selection',
    () => call(foreman, 'saveSelection', { jobId: 'sds-job', selections: [], version: 0 }),
    /aborted/,
  )
  await denied(
    'Invented revision',
    () =>
      call(foreman, 'saveSelection', {
        jobId: 'sds-job',
        selections: [{ documentId: 'sheet-b', revisionId: 'fake' }],
        version: binderVersion,
      }),
    /failed-precondition/,
  )
  await denied(
    'Duplicate selection',
    () =>
      call(foreman, 'saveSelection', {
        jobId: 'sds-job',
        selections: [...selection, ...selection],
        version: binderVersion,
      }),
    /invalid-argument/,
  )
  for (const actor of [admin, foreman, outsider, inactive]) {
    for (const collection of [
      'sdsDocuments',
      'sdsFolders',
      'sdsBinders',
      'sdsExports',
      'sdsDownloads',
    ]) {
      await denied('Direct SDS mutation', () =>
        setDoc(doc(actor.firestore, collection, 'forged'), { role: 'admin' }),
      )
      await denied('Direct SDS read', () => getDoc(doc(actor.firestore, collection, 'forged')))
    }
  }
  const storedRevision = (
    await db.doc(`sdsDocuments/sheet-a/revisions/${firstRevision}`).get()
  ).data()
  await denied('Direct published PDF access', () =>
    getBytes(ref(foreman.storage, storedRevision.filePath)),
  )
  const before = (await db.doc('jobs/sds-job').get()).data()
  await call(payroll, 'requestExport', {
    jobId: 'sds-job',
    requestId: 'export-a',
    version: binderVersion,
  })
  await call(payroll, 'requestExport', {
    jobId: 'sds-job',
    requestId: 'export-a',
    version: binderVersion,
  })
  await denied('Other user export ID', () =>
    call(admin, 'requestExport', {
      jobId: 'sds-job',
      requestId: 'export-a',
      version: binderVersion,
    }),
  )
  await denied(
    'Second simultaneous book',
    () =>
      call(payroll, 'requestExport', {
        jobId: 'sds-job',
        requestId: 'export-overlap',
        version: binderVersion,
      }),
    /resource-exhausted/,
  )
  assert.equal(
    (await call(payroll, 'load', { jobId: 'sds-job' })).exportId,
    'export-a',
    'Returning to a job must resume its latest export',
  )
  await stage(admin, 'pdf-new')
  await call(admin, 'saveSheet', {
    ...input,
    name: 'Renamed after snapshot',
    version: 4,
    uploadId: 'pdf-new',
    revisionDate: '2026-09-14',
  })
  await call(admin, 'saveFolder', {
    id: 'folder-b',
    name: 'Renamed folder',
    parentId: 'folder-a',
    order: 1,
    version: 5,
  })
  const savedBinder = await call(foreman, 'load', { jobId: 'sds-job' })
  assert.equal(
    savedBinder.binder.selections[0].revisionId,
    firstRevision,
    'New revision must not silently replace saved revision',
  )
  const exportSnapshot = await db.doc('sdsExports/export-a').get()
  assert.equal(exportSnapshot.data().entries.length, 1, 'Unchecked sheet must be excluded')
  assert.equal(exportSnapshot.data().entries[0].title, 'Adhésif A', 'Title must be captured')
  assert.deepEqual(exportSnapshot.data().entries[0].folders, ['Adhesives', 'Interior'])
  await generateSdsBook.run({ data: exportSnapshot, params: { exportId: 'export-a' } })
  const result = (await db.doc('sdsExports/export-a').get()).data()
  assert.equal(result.status, 'complete', result.error)
  assert.equal(result.manifest[0].revisionId, firstRevision)
  const [output] = await bucket.file(result.filePath).download()
  const rendered = await PDFDocument.load(output)
  assert.equal(rendered.getPageCount(), 4)
  assert.deepEqual(rendered.getPage(2).getSize(), { width: 612, height: 792 })
  assert.deepEqual(rendered.getPage(3).getSize(), { width: 792, height: 612 })
  assert.ok(rendered.catalog.get(PDFName.of('Outlines')), 'Bookmarks must exist')
  const annotations = rendered.getPage(1).node.Annots()
  assert.ok(annotations instanceof PDFArray)
  const link = rendered.context.lookup(annotations.get(0))
  assert.equal(
    link.get(PDFName.of('Dest')).get(0).toString(),
    rendered.getPage(2).ref.toString(),
    'TOC link must target first original sheet page',
  )
  await generateSdsBook.run({ data: exportSnapshot, params: { exportId: 'export-a' } })
  assert.equal(
    (await db.doc('sdsExports/export-a').get()).data().filePath,
    result.filePath,
    'Redelivery must not regenerate completed export',
  )
  assert.deepEqual(
    (await db.doc('jobs/sds-job').get()).data(),
    before,
    'SDS must not mutate the existing job',
  )
  await denied('Another user export download', () =>
    call(foreman, 'exportStatus', { id: 'export-a', link: true }),
  )
  const bookLink = await call(payroll, 'exportStatus', { id: 'export-a', link: true })
  assert.match(bookLink.url, /downloadSdsFile\?ticket=/)
  // Exercise the actual HTTP file handler on a local server, with emulator data.
  server = createServer((req, res) => {
    req.query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams)
    res.set = (name, value) => {
      res.setHeader(name, value)
      return res
    }
    res.status = (status) => {
      res.statusCode = status
      return res
    }
    res.send = (body) => {
      res.end(body)
      return res
    }
    void downloadSdsFile(req, res)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const localUrl = `http://127.0.0.1:${server.address().port}/?${new URL(bookLink.url).searchParams}`
  const download = await fetch(localUrl)
  assert.equal(download.status, 200)
  assert.equal(download.headers.get('content-type'), 'application/pdf')
  assert.equal((await download.arrayBuffer()).byteLength, output.length)
  await db.doc(`users/${payroll.uid}`).update({ active: false })
  assert.equal(
    (await fetch(localUrl)).status,
    403,
    'Issued links must stop working after revocation',
  )
  await db.doc(`users/${payroll.uid}`).update({ active: true })
  const ticket = new URL(bookLink.url).searchParams.get('ticket')
  await db
    .doc(`sdsDownloads/${createHash('sha256').update(ticket).digest('hex')}`)
    .update({ expiresAt: Timestamp.fromMillis(Date.now() - 1) })
  assert.equal((await fetch(localUrl)).status, 403, 'Expired ticket must be denied')
  await denied('Cross-job export', () =>
    call(outsider, 'requestExport', {
      requestId: 'forged-export',
      jobId: 'sds-job',
      version: binderVersion,
    }),
  )
  await call(foreman, 'saveSelection', {
    jobId: 'sds-job',
    selections: [],
    version: binderVersion++,
  })
  await denied(
    'Empty binder export',
    () =>
      call(foreman, 'requestExport', {
        jobId: 'sds-job',
        requestId: 'empty-export',
        version: binderVersion,
      }),
    /failed-precondition/,
  )
  await call(admin, 'requestExport', { requestId: 'master-export' })
  assert.equal((await db.doc('sdsExports/master-export').get()).data().entries.length, 2)
  const missing = await db.doc('sdsExports/master-export').get()
  await bucket.file(missing.data().entries[0].filePath).delete()
  await generateSdsBook.run({ data: missing, params: { exportId: 'master-export' } })
  const failed = (await db.doc('sdsExports/master-export').get()).data()
  assert.equal(failed.status, 'failed')
  assert.equal(failed.filePath, undefined)
  await stage(admin, 'bad-pdf', new Uint8Array([1, 2, 3]))
  await denied(
    'Malformed PDF',
    () => call(admin, 'saveSheet', { ...input, id: 'bad', version: 6, uploadId: 'bad-pdf' }),
    /invalid-argument/,
  )
  await denied(
    'Invalid date',
    () => call(admin, 'saveSheet', { ...input, revisionDate: '2026-99-99', uploadId: '' }),
    /invalid-argument/,
  )
  await denied(
    'Folder with contents',
    () => call(admin, 'deleteFolder', { id: 'folder-a', version: 6 }),
    /failed-precondition/,
  )
  await call(admin, 'saveResource', {
    role: 'foreman',
    id: 'guide',
    title: 'Field guide',
    description: 'Shared instructions',
    url: '/safety/sds',
  })
  assert.equal((await call(foreman, 'listResources', { role: 'foreman' })).resources.length, 1)
  await denied('Cross-role resource read', () => call(pm, 'listResources', { role: 'foreman' }))
  await denied('Non-admin resource write', () =>
    call(foreman, 'saveResource', { role: 'foreman', title: 'Forged', description: '', url: '' }),
  )
  await denied(
    'Unsafe resource link',
    () =>
      call(admin, 'saveResource', {
        role: 'foreman',
        title: 'Unsafe',
        description: '',
        url: 'javascript:alert(1)',
      }),
    /invalid-argument/,
  )
  // A contents list long enough to span pages, with Unicode and long titles.
  const many = Array.from({ length: 75 }, (_, i) => ({
    documentId: `doc-${i}`,
    revisionId: `rev-${i}`,
    title: `SDS ${i} – résumé ${'long product name '.repeat(5)}`,
    manufacturer: 'Example',
    revisionDate: '2026-09-14',
    folders: ['Materials', 'Nested'],
    filePath: 'fixture',
  }))
  const large = await buildSdsBook(
    'Pagination check',
    new Date().toISOString(),
    many,
    async () => pdf,
  )
  assert.ok(large.manifest[0].startPage > 3, 'TOC must span multiple pages')
  for (let i = 1; i < many.length; i++)
    assert.equal(large.manifest[i].startPage, large.manifest[i - 1].startPage + 2)
  assert.equal(large.pageCount, large.manifest.at(-1).startPage + 1)
  // Mixed document formats use the same protected revision and download paths.
  const { DOCUMENT_MIME, validateDocument } = require('../functions/documentFormats.js')
  const fixtures = {
    png: 'site.png',
    jpeg: 'site.jpeg',
    webp: 'site.webp',
    txt: 'notes.txt',
    csv: 'materials.csv',
    docx: 'notes.docx',
    xlsx: 'materials.xlsx',
  }
  const revisions = {}
  for (const [extension, filename] of Object.entries(fixtures)) {
    const bytes = readFileSync(new URL(`../e2e/fixtures/${filename}`, import.meta.url))
    const uploadId = `format-${extension}`
    await uploadBytes(
      ref(admin.storage, `sds-uploads/${admin.uid}/${uploadId}.${extension}`),
      bytes,
      { contentType: DOCUMENT_MIME[extension] },
    )
    await call(admin, 'saveSheet', {
      ...input,
      id: uploadId,
      uploadId,
      uploadExtension: extension,
      originalName: filename,
      manufacturer: '',
      folderId: '',
      version: (await call(admin, 'load')).version,
    })
    const entry = (await call(admin, 'load')).sheets.find((file) => file.id === uploadId)
    revisions[extension] = entry.revisionId
    assert.equal(entry.extension, extension)
    const link = await call(foreman, 'openSheet', { id: uploadId, download: true })
    assert.equal(link.extension, extension)
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/?${new URL(link.url).searchParams}`,
    )
    assert.equal(response.headers.get('content-type'), DOCUMENT_MIME[extension])
    assert.ok(response.headers.get('content-disposition').includes(filename))
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes)
    checks++
  }
  for (const extension of ['png', 'docx', 'xlsx']) {
    await denied(
      `Forged ${extension}`,
      () => validateDocument(Buffer.from('<script>bad</script>'), extension),
      /invalid-argument/,
    )
  }
  await denied(
    'Oversized text',
    () => validateDocument(Buffer.alloc(2 * 1024 * 1024 + 1, 65), 'txt'),
    /invalid-argument/,
  )
  const mixedSelections = [
    { documentId: 'format-png', revisionId: revisions.png },
    { documentId: 'format-txt', revisionId: revisions.txt },
  ]
  await call(admin, 'saveSelection', {
    jobId: 'sds-job',
    selections: mixedSelections,
    version: (await call(admin, 'load', { jobId: 'sds-job' })).binder.version,
  })
  const mixedVersion = (await call(admin, 'load', { jobId: 'sds-job' })).binder.version
  // A replacement can change type; the job still opens its pinned image revision.
  const textReplacement = readFileSync(new URL('../e2e/fixtures/notes.txt', import.meta.url))
  await uploadBytes(ref(admin.storage, `sds-uploads/${admin.uid}/image-replacement.txt`), textReplacement, { contentType: 'text/plain' })
  await call(admin, 'saveSheet', { ...input, id: 'format-png', uploadId: 'image-replacement', uploadExtension: 'txt', originalName: 'notes.txt', version: (await call(admin, 'load')).version })
  assert.equal((await call(foreman, 'openSheet', { id: 'format-png', jobId: 'sds-job' })).extension, 'png')
  assert.equal((await call(foreman, 'openSheet', { id: 'format-png' })).extension, 'txt')
  await denied(
    'No silent omission from mixed book',
    () =>
      call(admin, 'requestExport', {
        jobId: 'sds-job',
        requestId: 'mixed-rejected',
        version: mixedVersion,
      }),
    /failed-precondition/,
  )
  await call(admin, 'requestExport', {
    jobId: 'sds-job',
    requestId: 'mixed-images',
    version: mixedVersion,
    printableOnly: true,
  })
  const mixedSnapshot = await db.doc('sdsExports/mixed-images').get()
  assert.equal(mixedSnapshot.data().entries.length, 1)
  assert.equal(mixedSnapshot.data().excludedFiles.length, 1)
  await generateSdsBook.run({ data: mixedSnapshot, params: { exportId: 'mixed-images' } })
  const mixedResult = (await db.doc('sdsExports/mixed-images').get()).data()
  assert.equal(mixedResult.status, 'complete', mixedResult.error)
  assert.equal(mixedResult.manifest[0].pageCount, 1)
  assert.deepEqual((await db.doc('jobs/sds-job').get()).data(), before)
  console.log(
    `SDS verification passed: ${checks} permission/validation cases plus uploads, revisions, snapshots, PDF hierarchy/pagination, download expiry/revocation, and unchanged job records.`,
  )
} finally {
  if (server) await new Promise((resolve) => server.close(resolve))
  await Promise.all(
    clients.map(async (c) => {
      await terminate(c.firestore)
      await deleteApp(c.app)
    }),
  )
}
