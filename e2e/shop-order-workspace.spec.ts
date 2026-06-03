import { expect, test } from '@playwright/test'

test.describe('shop order workspace regressions', () => {
  test('collapse all and expand all folders work from the context menu', async ({ page }) => {
    await page.goto('/__e2e/shop-order-workspace')

    await page.getByTestId('shoporder-root-row').click({ button: 'right' })
    await page.getByTestId('shoporder-context-collapse-all').click()

    await expect(page.getByTestId('shoporder-root-toggle')).toHaveText('collapsed')
    await expect(page.getByTestId('shoporder-category-cat-drywall')).toHaveCount(0)

    await page.getByTestId('shoporder-root-row').click({ button: 'right' })
    await page.getByTestId('shoporder-context-expand-all').click()

    await expect(page.getByTestId('shoporder-root-toggle')).toHaveText('expanded')
    await expect(page.getByTestId('shoporder-category-cat-drywall')).toBeVisible()
    await expect(page.getByTestId('shoporder-category-cat-all-purpose')).toBeVisible()
  })

  test('catalog item rows keep their full folder path when added to the order', async ({ page }) => {
    await page.goto('/__e2e/shop-order-workspace')

    await page.getByTestId('shoporder-add-item-box').click()

    const orderRow = page.getByTestId('shoporder-order-item-order-item-1')
    await expect(orderRow).toContainText('Drywall Mud / All Purpose Mud / Box')
  })

  test('comments survive autosave echo while the draft stays editable', async ({ page }) => {
    await page.goto('/__e2e/shop-order-workspace')

    const comments = page.getByTestId('shoporder-comments')
    const text = 'Delivery on Thursday 5/7 with 12 boxes and 4 buckets'

    await comments.fill(text)
    await expect(comments).toHaveValue(text)

    await page.waitForTimeout(700)

    await expect(comments).toHaveValue(text)
    await expect(page.getByTestId('shoporder-save-count')).toHaveText('1')
  })

  test('catalog item quantity input is applied when adding an item to the order', async ({ page }) => {
    await page.goto('/__e2e/shop-order-workspace')

    await page.getByTestId('shoporder-quantity-item-box').fill('3')
    await page.getByTestId('shoporder-add-item-box').click()

    await expect(page.getByTestId('shoporder-order-item-qty-order-item-1')).toHaveValue('3')
  })

  test('Thursday delivery shortcut updates the delivery date and autosaves', async ({ page }) => {
    await page.goto('/__e2e/shop-order-workspace')

    await page.getByTestId('shoporder-shortcut').click()

    await page.waitForTimeout(500)

    await expect(page.getByTestId('shoporder-delivery-date')).toHaveValue('2026-05-07')
    await expect(page.getByTestId('shoporder-save-count')).toHaveText('1')
  })

  test('removing the last item returns the empty state placeholder', async ({ page }) => {
    await page.goto('/__e2e/shop-order-workspace')

    await page.getByTestId('shoporder-add-item-box').click()
    await page.getByTestId('shoporder-order-item-remove-order-item-1').click()

    await expect(page.getByTestId('shoporder-empty')).toBeVisible()
    await expect(page.getByTestId('shoporder-order-item-order-item-1')).toHaveCount(0)
  })

  test('submitted orders render plain values instead of editable controls', async ({ page }) => {
    await page.goto('/__e2e/shop-order-workspace')

    await page.getByTestId('shoporder-add-item-box').click()
    await page.getByTestId('shoporder-comments').fill('Keep this read only after submit')
    await page.waitForTimeout(700)
    await page.getByTestId('shoporder-submit').click()

    await expect(page.getByTestId('shoporder-comments')).toHaveCount(0)
    await expect(page.getByTestId('shoporder-comments-readonly')).toHaveText('Keep this read only after submit')
    await expect(page.getByTestId('shoporder-order-item-remove-order-item-1')).toHaveCount(0)
    await expect(page.getByTestId('shoporder-order-item-qty-readonly-order-item-1')).toHaveText('1')
  })
})
