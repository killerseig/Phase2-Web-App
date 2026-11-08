/**
 * Isolated, real-SDK browser checks of a production-mode build.
 * Build functions, then build with PHASE2_CRITICAL_BUILT=1 and
 * `vite build --config scripts/vite.critical-built.ts --mode production`.
 * Run with `firebase emulators:exec --project demo-phase2-critical-built
 * --config firebase.critical-built.json --only auth,firestore,storage
 * "node scripts/verify-critical-built.mjs"`.
 * Never reuses the managed preview, imports emulator data, or sends mail.
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator, doc, updateDoc } from 'firebase/firestore'
import { createAdminWorkspaceFixture, createDailyLogsFixture, createShopOrdersFixture, createTimecardsFixture } from '../e2e/helpers/phase2AppFixture.ts'

const projectId = 'demo-phase2-critical-built', origin = 'http://127.0.0.1:5296'
for (const [key, expected] of Object.entries({ FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9197', FIRESTORE_EMULATOR_HOST: '127.0.0.1:9297', FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9397' }))
  assert.equal(process.env[key], expected, `Refusing any emulator endpoint except isolated ${expected}`)
assert.equal(process.env.GCLOUD_PROJECT, projectId, 'Only the isolated demo project is permitted')
process.env.METADATA_SERVER_DETECTION = 'none'
const root = fileURLToPath(new URL('..', import.meta.url)), output = resolve(root, '.security-work/critical-built'), dist = resolve(output, 'dist')
await mkdir(output, { recursive: true })
await readFile(resolve(dist, 'index.html'))
for (const file of await readdir(resolve(dist, 'assets'))) {
  if (!file.endsWith('.js')) continue
  const code = await readFile(resolve(dist, 'assets', file), 'utf8')
  assert.ok(!code.includes('__PHASE2_E2E_STATE__'), 'The production fixture runtime must remain excluded')
}
const require = createRequire(new URL('../functions/package.json', import.meta.url))
require('firebase-admin/app').initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` })
const adminAuth = require('firebase-admin/auth').getAuth(), db = require('firebase-admin/firestore').getFirestore()
// No delivery, submission, invitation, password-reset, publication or user-create handler is exposed.
const registrations = [
  ['jobFunctions', { listVisibleJobsForCurrentUser: null, getVisibleJobForCurrentUser: null }],
  ['userFunctions', { listAssignableFieldUsers: null }],
  ['dailyLogRecordFunctions', { listDailyLogsForCurrentUser: null, updateDailyLogRecordCallable: null }],
  ['shopOrderRecordFunctions', { listShopOrdersForCurrentUser: null, updateShopOrderRecordCallable: null }],
  ['timecardWeekFunctions', { listTimecardWeeksForCurrentUser: null, listTimecardCardsForCurrentUser: null, updateTimecardCardRecord: null }],
  ['formFunctions', { formTemplates: ['list', 'respondent', 'save'], formWorkspace: ['list', 'get', 'create', 'save'] }],
  ['formEntries', { formEntries: ['list'] }],
  ['sdsFunctions', { sdsWorkspace: ['load', 'page', 'saveSheet', 'openSheet', 'listResources'] }],
  ['dashboardFunctions', { dashboardWorkspace: ['load'] }],
  ['sharedDashboardFunctions', { sharedDashboardWorkspace: ['load', 'list-announcements'] }],
  ['websiteFunctions', { websiteBuilder: ['load', 'save', 'listImages', 'listRevisions', 'comparePublished'] }],
]
const handlers = new Map()
for (const [module, entries] of registrations) {
  const exports = require(`../functions/lib/${module}.js`)
  for (const [name, actions] of Object.entries(entries)) {
    assert.equal(typeof exports[name]?.run, 'function', `Compile the actual handler ${name} before verifying`)
    handlers.set(name, { handler: exports[name], actions })
  }
}
const password = 'Isolated-Critical-Only-123!', userIds = { admin: 'admin-e2e', foreman: 'foreman-e2e', payroll: 'payroll-built' }
const today = new Date().toLocaleDateString('en-CA'), date = value => value.toISOString().slice(0, 10)
const weekStart = new Date(`${today}T12:00:00Z`); weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay())
const weekEnd = new Date(weekStart); weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)
const future = new Date(weekEnd); future.setUTCDate(future.getUTCDate() + 7)
const fixtures = { admin: createAdminWorkspaceFixture(), daily: createDailyLogsFixture(), shop: createShopOrdersFixture(), time: createTimecardsFixture({ seededCard: true }) }
async function seed(collection, records) {
  for (const { id, ...record } of records) await db.doc(`${collection}/${id}`).set(record)
}
await seed('users', fixtures.admin.users.map(user => ({ ...user, email: `${user.id}@example.invalid` })))
for (const [role, uid] of Object.entries(userIds)) {
  const email = `${role}@example.invalid`
  await adminAuth.createUser({ uid, email, password, emailVerified: true })
  await db.doc(`users/${uid}`).set({ email, firstName: 'Synthetic', lastName: role, role, active: true, assignedJobIds: role === 'foreman' ? ['job-e2e'] : [] })
}
await seed('jobs', fixtures.admin.jobs)
await seed('employees', fixtures.time.employees)
await seed('shopCategories', fixtures.shop.shopCategories)
await seed('shopCatalog', fixtures.shop.shopCatalogItems)
await seed('shopOrders', fixtures.shop.shopOrders.map(order => ({ ...order, deliveryDate: date(future), orderDate: `${today}T09:00:00.000Z` })))
await seed('dailyLogs', fixtures.daily.dailyLogs.map(log => ({ ...log, logDate: today })))
await seed('timecardWeeks', fixtures.time.timecardWeeks.map(week => ({ ...week, weekStartDate: date(weekStart), weekEndDate: date(weekEnd) })))
for (const { weekId, id, ...card } of fixtures.time.timecardCards) {
  card.lines.forEach(line => line.days.forEach((day, index) => { const current = new Date(weekStart); current.setUTCDate(current.getUTCDate() + index); day.date = date(current) }))
  card.lines[0].account = '100'
  card.lines[0].days[1].hours = 8
  await db.doc(`timecardWeeks/${weekId}/cards/${id}`).set(card)
}
// Issue a synthetic, recipient-free fixture only; browser commands cannot issue or submit anything.
const definition = { title: 'Synthetic site visit', description: 'Isolated verification fixture', recipients: [], fields: [{ id: 'visit-notes', label: 'Visit notes', kind: 'text', required: false, options: [] }] }
const formTemplates = handlers.get('formTemplates').handler
await formTemplates.run({ auth: { uid: userIds.admin }, data: { action: 'save', id: 'built-visit', revision: 0, definition } })
await formTemplates.run({ auth: { uid: userIds.admin }, data: { action: 'issue', id: 'built-visit', revision: 1 } })

const calls = [], external = [], results = []
const bridge = createServer(async (req, res) => {
  if (req.headers.origin === origin) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Firebase-AppCheck')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Content-Type', 'application/json')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
  const name = new URL(req.url, origin).pathname.replace(`/${projectId}/us-central1/`, '')
  const registration = handlers.get(name), entry = { name, action: '', uid: '', status: '' }
  calls.push(entry)
  try {
    assert.equal(req.method, 'POST')
    assert.ok(registration, `Endpoint ${name} is not allowed in this verification`)
    let body = ''
    for await (const chunk of req) { body += chunk; assert.ok(body.length < 3000000, 'Request too large') }
    const data = JSON.parse(body).data || {}; entry.action = data.action || ''
    assert.ok(!registration.actions || registration.actions.includes(data.action), `Action ${name}/${data.action} is not allowed`)
    const token = String(req.headers.authorization || '').replace(/^Bearer /, '')
    const claims = await adminAuth.verifyIdToken(token); entry.uid = claims.uid
    const result = await registration.handler.run({ auth: { uid: claims.uid, token: claims }, data })
    entry.status = 'OK'; res.end(JSON.stringify({ result }))
  } catch (error) {
    const code = error.code?.startsWith('auth/') ? 'unauthenticated' : error.code || 'invalid-argument'
    entry.status = code; entry.message = error.message
    res.writeHead(code === 'unauthenticated' ? 401 : 400)
    res.end(JSON.stringify({ error: { status: code.replaceAll('-', '_').toUpperCase(), message: error.message } }))
  }
})
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.pdf': 'application/pdf' }
const application = require('express')()
application.get('/sds-file', require('../functions/lib/sdsFunctions.js').downloadSdsFile)
application.use(async (req, res) => {
  try {
    assert.equal(req.method, 'GET')
    const pathname = decodeURIComponent(new URL(req.url, origin).pathname)
    let file = resolve(dist, `.${pathname}`)
    assert.ok(file.startsWith(dist + sep), 'Invalid path')
    if (!extname(file)) file = resolve(dist, 'index.html')
    const bytes = await readFile(file)
    res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream')
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff')
    res.end(bytes)
  } catch { res.writeHead(404); res.end('Not found') }
})
const server = createServer(application)
const listen = (instance, port) => new Promise((resolve, reject) => { instance.once('error', reject); instance.listen(port, '127.0.0.1', resolve) })
let browser
try {
  await listen(bridge, 5297); await listen(server, 5296)
  browser = await chromium.launch({ headless: true })
  async function check(name, role, run) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true })
    const page = await context.newPage(), pageErrors = []
    page.setDefaultTimeout(15000)
    page.on('pageerror', error => pageErrors.push(error.message))
    await context.route('**/*', route => {
      const url = new URL(route.request().url())
      if (['data:', 'blob:'].includes(url.protocol) || url.hostname === '127.0.0.1' && ['5296', '5297', '9197', '9297', '9397'].includes(url.port)) return route.continue()
      external.push({ check: name, origin: url.origin, path: url.pathname, method: route.request().method() }); return route.abort('blockedbyclient')
    })
    try {
      await page.goto(`${origin}/login`)
      await page.locator('#login-email').fill(`${role}@example.invalid`)
      await page.locator('#login-password').fill(password)
      await page.getByRole('button', { name: 'Login', exact: true }).click()
      await page.waitForURL(url => url.pathname !== '/login')
      assert.equal(await page.evaluate(() => Boolean(window.__PHASE2_E2E_STATE__ || window.__PHASE2_E2E__)), false)
      await run(page)
      assert.deepEqual(pageErrors, [], 'No uncaught page errors')
      results.push({ name, passed: true }); console.log(`PASS ${name}`)
    } catch (error) {
      await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true }).catch(() => {})
      await writeFile(resolve(output, `${name}.txt`), await page.locator('body').innerText().catch(() => 'No body'))
      results.push({ name, passed: false, error: error.message, pageErrors }); console.error(`FAIL ${name}: ${error.message}`)
    } finally { await context.close() }
  }
  await check('admin-assignment-and-confirmation', 'admin', async page => {
    await page.goto(`${origin}/users`)
    await page.getByTestId('users-search').fill('foreman-2@example.invalid')
    await page.getByTestId('users-row-foreman-2').click()
    const assignment = page.locator('.users-job-toggle').filter({ hasText: 'Phase 2 Company Acoustical remodel' }).getByRole('checkbox')
    await assignment.check()
    await expect.poll(async () => (await db.doc('users/foreman-2').get()).data().assignedJobIds).toContain('job-e2e')
    await expect.poll(async () => (await db.doc('jobs/job-e2e').get()).data().assignedForemanIds).toContain('foreman-2')
    await assignment.uncheck()
    await expect.poll(async () => (await db.doc('jobs/job-e2e').get()).data().assignedForemanIds).not.toContain('foreman-2')
    const opener = page.getByRole('button', { name: 'Delete User', exact: true }); await opener.click()
    const dialog = page.getByRole('dialog', { name: 'Delete user?' }), cancel = dialog.getByRole('button', { name: 'Cancel', exact: true })
    await expect(cancel).toBeFocused(); await page.keyboard.press('Shift+Tab')
    await expect(dialog.getByRole('button', { name: 'Delete User', exact: true })).toBeFocused()
    await page.screenshot({ path: resolve(output, 'confirmation-success.png') })
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused()
  })
  await check('employee-edit', 'admin', async page => {
    await page.goto(`${origin}/employees`); await page.getByTestId('employee-row-employee-2').click()
    await page.getByRole('textbox', { name: 'First Name', exact: true }).fill('Verified')
    await page.getByRole('textbox', { name: 'Last Name', exact: true }).focus()
    await expect.poll(async () => (await db.doc('employees/employee-2').get()).data().firstName).toBe('Verified')
  })
  await check('catalog-edit', 'admin', async page => {
    await page.goto(`${origin}/settings/shop-catalog`)
    await page.getByTestId('shop-catalog-search').fill('Bucket')
    await page.getByTestId('shop-catalog-item-item-bucket').click()
    await page.getByRole('textbox', { name: 'Description', exact: true }).fill('Verified Bucket')
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
    await expect.poll(async () => (await db.doc('shopCatalog/item-bucket').get()).data().description).toBe('Verified Bucket')
  })
  await check('daily-log-pending-navigation', 'foreman', async page => {
    await page.goto(`${origin}/jobs/job-e2e/daily-logs?logId=daily-log-1`)
    await page.getByRole('textbox', { name: 'Trade', exact: true }).first().fill('Production-build retained trade')
    await page.getByRole('textbox', { name: 'Floor / Area', exact: true }).first().fill('Retained floor')
    await page.getByRole('link', { name: 'Jobs', exact: true }).click(); await expect(page).toHaveURL(/\/jobs$/)
    await expect.poll(async () => (await db.doc('dailyLogs/daily-log-1').get()).data().payload.manpowerLines[0].trade).toBe('Production-build retained trade')
    assert.equal((await db.doc('dailyLogs/daily-log-1').get()).data().payload.indoorClimateReadings[0].area, 'Retained floor')
  })
  await check('shop-order-pending-navigation', 'foreman', async page => {
    await page.goto(`${origin}/jobs/job-e2e/shop-orders`)
    await page.getByTestId('shoporder-comments').fill('Production-build retained instructions')
    await page.getByRole('link', { name: 'Jobs', exact: true }).click(); await expect(page).toHaveURL(/\/jobs$/)
    await expect.poll(async () => (await db.doc('shopOrders/order-draft').get()).data().comments).toBe('Production-build retained instructions')
  })
  await check('timecard-pending-navigation', 'foreman', async page => {
    await page.goto(`${origin}/jobs/job-e2e/timecards`)
    await page.getByTestId('timecards-week-ending').fill(date(weekEnd))
    await page.getByTestId('timecards-week-ending').dispatchEvent('change')
    await page.getByTestId('timecard-notes-input').fill('Production-build retained timecard notes')
    await page.getByRole('link', { name: 'Jobs', exact: true }).click(); await expect(page).toHaveURL(/\/jobs$/)
    await expect.poll(async () => (await db.doc('timecardWeeks/week-e2e/cards/card-e2e').get()).data().notes).toBe('Production-build retained timecard notes')
  })
  await check('timecard-and-payroll-export', 'payroll', async page => {
    await page.goto(`${origin}/exports/timecards`)
    await expect(page.getByTestId('timecard-export-page')).toBeVisible()
    await expect(page.getByText('Brown, Casey', { exact: true }).first()).toBeVisible()
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export CSV', exact: true }).click()
    const file = await download, path = await file.path()
    assert.match(await readFile(path, 'utf8'), /Brown/)
  })
  await check('forms-author-and-respondent-draft', 'admin', async page => {
    await page.goto(`${origin}/admin/forms`); await expect(page.getByText('Synthetic site visit', { exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Synthetic site visit', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Form editor', exact: true })).toBeVisible()
    await page.locator('[aria-label="Field 1"]').click()
    await expect(page.getByRole('group', { name: 'Selected field actions', exact: true })).toBeVisible()
    await page.screenshot({ path: resolve(output, 'form-editor-success.png') })
    await page.goto(`${origin}/forms/built-visit`)
    await page.getByRole('button', { name: 'Start draft', exact: true }).first().click()
    await page.getByLabel('Visit notes', { exact: true }).fill('Saved through the real production runtime')
    await page.getByRole('button', { name: 'Save progress', exact: true }).click()
    await expect(page.getByText('Saved answers', { exact: true })).toBeVisible()
    await page.goto(`${origin}/reports`); await expect(page.getByRole('heading', { name: 'Forms', exact: true })).toBeVisible()
    const entries = await db.collection('formRecords').where('templateId', '==', 'built-visit').get()
    assert.ok(entries.docs.some(entry => entry.data().answers['visit-notes'] === 'Saved through the real production runtime'))
  })
  await check('library-and-website-readiness', 'admin', async page => {
    await page.goto(`${origin}/company-library`); await expect(page.getByTestId('sds-module')).toBeVisible()
    await expect(page.getByText('Root folder', { exact: true }).first()).toBeVisible()
    await page.locator('input[type=file][aria-label="Add file"]').setInputFiles({ name: 'built-verification.txt', mimeType: 'text/plain', buffer: Buffer.from('Synthetic private document verified through the actual file handler.') })
    await expect(page.locator('[data-testid="sds-module"] pre')).toContainText('Synthetic private document verified')
    await expect.poll(async () => (await require('firebase-admin/storage').getStorage().bucket().getFiles({ prefix: `sds-uploads/${userIds.admin}/` }))[0].length).toBe(0)
    await page.goto(`${origin}/admin/website`)
    await expect(page.getByText('Website Builder', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect.poll(async () => (await db.doc('websitePrivate/state').get()).data()?.version || 0).toBeGreaterThan(0)
  })
  // Rules are exercised through a separately authenticated real client, never Admin SDK.
  const client = initializeApp({ projectId, apiKey: 'isolated-verification-only' }, 'negative-rules')
  try {
    const auth = getAuth(client), firestore = getFirestore(client)
    connectAuthEmulator(auth, 'http://127.0.0.1:9197', { disableWarnings: true }); connectFirestoreEmulator(firestore, '127.0.0.1', 9297)
    for (const role of ['foreman', 'payroll']) {
      await signInWithEmailAndPassword(auth, `${role}@example.invalid`, password)
      await assert.rejects(updateDoc(doc(firestore, 'users', 'foreman-2'), { assignedJobIds: ['job-e2e'] }), error => error.code === 'permission-denied')
      await assert.rejects(updateDoc(doc(firestore, 'jobs', 'job-e2e'), { assignedForemanIds: ['foreman-2'] }), error => error.code === 'permission-denied')
    }
    results.push({ name: 'native-nonadmin-assignment-denials', passed: true })
  } finally { await deleteApp(client) }
  await expect.poll(() => calls.filter(call => !call.status).length).toBe(0)
  assert.deepEqual(calls.filter(call => call.status !== 'OK'), [], 'Every allowed application request must succeed')
  assert.deepEqual(external, [], 'No browser request may leave the isolated local services')
  assert.ok(results.every(result => result.passed), `${results.filter(result => !result.passed).length} built-browser checks failed`)
  console.log(`PASS ${results.length} production-built checks; real SDK, actual compiled handlers/rules, no fixture runtime or external requests`)
} catch (error) {
  results.push({ name: 'gate-completion', passed: false, error: error.message })
  throw error
} finally {
  const report = JSON.stringify({ projectId, build: 'production mode; Firebase initializer alias only', results, calls, blockedExternalRequests: external }, null, 2)
  await writeFile(resolve(output, `results-${new Date().toISOString().replaceAll(':', '-')}.json`), report)
  await writeFile(resolve(output, 'results.json'), report)
  await browser?.close(); await Promise.all([server, bridge].map(instance => new Promise(resolve => instance.close(resolve))))
  await db.terminate()
}
