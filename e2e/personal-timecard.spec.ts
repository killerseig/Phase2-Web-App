import { expect, test } from './helpers/test'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture'
for (const screen of [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'phone', width: 390, height: 844 },
]) {
  test.describe(screen.name, () => {
    test.use({ viewport: { width: screen.width, height: screen.height } })

    test('personal entry retains edits, retries once and scrolls inside the workbook', async ({
      page,
    }) => {
      let stored = {
          notes: '',
          lines: Array.from({ length: 13 }, () => ({
            jobNumber: '',
            subsectionArea: '',
            account: '',
            hours: Array(7).fill(0),
          })),
        },
        lost = true
      const saves: Array<{ requestId: string; card: typeof stored }> = [],
        headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
      await page.route('**/ensureTimecardWeekRecord', async (route) => {
        if (route.request().method() === 'OPTIONS') {
          await route.fulfill({ status: 204, headers })
          return
        }
        const data = route.request().postDataJSON().data
        expect(['load', 'save']).toContain(data.personalAction)
        if (data.personalAction === 'save') {
          saves.push(data)
          stored = structuredClone(data.card)
          if (lost) {
            lost = false
            await route.abort()
            return
          }
        }
        await route.fulfill({
          headers,
          contentType: 'application/json',
          body: JSON.stringify({
            result: {
              state: 'ready',
              employeeName: 'Synthetic Employee',
              card: stored,
              version: saves.length ? '2:0' : '1:0',
              readOnly: false,
            },
          }),
        })
      })
      await gotoPhase2App(page, '/jobs/my-timecard', createJobsFixture())
      await expect(page.getByRole('heading', { name: 'My Timecard', exact: true })).toBeVisible()
      await page.getByRole('combobox', { name: 'Payroll job', exact: true }).selectOption('job-1')
      await page.getByRole('button', { name: 'Open my timecard', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Synthetic Employee' })).toBeVisible()
      await page.getByLabel('Line 1 job number', { exact: true }).fill('1A')
      await page.getByLabel('Line 1 account', { exact: true }).fill('PAINT')
      await page.getByLabel('Line 1 account', { exact: true }).press('Tab')
      await expect(page.getByLabel('Line 1 MON hours', { exact: true })).toBeFocused()
      await page.getByLabel('Line 1 MON hours', { exact: true }).fill('4')
      await page.getByLabel('Line 2 job number', { exact: true }).fill('2B')
      await page.getByLabel('Line 2 account', { exact: true }).fill('PAINT')
      await page.getByLabel('Line 2 MON hours', { exact: true }).fill('4')
      await page.getByRole('button', { name: 'Save my timecard', exact: true }).click()
      await expect(page.getByRole('alert')).toBeVisible()
      await expect(page.getByLabel('Line 1 MON hours', { exact: true })).toHaveValue('4')
      await page.getByRole('button', { name: 'Save my timecard', exact: true }).press('Enter')
      await expect(page.getByText('Your timecard draft was saved.', { exact: false })).toBeVisible()
      expect(saves).toHaveLength(2)
      expect(saves[0]!.requestId).toBe(saves[1]!.requestId)
      expect(saves[1]!.card.lines[1]!.hours[1]).toBe(4)
      await expect(
        page.getByRole('button', { name: 'Save my timecard', exact: true }),
      ).toBeDisabled()
      const overflow = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth > window.innerWidth + 1,
        table:
          document.querySelector('.my-timecard__scroll')!.scrollWidth >
          document.querySelector('.my-timecard__scroll')!.clientWidth,
      }))
      expect(overflow.page).toBe(false)
      expect(overflow.table).toBe(screen.name === 'phone')
      await page.getByLabel('Line 1 job number', { exact: true }).scrollIntoViewIfNeeded()
      await page.getByRole('heading', { name: 'My Timecard', exact: true }).scrollIntoViewIfNeeded()
      await page.screenshot({
        path: 'evidence/personal-timecard-' + screen.name + '.png',
        fullPage: true,
      })
    })
  })
}
