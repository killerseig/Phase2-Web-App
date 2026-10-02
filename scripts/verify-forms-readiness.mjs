import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import source from '../functions/src/committeeAudit.json' with { type: 'json' }
assert.equal(process.env.GCLOUD_PROJECT, 'demo-phase2-security')
for (const key of [
  'FIRESTORE_EMULATOR_HOST',
  'FIREBASE_AUTH_EMULATOR_HOST',
  'FIREBASE_STORAGE_EMULATOR_HOST',
])
  assert.match(process.env[key] || '', /^(127\.0\.0\.1|localhost):\d+$/)
const require = createRequire(new URL('../functions/package.json', import.meta.url))
require('firebase-admin/app').initializeApp({
  projectId: process.env.GCLOUD_PROJECT,
  storageBucket: process.env.GCLOUD_PROJECT + '.appspot.com',
})
const db = require('firebase-admin/firestore').getFirestore(),
  auth = require('firebase-admin/auth').getAuth()
const namespace = 'readiness-' + randomUUID(),
  accounts = {}
for (const role of ['admin', 'foreman', 'other']) {
  const uid = namespace + '-' + role,
    email = uid + '@forms.local'
  await auth.createUser({ uid, email, password: 'Local-Forms-Only-123!' })
  await db.doc('users/' + uid).set({
    role: role === 'other' ? 'foreman' : role,
    active: true,
    email,
    firstName: 'Readiness',
    lastName: role,
    assignedJobIds: [],
  })
  accounts[role] = { uid, email }
}
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [],
  externalWrites = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('request', (request) => {
  if (
    request.method() === 'POST' &&
    !new URL(request.url()).hostname.match(/^(localhost|127\.0\.0\.1)$/)
  )
    externalWrites.push(request.url())
})
page.setDefaultTimeout(25000)
page.setDefaultNavigationTimeout(35000)
async function login(role) {
  await page.evaluate(async () => {
    const { requireFirebaseServices } = await import('/src/firebase.ts')
    const { signOut } = await import('/node_modules/.vite/deps/firebase_auth.js')
    await signOut(requireFirebaseServices().auth)
  })
  await page.goto('http://127.0.0.1:5173/login')
  await page.locator('#login-email').fill(accounts[role].email)
  await page.locator('#login-password').fill('Local-Forms-Only-123!')
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL((url) => url.pathname !== '/login')
}
try {
  const deadline = Date.now() + 45000
  while (true) {
    try {
      if ((await fetch('http://127.0.0.1:5173/login')).ok) break
    } catch {}
    if (Date.now() > deadline) throw new Error('Local Forms Vite did not become ready.')
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  await page.goto('http://127.0.0.1:5173/login', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.locator('#login-email').fill(accounts.admin.email)
  await page.locator('#login-password').fill('Local-Forms-Only-123!')
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL((url) => url.pathname !== '/login')
  console.log('await page.goto(http://127.0.0.1:5173/admin/forms)')
  await page.goto('http://127.0.0.1:5173/admin/forms')
  await page.getByRole('button', { name: 'Committee audit starter', exact: true }).click()
  await page.getByLabel('Form title', { exact: true }).fill(namespace + ' audit')
  await page.getByLabel('Recipients', { exact: true }).fill(accounts.other.email)
  await page.getByRole('button', { name: 'Full-page preview', exact: true }).click()
  await page
    .getByRole('group', { name: 'Preview device' })
    .getByRole('button', { name: 'Phone', exact: true })
    .click()
  await page.getByRole('button', { name: 'Edit fields', exact: true }).click()
  const issuedResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/formTemplates') &&
      response.request().method() === 'POST' &&
      response.request().postDataJSON()?.data.action === 'issue',
  )
  await page.getByRole('button', { name: 'Issue local server version', exact: true }).click()
  await page
    .getByRole('status')
    .filter({ hasText: 'Immutable local server version issued.' })
    .waitFor()
  const issued = (await (await issuedResponse).json()).result
  console.log('await login(foreman)')
  await login('foreman')
  console.log('await page.goto(http://127.0.0.1:5173/admin/forms)')
  await page.goto('http://127.0.0.1:5173/admin/forms')
  await page.waitForURL((url) => url.pathname !== '/admin/forms', { timeout: 10000 })
  await page.goto('http://127.0.0.1:5173/forms/' + issued.id)
  console.log('await page.getByRole(button, { name: Start draft, exact: true }).click()')
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  await page.getByLabel('Job name', { exact: false }).fill('Actual emulator draft')
  await page.getByRole('button', { name: 'Save progress', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Progress saved' }).waitFor()
  await page.reload()
  await page
    .getByRole('button', { name: /Resume draft/ })
    .last()
    .click()
  assert.equal(
    await page.getByLabel('Job name', { exact: false }).inputValue(),
    'Actual emulator draft',
  )
  for (const field of source.fields) {
    if (field.kind === 'photo' || field.kind === 'textarea') continue
    const input = page.getByLabel(field.label, { exact: false })
    if (field.kind === 'choice') await input.selectOption(field.options[0])
    else if (field.kind === 'date') await input.fill('2026-10-01')
    else if (field.kind === 'number') await input.fill('4')
    else if (field.required) await input.fill('Synthetic ' + field.label)
  }
  await page.getByLabel('First impression photos', { exact: false }).setInputFiles({
    name: 'synthetic.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  })
  await page.getByRole('status').filter({ hasText: 'Photos saved' }).waitFor()
  console.log('await page.getByRole(button, { name: Submit form, exact: true }).click()')
  await page.getByRole('button', { name: 'Submit form', exact: true }).click()
  await page.getByText('Record status: submitted', { exact: false }).waitFor()
  await page.getByRole('button', { name: 'View First impression photos', exact: true }).click()
  await page.getByRole('img', { name: 'First impression photos', exact: true }).waitFor()
  assert.match(await page.getByText('Email delivery:', { exact: false }).textContent(), /disabled/)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    const menu = page.locator('.app-shell__menu-button')
    if ((await menu.getAttribute('aria-expanded')) === 'true') await menu.click()
    if (width === 390)
      await page.waitForFunction(
        () => document.querySelector('.app-shell__sidebar').getBoundingClientRect().right <= 0,
      )
    await page.evaluate(() => {
      for (const element of document.querySelectorAll('*'))
        if (element.scrollTop) element.scrollTop = 0
    })
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    )
    const pane = await page
      .locator('.app-shell__content')
      .evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }))
    if (pane.scroll > pane.client + 1)
      console.log(
        JSON.stringify(
          await page.evaluate(() =>
            [
              ...document.querySelectorAll(
                '.response,.app-shell__content,.form-fields,.form-field,input,select,textarea,h2,p,button',
              ),
            ]
              .map((el) => ({
                tag: el.tagName,
                class: el.className,
                width: el.getBoundingClientRect().width,
                left: el.getBoundingClientRect().left,
                scroll: el.scrollWidth,
                client: el.clientWidth,
              }))
              .filter((el) => el.width > 360 || el.scroll > el.client + 1)
              .slice(0, 15),
          ),
        ),
      )
    assert.ok(pane.scroll <= pane.client + 1, 'The actual form scroll pane must stay contained.')
    if (process.env.FORMS_SMOKE_ARTIFACTS)
      await page.screenshot({
        path: process.env.FORMS_SMOKE_ARTIFACTS + '/form-record-' + width + '.png',
        fullPage: true,
      })
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  console.log('await login(admin)')
  await login('admin')
  console.log('await page.goto(http://127.0.0.1:5173/admin/forms)')
  await page.goto('http://127.0.0.1:5173/admin/forms')
  await page.getByRole('button', { name: 'New form', exact: true }).click()
  await page.getByLabel('Form title', { exact: true }).fill(namespace + ' choices')
  for (const [kind, label, required] of [
    ['checkbox', 'Acknowledgement', true],
    ['checkbox', 'Optional follow-up', false],
    ['radio', 'Schedule', true],
    ['multiselect', 'Work areas', true],
  ]) {
    await page.getByRole('button', { name: 'Add ' + kind, exact: true }).click()
    const field = page.getByLabel('Field inspector', { exact: true })
    await field.getByLabel('Selected field label', { exact: true }).fill(label)
    if (required) await field.getByLabel('Selected field required', { exact: true }).check()
    if (kind !== 'checkbox')
      await field.getByLabel('Selected field options', { exact: true }).fill('North\nSouth')
  }
  const choiceIssuedResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/formTemplates') &&
      response.request().method() === 'POST' &&
      response.request().postDataJSON()?.data.action === 'issue',
  )
  await page.getByRole('button', { name: 'Issue local server version', exact: true }).click()
  const choiceIssued = (await (await choiceIssuedResponse).json()).result
  console.log('await login(foreman)')
  await login('foreman')
  await page.goto('http://127.0.0.1:5173/forms/' + choiceIssued.id)
  console.log('await page.getByRole(button, { name: Start draft, exact: true }).click()')
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  const ack = page.getByRole('checkbox', { name: /Acknowledgement/ }),
    optional = page.getByRole('checkbox', { name: 'Optional follow-up', exact: true })
  await ack.focus()
  await ack.press('Space')
  assert.equal(await ack.isChecked(), true)
  assert.equal(await optional.isChecked(), false)
  const north = page.getByRole('radio', { name: 'North', exact: true })
  await north.focus()
  await north.press('ArrowDown')
  assert.equal(await page.getByRole('radio', { name: 'South', exact: true }).isChecked(), true)
  const combo = page.getByRole('combobox', { name: /Work areas/ })
  await combo.focus()
  await combo.press('ArrowDown')
  await combo.press('Home')
  await combo.press('Enter')
  assert.equal(
    await page.getByRole('option', { name: 'North', exact: true }).getAttribute('aria-selected'),
    'true',
  )
  await combo.press('ArrowDown')
  await combo.press('Enter')
  assert.equal(
    await page.getByRole('option', { name: 'South', exact: true }).getAttribute('aria-selected'),
    'true',
  )
  await combo.press('Escape')
  await page.getByRole('button', { name: 'Save progress', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Progress saved' }).waitFor()
  await page.reload()
  await page.getByRole('button', { name: /Resume draft/ }).click()
  assert.equal(await ack.isChecked(), true)
  assert.equal(await optional.isChecked(), false)
  assert.equal(await page.getByRole('radio', { name: 'South', exact: true }).isChecked(), true)
  console.log('await page.getByRole(button, { name: Submit form, exact: true }).click()')
  await page.getByRole('button', { name: 'Submit form', exact: true }).click()
  await page.getByText('Record status: submitted', { exact: false }).waitFor()
  assert.equal(await ack.isDisabled(), true)
  assert.equal(await combo.isDisabled(), true)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    if (width === 390)
      await page.waitForFunction(
        () => document.querySelector('.app-shell__sidebar').getBoundingClientRect().right <= 0,
      )
    await page.locator('.app-shell__content').evaluate((el) => (el.scrollTop = 0))
    assert.ok(
      await page
        .locator('.app-shell__content')
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    )
    if (process.env.FORMS_SMOKE_ARTIFACTS)
      await page.screenshot({
        path: process.env.FORMS_SMOKE_ARTIFACTS + '/form-choices-' + width + '.png',
        fullPage: true,
      })
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  // Seed only a local-emulator personal layout, using the same real Auth token as the UI.
  await page.evaluate(async (id) => {
    const { requireFirebaseServices } = await import('/src/firebase.ts')
    const token = await requireFirebaseServices().auth.currentUser.getIdToken()
    const command = async (data) => {
      const response = await fetch(
        'http://127.0.0.1:5001/demo-phase2-security/us-central1/dashboardWorkspace',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ data }),
        },
      )
      const body = await response.json()
      if (!response.ok) throw new Error(body.error?.message)
      return body.result
    }
    const layout = await command({ action: 'load', scope: 'personal' })
    await command({
      action: 'save',
      scope: 'personal',
      version: layout.version,
      widgets: [
        {
          id: 'local-form-check',
          type: 'form',
          span: 12,
          title: 'Common choice control smoke',
          text: '',
          form: { templateId: id, version: 1, presentation: 'inline' },
        },
      ],
    })
  }, choiceIssued.id)
  await page.goto('http://127.0.0.1:5173/dashboards/personal')
  // The already-submitted choice record is reused; viewing an inline widget creates nothing.
  await page.getByText('Record status: submitted', { exact: false }).waitFor()
  assert.equal(await ack.isChecked(), true)
  assert.equal(await ack.isDisabled(), true)
  console.log('await page.getByRole(button, { name: Start draft, exact: true }).click()')
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  await page.getByText('Record status: draft', { exact: false }).waitFor()
  await ack.check()
  await page.getByRole('radio', { name: 'North', exact: true }).check()
  const inlineRecordResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/formWorkspace') &&
      response.request().postDataJSON()?.data.action === 'save',
  )
  await page.getByRole('button', { name: 'Open full-page form', exact: true }).click()
  const inlineRecord = (await (await inlineRecordResponse).json()).result
  await page.waitForURL(
    (url) =>
      url.pathname === '/forms/' + choiceIssued.id &&
      url.searchParams.get('record') === inlineRecord.id,
  )
  assert.equal(await ack.isChecked(), true)
  await page.getByRole('radio', { name: 'South', exact: true }).check()
  await page.getByRole('button', { name: 'Return to dashboard', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/dashboards/personal')
  await page.getByRole('radio', { name: 'South', exact: true }).waitFor()
  assert.equal(await page.getByRole('radio', { name: 'South', exact: true }).isChecked(), true)
  await page.reload()
  await ack.waitFor()
  assert.equal(await ack.isChecked(), true)
  assert.equal(await page.getByRole('radio', { name: 'South', exact: true }).isChecked(), true)
  await page.getByRole('button', { name: 'Edit layout', exact: true }).click()
  await page.getByLabel('Widget 1 presentation', { exact: true }).selectOption('launcher')
  await page.getByRole('button', { name: 'Save layout', exact: true }).click()
  await page.getByRole('link', { name: 'Open full-page form', exact: true }).click()
  await ack.waitFor()
  assert.equal(await ack.isChecked(), true)
  assert.equal(await page.getByRole('radio', { name: 'South', exact: true }).isChecked(), true)
  await page.getByRole('button', { name: 'Return to dashboard', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/dashboards/personal')
  await page.getByRole('button', { name: 'Edit layout', exact: true }).click()
  await page.getByLabel('Widget 1 presentation', { exact: true }).selectOption('inline')
  await page.getByRole('button', { name: 'Save layout', exact: true }).click()
  await ack.waitFor()
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    if (width === 390)
      await page.waitForFunction(
        () => document.querySelector('.app-shell__sidebar').getBoundingClientRect().right <= 0,
      )
    await page.locator('.app-shell__content').evaluate((el) => (el.scrollTop = 0))
    await page.locator('.dashboard-scroll').evaluate((el) => (el.scrollTop = 0))
    assert.ok(
      await page
        .locator('.dashboard-scroll')
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    )
    if (process.env.FORMS_SMOKE_ARTIFACTS)
      await page.locator('[aria-label="Dashboard form"]').screenshot({
        path: process.env.FORMS_SMOKE_ARTIFACTS + '/real-inline-form-' + width + '.png',
      })
  }
  const { formWorkspace, formTemplates } = require('../functions/formFunctions.js')
  const records = (
    await formWorkspace.run({ auth: { uid: accounts.foreman.uid }, data: { action: 'list' } })
  ).records
  const submitted = records.find((r) => r.templateId === issued.id && r.status === 'submitted')
  assert.ok(submitted)
  for (const data of [
    { action: 'get', id: submitted.id },
    {
      action: 'save',
      id: submitted.id,
      revision: submitted.revision,
      requestId: randomUUID(),
      answers: {},
    },
  ])
    await assert.rejects(
      () => formWorkspace.run({ auth: { uid: accounts.other.uid }, data }),
      (e) => e.code === 'permission-denied',
    )
  await assert.rejects(
    () =>
      formTemplates.run({
        auth: { uid: accounts.foreman.uid },
        data: { action: 'save', id: randomUUID(), revision: 0, definition: submitted.definition },
      }),
    (e) => e.code === 'permission-denied',
  )
  const before = JSON.stringify(submitted)
  await assert.rejects(
    () =>
      formWorkspace.run({
        auth: { uid: accounts.foreman.uid },
        data: {
          action: 'save',
          id: submitted.id,
          revision: submitted.revision,
          requestId: randomUUID(),
          answers: {},
        },
      }),
    (e) => e.code === 'failed-precondition',
  )
  const assets = submitted.definition.fields
    .filter((field) => field.kind === 'photo')
    .flatMap((field) => submitted.answers[field.id] || [])
  assert.ok(assets.length > 0)
  await assert.rejects(
    () =>
      formWorkspace.run({
        auth: { uid: accounts.other.uid },
        data: { action: 'photo', id: submitted.id, assetId: assets[0] },
      }),
    (e) => e.code === 'permission-denied',
  )
  const { formEmail } = require('../functions/formDelivery.js')
  const delivery = await formEmail.run({
    auth: { uid: accounts.foreman.uid },
    data: { action: 'retry', id: submitted.id },
  })
  assert.equal(delivery.emailStatus, 'disabled')
  const after = await formWorkspace.run({
    auth: { uid: accounts.foreman.uid },
    data: { action: 'get', id: submitted.id },
  })
  assert.equal(JSON.stringify(after), before)
  const { buildFormEmailHtml } = require('../functions/formDelivery.js')
  const html = buildFormEmailHtml(submitted)
  assert.ok(html.includes('1 private photos retained'))
  assert.ok(!html.includes('<a '))
  assert.ok(!html.includes('<img '))
  assert.deepEqual(errors, [])
  assert.deepEqual(externalWrites, [])
  console.log(
    JSON.stringify({
      passed: true,
      realEmulatorAuth: true,
      realCommonChoiceControls: true,
      realDashboardPresentationsAndSharedRecord: true,
      choiceKeyboardAndDraftRoundtrip: true,
      uniqueAccountsAndPersonalLayout: true,
      foreignRecipientDenied: true,
      emailRetryPreservesSubmission: true,
      emailPhotoCountsOnly: true,
      adminIssue: true,
      draftResume: true,
      sourceFields: source.fields.length,
      privatePhoto: true,
      immutableSubmitted: true,
      emailDisabled: true,
      desktopAndPhoneContained: true,
      productionWrites: false,
      realEmails: 0,
    }),
  )
} finally {
  await browser.close()
}
