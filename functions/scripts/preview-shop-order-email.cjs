#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

const { buildShopOrderEmail } = require('../emailService.js')

const sampleFixturePath = path.resolve(__dirname, 'shop-order-email.sample.json')
const defaultOutputPath = path.resolve(__dirname, '..', 'tmp', 'shop-order-email-preview.html')

function extractInlineField(html, label) {
  const match = html.match(new RegExp(`<strong>${label}:<\\/strong>\\s*([^<]+)`))
  return match ? match[1].trim() : 'Not found'
}

function loadFixture(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath)
  const raw = fs.readFileSync(absolutePath, 'utf8')
  const parsed = JSON.parse(raw)

  if (parsed && typeof parsed === 'object' && parsed.order) {
    return {
      fixturePath: absolutePath,
      order: parsed.order,
      costCodesByCatalogItemId: parsed.costCodesByCatalogItemId || {},
    }
  }

  return {
    fixturePath: absolutePath,
    order: parsed,
    costCodesByCatalogItemId: parsed?.costCodesByCatalogItemId || {},
  }
}

function main() {
  const fixtureArg = process.argv[2] || sampleFixturePath
  const outputArg = process.argv[3]
  const { fixturePath, order, costCodesByCatalogItemId } = loadFixture(fixtureArg)
  const outputPath = outputArg
    ? path.resolve(process.cwd(), outputArg)
    : defaultOutputPath

  const html = buildShopOrderEmail(order, costCodesByCatalogItemId)

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, html, 'utf8')

  console.log(`Preview fixture: ${fixturePath}`)
  console.log(`Preview HTML: ${outputPath}`)
  console.log(`Contains "Status:": ${html.includes('Status:')}`)
  console.log(`Contains "Sign-Off": ${html.includes('Sign-Off')}`)
  console.log(`Contains "Approved By": ${html.includes('Approved By')}`)
  console.log(`Contains "Online Shop Order": ${html.includes('Online Shop Order')}`)
  console.log(`Contains "Generated from Phase 2": ${html.includes('Generated from Phase 2')}`)
  console.log(`Contains "Transfer From": ${html.includes('Transfer From')}`)
  console.log(`Contains "Desired Delivery Date": ${html.includes('Desired Delivery Date')}`)
  console.log(`Contains "Job:": ${html.includes('<strong>Job:</strong>')}`)
  console.log(`Contains "Layout": ${html.includes('Layout')}`)
  console.log(`Contains "Loaded / Pending": ${html.includes('Loaded / Pending')}`)
  console.log(`Contains "Received": ${html.includes('Received')}`)
  console.log(`Contains "Job # Trans. To": ${html.includes('Job # Trans. To')}`)
  console.log(`Contains "Part #": ${html.includes('Part #')}`)
  console.log(`Contains "Pulled By": ${html.includes('Pulled<br>By')}`)
  console.log(`Contains "Verified By": ${html.includes('Verified<br>By')}`)
  console.log(`Contains "133/513": ${html.includes('133/513')}`)
  console.log(`Contains "Item Name": ${html.includes('Item Name')}`)
  console.log(`Contains "End of Order": ${html.includes('End of Order')}`)
  console.log(`Contains "Standard Items:": ${html.includes('Standard Items:')}`)
  console.log(`Contains "Start Up / Foreman Book": ${html.includes('Start Up / Foreman Book')}`)
  console.log(`Date Ordered: ${extractInlineField(html, 'Date Ordered')}`)
  console.log(`Desired Delivery Date: ${extractInlineField(html, 'Desired Delivery Date')}`)
  console.log(`Job: ${extractInlineField(html, 'Job')}`)
}

main()
