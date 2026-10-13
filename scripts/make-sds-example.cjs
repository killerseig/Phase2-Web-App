const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto')
const requireFunctions = require('node:module').createRequire(path.resolve('functions/package.json'))
const { PDFDocument, StandardFonts } = requireFunctions('pdf-lib')
const { zipSync, strToU8 } = require('fflate')
const { validateImportIndex, checkImportBytes } = require('../functions/sdsIntake')
const { validateDocument } = require('../functions/documentFormats')
async function main() {
  const destination = path.resolve('deliverables/sds-intake-example')
  fs.mkdirSync(destination, { recursive: true })
  const schema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Phase 2 SDS bulk import index version 1',
    type: 'object', required: ['version', 'files'], additionalProperties: false,
    properties: {
      version: { const: 1 },
      files: { type: 'array', minItems: 1, maxItems: 10000, items: { type: 'object', required: ['path', 'size', 'sha256', 'name', 'language'], additionalProperties: false,
        properties: {
          path: { type: 'string', minLength: 1, maxLength: 1000, pattern: '^(?![/\\\\])(?!.*(?:^|[/\\\\])\\.\\.?(?:[/\\\\]|$))(?!.*[/\\\\]{2})(?!.*[:\\u0000-\\u001f]).+\\.[pP][dD][fF]$', description: 'Relative file path. Folder picker includes the selected folder name; individual picker uses the filename. Paths must be unique ignoring case.' },
          size: { type: 'integer', minimum: 1, maximum: 20971520, description: 'Exact PDF byte length.' },
          sha256: { type: 'string', pattern: '^[a-fA-F0-9]{64}$', description: 'SHA-256 of the exact PDF bytes.' },
          name: { type: 'string', minLength: 1, maxLength: 160, pattern: '\\S' },
          language: { type: 'string', minLength: 1, maxLength: 40, pattern: '\\S' },
          manufacturer: { type: 'string', maxLength: 160 },
          productCode: { type: 'string', maxLength: 100 },
          revisionDate: { anyOf: [{ const: '' }, { type: 'string', format: 'date', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }], description: 'Actual revision evidence, not upload date. Empty if unverified.' },
          provenance: { type: 'string', maxLength: 1000 },
        } } },
    },
  }
  const pdf = await PDFDocument.create(), page = pdf.addPage([612, 792]), font = await pdf.embedFont(StandardFonts.Helvetica)
  pdf.setTitle('Synthetic SDS import validation fixture - not an SDS')
  pdf.setCreationDate(new Date('2026-10-13T00:00:00Z'))
  pdf.setModificationDate(new Date('2026-10-13T00:00:00Z'))
  const lines = ['SYNTHETIC IMPORT FIXTURE', 'NOT A SAFETY DATA SHEET', '', 'Harmless sample for file size and SHA-256 validation.', 'No real chemical, manufacturer or safety guidance is represented.', 'Do not use as an approved or current SDS.']
  lines.forEach((text, index) => page.drawText(text, { x: 48, y: 720 - index * 26, size: index < 2 ? 18 : 12, font }))
  const bytes = Buffer.from(await pdf.save()), hash = crypto.createHash('sha256').update(bytes).digest('hex')
  const index = { version: 1, files: [{ path: 'synthetic-sds.pdf', size: bytes.length, sha256: hash, name: 'Synthetic import fixture - not an SDS', manufacturer: 'Synthetic Test Manufacturer', productCode: 'SYNTHETIC-ONLY', language: 'English', revisionDate: '', provenance: 'Generated harmless validation fixture. Not approved safety content; currency unverified.' }] }
  validateImportIndex(index); checkImportBytes(bytes, hash, index.files[0].size, index.files[0].sha256); await validateDocument(bytes, 'pdf')
  const instructions = `Phase 2 SDS index example\n\nThis PDF is synthetic and is not an SDS. Nothing is uploaded automatically.\n\n1. Keep example-index.json and synthetic-sds.pdf together. Select the PDF as an individual file so its relative path is synthetic-sds.pdf. Folder selection instead includes the selected folder's name and requires matching index paths.\n2. Verify SHA-256 and byte size before preflight. On Windows: Get-FileHash -Algorithm SHA256 -LiteralPath .\\synthetic-sds.pdf; (Get-Item -LiteralPath .\\synthetic-sds.pdf).Length\n3. The expected size is ${bytes.length} bytes; SHA-256 is ${hash}.\n4. Admin opens Bulk PDF import, chooses an approved destination folder, selects the index and matching PDFs, and validates the preview before explicitly starting. Do not import this sample into the approved SDS library.\n5. Use index-schema.json as a strict reference schema. JSON Schema cannot prove file hashes, case-insensitive path uniqueness or complete selection matching; the application/server validator must perform those checks. Name/language must remain nonblank after trimming; revision dates must be actual calendar dates.\n6. Only nonempty readable unencrypted PDFs up to 20 MB and 500 pages are accepted by this bulk importer, with at most 10,000 index rows. Missing/orphan files and duplicate paths are rejected. Source paths do not create destination folders.\n7. Do not infer currency from upload date or hash. Leave revisionDate empty unless supported by evidence, and retain provenance. Imported currency remains unverified.\n\nThis pack contains no real SDS, personal data, credentials or application source bundle.\n`
  const files = { 'index-schema.json': strToU8(JSON.stringify(schema, null, 2) + '\n'), 'example-index.json': strToU8(JSON.stringify(index, null, 2) + '\n'), 'synthetic-sds.pdf': new Uint8Array(bytes), 'VALIDATION.txt': strToU8(instructions) }
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(destination, name), content)
  const archive = path.resolve('deliverables/Phase2-SDS-Import-Example.zip')
  fs.writeFileSync(archive, zipSync(files, { level: 6 }))
  console.log(JSON.stringify({ destination, archive, pdfBytes: bytes.length, pdfSha256: hash, realFilesUploaded: false, serverValidationPassed: true }))
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
