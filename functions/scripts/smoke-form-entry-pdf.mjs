// Synthetic local data only: replace runtime before importing the compiled viewer helpers.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'
const backend = createRequire(import.meta.url)
let activeRecord, source, active = 0, peak = 0
const runtimePath = backend.resolve('../lib/runtime.js')
backend.cache[runtimePath] = { id: runtimePath, filename: runtimePath, loaded: true, exports: {
  db: { doc: path => ({ get: async () => ({ data: () => ({ recordId: activeRecord.id, ownerUid: activeRecord.ownerUid, path: 'form-photos/' + activeRecord.id + '/' + path.split('/').pop() + '.webp' }) }) }) },
  storageBucket: { file: () => ({ getMetadata: async () => [{ size: source.length }], download: async () => { active++; peak = Math.max(peak, active); await Promise.resolve(); active--; return [source] } }) },
} }
const { entryPdfPhotos } = backend('../lib/formEntryPhotos.js')
const { buildFormSubmissionPdf } = backend('../lib/formSubmissionPdf.js')
async function main() {
  source = await sharp({ create: { width: 1536, height: 2048, channels: 3, background: '#305d85' } }).webp().toBuffer()
  for (const count of [4, 20]) {
    activeRecord = { id: 'synthetic-entry', ownerUid: 'synthetic-owner', templateId: 'synthetic-form', templateVersion: 1, revision: 1, status: 'submitted', createdAt: 1, updatedAt: 1,
      definition: { title: 'Synthetic photo inspection', description: 'Isolated PDF memory regression', version: 1, createdAt: '', recipients: [], fields: [{ id: 'photos', kind: 'photo', label: 'Photos', required: false, options: [] }] },
      answers: { photos: Array.from({ length: count }, (_, i) => 'photo-' + i) } }
    const before = JSON.stringify(activeRecord), started = performance.now()
    const photos = await entryPdfPhotos(activeRecord), bytes = await buildFormSubmissionPdf(activeRecord, photos), pdf = await PDFDocument.load(bytes)
    assert.equal(photos.length, count); assert.equal(peak, 1); assert.equal(JSON.stringify(activeRecord), before)
    assert.equal((bytes.toString('latin1').match(/\/Subtype \/Image/g) || []).length, count)
    assert(pdf.getPageCount() > 1)
    console.log(JSON.stringify({ synthetic: true, photos: count, pages: pdf.getPageCount(), bytes: bytes.length, elapsedMs: Math.round(performance.now() - started), peakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024), entryUnchanged: true, realMail: false }))
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
