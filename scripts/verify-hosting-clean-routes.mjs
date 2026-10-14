import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
const shell = readFileSync('dist/employee-app.html', 'utf8')
const host = 'http://127.0.0.1:5000'
for (const [old, clean] of [['/website?source=email', '/?source=email'], ['/website/home?source=email', '/?source=email'], ['/website/company?source=email', '/company?source=email']]) {
  const response = await fetch(host + old, { redirect: 'manual' })
  assert.equal(response.status, 301)
  const destination = new URL(response.headers.get('location'), host)
  assert.equal(destination.pathname + destination.search, clean)
}
for (const route of ['/login', '/reports', '/company-library', '/jobs', '/jobs/example/shop-orders', '/admin/forms', '/admin/website', '/forms/example', '/safety/sds', '/users', '/employees', '/exports/timecards', '/settings/shop-catalog']) {
  const response = await fetch(host + route)
  assert.equal(response.status, 200, route)
  assert.equal(await response.text(), shell, route + ' retains the employee shell')
}
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.goto('http://127.0.0.1:5822/website/company?source=email#people')
  await page.waitForFunction(() => document.getElementById('app')?.dataset.publicReady === 'true')
  assert.equal(new URL(page.url()).pathname + new URL(page.url()).search + new URL(page.url()).hash, '/company?source=email#people')
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), '/company')
  assert.equal(await page.locator('a[href^="/website/"]').count(), 0)
} finally { await browser.close() }
console.log('Passed Hosting legacy 301/query redirects, 13 reserved app shell routes, browser fragment preservation and clean canonical/navigation links.')
