// Offline packaging check. Load declarations only; never invoke cloud handlers.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, relative } from 'node:path'
import { createHash } from 'node:crypto'

const root = resolve('functions'), require = createRequire(resolve(root, 'package.json'))
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const config = JSON.parse(readFileSync('firebase.json', 'utf8')).functions
const tsconfig = JSON.parse(readFileSync(resolve(root, 'tsconfig.json'), 'utf8'))
assert.equal(config.source, 'functions')
assert.equal(resolve(root, pkg.main), resolve(root, tsconfig.compilerOptions.outDir, 'index.js'))
process.env.GCLOUD_PROJECT = 'demo-phase2-build-contract'
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: process.env.GCLOUD_PROJECT, storageBucket: process.env.GCLOUD_PROJECT + '.appspot.com' })

const ts = require('typescript')
const source = ts.createSourceFile('index.ts', readFileSync(resolve(root, 'src/index.ts'), 'utf8'), ts.ScriptTarget.Latest)
const declared = source.statements.filter(ts.isExportDeclaration).flatMap(statement => {
  assert(statement.exportClause && ts.isNamedExports(statement.exportClause), 'Keep deployed handler names explicit')
  return statement.exportClause.elements.map(element => element.name.text)
}).sort()
const endpoints = Object.fromEntries(Object.entries(require(root)).map(([name, handler]) => {
  assert(handler.__endpoint, `Missing trigger metadata: ${name}`)
  return [name, handler.__endpoint]
}))
assert.deepEqual(Object.keys(endpoints).sort(), declared)
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value
const digest = createHash('sha256').update(JSON.stringify(stable(endpoints))).digest('hex')
if (process.argv[2]) {
  const before = JSON.parse(readFileSync(process.argv[2], 'utf8'))
  assert.deepEqual(declared, before.names)
  assert.equal(digest, before.digest, 'Trigger/runtime/secret-binding metadata changed')
}

// Use the same file traversal as Firebase packaging, without reading secrets,
// creating an archive, contacting Firebase or uploading anything.
const cli = createRequire(resolve('package.json'))
const { readdirRecursive } = cli('firebase-tools/lib/fsAsync.js')
const files = await readdirRecursive({ path: root, ignoreStrings: config.ignore || ['node_modules', '.git'] })
const packaged = new Set(files.map(file => relative(root, file.name).replaceAll('\\', '/')))
for (const name of [pkg.main, 'assets/SourceSans3-Regular.ttf', 'assets/SourceSans3-Semibold.ttf', 'generated/publicTemplate.html', 'generated/publicWebsiteRenderer.cjs']) {
  assert(packaged.has(name), `Required runtime file excluded from Firebase package: ${name}`)
}

const { PDFDocument } = require('pdf-lib')
const fixture = await PDFDocument.create()
fixture.addPage([612, 792])
const { buildSdsBook } = require('./lib/sdsBook.js')
const book = await buildSdsBook('Synthetic packaging check', '2026-01-01T00:00:00.000Z', [{
  documentId: 'test', revisionId: 'test-v1', title: 'Test sheet', manufacturer: 'Test', revisionDate: '', folders: [], filePath: 'synthetic-only',
}], async () => fixture.save())
assert(book.manifest.length === 1, 'SDS book font/PDF smoke check failed')
const { publicRendererId, generatePublicPages, servePublicHtml } = require('./lib/publicWebsiteSnapshot.js')
const site = { name: 'Synthetic build check', accent: '#174878', pages: [
  { id: 'home', slug: 'home', title: 'Home', description: '', inNavigation: true, sections: [] },
] }
assert.match(publicRendererId(), /^[a-f0-9]{16}$/)
const generated = await generatePublicPages(site, 1)
const first = site.pages[0].slug
assert(generated.pages[first].includes('<'))
assert(servePublicHtml(site, generated.version, first, generated.pages[first]).includes('data-public-prerender'))
console.log(JSON.stringify({ passed: true, handlers: declared.length, metadataSha256: digest, packagedRuntimeFiles: true, sdsPdfAndPublicRenderer: true, cloudCalls: false }))
