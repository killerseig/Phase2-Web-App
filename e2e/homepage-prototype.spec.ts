import { createRequire } from 'node:module'
const { validateWebsite, publishedWebsite } = createRequire(import.meta.url)(
  '../functions/websiteModel.js',
)
import { readFileSync } from 'node:fs'
import { expect, test } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { homepagePrototype } from './fixtures/homepagePrototype.js'

test('homepage prototype exercises shared design, mobile flow, images and keyboard navigation', async ({
  page,
}) => {
  let draft = validateWebsite(homepagePrototype()),
    published = publishedWebsite(draft),
    version = 1
  await page.route('**/websiteBuilder', async (route) => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers })
      return
    }
    const data = route.request().postDataJSON().data
    let result: unknown = { draft, version, publishedAt: 1, hasPrevious: false }
    if (data.action === 'getImage')
      result = {
        base64: readFileSync('src/assets/images/construction-placeholder.webp').toString('base64'),
      }
    if (data.action === 'save') {
      draft = structuredClone(data.site)
      version++
      result = { version }
    }
    if (data.action === 'publish') {
      published = structuredClone(draft)
      version++
      result = { version, publishedAt: Date.now() }
    }
    await route.fulfill({ headers, json: { result } })
  })
  await page.route('**/getPublishedWebsite', (route) =>
    route.fulfill({
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      json: { result: { site: published } },
    }),
  )
  await page.route('**/website-image?*', (route) =>
    route.fulfill({
      path: 'src/assets/images/construction-placeholder.webp',
      contentType: 'image/webp',
    }),
  )
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page
    .getByRole('group', { name: 'Editor mode', exact: true })
    .getByRole('button', { name: 'Design', exact: true })
    .click()
  await page.getByRole('button', { name: 'Site settings', exact: true }).click()
  const editor = page.getByRole('complementary', { name: 'Content editor' })
  await editor.getByLabel('Heading font', { exact: true }).selectOption('serif')
  await expect(page.locator('.preview-frame h1')).toHaveCSS('font-family', 'Georgia, serif')
  await editor.getByLabel('Body text', { exact: true }).fill('#ffffff')
  await expect(editor.getByRole('list', { name: 'Design readability warnings' })).toContainText(
    'increase color contrast',
  )
  await editor.getByLabel('Body text', { exact: true }).fill('#172c40')
  await editor.getByLabel('Heading font', { exact: true }).selectOption('display')
  await editor.getByLabel('Default flow spacing', { exact: true }).fill('20')
  await editor.getByLabel('Default flow spacing', { exact: true }).press('Tab')
  await expect(page.locator('.preview-frame .flow-surface')).toHaveCSS('gap', '20px')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(draft.theme?.spacing).toBe(20)
  expect(published.theme?.spacing).toBe(24)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.goto('/website')
  await page.setViewportSize({ width: 1440, height: 1050 })
  const hero = page.getByRole('heading', { level: 1, name: 'Built around the details.' })
  await expect(hero).toBeVisible()
  const image = page.locator('.section-hero img')
  await expect(image).toHaveAttribute('loading', 'eager')
  await expect(image).toHaveAttribute('fetchpriority', 'high')
  await image.evaluate(async (image) => {
    await (image as HTMLImageElement).decode()
  })
  await page.evaluate(() => document.fonts.ready)
  const heights = await page
    .locator('.section-card')
    .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height))
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(2)
  expect(
    await page.evaluate(() =>
      [...document.fonts].some((font) => font.family.includes('Saira') && font.status === 'loaded'),
    ),
  ).toBe(true)
  await page.screenshot({ path: '.security-work/homepage-desktop.png', fullPage: true })
  await page.getByRole('link', { name: 'Explore our work', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/website\/projects$/)
  await page.goto('/website')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true)
  await expect(hero).toHaveCSS('font-size', '38px')
  await expect(page.locator('.container-items').first()).toHaveCSS('flex-direction', 'column')
  await page.locator('.section-hero img').evaluate(async (image) => {
    await (image as HTMLImageElement).decode()
  })
  await page.screenshot({ path: '.security-work/homepage-mobile.png', fullPage: true })
  await expect(page.getByRole('link', { name: 'Employee Login', exact: true })).toHaveAttribute(
    'href',
    '/login',
  )
})
