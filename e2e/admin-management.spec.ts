import { expect, test } from './helpers/test.js'
import { createAdminWorkspaceFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

test.describe('admin management workflows', () => {
  test('admins can create a user and then send pending invites from the real users page', async ({ page }) => {
    await gotoPhase2App(page, '/users', createAdminWorkspaceFixture())

    await page.getByRole('button', { name: 'New User' }).click()
    await page.getByLabel('Email').fill('zoe.foreman@example.com')
    await page.getByLabel('First Name').fill('Zoe')
    await page.getByLabel('Last Name').fill('Foreman')
    await page.getByRole('button', { name: "Create User, Don't Send Invite" }).click()

    await page.getByTestId('users-search').fill('zoe.foreman@example.com')
    await expect(page.getByText('zoe.foreman@example.com')).toBeVisible()
    await expect(page.getByText('Invite Pending')).toBeVisible()

    await page.getByRole('button', { name: 'Send Invites' }).click()

    await expect(page.getByText('Invited')).toBeVisible()
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          users?: Array<{ email?: string | null; inviteStatus?: string | null }>
        }
        return state.users?.find((user) => user.email === 'zoe.foreman@example.com')?.inviteStatus ?? null
      }))
      .toBe('sent')
  })

  test('admins can create, edit, and delete an employee on the real employees page', async ({ page }) => {
    await gotoPhase2App(page, '/employees', createAdminWorkspaceFixture())

    await page.getByRole('button', { name: 'New Employee' }).click()
    await page.getByLabel('Employee Number').fill('3001')
    await page.getByLabel('First Name').fill('Morgan')
    await page.getByLabel('Last Name').fill('Stone')
    await page.getByLabel('Occupation').fill('Apprentice')
    await page.getByRole('button', { name: 'Create Employee', exact: true }).click()

    await page.getByTestId('employees-search').fill('3001')
    const employeeDirectoryCode = page.locator('.employees-browser__secondary').filter({ hasText: 'Employee #3001' })
    await expect(employeeDirectoryCode).toBeVisible()

    const occupationInput = page.getByLabel('Occupation')
    await occupationInput.fill('Lead Installer')
    await occupationInput.blur()

    await expect(page.getByText('All changes saved.')).toBeVisible()
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          employees?: Array<{ employeeNumber?: string; occupation?: string }>
        }
        return state.employees?.find((employee) => employee.employeeNumber === '3001')?.occupation ?? null
      }))
      .toBe('Lead Installer')

    await page.getByRole('button', { name: 'Delete Employee' }).click()

    await expect(page.getByText('Employee deleted.')).toBeVisible()
    await expect(employeeDirectoryCode).toHaveCount(0)
  })

  test('admins can change a user role and remove the user from assigned jobs', async ({ page }) => {
    await gotoPhase2App(page, '/users', createAdminWorkspaceFixture())

    await page.getByTestId('users-search').fill('sam@example.com')
    const samRow = page.locator('.users-browser__row').filter({ hasText: 'sam@example.com' })
    await samRow.click()

    await expect(page.getByRole('heading', { name: 'Sam Foreman' })).toBeVisible()
    await page.getByLabel('Role').selectOption('admin')

    await expect(page.locator('.users-jobs-panel')).toHaveCount(0)
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          users?: Array<{ email?: string | null; role?: string | null; assignedJobIds?: string[] }>
        }
        const user = state.users?.find((entry) => entry.email === 'sam@example.com')
        return user
          ? { role: user.role ?? null, assignedJobIds: user.assignedJobIds ?? [] }
          : null
      }))
      .toEqual({ role: 'admin', assignedJobIds: [] })
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          jobs?: Array<{ id?: string; assignedForemanIds?: string[] }>
        }
        return state.jobs?.find((job) => job.id === 'job-2')?.assignedForemanIds ?? []
      }))
      .toEqual([])

    await page.getByRole('button', { name: 'Delete User', exact: true }).click()

    await expect(page.getByText('User deleted.')).toBeVisible()
    await expect(samRow).toHaveCount(0)
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          users?: Array<{ email?: string | null }>
        }
        return state.users?.some((user) => user.email === 'sam@example.com') ?? false
      }))
      .toBe(false)
  })
})
