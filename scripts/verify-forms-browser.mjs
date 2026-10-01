import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'
import source from '../functions/src/committeeAudit.json' with { type: 'json' }
assert.equal(process.env.GCLOUD_PROJECT, 'demo-phase2-security')
for (const key of [
  'FIRESTORE_EMULATOR_HOST',
  'FIREBASE_AUTH_EMULATOR_HOST',
  'FIREBASE_STORAGE_EMULATOR_HOST',
])
  assert.match(process.env[key] || '', /^(127\.0\.0\.1|localhost):\d+$/)
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
try {
  const deadline = Date.now() + 45000
  while (true) {
    try {
      if ((await fetch('http://127.0.0.1:5195/login')).ok) break
    } catch {}
    if (Date.now() > deadline) throw new Error('Local Forms Vite did not become ready.')
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  await page.goto('http://127.0.0.1:5195/login', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.locator('#login-email').fill('admin@forms.local')
  await page.locator('#login-password').fill('Local-Forms-Only-123!')
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL((url) => url.pathname !== '/login')
  await page.goto('http://127.0.0.1:5195/admin/forms')
  if (process.env.FORMS_EXPECT_HISTORY === 'true') {
    assert.ok(process.env.FORMS_EXISTING_TEMPLATE, 'A submitted audit must survive restart.')
    await page.goto('http://127.0.0.1:5195/forms/' + process.env.FORMS_EXISTING_TEMPLATE)
    await page
      .getByRole('button', {
        name: new RegExp('View submitted form.*' + process.env.FORMS_EXISTING_RECORD.slice(0, 8)),
      })
      .click()
    await page.getByRole('button', { name: 'View First impression photos', exact: true }).click()
    await page.getByRole('img', { name: 'First impression photos', exact: true }).waitFor()
    assert.equal(
      await page.getByLabel('Job name', { exact: false }).inputValue(),
      'Synthetic Job name',
    )
    await page.goto('http://127.0.0.1:5195/admin/forms')
  }
  await page.getByRole('button', { name: 'Committee audit starter', exact: true }).click()
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
  await page.goto('http://127.0.0.1:5195/forms/' + issued.id)
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
  await page.goto('http://127.0.0.1:5195/admin/forms')
  await page.getByRole('button', { name: 'New form', exact: true }).click()
  await page.getByLabel('Form title', { exact: true }).fill('Common choice control smoke')
  for (const [kind, label, required] of [
    ['checkbox', 'Acknowledgement', true],
    ['checkbox', 'Optional follow-up', false],
    ['radio', 'Schedule', true],
    ['multiselect', 'Work areas', true],
  ]) {
    await page.getByRole('button', { name: 'Add ' + kind, exact: true }).click()
    const field = page.getByLabel('Form editor').locator('article').last()
    await field.getByLabel('Field label', { exact: true }).fill(label)
    if (required) await field.getByLabel('Required', { exact: true }).check()
    if (kind !== 'checkbox') await field.getByLabel('Options', { exact: true }).fill('North\nSouth')
  }
  const choiceIssuedResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/formTemplates') &&
      response.request().method() === 'POST' &&
      response.request().postDataJSON()?.data.action === 'issue',
  )
  await page.getByRole('button', { name: 'Issue local server version', exact: true }).click()
  const choiceIssued = (await (await choiceIssuedResponse).json()).result
  await page.goto('http://127.0.0.1:5195/forms/' + choiceIssued.id)
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
  assert.deepEqual(errors, [])
  assert.deepEqual(externalWrites, [])
  console.log(
    JSON.stringify({
      passed: true,
      realEmulatorAuth: true,
      realCommonChoiceControls: true,
      choiceKeyboardAndDraftRoundtrip: true,
      restartHistory: process.env.FORMS_EXPECT_HISTORY === 'true',
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
