import { expect, test, type Page } from './helpers/test.js'
import { createShopOrdersFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

const longLabel = 'Screws - Extra Long Construction Fastener Description With Corrosion Resistant Coating - Box of 1000'

function catalogFixture() {
  const fixture = createShopOrdersFixture()
  fixture.shopCategories = [
    { id: 'screws', name: 'Screws', parentId: null, active: true },
    { id: 'nested', name: 'Nested fasteners', parentId: 'screws', active: true },
    { id: 'deep', name: 'Coated fasteners', parentId: 'nested', active: true },
  ]
  fixture.shopCatalogItems = Array.from({ length: 18 }, (_, index) => ({
    id: `screw-${index}`, description: index === 0 ? longLabel : `Screws ${index + 1} - Box of 1000`,
    categoryId: 'screws', sku: null, price: 123.45, active: true,
  }))
  fixture.shopCatalogItems.push({
    id: 'nested-screw', description: longLabel, categoryId: 'deep', sku: null, price: 9.99, active: true,
  })
  return fixture
}

async function openOrderWorkspace(page: Page) {
  const viewOrder = page.getByTestId('shoporder-view-order')
  if (await viewOrder.isVisible()) await viewOrder.click()
}

// 911px and 683px also cover the CSS viewport of a 1366px laptop at 150%/200% zoom.
for (const width of [320, 390, 683, 768, 911, 960, 1180, 1280, 1366, 1440, 1600, 1920]) {
  test(`searched screws keep readable labels and controls at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    await gotoPhase2App(page, '/jobs/job-e2e/shop-orders', catalogFixture())
    await page.getByTestId('shoporder-catalog-search').fill('screws')
    const folder = page.getByTestId('shoporder-category-screws')
    await expect(folder).toContainText('18 items')
    const item = page.getByTestId('shoporder-item-screw-0')
    await expect(item).toBeVisible()
    await folder.click()
    await expect(item).toHaveCount(0)
    await folder.click()
    await expect(item).toBeVisible()
    await item.scrollIntoViewIfNeeded()
    const measurements = await page.locator('.shop-orders-tree-node--item').evaluateAll((rows) => rows.map((row) => {
      const label = row.querySelector('.shop-orders-tree-node__label')!
      const price = row.querySelector('.shop-orders-tree-node__price')!
      const quantity = row.querySelector('input')!
      const add = row.querySelector('.shop-orders-tree-node__add')!
      const bounds = row.getBoundingClientRect()
      return {
        id: row.getAttribute('data-testid'), rowWidth: bounds.width,
        labelWidth: label.getBoundingClientRect().width, labelHeight: label.getBoundingClientRect().height,
        quantityWidth: quantity.getBoundingClientRect().width,
        fits: row.scrollWidth <= row.clientWidth + 1 && bounds.right <= window.innerWidth + 1,
        controlsFit: [price, quantity, add].every((control) => {
          const rect = control.getBoundingClientRect()
          return rect.left >= bounds.left && rect.right <= bounds.right + 1
        }),
        labelBeforeControls: label.getBoundingClientRect().right <= quantity.getBoundingClientRect().left + 1,
      }
    }))
    await testInfo.attach('catalog-measurements', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' })
    await page.screenshot({ path: testInfo.outputPath(`catalog-${width}.png`), fullPage: true })
    for (const measurement of measurements) {
      expect(measurement.labelWidth, measurement.id ?? '').toBeGreaterThanOrEqual(Math.min(96, measurement.rowWidth / 3))
      expect(measurement.quantityWidth).toBeLessThanOrEqual(60)
      expect(measurement.fits).toBe(true)
      expect(measurement.controlsFit).toBe(true)
      expect(measurement.labelBeforeControls).toBe(true)
    }
    await expect(item.locator('.shop-orders-tree-node__label')).toHaveText(longLabel)
    await expect(page.getByTestId('shoporder-item-nested-screw')).toBeVisible()
    await page.getByTestId('shoporder-quantity-screw-0').fill('3')
    await page.getByTestId('shoporder-add-screw-0').click()
    await openOrderWorkspace(page)
    await expect(page.getByTestId('shoporder-order-item-qty-screw-0')).toHaveValue('3')
  })
}
