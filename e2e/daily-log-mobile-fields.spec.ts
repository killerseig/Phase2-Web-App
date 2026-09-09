import { expect, test } from './helpers/test.js'
import { createDailyLogsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

test('daily-log rows remain readable and editable on a narrow phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await gotoPhase2App(page, '/jobs/job-e2e/daily-logs', createDailyLogsFixture())

  const crew = page.locator('.daily-log-manpower-card')
  const climate = page.locator('.daily-log-climate-card')
  const trade = crew.getByRole('textbox', { name: 'Trade', exact: true })
  const areas = crew.getByRole('textbox', { name: 'Areas', exact: true })
  const floor = climate.getByRole('textbox', { name: 'Floor / Area', exact: true })

  for (const field of [trade, areas, floor]) {
    await expect(field).toBeVisible()
    const bounds = await field.boundingBox()
    expect(bounds!.width).toBeGreaterThanOrEqual(140)
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320)
  }

  await trade.fill('Acoustics')
  await areas.fill('North corridor')
  await floor.fill('Level 2 lobby')
  await climate.getByRole('textbox', { name: 'High (degF)', exact: true }).fill('74')
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click()

  await expect.poll(() => page.evaluate(() => {
    const state = window.__PHASE2_E2E_STATE__ as {
      dailyLogs: Array<{
        id: string
        payload: {
          manpowerLines: Array<{ trade: string; areas: string }>
          indoorClimateReadings: Array<{ area: string; high: string }>
        }
      }>
    }
    const payload = state.dailyLogs.find(log => log.id === 'daily-log-1')?.payload
    return {
      trade: payload?.manpowerLines[0]?.trade,
      areas: payload?.manpowerLines[0]?.areas,
      floor: payload?.indoorClimateReadings[0]?.area,
      high: payload?.indoorClimateReadings[0]?.high,
    }
  })).toEqual({ trade: 'Acoustics', areas: 'North corridor', floor: 'Level 2 lobby', high: '74' })

  await crew.getByRole('button', { name: 'Add manpower row', exact: true }).click()
  await expect(crew.getByRole('textbox', { name: 'Trade', exact: true })).toHaveCount(2)
  await crew.getByRole('button', { name: 'Remove manpower row 2', exact: true }).click()
  await expect(trade).toHaveValue('Acoustics')

  await climate.getByRole('button', { name: 'Add indoor climate row', exact: true }).click()
  await expect(climate.getByRole('textbox', { name: 'Floor / Area', exact: true })).toHaveCount(2)
  await climate.getByRole('button', { name: 'Remove indoor climate row 2', exact: true }).click()
  await expect(floor).toHaveValue('Level 2 lobby')

  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
})
