import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const base = new URL(process.argv[2] || 'http://127.0.0.1:5822/')
assert(['127.0.0.1', 'localhost'].includes(base.hostname), 'Use the isolated local preview only.')
const response = await fetch(base)
assert.equal(response.headers.get('x-phase2-preview'), 'frontpages-navigation-current-generated-html')
const snapshot = (await (await fetch(new URL('/getPublishedWebsite', base))).json()).result
const pages = snapshot.site.pages
const normalize = text => text.replace(/\s+/g, ' ').trim()
const browser = await chromium.launch({ headless: true })
const results = [], errors = []
async function settle(page) {
  await page.waitForFunction(() => document.getElementById('app')?.dataset.publicReady === 'true')
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(100)
}
async function state(page) {
  return page.evaluate(() => ({
    title: document.title,
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    description: document.querySelector('meta[name="description"]')?.content,
    text: document.querySelector('.public-website').innerText.replace(/\s+/g, ' ').trim(),
    active: [...document.querySelectorAll('[aria-current="page"]')].map(e => e.getAttribute('href')),
    styles: [...document.querySelectorAll('.public-website style')].map(e => e.textContent.replace(/\[data-page-scope="[a-zA-Z0-9_-]+"\]/g, '[data-page-scope="SCOPE"]')),
    sections: [...document.querySelectorAll('.website-section')].map(e => {
      const r = e.getBoundingClientRect(), s = getComputedStyle(e)
      return { class: e.className, text: e.innerText.replace(/\s+/g, ' ').trim(), box: [r.x, r.y + scrollY, r.width, r.height], color: s.color, background: s.backgroundColor, display: s.display }
    }),
    images: [...document.querySelectorAll('.public-website img')].map(e => ({ src: e.getAttribute('src'), alt: e.alt })),
    inputs: [...document.querySelectorAll('.public-website input,.public-website select,.public-website textarea')].map(e => ({ name: e.name, type: e.type, value: e.value, checked: e.checked })),
    frames: [...document.querySelectorAll('.public-website iframe')].map(e => ({ src: e.getAttribute('src'), sandbox: e.getAttribute('sandbox') })),
    stale: !!document.querySelector('[data-stale-page-test]'),
  }))
}
function compare(actual, expected, label) {
  assert.equal(actual.sections.length, expected.sections.length, label + ': section count')
  actual.sections.forEach((section, i) => {
    const { box, ...rest } = section, { box: expectedBox, ...expectedRest } = expected.sections[i]
    assert.deepEqual(rest, expectedRest, label + ': section ' + i)
    box.forEach((value, axis) => assert(Math.abs(value - expectedBox[axis]) <= 2, label + ': geometry ' + i + '/' + axis))
  })
  const { sections, ...rest } = actual, { sections: ignored, ...expectedRest } = expected
  assert.deepEqual(rest, expectedRest, label + ': title, metadata, navigation, CSS, images, widgets and cleanup')
}
async function clickPage(page, destination) {
  const path = destination.slug === 'home' ? '/' : '/' + destination.slug
  let anchor = page.locator(`.page-header a[href="${path}"]`).first()
  if (await anchor.count()) {
    if (!await anchor.isVisible()) {
      const menu = page.locator('.page-header .mobile-menu-toggle').first()
      await menu.click()
    }
  } else anchor = page.locator(`footer a[href="${path}"]`).first()
  await anchor.click()
  await page.waitForURL(url => url.pathname === path)
  await settle(page)
}
try {
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
    const hard = {}
    for (const destination of pages) {
      const page = await context.newPage()
      await page.goto(new URL(destination.slug === 'home' ? '/' : '/' + destination.slug, base).href)
      await settle(page)
      hard[destination.slug] = await state(page)
      await page.close()
    }
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    for (const source of pages) {
      await page.goto(new URL(source.slug === 'home' ? '/' : '/' + source.slug, base).href)
      await settle(page)
      await page.evaluate(() => window.__navigationDocument = 'retained')
      for (const destination of pages.filter(p => p.slug !== source.slug)) {
        await page.locator('.website-content').last().evaluate(e => e.dataset.stalePageTest = 'true')
        await clickPage(page, destination)
        compare(await state(page), hard[destination.slug], `${width}: ${source.slug} -> ${destination.slug}`)
        assert(await page.evaluate(() => window.__navigationDocument === 'retained'), 'No document reload')
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'No horizontal overflow')
        await page.goBack(); await settle(page)
        compare(await state(page), hard[source.slug], `${width}: back to ${source.slug}`)
        await page.goForward(); await settle(page)
        compare(await state(page), hard[destination.slug], `${width}: forward to ${destination.slug}`)
        await clickPage(page, source)
        compare(await state(page), hard[source.slug], `${width}: return to ${source.slug}`)
        results.push({ width, from: source.slug, to: destination.slug, passed: true })
      }
    }
    await context.close()
  }
  assert.deepEqual(errors, [])
  writeFileSync('.forms-local-data/public-navigation-results.json', JSON.stringify({ results, errors }, null, 2))
  console.log(`Passed ${results.length} navbar pairs, each with return/back/forward, desktop/mobile, hard-load DOM/CSS/geometry/image/widget parity and cleanup.`)
} finally { await browser.close() }
