import { expect, test } from './helpers/test.js'
import { createAdminWorkspaceFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

test('administrative confirmation contains keyboard focus and restores its opener', async ({ page }) => {
  await gotoPhase2App(page, '/users', createAdminWorkspaceFixture())
  await page.getByTestId('users-search').fill('sam@example.com')
  await page.locator('.users-browser__row').filter({ hasText: 'sam@example.com' }).click()
  const opener = page.getByRole('button', { name: 'Delete User', exact: true })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Delete user?' })
  const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true })
  const confirm = dialog.getByRole('button', { name: 'Delete User', exact: true })
  await expect(cancel).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(confirm).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(cancel).toBeFocused()
  await page.getByTestId('users-search').evaluate(element => (element as HTMLElement).focus())
  await expect(cancel).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
  await expect(page.getByRole('heading', { name: 'Sam Foreman' })).toBeVisible()
})
