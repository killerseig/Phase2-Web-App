const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const {
  validateImportIndex,
  checkImportBytes,
  importPath,
  SDS_MASTER_CAPACITY,
} = require('../sdsIntake')
const bytes = Buffer.from('%PDF-test-only')
const hash = createHash('sha256').update(bytes).digest('hex')
const row = (path = 'folder/source.pdf') => ({
  path,
  size: bytes.length,
  sha256: hash,
  name: 'Product',
  manufacturer: 'Maker',
  productCode: '',
  revisionDate: '',
  language: 'English',
  provenance: 'Original index',
})
test('supports more than 5,000 validated records while retaining duplicate byte evidence', () => {
  const result = validateImportIndex({
    version: 1,
    files: Array.from({ length: 6001 }, (_, i) => row(`folder/${i}.pdf`)),
  })
  assert.equal(result.length, 6001)
  assert.equal(SDS_MASTER_CAPACITY, 10000)
  assert.equal(result[6000].sha256, hash)
})
test('rejects traversal, absolute, ambiguous and duplicate source paths', () => {
  for (const path of ['../x.pdf', '/x.pdf', 'C:\\x.pdf', 'a//x.pdf', './x.pdf'])
    assert.throws(() => importPath(path))
  assert.equal(importPath('folder\\x.pdf'), 'folder/x.pdf')
  assert.throws(() => validateImportIndex({ version: 1, files: [row('A.pdf'), row('a.pdf')] }))
})
test('rejects unsupported versions, invalid revision dates, hashes and quotas', () => {
  assert.throws(() => validateImportIndex({ version: 2, files: [row()] }))
  for (const change of [
    { revisionDate: '2026-02-30' },
    { sha256: 'no' },
    { size: 0 },
    { size: 21 * 1024 * 1024 },
    { path: 'x.csv' },
  ])
    assert.throws(() => validateImportIndex({ version: 1, files: [{ ...row(), ...change }] }))
})
test('exact uploaded byte count and hash are required when supplied; legacy upload remains compatible', () => {
  checkImportBytes(bytes, hash, bytes.length, hash.toUpperCase())
  checkImportBytes(bytes, hash, undefined, undefined)
  assert.throws(() => checkImportBytes(bytes, hash, bytes.length + 1, hash))
  assert.throws(() => checkImportBytes(bytes, hash, bytes.length, '0'.repeat(64)))
})
