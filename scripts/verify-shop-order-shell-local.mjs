import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
const root = resolve('dist')
let publicRoot = false
const server = createServer((req, res) => {
  try {
    const route = new URL(req.url, 'http://localhost').pathname
    if (route === '/' && publicRoot) { res.end('<div id="app" data-public-prerender>Generated public HTML</div>'); return }
    const file = resolve(root, route === '/' ? 'employee-app.html' : '.' + route)
    assert(file.startsWith(root + '/'.replace('/', process.platform === 'win32' ? '\\' : '/')))
    res.end(readFileSync(file))
  } catch { res.writeHead(404); res.end() }
}).listen(0, '127.0.0.1')
await new Promise(resolve => server.once('listening', resolve))
const url = `http://127.0.0.1:${server.address().port}/`
try {
  for (const layout of ['legacy private root', 'generated public root']) {
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['scripts/verify-shop-order-layout-live.mjs', url], { stdio: 'inherit', windowsHide: true })
      child.on('error', reject); child.on('exit', resolve)
    })
    assert.equal(code, 0, layout + ' retains Shop Orders CSS/hash verification')
    publicRoot = true
  }
} finally { await new Promise(resolve => server.close(resolve)) }
