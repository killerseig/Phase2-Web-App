#!/usr/bin/env node

const assert = require('node:assert/strict')

const {
  buildShopOrderEmail,
  buildShopOrderPdfBuffer,
  buildShopOrderPdfFilename,
} = require('../emailService.js')

function extractInlineField(html, label) {
  const match = html.match(new RegExp(`<strong>${label}:<\\/strong>\\s*([^<]+)`))
  return match ? match[1].trim() : null
}

function countMatches(html, text) {
  return html.split(text).length - 1
}

function countPdfPages(pdfBuffer) {
  return (pdfBuffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length
}

function runScenario(name, order, expectedDeliveryDate) {
  const html = buildShopOrderEmail(order)

  assert.equal(html.includes('Status:'), false, `${name}: email should not include Status`)
  assert.equal(html.includes('Sign-Off'), false, `${name}: email should not include Sign-Off`)
  assert.equal(html.includes('Approved By'), false, `${name}: email should not include Approved By`)
  assert.equal(html.includes('Ordered By'), false, `${name}: email should not include Ordered By`)
  assert.equal(html.includes('All rights reserved'), false, `${name}: email should not include the generic footer`)
  assert.equal(html.includes('class="footer"'), false, `${name}: email should not include the generic footer block`)
  assert.equal(html.includes('Chris (CJ) Larsen'), true, `${name}: email should include the foreman name`)
  assert.equal(html.includes('Generated from Phase 2'), false, `${name}: email should not include the generated footer copy`)
  assert.equal(html.includes('Transfer From'), false, `${name}: email should not include the transfer from field`)
  assert.equal(html.includes('Layout'), false, `${name}: email should not include the layout box`)
  assert.equal(html.includes('Not requested'), false, `${name}: email should not show "Not requested"`)
  assert.equal(html.includes('Online Shop Order'), true, `${name}: email should use the online shop order title`)
  assert.equal(html.includes('Desired Delivery Date'), true, `${name}: email should use the desired delivery date label`)
  assert.equal(html.includes('<strong>Job:</strong>'), true, `${name}: email should include the job line`)
  assert.equal(html.includes('Loaded / Pending'), false, `${name}: email should not include the loaded/pending column`)
  assert.equal(html.includes('Job # Trans. To'), false, `${name}: email should not include the transfer-to column`)
  assert.equal(html.includes('Part#'), true, `${name}: email should include the part number column`)
  assert.equal(html.includes('Pulled<br>By'), true, `${name}: email should include the pulled by column`)
  assert.equal(html.includes('Verified<br>By'), true, `${name}: email should include the verified by column`)
  assert.equal(html.includes('133/513'), true, `${name}: email should include the 133/513 column`)
  assert.equal(html.includes('Item Name'), true, `${name}: email should use the item name column heading`)
  assert.equal(html.includes('End of Order'), true, `${name}: email should include the end of order marker`)
  assert.equal(html.includes('shop-order-email__items-table'), true, `${name}: email should include the print-safe shop order items table class`)
  assert.equal(html.includes('shop-order-email__document'), true, `${name}: email should force a fixed-width paper document wrapper`)
  assert.equal(html.includes('width: 980px'), true, `${name}: email should use a fixed 980px document width`)
  assert.equal(html.includes('width: 952px'), true, `${name}: item table should use a fixed table width`)
  assert.equal(html.includes('display: table-header-group !important;'), true, `${name}: printed table headers should be forced for paged print layouts`)
  assert.equal(html.includes('page-break-inside: avoid !important; break-inside: avoid-page !important;'), true, `${name}: item rows should avoid splitting across printed pages`)
  assert.equal(html.includes('height: 30px;'), true, `${name}: row height should stay compact for printing`)
  assert.equal(html.includes('border: 2px solid #9b9b9b'), true, `${name}: item table outer border should be stronger for weak printers`)
  assert.equal(html.includes('Standard Items:'), false, `${name}: email should not include the standard items heading`)
  assert.equal(html.includes('./ *Start Up / Foreman Book'), false, `${name}: email should not include folder paths in item names`)
  assert.equal(html.includes('./ *Start Up / Job Posters'), false, `${name}: email should not include folder paths in item names`)
  assert.equal(html.includes('Foreman Book'), true, `${name}: email should include the item name itself`)
  assert.equal(html.includes('Job Posters'), true, `${name}: email should include the item name itself`)
  assert.equal(
    extractInlineField(html, 'Date Ordered'),
    '6/4/2026',
    `${name}: date ordered should stay on 6/4/2026`,
  )
  assert.equal(
    extractInlineField(html, 'Desired Delivery Date'),
    expectedDeliveryDate,
    `${name}: delivery date should be ${expectedDeliveryDate}`,
  )
  assert.equal(
    extractInlineField(html, 'Job'),
    'Phase 2 Company Acoustical remodel - 1A',
    `${name}: job line should include the job name and number`,
  )
}

const sharedOrderFields = {
  jobCode: '1A',
  jobName: 'Phase 2 Company Acoustical remodel',
  orderDate: '2026-06-04',
  createdAt: '2026-06-04T09:00:00Z',
  foremanName: 'Chris (CJ) Larsen',
  comments: 'Email smoke test',
  items: [
    {
      description: './ *Start Up / Job Posters',
      quantity: 2,
      receivedQuantity: 0,
      backorderedQuantity: 0,
      note: '',
    },
    {
      description: './ *Start Up / Foreman Book',
      quantity: 1,
      receivedQuantity: 0,
      backorderedQuantity: 0,
      note: '',
    },
  ],
}

const combinedItemHtml = buildShopOrderEmail({
  ...sharedOrderFields,
  deliveryDate: '2026-06-11',
  items: [
    ...sharedOrderFields.items,
    {
      description: 'Special order bottled water',
      quantity: 5,
      note: 'Special item',
    },
  ],
})

assert.equal(
  countMatches(combinedItemHtml, 'Online Shop Order'),
  1,
  'special/custom items should stay in the same order document instead of creating a second table section',
)
assert.equal(
  countMatches(combinedItemHtml, '<table class="shop-order-email__items-table"'),
  1,
  'special/custom items should render in the same item table as normal catalog items',
)
assert.equal(
  combinedItemHtml.includes('Special order bottled water'),
  true,
  'special/custom item should render in the main item table',
)

runScenario(
  'explicit delivery date',
  {
    ...sharedOrderFields,
    deliveryDate: '2026-06-11',
    status: 'submitted',
  },
  '6/11/2026',
)

runScenario(
  'missing delivery date fallback',
  {
    ...sharedOrderFields,
    deliveryDate: '',
    status: 'submitted',
  },
  '6/11/2026',
)

const longOrderHtml = buildShopOrderEmail({
  ...sharedOrderFields,
  deliveryDate: '2026-06-11',
  status: 'submitted',
  items: Array.from({ length: 45 }, (_, index) => ({
    description: `./ Adhesive / Long Print Item ${index + 1}`,
    quantity: 1,
    receivedQuantity: 0,
    backorderedQuantity: 0,
    note: '',
  })),
})

assert.equal(
  countMatches(longOrderHtml, 'Pulled<br>By'),
  1,
  'long order: email body should keep one visible item table instead of splitting into multiple tables',
)
assert.equal(
  countMatches(longOrderHtml, '<table class="shop-order-email__items-table"'),
  1,
  'long order: all items should render in one item table',
)
assert.equal(
  longOrderHtml.includes('display: table-header-group !important;'),
  true,
  'long order: single table should still request printed table-header repetition',
)
assert.equal(
  longOrderHtml.includes('page-break-before: always; break-before: page;'),
  false,
  'long order: email body should not create separate continued table sections',
)

async function main() {
  const pdfBuffer = await buildShopOrderPdfBuffer({
    ...sharedOrderFields,
    deliveryDate: '2026-06-11',
  })
  assert.equal(Buffer.isBuffer(pdfBuffer), true, 'shop order PDF should return a buffer')
  assert.equal(pdfBuffer.length > 0, true, 'shop order PDF should not be empty')
  const longPdfBuffer = await buildShopOrderPdfBuffer({
    ...sharedOrderFields,
    deliveryDate: '2026-06-11',
    status: 'submitted',
    items: Array.from({ length: 45 }, (_, index) => ({
      description: `./ Adhesive / Long Print Item ${index + 1}`,
      quantity: 1,
      receivedQuantity: 0,
      backorderedQuantity: 0,
      note: '',
    })),
  })
  assert.equal(Buffer.isBuffer(longPdfBuffer), true, 'long shop order PDF should return a buffer')
  assert.equal(longPdfBuffer.length > 0, true, 'long shop order PDF should not be empty')
  assert.equal(
    countPdfPages(longPdfBuffer) > 1,
    true,
    'long shop order PDF should span multiple pages so repeated PDF headers are exercised',
  )
  assert.equal(
    buildShopOrderPdfFilename({ orderNumber: '20260610170629' }),
    'Online Shop Order 20260610170629.pdf',
    'shop order PDF filename should include the order number',
  )

  console.log('Shop order email smoke test passed.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
