import { expect, type Page } from '@playwright/test'

type SmokeUser = {
  email: string
  password: string
}

export async function loginAs(page: Page, user: SmokeUser) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}
