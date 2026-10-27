import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstatSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

export const site = 'phase2-website'
const root = `/projects/${site}/sites/${site}`
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

const analyticsOrigins = ['https://www.googletagmanager.com', 'https://www.google-analytics.com', 'https://region1.google-analytics.com']
/** Apply only the owner's approved default-policy additions, including Gen2 ServingConfig shape. */
export function analyticsHostingConfig(config) {
  const next = structuredClone(config)
  const defaults = next.headers?.filter(rule => (rule.source ?? rule.glob) === '**') ?? []
  assert.equal(defaults.length, 1, 'Expected one default Hosting header rule; no policy guessed')
  const headers = defaults[0].headers
  const entries = Array.isArray(headers) ? headers.filter(header => header.key.toLowerCase() === 'content-security-policy') : Object.keys(headers || {}).filter(key => key.toLowerCase() === 'content-security-policy')
  assert.equal(entries.length, 1, 'Expected one existing CSP; no policy guessed')
  const entry = entries[0], policy = Array.isArray(headers) ? entry.value : headers[entry]
  const found = new Set()
  const updated = policy.split(';').map(directive => {
    const [name, ...values] = directive.trim().split(/\s+/)
    assert(name !== 'script-src-elem', 'Specific script element policy requires separate review')
    const additions = name === 'script-src' ? analyticsOrigins.slice(0, 1) : ['img-src', 'connect-src'].includes(name) ? analyticsOrigins : []
    if (!additions.length) return directive
    assert(!found.has(name), 'Ambiguous duplicate CSP directive; no release sent')
    assert(!values.includes("'none'"), 'Refusing to replace a deny-all CSP directive')
    found.add(name)
    const missing = additions.filter(origin => !values.includes(origin))
    return missing.length ? directive.trimEnd() + ' ' + missing.join(' ') : directive
  }).join(';')
  assert.equal(found.size, 3, 'Required CSP directives are absent; no policy guessed')
  if (Array.isArray(headers)) entry.value = updated
  else headers[entry] = updated
  return next
}

/** Select public build output only, never source/configuration/private data from the output root. */
export function publicFiles(directory) {
  const files = new Map(), base = resolve(directory)
  assert(!lstatSync(base).isSymbolicLink(), 'Release directory must not be a symbolic link')
  function add(filename) {
    assert(!lstatSync(filename).isSymbolicLink(), 'Release files must not be symbolic links')
    const name = '/' + relative(base, filename).replaceAll('\\', '/')
    const raw = readFileSync(filename)
    for (const marker of ['synthetic-verification-only', 'demo-phase2-verification', 'demo-phase2-security', 'offline-fixture-only', 'Local review sign-in', 'Intranet - No Documents - Send to CJ'])
      assert(!raw.includes(Buffer.from(marker)), `Local/private marker found in ${name}`)
    files.set(name, { raw, compressed: gzipSync(raw, { level: 9 }) })
  }
  function walk(folder) {
    assert(!lstatSync(folder).isSymbolicLink(), 'Release directory must not be a symbolic link')
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      assert(!entry.isSymbolicLink(), 'Release files must not be symbolic links')
      const filename = resolve(folder, entry.name)
      if (entry.isDirectory()) walk(filename)
      else add(filename)
    }
  }
  for (const name of ['public-boot.js', 'public-style.css', 'website-runtime.html']) add(resolve(base, name))
  walk(resolve(base, 'public-assets'))
  const boot = files.get('/public-boot.js').raw.toString().match(/^\s*import ["'](\/public-assets\/[\w.-]+\.js)["'];?\s*$/)
  assert(boot && files.has(boot[1]), 'Public boot entry is missing from this artifact')
  const runtime = files.get('/website-runtime.html').raw.toString()
  const runtimeScript = runtime.match(/<script[^>]+src="(\/public-assets\/[\w.-]+\.js)"/)
  assert(runtimeScript && files.has(runtimeScript[1]), 'Public iframe entry is missing from this artifact')
  for (const match of runtime.matchAll(/(?:src|href)="(\/public-assets\/[^"?#]+)(?:[?#][^"]*)?"/g))
    assert(files.has(match[1]), 'Public iframe references a missing artifact')
  return files
}

// Remove only the shadowing employee-shell rewrite. Keep the private file handler,
// all public-site rules and every other Hosting setting unchanged.
export function documentPreviewHostingConfig(config) {
  const next = structuredClone(config)
  const source = rule => rule.glob ?? rule.source
  const fileHandler = rule => [rule.function?.functionId, rule.function, rule.run?.serviceId]
    .some(name => typeof name === 'string' && name.toLowerCase() === 'downloadsdsfile')
  assert(next.rewrites?.some(rule => source(rule) === '/sds-file' && fileHandler(rule)), 'Private document handler rewrite is missing; no release sent')
  next.rewrites = next.rewrites.filter(rule => !(source(rule) === '/sds-file' && (rule.path ?? rule.destination) === '/employee-app.html'))
  assert(fileHandler(next.rewrites.find(rule => source(rule) === '/sds-file')), 'Document preview route is still shadowed')
  return next
}

export function employeeFiles(directory) {
  const files = new Map()
  function walk(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const filename = resolve(folder, entry.name)
      assert(!entry.isSymbolicLink(), 'Release files must not be symbolic links')
      if (entry.isDirectory()) walk(filename)
      else {
        const name = '/' + relative(directory, filename).replaceAll('\\', '/')
        assert(name === '/employee-app.html' || name.startsWith('/assets/') || name.startsWith('/sds-pdf-assets/'), `Unexpected employee asset ${name}`)
        const raw = readFileSync(filename)
        for (const marker of ['demo-phase2-security', 'offline-fixture-only', 'localhost:9099', 'Local review sign-in', 'Intranet - No Documents - Send to CJ']) {
          assert(!raw.includes(Buffer.from(marker)), `Local/private marker found in ${name}`)
        }
        files.set(name, { raw, compressed: gzipSync(raw, { level: 9 }) })
      }
    }
  }
  walk(resolve(directory))
  assert(files.has('/employee-app.html'), 'Employee shell is missing')
  assert.match(files.get('/employee-app.html').raw.toString(), /src="\/assets\/index-[\w-]+\.js"/)
  assert([...files.keys()].some(name => /\/ShopOrdersView-[\w-]+\.css$/.test(name)), 'Shop Orders stylesheet is missing')
  return files
}

// api is deliberately injectable: release failure/race paths use synthetic APIs in tests.
async function deployHosting({ api, files, commit, artifactSourceCommit = commit, record = () => {}, assertCurrentMain = async () => {}, combined = false }) {
  assert.match(commit, /^[a-f0-9]{40}$/)
  assert.match(artifactSourceCommit, /^[a-f0-9]{40}$/)
  const channelPath = `${root}/channels/live`
  const channel = await api('GET', channelPath)
  const previous = channel.release?.version?.name
  assert(previous?.startsWith(`${root.slice(1)}/versions/`), 'Unexpected live site/version')
  const versionBefore = await api('GET', '/' + previous)
  assert.equal(versionBefore.status, 'FINALIZED')
  assert(versionBefore.config?.rewrites?.some(rule => [rule.function?.functionId, rule.function, rule.run?.serviceId].some(name => typeof name === 'string' && name.toLowerCase() === 'getpublishedwebsite')), 'Existing public renderer rewrite is missing')
  // The combined path preserves live rewrites verbatim and changes only approved CSP origins.
  const releaseConfig = combined ? analyticsHostingConfig(versionBefore.config) : documentPreviewHostingConfig(versionBefore.config)
  if (combined) assert.deepEqual(documentPreviewHostingConfig(versionBefore.config).rewrites, versionBefore.config.rewrites, 'Private file routing needs separate review')
  async function inventory(version) {
    const result = {}
    let pageToken
    do {
      const page = await api('GET', '/' + version + '/files', undefined, { pageSize: 1000, ...(pageToken ? { pageToken } : {}) })
      for (const file of page.files || []) result[file.path] = file.hash
      pageToken = page.nextPageToken
    } while (pageToken)
    return result
  }
  const before = await inventory(previous)
  assert(Object.keys(before).length > 0, 'Empty live file inventory')
  const merged = { ...before }, uploads = new Map(), manifest = []
  for (const [name, file] of files) {
    const hash = sha256(file.compressed)
    // Hashed shared assets must never silently overwrite the public renderer's graph.
    if ((name.startsWith('/assets/') || name.startsWith('/public-assets/')) && before[name]) assert.equal(hash, before[name], `Existing asset collision: ${name}`)
    merged[name] = hash
    uploads.set(hash, file.compressed)
    manifest.push({ path: name, hash, sha256: sha256(file.raw) })
  }
  const receipt = { commit, artifactSourceCommit, project: site, site, previousVersion: previous, previousRelease: channel.release.name, manifest, hostingConfigUnchanged: JSON.stringify(releaseConfig) === JSON.stringify(versionBefore.config), documentPreviewRoutingRepaired: !combined, publicAssetsPreserved: !combined, publicAssetsUpdated: combined, analyticsCspApplied: combined }
  record({ ...receipt, state: 'PREPARED' })
  if (versionBefore.labels?.['phase2-commit'] === commit) {
    assert.deepEqual(versionBefore.config, releaseConfig, 'Same commit has different intended policy; investigate before retrying')
    for (const [name, hash] of Object.entries(merged)) assert.equal(before[name], hash, 'Same commit has different build bytes; investigate before retrying')
    record({ ...receipt, version: previous, state: 'ALREADY_RELEASED' })
    return { ...receipt, version: previous, state: 'ALREADY_RELEASED' }
  }
  await assertCurrentMain()
  const version = (await api('POST', `${root}/versions`, { config: releaseConfig, labels: { 'phase2-commit': commit, 'deployment-tool': combined ? 'reviewed-combined-release' : 'github-actions' } })).name
  assert(version?.startsWith(`${root.slice(1)}/versions/`), 'Unexpected staged version')
  record({ ...receipt, version, state: 'CREATED' })
  const pairs = Object.entries(merged)
  for (let offset = 0; offset < pairs.length; offset += 900) {
    const population = await api('POST', '/' + version + ':populateFiles', { files: Object.fromEntries(pairs.slice(offset, offset + 900)) })
    const url = new URL(population.uploadUrl)
    assert.equal(url.origin, 'https://upload-firebasehosting.googleapis.com')
    assert.equal(url.pathname, `/upload/sites/${site}/versions/${version.split('/').at(-1)}/files`)
    for (const hash of population.uploadRequiredHashes || []) {
      assert(uploads.has(hash), 'Server requested a preserved live file; stop before release')
      await api('UPLOAD', population.uploadUrl + '/' + hash, uploads.get(hash))
    }
  }
  await api('PATCH', '/' + version, { status: 'FINALIZED' }, { updateMask: 'status' })
  const staged = await api('GET', '/' + version)
  assert.equal(staged.status, 'FINALIZED')
  assert.deepEqual(staged.config, releaseConfig, 'Hosting config differs from the reviewed document-route correction')
  assert.deepEqual(await inventory(version), merged, 'Staged file inventory differs')
  assert.equal((await api('GET', channelPath)).release.version.name, previous, 'Live changed during preparation; no release sent')
  await assertCurrentMain()
  record({ ...receipt, version, state: 'FINALIZED' })
  const release = await api('POST', `${channelPath}/releases`, { message: combined ? `Public and employee frontend ${commit}; approved analytics CSP; backend preserved` : `Employee frontend ${commit}; public assets and backend preserved` }, { versionName: version })
  assert.equal((await api('GET', channelPath)).release.version.name, version, 'Release sent but live confirmation differs; inspect before retrying')
  const result = { ...receipt, version, release: release.name, state: 'RELEASED', url: 'https://phase2-website.web.app/login' }
  record(result)
  return result
}

export const deployEmployeeHosting = options => deployHosting(options)
export function deployCombinedHosting(options) {
  const files = new Map(options.employee)
  for (const name of files.keys()) {
    assert(name === '/employee-app.html' || name.startsWith('/assets/') || name.startsWith('/sds-pdf-assets/'), 'Unexpected employee release path')
    assert(!name.split('/').some(part => part === '..' || part === '.') && !/[\\?#%]/.test(name), 'Unsafe employee release path')
  }
  for (const [name, value] of options.public) {
    assert(['/public-boot.js', '/public-style.css', '/website-runtime.html'].includes(name) || name.startsWith('/public-assets/'), 'Unexpected public release path')
    assert(!name.split('/').some(part => part === '..' || part === '.') && !/[\\?#%]/.test(name), 'Unsafe public release path')
    assert(!files.has(name), 'Ambiguous public/employee release path')
    files.set(name, value)
  }
  for (const name of ['/employee-app.html', '/public-boot.js', '/public-style.css', '/website-runtime.html']) assert(files.has(name), 'Combined release artifact is incomplete')
  return deployHosting({ ...options, files, combined: true })
}

async function main() {
  assert.equal(process.env.GITHUB_REPOSITORY, 'killerseig/Phase2-Web-App')
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main', 'Only main may deploy')
  assert.equal(process.env.GITHUB_EVENT_NAME, 'push', 'Only a main push may deploy')
  async function assertCurrentMain() {
    const response = await fetch('https://api.github.com/repos/killerseig/Phase2-Web-App/commits/main', {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'phase2-hosting-release' },
      cache: 'no-store', signal: AbortSignal.timeout(30000), redirect: 'error',
    })
    assert(response.ok, 'Cannot verify current main; no release sent')
    assert.equal((await response.json()).sha, process.env.GITHUB_SHA, 'A newer main exists; no stale release sent')
  }
  await assertCurrentMain()
  // ADC comes only from a separately approved CI identity. No workstation refresh tokens.
  const require = createRequire(import.meta.url)
  const authRequire = createRequire(require.resolve('firebase-tools/package.json'))
  const { GoogleAuth } = authRequire('google-auth-library')
  const auth = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/firebase.hosting'] }).getClient()
  async function api(method, path, body, query) {
    const url = method === 'UPLOAD' ? new URL(path) : new URL('https://firebasehosting.googleapis.com/v1beta1' + path)
    for (const [name, value] of Object.entries(query || {})) url.searchParams.set(name, value)
    const token = (await auth.getAccessToken()).token
    assert(token, 'No approved ADC credential')
    const response = await fetch(url, {
      method: method === 'UPLOAD' ? 'POST' : method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': method === 'UPLOAD' ? 'application/octet-stream' : 'application/json' },
      body: body ? (method === 'UPLOAD' ? body : JSON.stringify(body)) : undefined,
      signal: AbortSignal.timeout(120000), redirect: 'error',
    })
    assert(response.ok, `Hosting ${method} HTTP ${response.status}; inspect receipt before retrying`)
    return method === 'UPLOAD' ? {} : response.json()
  }
  const result = await deployEmployeeHosting({ api, files: employeeFiles(resolve('hosting-dist')), commit: process.env.GITHUB_SHA, assertCurrentMain, record: data => writeFileSync('release-receipt.json', JSON.stringify(data, null, 2)) })
  const shell = result.manifest.find(file => file.path === '/employee-app.html')
  const response = await fetch('https://phase2-website.web.app/login', {
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30000),
  })
  assert(response.ok, `Live login HTTP ${response.status}`)
  assert.equal(sha256(Buffer.from(await response.arrayBuffer())), shell.sha256, 'Live login differs from this release; inspect receipt')
  console.log(JSON.stringify({ state: result.state, commit: result.commit, version: result.version, previousVersion: result.previousVersion, url: result.url }))
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
