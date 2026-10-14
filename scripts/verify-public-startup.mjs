import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
const graph = JSON.parse(readFileSync('.forms-local-data/public-build-graph.json','utf8'))
const byName = new Map(graph.map(chunk => [chunk.file, chunk]))
const entry = graph.find(chunk => chunk.entry && chunk.modules.some(name => name.replaceAll('\\','/').endsWith('/src/publicMain.ts')))
assert(entry, 'Public entry exists')
const visited = new Set()
function walk(name) { if (visited.has(name)) return; visited.add(name); for (const dependency of byName.get(name)?.imports || []) walk(dependency) }
walk(entry.file)
const modules = [...visited].flatMap(name => byName.get(name)?.modules || []).map(name => name.replaceAll('\\','/'))
const forbidden = modules.filter(name => /\/src\/(?:stores\/|auth\/|layouts\/AppShell|features\/(?:forms|dailyLogs|shopOrders|timecards|users)\/|features\/website\/useTextBox\.ts|components\/website\/(?:WebsiteInlineEditor|WebsiteSelectionHandles|WebsiteAlignmentGuides)\.vue|firebase\.ts)/.test(name) || /node_modules\/(?:firebase|@firebase|primevue|@tiptap)\//.test(name))
assert.deepEqual(forbidden, [], 'Public startup must not import app stores/auth/Firebase/business modules or editor dependencies')
const result = { entry: entry.file, initialChunks: [...visited], moduleCount: modules.length, privateModules: forbidden, dynamicChunks: graph.filter(chunk => !visited.has(chunk.file)).map(chunk => chunk.file) }
writeFileSync('.forms-local-data/public-startup-audit.json', JSON.stringify(result,null,2))
console.log(JSON.stringify(result,null,2))
