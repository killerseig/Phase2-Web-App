import { createRequire } from 'node:module'
import { expect, test, type Page } from './helpers/test.js'
import { phase2Site } from '../src/features/website/phase2Site.js'

const { validateWebsite, publishedWebsite } = createRequire(import.meta.url)(
  '../functions/websiteModel.js',
)
const images: Record<string, { path: string; contentType: string }> = {
  'site-logo': { path: 'src/assets/images/phase2-logo.png', contentType: 'image/png' },
  'site-interior': {
    path: 'src/assets/images/construction-placeholder.webp',
    contentType: 'image/webp',
  },
  'site-architecture': {
    path: 'src/assets/images/site/architecture.jpg',
    contentType: 'image/jpeg',
  },
  'site-finished': {
    path: 'src/assets/images/site/finished-interior.jpg',
    contentType: 'image/jpeg',
  },
  'site-planning': { path: 'src/assets/images/site/planning.jpg', contentType: 'image/jpeg' },
}
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }

async function mockPublicSite(page: Page) {
  const draft = validateWebsite(
    phase2Site({
      logo: 'site-logo',
      interior: 'site-interior',
      architecture: 'site-architecture',
      finished: 'site-finished',
      planning: 'site-planning',
    }),
  )
  draft.forms.forEach((form: { delivery: { to: string[] } }) => {
    form.delivery.to = ['review@example.com']
  })
  const site = publishedWebsite(draft)
  await page.route('**/getPublishedWebsite', (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers })
      : route.fulfill({ headers, json: { result: { site } } }),
  )
  await page.route('**/website-image?*', (route) =>
    route.fulfill(images[new URL(route.request().url()).searchParams.get('id')!]!),
  )
}

async function loadImages(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  for (const image of await page.locator('img').all()) {
    await image.scrollIntoViewIfNeeded()
    await expect
      .poll(() =>
        image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0),
      )
      .toBe(true)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
}

async function expectReadableProportions(page: Page, width: number) {
  const phone = width < 768
  await expect(page.locator('.website-canvas').first()).toHaveAttribute(
    'data-device',
    phone ? 'mobile' : width < 1024 ? 'tablet' : 'desktop',
  )
  const heading = page.getByRole('heading', { level: 1 })
  const type = await heading.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      size: parseFloat(style.fontSize),
      lines: element.getBoundingClientRect().height / parseFloat(style.lineHeight),
    }
  })
  expect(type.lines).toBeLessThanOrEqual(3.05)
  expect(type.size).toBeLessThanOrEqual(phone ? 36 : 70)
  const body = page.locator(
    '.section-hero .widget-text, .custom-intro .widget-text, .custom-detail-card .widget-text, ' +
      '.custom-photo-card .widget-text, .custom-feature .widget-text, ' +
      '.custom-feature-reverse .widget-text, .custom-careers-band .widget-text',
  )
  expect(await body.count()).toBeGreaterThan(0)
  for (const paragraph of await body.all()) {
    const size = await paragraph.evaluate((element) =>
      parseFloat(getComputedStyle(element).fontSize),
    )
    expect(size).toBeGreaterThanOrEqual(15)
  }
  const afterHero = await page.locator('.section-hero').evaluate((element) => {
    const frame = element.closest('.widget-frame')!
    const next = frame.nextElementSibling!
    return { top: next.getBoundingClientRect().top, viewportHeight: innerHeight }
  })
  expect(afterHero.top).toBeLessThan(afterHero.viewportHeight)
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true)
}

async function expectPhoneSectionHeadings(page: Page) {
  const sizes = await page
    .locator('h2,h3')
    .evaluateAll((headings) =>
      headings
        .filter((heading) => (heading as HTMLElement).offsetHeight > 0)
        .map((heading) => parseFloat(getComputedStyle(heading).fontSize)),
    )
  expect(sizes.length).toBeGreaterThan(0)
  expect(Math.max(...sizes)).toBeLessThanOrEqual(30)
}

async function expectCareersFormContained(page: Page) {
  const form = (await page.locator('.section-form').boundingBox())!
  const footer = (await page.locator('.section-footer').boundingBox())!
  for (const control of [
    page.getByRole('button', { name: 'Send introduction', exact: true }),
    page.getByLabel('Tell us about your experience and interests'),
  ]) {
    const box = (await control.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(form.x)
    expect(box.x + box.width).toBeLessThanOrEqual(form.x + form.width)
    expect(box.y).toBeGreaterThanOrEqual(form.y)
    expect(box.y + box.height).toBeLessThanOrEqual(form.y + form.height)
    expect(box.y + box.height).toBeLessThanOrEqual(footer.y)
  }
}

for (const slug of ['home', 'company']) {
  test(`Phase 2 ${slug} keeps readable type and balanced sections across desktop and phone widths`, async ({
    page,
  }) => {
    await mockPublicSite(page)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(slug === 'home' ? '/website' : `/website/${slug}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await loadImages(page)
    for (const width of [1440, 820]) {
      await page.setViewportSize({ width, height: 1000 })
      await expectReadableProportions(page, width)
    }
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 })
      await expectReadableProportions(page, width)
      await expectPhoneSectionHeadings(page)
    }
  })
}

test('Phase 2 Careers proportions preserve the form inside its card at every preview width', async ({
  page,
}) => {
  await mockPublicSite(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/website/careers')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await loadImages(page)
  for (const width of [1440, 820]) {
    await page.setViewportSize({ width, height: 1000 })
    await expectReadableProportions(page, width)
    await expectCareersFormContained(page)
  }
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await expectReadableProportions(page, width)
    await expectPhoneSectionHeadings(page)
    await expectCareersFormContained(page)
  }
})
