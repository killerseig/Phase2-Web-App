import { readFileSync } from 'node:fs'
import { expect, test } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'

test('unconfigured employee analytics leaves navigation intact and makes no provider requests', async ({ page }) => {
  const providerRequests: string[] = []
  await page.route(/https:\/\/[^/]*(?:googletagmanager\.com|google-analytics\.com)\//, route => {
    providerRequests.push(new URL(route.request().url()).hostname)
    return route.abort()
  })
  await gotoPhase2App(page, '/jobs', createJobsFixture())
  await expect(page.getByRole('heading', { name: 'Jobs', exact: true })).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Employee analytics choices' })).toHaveCount(0)
  await expect(page.locator('script[data-phase2-analytics]')).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Jobs', exact: true })).toBeVisible()
  expect(providerRequests).toEqual([])
})

test('the standalone public entry renders without analytics requests when activation is unconfigured', async ({ page }) => {
  const providerRequests: string[] = []
  await page.route(/https:\/\/[^/]*(?:googletagmanager\.com|google-analytics\.com)\//, route => {
    providerRequests.push(new URL(route.request().url()).hostname)
    return route.abort()
  })
  await page.route('**/getPublishedWebsite*', route => route.fulfill({ json: { result: { site: { name: 'Synthetic public site', accent: '#174878', pages: [{ id: 'home', slug: 'home', title: 'Home', description: '', sections: [] }] }, version: 'public-1' } } }))
  await page.route('http://127.0.0.1:5196/', route => route.fulfill({ body: readFileSync('public-site.html', 'utf8'), contentType: 'text/html' }))
  await page.goto('/')
  await expect(page.locator('#app')).toHaveAttribute('data-public-ready', 'true')
  await expect(page.locator('.public-website')).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Website analytics choices' })).toHaveCount(0)
  await expect(page.locator('script[data-phase2-analytics]')).toHaveCount(0)
  expect(providerRequests).toEqual([])
})
