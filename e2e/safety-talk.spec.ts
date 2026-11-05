import { expect, test, type Page } from './helpers/test'
import { setupFormServer } from './helpers/formFixture'
import { safetyTalkDefinition } from '../src/features/forms/safetyTalk'
import { createRequire } from 'node:module'
const { parseFormSignature } = createRequire(import.meta.url)('../functions/lib/formSignatures.js') as typeof import('../functions/src/formSignatures')
async function draw(page: Page, touch: boolean) {
  const surface = page.getByRole('img', { name: 'Attendee signature', exact: true }).last()
  await surface.scrollIntoViewIfNeeded()
  const box = (await surface.boundingBox())!
  const start = { x: box.x + box.width * .15, y: box.y + box.height * .25 }
  const middle = { x: box.x + box.width * .3, y: box.y + box.height * .7 }
  const end = { x: box.x + box.width * .6, y: box.y + box.height * .3 }
  if (touch) {
    const session = await page.context().newCDPSession(page)
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [middle] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [end] })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await session.detach()
  } else {
    await page.mouse.move(start.x, start.y); await page.mouse.down()
    await page.mouse.move(middle.x, middle.y, { steps: 4 }); await page.mouse.move(end.x, end.y, { steps: 4 }); await page.mouse.up()
  }
  await expect(surface.locator('path')).toHaveCount(1)
}
for (const viewport of [{ name: 'desktop', width: 1440, height: 1000, touch: false }, { name: 'phone touch', width: 390, height: 844, touch: true }]) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height }, hasTouch: viewport.touch })

    test('safety talk saves before handoff and resumes; review submission stays disabled', async ({ page }) => {
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
      const state = await setupFormServer(page, { definition: { ...safetyTalkDefinition, access: undefined } })
      await page.getByRole('button', { name: 'Start draft', exact: true }).click()
      await page.getByLabel('Job name / number').fill('Synthetic job')
      await page.getByLabel('Site / location').fill('Synthetic site')
      await page.getByLabel('Date of safety talk').fill('2026-11-05')
      await page.getByLabel('Safety talk topic and notes').fill('Synthetic topic')
      await page.getByLabel('Talk led by').fill('Synthetic facilitator')
      await page.getByRole('textbox', { name: 'Attendee name *', exact: true }).fill('Synthetic attendee one')
      await draw(page, viewport.touch)
      await page.getByRole('button', { name: 'Save attendee & next', exact: true }).click()
      await expect(page.getByText('Attendee 1 — saved', { exact: true })).toBeVisible()
      await expect(page.getByText('Attendee saved. Ready for the next attendee.')).toBeVisible()
      await expect(page.getByRole('textbox', { name: 'Attendee name *', exact: true }).last()).toBeFocused()
      const first = [...state.records.values()][0]!
      const stored = first.answers.attendees as { instanceId: string; answers: Record<string, string> }[]
      expect(parseFormSignature(stored[0]!.answers.signature!)?.signedAt).toBeGreaterThan(0)
      await expect(page.locator('details').filter({ has: page.getByText('Attendee 1 — saved', { exact: true }) })).not.toHaveAttribute('open')
      await page.getByRole('textbox', { name: 'Attendee name *', exact: true }).last().fill('Synthetic attendee two')
      await draw(page, viewport.touch)
      await page.getByRole('button', { name: 'Save attendee & next', exact: true }).last().click()
      await expect(page.getByText('Attendee 2 — saved', { exact: true })).toBeVisible()
      await expect(page.getByText('Attendee saved. Ready for the next attendee.')).toBeVisible()
      expect(first.answers.attendees).toHaveLength(2)
      await page.reload()
      await page.getByRole('button', { name: /Resume/ }).first().click()
      await expect(page.getByText('Attendee 2 — saved', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Submit form', exact: true })).toBeDisabled()
      expect(state.created).toBe(1); expect(state.submitted).toBe(0)
      expect(first.answers.attendees).toHaveLength(2)
      expect(errors).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `evidence/safety-talk-${viewport.touch ? 'phone' : 'desktop'}.png`, fullPage: true })
    })
  })
}

test('lost handoff response retains ink and retries the same saved attendee without duplication', async ({ page }) => {
  const state = await setupFormServer(page, { definition: { ...safetyTalkDefinition, access: undefined }, lostSave: true })
  await page.getByRole('button', { name: 'Start draft', exact: true }).click()
  await page.getByRole('textbox', { name: 'Attendee name *', exact: true }).fill('Synthetic retry attendee')
  await draw(page, false)
  const handoff = page.getByRole('button', { name: 'Save attendee & next', exact: true })
  await handoff.click()
  await expect(page.locator('#form-validation-message')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Attendee name *', exact: true })).toHaveValue('Synthetic retry attendee')
  await expect(page.getByRole('img', { name: 'Attendee signature', exact: true }).locator('path')).toHaveCount(1)
  await handoff.click()
  await expect(page.getByText('Attendee 1 — saved', { exact: true })).toBeVisible()
  expect(new Set(state.saveRequests).size).toBe(1)
  expect(state.created).toBe(1)
  expect([...state.records.values()][0]!.answers.attendees).toHaveLength(1)
})
