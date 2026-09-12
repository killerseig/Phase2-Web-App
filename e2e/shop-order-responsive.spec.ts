import type { Locator } from '@playwright/test'
import { expect, test, type Page } from './helpers/test.js'
import { createShopOrdersFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

const longDescription = 'Extra Long Construction Supply Item Name That Needs Another Line To Stay Readable'

async function openOrderWorkspace(page: Page) {
  const viewOrder = page.getByTestId('shoporder-view-order')
  if (await viewOrder.isVisible()) {
    await viewOrder.tap()
    await expect(page.getByRole('dialog', { name: 'Your Order', exact: true })).toHaveCSS('transform', 'none')
  }
}

async function expectContentToFit(locator: Locator) {
  const measurements = await locator.evaluateAll((elements) => elements.map((element) => {
    const bounds = element.getBoundingClientRect()
    return {
      label: element.getAttribute('data-testid') || element.className,
      fits: element.scrollWidth <= element.clientWidth + 1
        && bounds.left >= 0 && bounds.right <= window.innerWidth + 1,
    }
  }))
  expect(measurements.length).toBeGreaterThan(0)
  expect(measurements.filter((measurement) => !measurement.fits)).toEqual([])
}

test.describe('shop orders on phones and tablets', () => {
  test.use({ hasTouch: true })

  for (const viewport of [
    { width: 320, height: 900 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1180, height: 820 },
    { width: 1366, height: 1024 },
  ]) {
    test(`order items stay readable and editable at ${viewport.width} × ${viewport.height}`, async ({ page }) => {
      const fixture = createShopOrdersFixture()
      const catalogItem = fixture.shopCatalogItems.find((item) => item.id === 'item-box')!
      catalogItem.description = longDescription
      fixture.shopOrders[0]!.items = [{
        id: 'custom-blanket',
        sourceType: 'custom',
        catalogItemId: null,
        description: 'Special fire blanket',
        quantity: 1,
        price: null,
        note: '',
        categoryId: null,
        sku: 'FB-12',
      }]

      await page.setViewportSize(viewport)
      await gotoPhase2App(page, '/jobs/job-e2e/shop-orders', fixture)
      const header = page.locator('.shop-orders-tree-pane__header')
      await expect(header.getByTestId('shoporder-new-order')).toBeVisible()
      await expect(page.getByTestId('shoporder-new-order')).toHaveCount(1)
      await expectContentToFit(header.locator('.app-pane-header__copy, .shop-order-page-actions, button'))
      await expect(page.getByTestId('shoporder-order-item-price-custom-blanket')).toHaveText('No price')
      await page.getByTestId('shoporder-catalog-search').fill('Extra Long')
      const catalogRow = page.getByTestId('shoporder-item-item-box')
      await expect(catalogRow).toBeVisible()
      await expectContentToFit(catalogRow.locator('.shop-orders-tree-node__label'))
      await expect(catalogRow.locator('.shop-orders-tree-node__label')).toHaveCSS('white-space', 'normal')

      const addButton = page.getByTestId('shoporder-add-item-box')
      const addBounds = await addButton.boundingBox()
      expect(addBounds!.width).toBeGreaterThanOrEqual(32)
      expect(addBounds!.height).toBeLessThanOrEqual(32)
      const catalogQuantity = page.getByTestId('shoporder-quantity-item-box')
      const quantityBounds = await catalogQuantity.boundingBox()
      expect(quantityBounds!.height).toBe(32)
      const customQuantity = page.locator('.shop-order-custom-item-form input[type="number"]')
      expect((await customQuantity.boundingBox())!.height).toBe(32)
      await catalogQuantity.fill('3')
      await addButton.tap()
      await openOrderWorkspace(page)

      const item = page.getByTestId('shoporder-order-item-item-box')
      const quantity = page.getByTestId('shoporder-order-item-qty-item-box')
      const note = page.getByTestId('shoporder-order-item-note-item-box')
      await expect(quantity).toHaveValue('3')
      await expect(item.locator('.shop-orders-item-card__name')).toHaveText(longDescription)
      await quantity.scrollIntoViewIfNeeded()
      expect((await quantity.boundingBox())!.height).toBe(32)
      await expectContentToFit(item.locator('.shop-orders-item-card__name, .shop-orders-item-card__field, button, input, textarea'))
      await expectContentToFit(page.locator('.shop-orders-items-list, .shop-orders-workspace-pane, .shop-order-meta-form'))
      await quantity.fill('4')
      await note.tap()
      await expect(page.getByTestId('shoporder-order-item-line-total-item-box')).toHaveText('$50.00')
      const noteText = 'Deliver to the north entrance.\nCall the foreman before unloading.'
      await note.fill(noteText)
      await note.blur()
      await expect.poll(() => page.evaluate(() => {
        const state = window.__PHASE2_E2E_STATE__ as {
          shopOrders?: Array<{ id: string; items: Array<{ catalogItemId: string | null; note: string }> }>
        }
        return state.shopOrders?.find((order) => order.id === 'order-draft')
          ?.items.find((item) => item.catalogItemId === 'item-box')?.note
      })).toBe(noteText)

      await page.getByTestId('shoporder-order-item-remove-custom-blanket').tap()
      await page.getByRole('dialog', { name: 'Remove item?' }).getByRole('button', { name: 'Remove Item' }).tap()
      await expect(page.getByTestId('shoporder-order-item-custom-blanket')).toHaveCount(0)
      await expect(quantity).toHaveValue('4')

      await page.getByTestId('shoporder-submit').tap()
      await page.getByRole('dialog', { name: 'Submit shop order?' }).getByRole('button', { name: 'Submit Order' }).tap()
      await expect(page.getByTestId('shoporder-order-item-qty-readonly-item-box')).toHaveText('4')
      await expect(page.getByTestId('shoporder-order-item-note-readonly-item-box')).toHaveText(noteText)
      await expect(page.getByTestId('shoporder-order-item-remove-item-box')).toHaveCount(0)
      await item.scrollIntoViewIfNeeded()
      await expectContentToFit(item.locator('.shop-orders-item-card__name, .shop-orders-item-card__field'))
    })
  }
})

test.describe('shop order drawer', () => {
  test.use({ hasTouch: true })

  for (const width of [390, 768, 1366]) {
    test(`a twelve-item order stays in compact aligned rows at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 })
      const fixture = createShopOrdersFixture()
      fixture.shopOrders[0]!.items = Array.from({ length: 12 }, (_, index) => ({
        id: `line-${index}`,
        sourceType: 'catalog',
        catalogItemId: `line-${index}`,
        description: `Gloves ${String(index + 1).padStart(2, '0')}`,
        quantity: 2,
        price: 12.5,
        note: '',
        categoryId: null,
        sku: null,
      }))
      await gotoPhase2App(page, '/jobs/job-e2e/shop-orders', fixture)
      await expect(page.getByTestId('shoporder-new-order')).toBeVisible()
      await openOrderWorkspace(page)
      const heading = page.locator('.shop-orders-items-head')
      await expect(heading).toBeVisible()
      await heading.evaluate((element) => element.scrollIntoView({ block: 'start' }))
      const rows = page.locator('.shop-orders-item-card')
      await expect(rows).toHaveCount(12)
      const rowLayouts = await rows.evaluateAll((elements) => elements.map((row) => {
        const name = row.querySelector('.shop-orders-item-card__main')!.getBoundingClientRect()
        const quantity = row.querySelector('.shop-orders-item-card__quantity')!.getBoundingClientRect()
        const total = row.querySelector('.shop-orders-item-card__total')!.getBoundingClientRect()
        return {
          height: row.getBoundingClientRect().height,
          aligned: name.right <= quantity.left && quantity.right <= total.left
            && Math.abs(quantity.top - total.top) < 1,
          fits: row.scrollWidth <= row.clientWidth,
        }
      }))
      for (const row of rowLayouts) {
        expect(row.height).toBeLessThanOrEqual(width === 390 ? 96 : 52)
        expect(row.aligned).toBe(true)
        expect(row.fits).toBe(true)
      }
      const visibleRows = await rows.evaluateAll((elements) => elements.filter((row) => {
        const bounds = row.getBoundingClientRect()
        return bounds.top >= 65 && bounds.bottom <= window.innerHeight
      }).length)
      expect(visibleRows).toBeGreaterThanOrEqual(width === 390 ? 8 : 12)
    })
  }

  for (const width of [390, 768, 1024, 1180]) {
    test(`reviewing an order preserves the catalog position at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      const fixture = createShopOrdersFixture()
      for (let index = 0; index < 30; index += 1) {
        fixture.shopCatalogItems.push({
          id: `supply-${index}`,
          description: `Supply ${String(index).padStart(2, '0')} - Case of 12`,
          categoryId: 'cat-all-purpose',
          sku: null,
          price: 108,
          active: true,
        })
      }
      await gotoPhase2App(page, '/jobs/job-e2e/shop-orders', fixture)
      const viewOrder = page.getByTestId('shoporder-view-order')
      const header = page.locator('.shop-orders-tree-pane__header')
      await expect(header.getByTestId('shoporder-view-order')).toBeVisible()
      await expect(page.locator('.app-shell__topbar').getByTestId('shoporder-view-order')).toHaveCount(0)
      const headerBounds = (await header.boundingBox())!
      const triggerBounds = (await viewOrder.boundingBox())!
      const newOrderBounds = (await header.getByTestId('shoporder-new-order').boundingBox())!
      expect(triggerBounds.y).toBeGreaterThanOrEqual(headerBounds.y)
      expect(triggerBounds.y).toBeLessThan(headerBounds.y + 30)
      expect(triggerBounds.x + triggerBounds.width).toBeGreaterThan(headerBounds.x + headerBounds.width - 30)
      expect(newOrderBounds.x).toBe(triggerBounds.x)
      expect(newOrderBounds.y).toBeGreaterThan(triggerBounds.y + triggerBounds.height)
      const search = page.getByTestId('shoporder-catalog-search')
      await search.fill('Supply')
      const row = page.getByTestId('shoporder-item-supply-20')
      await row.scrollIntoViewIfNeeded()
      const rowBounds = await row.boundingBox()
      expect(rowBounds!.height).toBeLessThanOrEqual(64)
      await page.getByTestId('shoporder-add-supply-20').tap()

      await expect(viewOrder).toContainText('1')
      await viewOrder.scrollIntoViewIfNeeded()
      const scrollPosition = () => page.evaluate(() => ({
        page: document.querySelector('.app-shell__content')!.scrollTop,
        catalog: document.querySelector('[data-testid="shoporder-catalog-tree"]')!.scrollTop,
      }))
      const before = await scrollPosition()
      await viewOrder.tap()
      const drawer = page.getByRole('dialog', { name: 'Your Order', exact: true })
      const back = page.getByTestId('shoporder-close-drawer')
      await expect(drawer).toBeVisible()
      await expect(drawer).toHaveCSS('transform', 'none')
      await expect(back).toBeFocused()
      await expect(back).toHaveAttribute('aria-label', 'Close order')
      await expect.poll(async () => (await drawer.boundingBox())!.x).toBeGreaterThanOrEqual(39)
      await expect(page.getByTestId('shoporder-order-item-supply-20')).toBeVisible()
      await expectContentToFit(drawer)

      const note = page.getByTestId('shoporder-order-item-note-supply-20')
      await note.fill('Keep these near the shop entrance.')
      await back.tap()
      await expect(drawer).toBeHidden()
      await expect(viewOrder).toBeFocused()
      expect(await scrollPosition()).toEqual(before)
      await expect(search).toHaveValue('Supply')

      await viewOrder.tap()
      await expect(note).toHaveValue('Keep these near the shop entrance.')
      await page.getByTestId('shoporder-order-item-remove-supply-20').tap()
      const confirm = page.getByRole('dialog', { name: 'Remove item?', exact: true })
      const cancel = confirm.getByRole('button', { name: 'Cancel', exact: true })
      await expect(cancel).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await expect(confirm.getByRole('button', { name: 'Remove Item', exact: true })).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(cancel).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(confirm).toBeHidden()
      await expect(drawer).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(drawer).toBeHidden()
      expect(await scrollPosition()).toEqual(before)

      await viewOrder.tap()
      await expect(drawer).toBeVisible()
      await page.getByTestId('shoporder-drawer-backdrop').tap({ position: { x: 10, y: 150 } })
      await expect(drawer).toBeHidden()
      await expect(viewOrder).toBeFocused()
      expect(await scrollPosition()).toEqual(before)
    })
  }

  test('New Order in the page header starts a draft after reviewing a submitted order', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const fixture = createShopOrdersFixture()
    fixture.shopOrders = fixture.shopOrders.filter((order) => order.status === 'submitted')
    await gotoPhase2App(page, '/jobs/job-e2e/shop-orders', fixture)
    await expect(page.getByTestId('shoporder-view-order')).toBeVisible()
    await openOrderWorkspace(page)
    await page.locator('.shop-orders-history-row').filter({ hasText: 'Order #20260604145900' }).tap()
    await expect(page.getByTestId('shoporder-delivery-date-readonly')).toBeVisible()
    await page.getByTestId('shoporder-close-drawer').tap()
    await page.locator('.shop-orders-tree-pane__header').getByTestId('shoporder-new-order').tap()
    await expect(page.getByTestId('shoporder-new-order')).toBeEnabled()
    await page.getByTestId('shoporder-catalog-search').fill('Box')
    await page.getByTestId('shoporder-add-item-box').tap()
    await openOrderWorkspace(page)
    await expect(page.getByTestId('shoporder-delivery-date')).toBeEditable()
    await expect(page.getByTestId('shoporder-order-item-qty-item-box')).toHaveValue('1')
    await expect(page.getByTestId('shoporder-submit')).toBeEnabled()
  })

  test('resizing between a drawer and side-by-side panes keeps the same order and note', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await gotoPhase2App(page, '/jobs/job-e2e/shop-orders', createShopOrdersFixture())
    await page.getByTestId('shoporder-catalog-search').fill('Box')
    await page.getByTestId('shoporder-add-item-box').tap()
    await page.getByTestId('shoporder-view-order').tap()
    const note = page.getByTestId('shoporder-order-item-note-item-box')
    await note.fill('Leave at the loading dock.')
    await page.setViewportSize({ width: 1600, height: 1000 })
    await expect(page.getByTestId('shoporder-view-order')).toHaveCount(0)
    await expect(note).toBeVisible()
    await expect(note).toHaveValue('Leave at the loading dock.')
    await note.focus()
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(page.getByRole('dialog', { name: 'Your Order', exact: true })).toBeVisible()
    await expect(note).toHaveValue('Leave at the loading dock.')
    await page.getByTestId('shoporder-close-drawer').tap()
    await expect(page.getByTestId('shoporder-catalog-search')).toHaveValue('Box')
  })
})
