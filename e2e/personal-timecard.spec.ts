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
        expect(['context', 'load', 'save']).toContain(data.personalAction)
        if (data.personalAction === 'context') {
          await route.fulfill({ headers, contentType: 'application/json', body: JSON.stringify({ result: {
            state: 'context', jobs: [{ id: 'job-1', code: '1A', name: 'Assigned first job' }, { id: 'job-2', code: '2B', name: 'Assigned second job' }],
            defaultJobId: 'job-1', currentWeekEndDate: '2026-11-07', card: null, version: null, readOnly: true,
          } }) }); return
        }
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
              readOnly: data.weekEndDate !== '2026-11-07',
            },
          }),
        })
      })
      const fixture = createJobsFixture()
      fixture.auth.profile.role = 'employee'
      await gotoPhase2App(page, '/jobs/my-timecard', fixture)
      await expect(page.getByRole('heading', { name: 'My Timecard', exact: true })).toBeVisible()
      await expect(page.getByRole('combobox', { name: 'Payroll job', exact: true })).toHaveValue('job-1')
      await expect(page.getByLabel('Week ending (Saturday)')).toHaveValue('2026-11-07')
      await expect(page.getByTestId('timecard-employee-name')).toContainText('Synthetic Employee')
      await expect(page.getByRole('combobox', { name: 'Payroll job', exact: true }).locator('option')).toHaveCount(3)
      await expect(page.locator('.app-shell__nav a')).toHaveText(['My Timecard'])
      await expect(page.getByTestId('timecard-wage-input')).toHaveCount(0)
      await expect(page.getByLabel('Line 1 MON production', { exact: true })).toBeDisabled()
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
      await expect(page.getByLabel('Line 1 MON hours', { exact: true })).toHaveValue('4.00')
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
      await page.getByTestId('timecard-notes-input').fill('Unsaved note')
      await page.getByRole('combobox', { name: 'Payroll job', exact: true }).selectOption('job-2')
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      await expect(page.getByRole('combobox', { name: 'Payroll job', exact: true })).toHaveValue('job-1')
      await expect(page.getByTestId('timecard-notes-input')).toHaveValue('Unsaved note')
      await page.getByLabel('Week ending (Saturday)').fill('2026-10-31')
      await page.getByLabel('Week ending (Saturday)').press('Tab')
      await page.getByRole('button', { name: 'Discard changes', exact: true }).click()
      await expect(page.getByText('This timecard is locked and available to view only.')).toBeVisible()
      await expect(page.getByLabel('Line 1 MON hours', { exact: true })).toBeDisabled()
      await expect(page.getByTestId('timecard-notes-input')).toBeDisabled()
      await expect(page.getByRole('button', { name: 'Save my timecard', exact: true })).toBeDisabled()
      expect(saves).toHaveLength(2)
      await page.getByLabel('Line 1 job number', { exact: true }).scrollIntoViewIfNeeded()
      await page.getByRole('heading', { name: 'My Timecard', exact: true }).scrollIntoViewIfNeeded()
      await page.screenshot({
        path: 'evidence/personal-timecard-' + screen.name + '.png',
        fullPage: true,
      })
    })

    for (const staff of [{ role: 'admin', userLinks: 1 }, { role: 'foreman', userLinks: 0 }] as const) {
      test(staff.role + ' retains normal navigation and uses only their assigned personal card', async ({ page }) => {
        const fixture = createJobsFixture(); fixture.auth.profile.role = staff.role
        let card = { notes: '', lines: Array.from({ length: 13 }, () => ({ jobNumber: '1A', subsectionArea: '', account: 'PAINT', hours: Array(7).fill(0) })) }
        const saves: Array<{ jobId: string }> = [], headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
        await page.route('**/ensureTimecardWeekRecord', async route => {
          if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return }
          const data = route.request().postDataJSON().data
          if (data.personalAction === 'save') { saves.push(data); card = structuredClone(data.card) }
          const result = data.personalAction === 'context' ? { state: 'context', jobs: [{ id: 'job-1', code: '1A', name: 'Assigned payroll job' }], defaultJobId: 'job-1', currentWeekEndDate: '2026-11-07', card: null, version: null, readOnly: true } : { state: 'ready', employeeName: 'Synthetic ' + staff.role, card, version: saves.length ? '2:0' : '1:0', readOnly: data.weekEndDate !== '2026-11-07' }
          await route.fulfill({ headers, contentType: 'application/json', body: JSON.stringify({ result }) })
        })
        await gotoPhase2App(page, '/jobs/my-timecard', fixture)
        await expect(page.getByRole('combobox', { name: 'Payroll job', exact: true })).toHaveValue('job-1')
        await expect(page.getByRole('combobox', { name: 'Payroll job', exact: true }).locator('option')).toHaveCount(2)
        await expect(page.locator('.app-shell__nav a[href="/jobs"]')).toHaveCount(1)
        await expect(page.locator('.app-shell__nav a[href="/users"]')).toHaveCount(staff.userLinks)
        await expect(page.getByTestId('timecard-employee-name')).toContainText('Synthetic ' + staff.role)
        await page.getByLabel('Line 1 MON hours', { exact: true }).fill('6')
        await page.getByRole('button', { name: 'Save my timecard', exact: true }).click()
        await expect(page.getByText('Your timecard draft was saved.', { exact: false })).toBeVisible()
        expect(saves).toHaveLength(1)
        expect(saves[0]?.jobId).toBe('job-1')
        await expect(page.getByLabel('Line 1 MON hours', { exact: true })).toHaveValue('6.00')
        await page.getByLabel('Week ending (Saturday)').fill('2026-10-31')
        await expect(page.getByText('This timecard is locked and available to view only.')).toBeVisible()
        await expect(page.getByLabel('Line 1 MON hours', { exact: true })).toBeDisabled()
      })
    }
  })
}
