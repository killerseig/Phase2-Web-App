import { expect, test, type Page } from '@playwright/test'
import { gotoShopOrderApp } from './helpers/shopOrderAppFixture.js'

async function expandAllCatalogFolders(page: Page) {
  await page.getByTestId('shoporder-root-row').click({ button: 'right' })
  await page.getByTestId('shoporder-context-expand-all').click()
}

test.describe('shop order workspace regressions', () => {
  test('draft orders start with the next Thursday delivery date', async ({ page }) => {
    await gotoShopOrderApp(page)

    await expect(page.getByTestId('shoporder-delivery-date')).toHaveValue('2026-06-11')
  })

  test('new drafts reset the delivery date back to next Thursday', async ({ page }) => {
    await gotoShopOrderApp(page)

    await page.getByTestId('shoporder-delivery-date').fill('2026-06-20')
    await expandAllCatalogFolders(page)
    await page.getByTestId('shoporder-add-item-box').click()
    await page.getByTestId('shoporder-submit').click()
    await page.getByTestId('shoporder-new-order').click()

    await expect(page.getByTestId('shoporder-delivery-date')).toHaveValue('2026-06-11')
  })

  test('collapse all and expand all folders work from the context menu', async ({ page }) => {
    await gotoShopOrderApp(page)

    await page.getByTestId('shoporder-root-row').click({ button: 'right' })
    await page.getByTestId('shoporder-context-collapse-all').click()

    await expect(page.getByTestId('shoporder-root-toggle')).toHaveAttribute('data-state', 'collapsed')
    await expect(page.getByTestId('shoporder-category-cat-drywall')).toHaveCount(0)

    await page.getByTestId('shoporder-root-row').click({ button: 'right' })
    await page.getByTestId('shoporder-context-expand-all').click()

    await expect(page.getByTestId('shoporder-root-toggle')).toHaveAttribute('data-state', 'expanded')
    await expect(page.getByTestId('shoporder-category-cat-drywall')).toBeVisible()
    await expect(page.getByTestId('shoporder-category-cat-all-purpose')).toBeVisible()
  })

  test('catalog item rows show only the item name when added to the order', async ({ page }) => {
    await gotoShopOrderApp(page)

    await expandAllCatalogFolders(page)
    await page.getByTestId('shoporder-add-item-box').click()

    const orderRow = page.getByTestId('shoporder-order-item-item-box')
    await expect(orderRow).toContainText('Box')
    await expect(orderRow).not.toContainText('Drywall Mud / All Purpose Mud /')
  })

  test('comments survive autosave echo while the draft stays editable', async ({ page }) => {
    await gotoShopOrderApp(page)

    const comments = page.getByTestId('shoporder-comments')
    const text = 'Delivery on Thursday 5/7 with 12 boxes and 4 buckets'

    await comments.fill(text)
    await expect(comments).toHaveValue(text)

    await page.waitForTimeout(700)

    await expect(comments).toHaveValue(text)
  })

  test('catalog item quantity input is applied when adding an item to the order', async ({ page }) => {
    await gotoShopOrderApp(page)

    await expandAllCatalogFolders(page)
    await page.getByTestId('shoporder-quantity-item-box').fill('3')
    await page.getByTestId('shoporder-add-item-box').click()

    await expect(page.getByTestId('shoporder-order-item-qty-item-box')).toHaveValue('3')
  })

  test('Thursday delivery shortcut keeps the next Thursday delivery date selected', async ({ page }) => {
    await gotoShopOrderApp(page)

    await page.getByTestId('shoporder-shortcut').click()

    await page.waitForTimeout(500)

    await expect(page.getByTestId('shoporder-delivery-date')).toHaveValue('2026-06-11')
  })

  test('removing the last item returns the empty state placeholder', async ({ page }) => {
    await gotoShopOrderApp(page)

    await expandAllCatalogFolders(page)
    await page.getByTestId('shoporder-add-item-box').click()
    await page.getByTestId('shoporder-order-item-remove-item-box').click()

    await expect(page.getByTestId('shoporder-empty')).toBeVisible()
    await expect(page.getByTestId('shoporder-order-item-item-box')).toHaveCount(0)
  })

  test('submitted orders render plain values instead of editable controls', async ({ page }) => {
    await gotoShopOrderApp(page)

    await expandAllCatalogFolders(page)
    await page.getByTestId('shoporder-add-item-box').click()
    await page.getByTestId('shoporder-comments').fill('Keep this read only after submit')
    await page.waitForTimeout(700)
    await page.getByTestId('shoporder-submit').click()

    await expect(page.getByTestId('shoporder-comments')).toHaveCount(0)
    await expect(page.getByTestId('shoporder-comments-readonly')).toHaveText('Keep this read only after submit')
    await expect(page.getByTestId('shoporder-order-item-remove-item-box')).toHaveCount(0)
    await expect(page.getByTestId('shoporder-order-item-qty-readonly-item-box')).toHaveText('1')
  })
})
