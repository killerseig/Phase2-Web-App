import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

// Read public assets only. No authentication, production records or writes.
const base = new URL(process.argv[2] || 'https://phase2-website.web.app/')
assert(!base.username && !base.password, 'Use a public URL without credentials.')
assert(base.protocol === 'https:' || (base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname)), 'Use HTTPS or local HTTP.')

async function readPublicAsset(path) {
  const url = new URL(path, base)
  assert.equal(url.origin, base.origin, 'Assets must stay on the requested site.')
  const response = await fetch(url, {
    method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store',
    headers: { Accept: path === '/' ? 'text/html' : '*/*' },
    signal: AbortSignal.timeout(15000),
  })
  assert(response.ok, `${url.pathname}: HTTP ${response.status}`)
  return { url, text: await response.text() }
}

let html = await readPublicAsset('/')
// The public HTML release gives the employee app an explicit static shell.
// Retain the same Shop Orders CSS/hash checks for both Hosting layouts.
if (html.text.includes('data-public-prerender')) html = await readPublicAsset('/employee-app.html')
const entries = [...html.text.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)]
  .map(match => match[1])
  .filter(path => /\/assets\/index-[\w-]+\.js$/.test(path))
assert.equal(entries.length, 1, 'Expected one production application entry bundle.')
const entry = await readPublicAsset(entries[0])
const styles = [...new Set(entry.text.match(/assets\/ShopOrdersView-[\w-]+\.css/g))]
assert.equal(styles.length, 1, 'Expected one Shop Orders stylesheet in the entry bundle.')
const css = await readPublicAsset(`/${styles[0]}`)
assert(/container\s*:\s*shop-order-catalog\s*\/\s*inline-size/.test(css.text), 'Missing catalog pane size container: the old sizing regression is live.')
assert(/@container\s+shop-order-catalog\s*\(\s*(?:max-width\s*:\s*28rem|width\s*<=\s*28rem)\s*\)/.test(css.text), 'Missing compact catalog layout query.')
const expected = await readFile(new URL(`../dist/${styles[0]}`, import.meta.url), 'utf8')
const sha256 = text => createHash('sha256').update(text).digest('hex')
const deliveredHash = sha256(css.text)
assert.equal(deliveredHash, sha256(expected), 'Delivered Shop Orders CSS does not match this checkout’s build.')
console.log(JSON.stringify({
  site: base.origin,
  entry: entry.url.href,
  stylesheet: css.url.href,
  sha256: deliveredHash,
  catalogContainer: true,
  compactLayoutQuery: true,
  matchesLocalBuild: true,
}, null, 2))
