import { expect, test } from '@playwright/test'
import { seededJobs, seededUsers } from './fixtures/seed-data.mjs'
import { loginAs } from './helpers/auth'

test.describe('authenticated smoke', () => {
  test('foreman can sign in and open the seeded job workspace', async ({ page }) => {
    await loginAs(page, seededUsers.foreman)

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByRole('button', { name: new RegExp(seededJobs.active.name) })).toBeVisible()

    await page.getByRole('button', { name: new RegExp(seededJobs.active.name) }).click()

    await expect(page).toHaveURL(new RegExp(`/job/${seededJobs.active.id}$`))
    await expect(page.getByRole('heading', { name: seededJobs.active.name })).toBeVisible()
    await expect(page.getByText('Daily Logs')).toBeVisible()
    await expect(page.getByText('Timecards')).toBeVisible()
    await expect(page.getByText('Shop Orders')).toBeVisible()
  })

  test('foreman is blocked from admin users', async ({ page }) => {
    await loginAs(page, seededUsers.foreman)

    await page.goto('/admin/users')

    await expect(page).toHaveURL(/\/unauthorized$/)
    await expect(page).toHaveTitle(/Unauthorized - Phase 2/)
  })

  test('controller can reach the review workspace', async ({ page }) => {
    await loginAs(page, seededUsers.controller)

    await page.goto('/controller')

    await expect(page).toHaveTitle(/Controller - Phase 2/)
    await expect(page.getByRole('heading', { name: 'Timecard Search, Review & Edits' })).toBeVisible()
  })

  test('admin can reach key admin pages', async ({ page }) => {
    await loginAs(page, seededUsers.admin)

    await page.goto('/admin/users')
    await expect(page).toHaveTitle(/Admin - Users - Phase 2/)
    await expect(page.getByText('User Profiles')).toBeVisible()

    await page.goto('/admin/jobs')
    await expect(page).toHaveTitle(/Admin - Jobs - Phase 2/)
    await expect(page.getByText('Jobs')).toBeVisible()

    await page.goto('/admin/shop-catalog')
    await expect(page).toHaveTitle(/Admin - Shop Catalog - Phase 2/)
    await expect(page.getByText('Catalog')).toBeVisible()
  })
})
