import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { expect, test, type Page } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import type { FormRecord } from '../functions/src/formModel'

const projectId = 'demo-phase2-recipient-ui-qa'
process.env.GCLOUD_PROJECT = projectId; process.env.GOOGLE_CLOUD_PROJECT = projectId
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId, storageBucket: projectId + '.appspot.com' })
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'; process.env.FUNCTIONS_EMULATOR = 'true'; process.env.METADATA_SERVER_DETECTION = 'none'
const backend = createRequire(resolve('functions/package.json'))
type Callable = { run: (request: Record<string, unknown>) => Promise<unknown> }
const { formTemplates, formWorkspace } = backend(resolve('functions/formFunctions.js')) as { formTemplates: Callable; formWorkspace: Callable }
const { verifyPublicFormRecipient } = backend(resolve('functions/formRecipientVerification.js')) as typeof import('../functions/src/formRecipientVerification')
const { publicRecipientConsentSnapshot, resolveRecipientEmails } = backend(resolve('functions/formRecipients.js')) as typeof import('../functions/src/formRecipients')
const { db } = backend(resolve('functions/runtime.js')) as typeof import('../functions/src/runtime')
const checks: Record<string, unknown>[] = [], sha = (value: string) => createHash('sha256').update(value).digest('hex')

test.afterAll(async () => { writeFileSync('evidence/recipient-browser-local-backend.json', JSON.stringify({ checkedAt: new Date().toISOString(), projectId, browserTransport: 'Playwright callable transport; actual existing backend handlers and Firestore transactions', mailer: 'in-memory only', productionReads: false, productionWrites: false, externalEmails: false, reviewProjectUntouched: true, checks }, null, 2)); await db.terminate() })

async function setup(page: Page) {
  const templateId = 'ui-' + randomUUID(), email = 'recipient-' + randomUUID() + '@example.invalid', origin = 'local-ui-' + templateId
  const definition = { title: 'Synthetic public approval form', description: 'Local QA only.', recipients: [], access: { respondents: 'public', identity: 'anonymous', respondentRoles: [], respondentUserIds: [], entryRoles: [], entryUserIds: [] }, fields: [{ id: 'notes', kind: 'text', label: 'Notes', required: false, options: [] }, { id: 'recipients', kind: 'recipients', label: 'Send report to', required: false, options: [] }] }
  await db.doc('formTemplates/' + templateId).set({ draft: definition, revision: 1, latestVersion: 1, archived: false })
  await db.doc('formTemplates/' + templateId + '/versions/v1').set({ ...definition, version: 1, createdAt: new Date().toISOString() })
  const context = { email, recordId: '', enabled: true, failSave: false, loseReply: false, sends: 0, codes: new Map<string, string>(), calls: [] as string[], requestIds: [] as string[] }
  const mailer = { enabled: () => context.enabled, send: async (address: string, code: string) => { context.sends++; context.codes.set(address, code) } }
  await page.addInitScript(() => { window.__PHASE2_FORM_SERVER__ = true })
  for (const service of ['formTemplates', 'formWorkspace', 'publicFormRecipientVerification']) await page.route('**/' + service, async route => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const data = route.request().postDataJSON().data; context.calls.push(service + ':' + data.action)
    try {
      let result: unknown
      if (service === 'formTemplates') {
        if (data.action !== 'respondent') throw new Error('Only public read is allowed in this QA fixture.')
        result = await formTemplates.run({ data, rawRequest: { ip: origin } })
      } else if (service === 'formWorkspace') {
        if (!['create', 'save', 'get'].includes(data.action)) throw new Error('Only local draft actions are allowed; submission is disabled.')
        if (context.failSave && data.action === 'save') throw Object.assign(new Error('Synthetic save failure; answers retained.'), { code: 'aborted' })
        result = await formWorkspace.run({ data, rawRequest: { ip: origin } })
        if (data.action === 'create') context.recordId = (result as { id: string }).id
      } else {
        if (data.action === 'request') context.requestIds.push(data.requestId)
        result = await verifyPublicFormRecipient(data, origin, mailer)
        if (context.loseReply && data.action === 'request') { context.loseReply = false; await route.abort(); return }
      }
      await route.fulfill({ json: { result }, headers })
    } catch (caught) {
      const error = caught as { code?: string; message: string }
      await route.fulfill({ status: 400, json: { error: { status: (error.code || 'invalid-argument').replaceAll('-', '_').toUpperCase(), message: error.message } }, headers })
    }
  })
  await gotoPhase2App(page, '/forms/' + templateId, { ...createJobsFixture(), auth: null })
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  await page.getByLabel('Send report to', { exact: true }).fill(email)
  await expect(page.getByRole('region', { name: 'Additional recipient approval' })).toBeVisible()
  return context
}
const requestButton = (page: Page, email: string) => page.getByRole('button', { name: 'Request approval code for ' + email, exact: true })
const codeInput = (page: Page, email: string) => page.getByRole('textbox', { name: 'Approval code for ' + email, exact: true })
const verifyButton = (page: Page, email: string) => page.getByRole('button', { name: 'Verify approval code for ' + email, exact: true })
const incorrectCode = (correct: string) => correct === '00000000' ? '11111111' : '00000000'

for (const width of [1600, 390]) test('public approval uses real local backend at ' + width, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); const context = await setup(page)
  await requestButton(page, context.email).focus(); await page.keyboard.press('Enter')
  await expect(codeInput(page, context.email)).toBeFocused(); expect(context.sends).toBe(1)
  const stored = (await db.doc('formRecords/' + context.recordId).get()).data() as FormRecord
  expect(stored.answers.recipients).toEqual([context.email])
  expect(resolveRecipientEmails(stored.definition, stored.answers, null, [], { publicRespondent: true, verifiedEmails: [] })).toEqual([])
  const correct = context.codes.get(context.email)!, wrong = incorrectCode(correct)
  await codeInput(page, context.email).fill(wrong); await codeInput(page, context.email).press('Enter')
  await expect(page.getByRole('alert').filter({ hasText: 'Incorrect verification code' })).toBeVisible()
  await expect(page.getByText('Approved for this response.', { exact: false })).toHaveCount(0)
  await codeInput(page, context.email).fill(correct); await verifyButton(page, context.email).click()
  await expect(page.getByRole('status').filter({ hasText: 'Approved for this response.' })).toBeFocused()
  const consents = await publicRecipientConsentSnapshot(db, context.recordId)
  expect(consents.map(item => item.email)).toEqual([context.email])
  expect(resolveRecipientEmails(stored.definition, stored.answers, null, [], { publicRespondent: true, verifiedEmails: consents.map(item => item.email) })).toEqual([context.email])
  await expect(codeInput(page, context.email)).toHaveCount(0)
  expect(await page.locator('.recipient-verification').evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: 'evidence/recipient-approved-' + width + '.png', fullPage: true })
  expect(context.calls.some(action => /submit|issue|formEmail/.test(action))).toBe(false)
  checks.push({ workflow: 'request/wrong-code/verify', width, savedBeforeRequest: true, actualConsentProof: true, keyboardFocus: true, unverifiedExcluded: true, sendsInMemory: context.sends })
})

test('save failure and lost response retry never approve or send duplicate challenges', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 }); const context = await setup(page)
  context.failSave = true; await requestButton(page, context.email).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Save the recipient addresses successfully' })).toBeVisible(); expect(context.sends).toBe(0)
  context.failSave = false; context.loseReply = true; await requestButton(page, context.email).click()
  await expect(page.locator('.recipient-verification [role="alert"]')).toBeVisible()
  await expect(requestButton(page, context.email)).toBeEnabled(); await requestButton(page, context.email).click(); await expect(codeInput(page, context.email)).toBeVisible()
  expect(context.sends).toBe(1); expect(new Set(context.requestIds).size).toBe(1)
  await expect(page.getByText('Approved for this response.', { exact: false })).toHaveCount(0)
  checks.push({ workflow: 'save failure and uncertain response retry', width: 390, noChallengeOnSaveFailure: true, idempotentRetry: true, sendsInMemory: context.sends })
})

test('expired code, rate limit and disabled transport stay unverified', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 }); const context = await setup(page)
  await requestButton(page, context.email).click(); await expect(codeInput(page, context.email)).toBeVisible()
  const proof = db.doc('formRecipientVerifications/' + sha(context.recordId + ':' + context.email))
  await proof.update({ codeExpiresAt: Date.now() - 1 })
  await codeInput(page, context.email).fill(context.codes.get(context.email)!); await verifyButton(page, context.email).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Verification expired or unavailable' })).toBeVisible(); await expect(codeInput(page, context.email)).toHaveCount(0)
  await db.doc('formRecipientVerificationRates/draft-' + context.recordId).set({ count: 10 })
  await requestButton(page, context.email).click(); await expect(page.getByRole('alert').filter({ hasText: 'Verification limit reached' })).toBeVisible()
  context.enabled = false; await requestButton(page, context.email).click()
  await expect(page.getByRole('status').filter({ hasText: 'Approval email is not enabled' })).toBeVisible(); await expect(requestButton(page, context.email)).toBeDisabled()
  expect(await publicRecipientConsentSnapshot(db, context.recordId)).toEqual([]); expect(context.sends).toBe(1)
  await expect(page.getByText('Approved for this response.', { exact: false })).toHaveCount(0)
  checks.push({ workflow: 'expired/rate-limited/not-configured', width: 390, actualConsentProofs: 0, sendsInMemory: context.sends })
})
