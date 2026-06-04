#!/usr/bin/env node

const assert = require('node:assert/strict')

const { buildShopOrderEmail } = require('../emailService.js')

function extractInlineField(html, label) {
  const match = html.match(new RegExp(`<strong>${label}:<\\/strong>\\s*([^<]+)`))
  return match ? match[1].trim() : null
}

function runScenario(name, order, expectedDeliveryDate) {
  const html = buildShopOrderEmail(order)

  assert.equal(html.includes('Status:'), false, `${name}: email should not include Status`)
  assert.equal(html.includes('Sign-Off'), false, `${name}: email should not include Sign-Off`)
  assert.equal(html.includes('Approved By'), false, `${name}: email should not include Approved By`)
  assert.equal(html.includes('Ordered By'), false, `${name}: email should not include Ordered By`)
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
  assert.equal(html.includes('Part #'), false, `${name}: email should not include the part number column`)
  assert.equal(html.includes('Pulled<br>By'), true, `${name}: email should include the pulled by column`)
  assert.equal(html.includes('Verified<br>By'), true, `${name}: email should include the verified by column`)
  assert.equal(html.includes('133/513'), true, `${name}: email should include the 133/513 column`)
  assert.equal(html.includes('Item Name'), true, `${name}: email should use the item name column heading`)
  assert.equal(html.includes('End of Order'), true, `${name}: email should include the end of order marker`)
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

console.log('Shop order email smoke test passed.')
