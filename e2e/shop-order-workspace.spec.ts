import { expect, test, type Page } from './helpers/test.js'
import { createShopOrdersFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

async function expandAllCatalogFolders(page: Page) {
  await page.getByTestId('shoporder-root-row').click({ button: 'right' })
  await page.getByTestId('shoporder-context-expand-all').click()
}

async function gotoShopOrderApp(page: Page) {
  await gotoPhase2App(page, '/jobs/job-e2e/shop-orders', createShopOrdersFixture())
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

  test('custom items can be added from the real custom item form', async ({ page }) => {
    await gotoShopOrderApp(page)

    await page.getByLabel('Description').fill('Lift Rental')
    await page.getByLabel('Quantity').fill('2')
    await page.getByLabel('Note').fill('North dock delivery')
    await page.getByRole('button', { name: 'Add Custom Item' }).click()

    await expect(page.locator('.shop-orders-items-list')).toContainText('Lift Rental')
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          shopOrders?: Array<{
            id: string
            items?: Array<{ description?: string; quantity?: number | null; note?: string; sourceType?: string }>
          }>
        }
        const draftOrder = state.shopOrders?.find((order) => order.id === 'order-draft')
        return draftOrder?.items?.[0] ?? null
      }))
      .toMatchObject({
        description: 'Lift Rental',
        quantity: 2,
        note: 'North dock delivery',
        sourceType: 'custom',
      })
  })

  test('comments survive autosave echo while the draft stays editable', async ({ page }) => {
    await gotoShopOrderApp(page)

    const comments = page.getByTestId('shoporder-comments')
    const text = 'Delivery on Thursday 5/7 with 12 boxes and 4 buckets'

    await comments.fill(text)
    await expect(comments).toHaveValue(text)

    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          shopOrders?: Array<{ id: string; comments?: string | null }>
        }
        return state.shopOrders?.find((order) => order.id === 'order-draft')?.comments ?? ''
      }))
      .toBe(text)

    await expect(comments).toHaveValue(text)
  })

  test('item notes autosave while typing without waiting for blur', async ({ page }) => {
    const fixture = createShopOrdersFixture()
    fixture.delays = { shopOrderUpdateMs: 250 }

    await gotoPhase2App(page, '/jobs/job-e2e/shop-orders', fixture)

    await expandAllCatalogFolders(page)
    await page.getByTestId('shoporder-add-item-box').click()

    const noteInput = page.getByTestId('shoporder-order-item-note-item-box')
    const noteText = 'Leave at north dock Friday AM'

    await noteInput.click()
    await noteInput.pressSequentially(noteText, { delay: 20 })

    await expect(noteInput).toHaveValue(noteText)
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          shopOrders?: Array<{ id: string; items?: Array<{ note?: string | null }> }>
        }
        const draftOrder = state.shopOrders?.find((order) => order.id === 'order-draft')
        return draftOrder?.items?.[0]?.note ?? ''
      }))
      .toBe(noteText)
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
    await expect
      .poll(async () => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          shopOrders?: Array<{ id: string; comments?: string | null }>
        }
        return state.shopOrders?.find((order) => order.id === 'order-draft')?.comments ?? ''
      }))
      .toBe('Keep this read only after submit')
    await page.getByTestId('shoporder-submit').click()

    await expect(page.getByTestId('shoporder-comments')).toHaveCount(0)
    await expect(page.getByTestId('shoporder-comments-readonly')).toHaveText('Keep this read only after submit')
    await expect(page.getByTestId('shoporder-order-item-remove-item-box')).toHaveCount(0)
    await expect(page.getByTestId('shoporder-order-item-qty-readonly-item-box')).toHaveText('1')
  })

  test('submitted orders show the same order number in the workspace header and history list', async ({ page }) => {
    await gotoShopOrderApp(page)

    await expandAllCatalogFolders(page)
    await page.getByTestId('shoporder-add-item-box').click()
    await page.getByTestId('shoporder-submit').click()

    await expect(page.locator('.shop-orders-workspace-strip__identity')).toContainText('Order #20260604163341')
    await expect(page.locator('.shop-orders-history-list')).toContainText('Order #20260604163341')
  })

  test('starting a new order from submitted history clears the previous order state', async ({ page }) => {
    await gotoShopOrderApp(page)

    await page.locator('.shop-orders-history-row').filter({ hasText: 'Order #20260604145900' }).click()

    await expect(page.getByTestId('shoporder-comments-readonly')).toHaveText('Previous order')
    await expect(page.getByTestId('shoporder-comments')).toHaveCount(0)

    await page.getByTestId('shoporder-new-order').click()

    await expect(page.getByTestId('shoporder-comments')).toHaveValue('')
    await expect(page.getByTestId('shoporder-comments-readonly')).toHaveCount(0)
    await expect(page.getByTestId('shoporder-empty')).toBeVisible()
    await expect(page.getByTestId('shoporder-delivery-date')).toHaveValue('2026-06-11')
  })
})
