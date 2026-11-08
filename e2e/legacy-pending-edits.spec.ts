import { expect, test, type Page } from './helpers/test.js'
import { createDailyLogsFixture, createShopOrdersFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

test.use({ viewport: { width: 1600, height: 950 } })

const dailyTransitions = [
  { name: 'date', leave: (page: Page) => page.getByTestId('dailylog-date-search').fill('2026-06-03'), check: (page: Page) => expect(page.getByTestId('dailylog-date-search')).toHaveValue('2026-06-03') },
  { name: 'history', leave: (page: Page) => page.getByTestId('dailylog-history-submitted-log').click(), check: (page: Page) => expect(page.getByTestId('dailylog-history-submitted-log')).toHaveAttribute('aria-pressed', 'true') },
  { name: 'leave', leave: (page: Page) => page.getByRole('link', { name: 'Jobs', exact: true }).click(), check: (page: Page) => expect(page).toHaveURL(/\/jobs$/) },
  { name: 'sign-out', leave: (page: Page) => page.getByRole('button', { name: 'Sign Out', exact: true }).click(), check: (page: Page) => expect(page).toHaveURL(/\/login(?:\?|$)/) },
]
for (const action of dailyTransitions) {
  test(`daily log saves manpower and climate before ${action.name}`, async ({ page }) => {
    const fixture = createDailyLogsFixture()
    fixture.delays = { dailyLogUpdateMs: 200 }
    fixture.dailyLogs.push({ ...structuredClone(fixture.dailyLogs[0]!), id: 'submitted-log', status: 'submitted', sequenceNumber: 2 })
    await gotoPhase2App(page, '/jobs/job-e2e/daily-logs?logId=daily-log-1', fixture)
    await page.getByRole('textbox', { name: 'Trade', exact: true }).first().fill('Acoustics retained')
    await page.getByRole('textbox', { name: 'Floor / Area', exact: true }).first().fill('Level 3 retained')
    await action.leave(page)
    await expect.poll(() => page.evaluate(() => {
      const log = window.__PHASE2_E2E_STATE__?.dailyLogs?.find(item => item.id === 'daily-log-1')
      return [log?.payload.manpowerLines[0]?.trade, log?.payload.indoorClimateReadings[0]?.area]
    })).toEqual(['Acoustics retained', 'Level 3 retained'])
    await action.check(page)
  })
}

test('daily log failed persistence keeps date, draft and session until retry or explicit discard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoPhase2App(page, '/jobs/job-e2e/daily-logs', createDailyLogsFixture())
  await page.getByRole('textbox', { name: 'Trade', exact: true }).first().fill('Retain after failure')
  // Refuse the isolated fixture write; no service/emulator or real records are involved.
  await page.evaluate(() => Object.defineProperty(window.__PHASE2_E2E_STATE__!.dailyLogs!, '0', { writable: false, configurable: true }))
  await page.getByTestId('dailylog-date-search').fill('2026-06-03')
  const dialog = page.getByRole('dialog', { name: 'Keep unsaved daily log changes?' })
  await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(page.getByTestId('dailylog-date-search')).toHaveValue('2026-06-04')
  await expect(page.getByRole('textbox', { name: 'Trade', exact: true }).first()).toHaveValue('Retain after failure')
  await page.evaluate(() => Object.defineProperty(window.__PHASE2_E2E_STATE__!.dailyLogs!, '0', { writable: true }))
  await page.getByTestId('dailylog-date-search').fill('2026-06-03')
  await expect(page.getByTestId('dailylog-date-search')).toHaveValue('2026-06-03')
  expect(await page.evaluate(() => window.__PHASE2_E2E_STATE__?.dailyLogs?.[0]?.payload.manpowerLines[0]?.trade)).toBe('Retain after failure')
})

test('daily log unadded recipient can cancel sign-out and is discarded only explicitly', async ({ page }) => {
  await gotoPhase2App(page, '/jobs/job-e2e/daily-logs', createDailyLogsFixture())
  const recipient = page.getByRole('textbox', { name: 'Additional Recipients email address', exact: true })
  await recipient.fill('draft@example.com')
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(recipient).toHaveValue('draft@example.com')
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expect(page).toHaveURL(/\/login(?:\?|$)/)
  expect(await page.evaluate(() => window.__PHASE2_E2E_STATE__?.dailyLogs?.[0]?.additionalRecipients)).toEqual([])
})

const shopTransitions = [
  { name: 'history', leave: (page: Page) => page.locator('.shop-orders-history-row').filter({ hasText: 'Order #20260604145900' }).click(), check: (page: Page) => expect(page.getByTestId('shoporder-comments-readonly')).toHaveText('Previous order') },
  { name: 'leave', leave: (page: Page) => page.getByRole('link', { name: 'Jobs', exact: true }).click(), check: (page: Page) => expect(page).toHaveURL(/\/jobs$/) },
  { name: 'sign-out', leave: (page: Page) => page.getByRole('button', { name: 'Sign Out', exact: true }).click(), check: (page: Page) => expect(page).toHaveURL(/\/login(?:\?|$)/) },
]
for (const action of shopTransitions) {
  test(`shop order flushes comments before ${action.name}`, async ({ page }) => {
    const fixture = createShopOrdersFixture()
    fixture.delays = { shopOrderUpdateMs: 200 }
    await gotoPhase2App(page, '/jobs/job-e2e/shop-orders', fixture)
    await page.getByTestId('shoporder-comments').fill('Instructions saved before departure')
    await action.leave(page)
    await expect.poll(() => page.evaluate(() => window.__PHASE2_E2E_STATE__?.shopOrders?.find(order => order.id === 'order-draft')?.comments)).toBe('Instructions saved before departure')
    await action.check(page)
  })
}

test('shop order invalid metadata can cancel history selection and sign-out without losing edits', async ({ page }) => {
  await gotoPhase2App(page, '/jobs/job-e2e/shop-orders', createShopOrdersFixture())
  await page.getByTestId('shoporder-delivery-date').fill('2026-06-03')
  await page.getByTestId('shoporder-comments').fill('Retain invalid draft instructions')
  await page.locator('.shop-orders-history-row').filter({ hasText: 'Order #20260604145900' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(page.getByTestId('shoporder-comments')).toHaveValue('Retain invalid draft instructions')
  await expect(page.getByTestId('shoporder-delivery-date')).toHaveValue('2026-06-03')
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sign Out', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expect(page).toHaveURL(/\/login(?:\?|$)/)
  expect(await page.evaluate(() => window.__PHASE2_E2E_STATE__?.shopOrders?.find(order => order.id === 'order-draft')?.comments)).toBe('')
})
