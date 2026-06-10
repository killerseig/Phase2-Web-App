import { expect, test } from './helpers/test.js'
import { createJobDashboardFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

test.describe('public route coverage', () => {
  test('login route renders for signed-out visitors', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('heading', { name: 'Phase 2 Web Application' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible()
  })

  test('forgot password route reads the email query parameter', async ({ page }) => {
    await page.goto('/forgot-password?email=cj%40example.com')

    await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeVisible()
    await expect(page.getByLabel('Email')).toHaveValue('cj@example.com')
    await expect(page.getByRole('link', { name: 'Back to login' })).toBeVisible()
  })

  test('set password route still renders its shell for setup links', async ({ page }) => {
    await page.goto('/set-password')

    await expect(page.getByRole('heading', { name: 'Create Your Password' })).toBeVisible()
    await expect(page.getByText('Finish the admin-created account setup')).toBeVisible()
  })

  test('unknown routes render the not found page', async ({ page }) => {
    await page.goto('/this-route-does-not-exist')

    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Back to Jobs' })).toBeVisible()
  })

  test('authenticated users are redirected away from login', async ({ page }) => {
    await gotoPhase2App(page, '/login', createJobDashboardFixture())

    await expect(page).toHaveURL(/\/jobs$/)
    await expect(page.getByTestId('job-card-1A')).toBeVisible()
  })
})
