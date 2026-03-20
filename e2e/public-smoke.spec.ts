import { expect, test } from '@playwright/test'

test.describe('public smoke', () => {
  test('login page renders expected controls', async ({ page }) => {
    await page.goto('/login')

    await expect(page).toHaveTitle(/Login - Phase 2/)
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Forgot password?' })).toBeVisible()
  })

  test('dashboard redirects anonymous users to login', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
  })

  test('job-scoped routes redirect anonymous users to login', async ({ page }) => {
    await page.goto('/job/e2e-smoke/timecards')

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible()
  })
})
