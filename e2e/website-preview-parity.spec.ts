import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import type { Locator } from '@playwright/test'
import { expect, test, type Page } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { phase2Site } from '../src/features/website/phase2Site.js'
import type { WebsitePage } from '../src/features/website/types.js'

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

test('Fit keeps text controls reachable at the top edge of the page', async ({
  page,
}, testInfo) => {
  const draft = fixture()
  const home = draft.pages[0] as WebsitePage
  const hero = home.sections.find((section) => section.type === 'hero')!
  home.useSiteLayout = false
  home.sections = [
    {
      ...hero,
      type: 'text',
      title: 'Edge controls',
      text: 'A short line of page content.',
      styleClass: '',
      imageId: '',
      linkLabel: '',
      linkUrl: '',
      appearance: { padding: 0, headingSize: 40 },
      textBoxes: { title: { x: 0, y: 0, width: 300, height: 70 } },
    },
  ]
  await mockWebsite(page, draft)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Design', exact: true }).click()
  await page.getByRole('button', { name: 'Fit', exact: true }).click()
  const heading = page
    .locator('.preview-frame')
    .getByRole('heading', { name: 'Edge controls', exact: true })
  await heading.click()
  const rotate = heading.getByRole('button', { name: 'Rotate text', exact: true })
  const corner = heading.getByRole('button', { name: 'Resize text from top-left', exact: true })
  const frame = (await page.locator('.preview-frame').boundingBox())!
  expect((await rotate.boundingBox())!.y).toBeGreaterThanOrEqual(frame.y)
  await page.screenshot({
    path: `.security-work/website-edge-controls-${testInfo.project.name}.png`,
  })
  await rotate.click({ trial: true, timeout: 5000 })
  await corner.click({ trial: true, timeout: 5000 })
})

const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }

test('inline text enters without a blank frame and keeps display geometry after blur', async ({
  page,
}) => {
  await mockWebsite(page, fixture())
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  await page.evaluate(() => document.fonts.ready)
  for (const field of ['title', 'text']) {
    const selector = `.preview-frame .section-hero [data-text-field="${field}"]`
    const target = page.locator(selector).first()
    const bounds = () =>
      target.evaluate((root) => {
        const range = document.createRange()
        const walker = document.createTreeWalker(
          root.querySelector('.tiptap') || root,
          NodeFilter.SHOW_TEXT,
        )
        const nodes: Node[] = []
        while (walker.nextNode())
          if (walker.currentNode.textContent?.trim()) nodes.push(walker.currentNode)
        const rects: DOMRect[] = []
        for (const node of nodes)
          for (let i = 0; i < node.textContent!.length; i++) {
            if (/\s/.test(node.textContent![i]!)) continue
            range.setStart(node, i)
            range.setEnd(node, i + 1)
            rects.push(range.getBoundingClientRect())
          }
        const x = Math.min(...rects.map((rect) => rect.x)),
          y = Math.min(...rects.map((rect) => rect.y))
        return {
          x,
          y,
          width: Math.max(...rects.map((rect) => rect.right)) - x,
          height: Math.max(...rects.map((rect) => rect.bottom)) - y,
          layoutHeight: root.getBoundingClientRect().height,
        }
      })
    for (let cycle = 0; cycle < 3; cycle++) {
      const before = await bounds()
      await page.evaluate((selector) => {
        const state = { empty: 0, frames: 0, running: true }
        Object.assign(window, { inlineFrameCheck: state })
        function sample() {
          if (!state.running) return
          state.frames++
          const root = document.querySelector(selector)
          const range = document.createRange()
          if (root) range.selectNodeContents(root)
          if (!root?.textContent?.trim() || !range.getBoundingClientRect().height) state.empty++
          requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
      }, selector)
      await target.click()
      const editor = target.getByRole('textbox')
      await expect(editor).toBeFocused()
      const during = await bounds()
      for (const key of ['x', 'y', 'width', 'height', 'layoutHeight'] as const)
        expect(during[key], `${field} enter ${key}`).toBeCloseTo(before[key], 0)
      await editor.press('Escape')
      await expect(editor).toHaveCount(0)
      const after = await bounds()
      for (const key of ['x', 'y', 'width', 'height', 'layoutHeight'] as const)
        expect(after[key], `${field} blur ${key}`).toBeCloseTo(before[key], 0)
      const state = await page.evaluate(() => {
        const state = (
          window as unknown as {
            inlineFrameCheck: { empty: number; frames: number; running: boolean }
          }
        ).inlineFrameCheck
        state.running = false
        return state
      })
      expect(state.frames).toBeGreaterThan(0)
      expect(state.empty).toBe(0)
    }
  }
})

test('Fit starts active and follows device, mode, edit and container changes', async ({ page }) => {
  await mockWebsite(page, fixture())
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const controls = page.getByRole('group', { name: 'Canvas controls', exact: true })
  const fit = controls.getByRole('button', { name: 'Fit', exact: true })
  const preview = page.locator('.preview-frame')
  async function fitted() {
    await expect(fit).toHaveAttribute('aria-pressed', 'true')
    await expect
      .poll(() =>
        preview.evaluate((frame) => {
          const scroll = document.querySelector('.preview-scroll') as HTMLElement
          const style = getComputedStyle(scroll)
          const width =
            scroll.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
          const height =
            scroll.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
          const expected = Math.min(1, width / frame.offsetWidth, height / frame.offsetHeight)
          const actual = new DOMMatrix(getComputedStyle(frame).transform).a
          const inset = frame.getBoundingClientRect().top - scroll.getBoundingClientRect().top
          return (
            Math.abs(actual - expected) < 0.003 &&
            Math.abs(inset - parseFloat(style.paddingTop)) < 1
          )
        }),
      )
      .toBe(true)
  }
  await fitted()
  for (const mode of ['Content', 'Design', 'Code']) {
    await page.getByRole('button', { name: mode, exact: true }).click()
    for (const device of ['Desktop', 'Tablet', 'Mobile']) {
      await controls.getByRole('button', { name: device, exact: true }).click()
      await fitted()
    }
  }
  await page.getByRole('button', { name: 'Design', exact: true }).click()
  await page.getByLabel('Page title', { exact: true }).fill('Edited title')
  await fitted()
  await controls.getByRole('button', { name: 'Focus canvas', exact: true }).click()
  await fitted()
  await page.setViewportSize({ width: 1280, height: 800 })
  await fitted()
})

function fixture() {
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
  return draft
}

async function mockWebsite(page: Page, draft: ReturnType<typeof fixture>) {
  await page.route('**/websiteBuilder', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers })
    }
    const data = route.request().postDataJSON().data
    let result: unknown = { draft, version: 1, publishedAt: null, hasPrevious: false }
    if (data.action === 'getImage') {
      const image = images[data.id]!
      result = {
        base64: readFileSync(image.path).toString('base64'),
        contentType: image.contentType,
      }
    }
    if (data.action === 'listRevisions') result = { revisions: [], activity: [] }
    if (data.action === 'save') result = { version: 2 }
    return route.fulfill({ headers, json: { result } })
  })
  await page.route('**/getPublishedWebsite', (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers })
      : route.fulfill({ headers, json: { result: { site: publishedWebsite(draft) } } }),
  )
  await page.route('**/website-image?*', (route) =>
    route.fulfill(images[new URL(route.request().url()).searchParams.get('id')!]!),
  )
}

async function ready(page: Page, scope: Locator) {
  await page.evaluate(() => document.fonts.ready)
  await expect(scope.locator('.section-hero img')).toBeVisible()
  for (const image of await scope.locator('img').all()) {
    await image.scrollIntoViewIfNeeded()
    await expect
      .poll(() =>
        image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0),
      )
      .toBe(true)
  }
  await page.mouse.move(0, 0)
  await page.locator('.preview-viewport, .preview-scroll').evaluateAll((elements) => {
    elements.forEach((element) => element.scrollTo(0, 0))
  })
}

async function rendering(scope: Locator) {
  return scope
    .locator('.website-canvas')
    .first()
    .evaluate((canvas) => {
      const canvasBox = canvas.getBoundingClientRect()
      const width = parseFloat(getComputedStyle(canvas).width)
      // Fit scales the preview. Compare actual layout CSS pixels rather than screenshot pixels.
      const scale = canvasBox.width / width
      const cssPixels = (value: string) =>
        value.replace(
          /(-?\d+(?:\.\d+)?)px/g,
          (_, pixels) => `${Math.round(Number(pixels) * 100) / 100}px`,
        )
      const lineCount = (element: Element) => {
        const lines = new Set<number>()
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
        while (walker.nextNode()) {
          if (!walker.currentNode.textContent?.trim()) continue
          const range = document.createRange()
          range.selectNodeContents(walker.currentNode)
          for (const rect of range.getClientRects()) {
            if (rect.width && rect.height) lines.add(Math.round((rect.top - canvasBox.top) / scale))
          }
        }
        return lines.size
      }
      const groups = {
        sections: '.website-section',
        headings: '.widget-title',
        text: '.widget-text',
        images: 'img',
        imageFrames: '.widget-image',
        navigation: '.page-navigation',
        links: '.page-navigation .menu-label',
        buttons: '.widget-button, .mobile-menu-toggle',
      }
      const nodes = Object.entries(groups).flatMap(([kind, selector]) =>
        Array.from(canvas.querySelectorAll(selector)).flatMap((element) => {
          const style = getComputedStyle(element)
          const box = element.getBoundingClientRect()
          if (!box.width || !box.height || style.visibility === 'hidden') return []
          return [
            {
              kind,
              text:
                kind === 'sections' ? '' : element.textContent?.trim().replace(/\s+/g, ' ') || '',
              alt: element.getAttribute('alt') || '',
              lines: kind === 'headings' || kind === 'text' ? lineCount(element) : undefined,
              geometry: {
                x: (box.x - canvasBox.x) / scale,
                y: (box.y - canvasBox.y) / scale,
                width: box.width / scale,
                height: box.height / scale,
              },
              style: {
                fontFamily: style.fontFamily,
                fontSize: cssPixels(style.fontSize),
                lineHeight: cssPixels(style.lineHeight),
                fontWeight: style.fontWeight,
                letterSpacing: cssPixels(style.letterSpacing),
                textAlign: style.textAlign,
                color: style.color,
                backgroundColor: style.backgroundColor,
                padding: cssPixels(style.padding),
                margin: cssPixels(style.margin),
                objectFit: style.objectFit,
                objectPosition: style.objectPosition,
              },
            },
          ]
        }),
      )
      return { width, scale, device: canvas.getAttribute('data-device'), nodes }
    })
}

function expectSameRendering(
  preview: Awaited<ReturnType<typeof rendering>>,
  publicSite: Awaited<ReturnType<typeof rendering>>,
  label: string,
  compareGeometry = true,
) {
  expect(preview.width, `${label}: CSS page width`).toBe(publicSite.width)
  expect(preview.device, `${label}: responsive breakpoint`).toBe(publicSite.device)
  expect(preview.nodes, `${label}: visible content`).toHaveLength(publicSite.nodes.length)
  for (const [index, actual] of preview.nodes.entries()) {
    const expected = publicSite.nodes[index]!
    const name = `${label}: ${actual.kind} ${actual.text.slice(0, 50) || actual.alt || index}`
    expect(actual.kind, name).toBe(expected.kind)
    expect(actual.text, name).toBe(expected.text)
    expect(actual.alt, name).toBe(expected.alt)
    expect(actual.lines, `${name}: text wrapping`).toBe(expected.lines)
    if (compareGeometry) {
      expect(actual.style, `${name}: authored styles`).toEqual(expected.style)
    } else {
      for (const key of [
        'fontFamily',
        'fontSize',
        'fontWeight',
        'lineHeight',
        'letterSpacing',
        'textAlign',
      ] as const) {
        const a = actual.style[key]
        const b = expected.style[key]
        if (a.endsWith('px') && b.endsWith('px')) {
          expect(
            Math.abs(parseFloat(a) - parseFloat(b)),
            `${name}: Fit ${key}`,
          ).toBeLessThanOrEqual(0.05)
        } else expect(a, `${name}: Fit ${key}`).toBe(b)
      }
    }
    if (compareGeometry) {
      for (const dimension of ['x', 'y', 'width', 'height'] as const) {
        expect(
          Math.abs(actual.geometry[dimension] - expected.geometry[dimension]),
          `${name}: unzoomed ${dimension}`,
        ).toBeLessThanOrEqual(2)
      }
    }
  }
}

async function expectMenuParity(page: Page, publicPage: Page, compact: boolean, label: string) {
  if (!compact) return
  const preview = page.locator('.preview-frame')
  const publicScope = publicPage.locator('.public-website')
  await preview.getByRole('button', { name: 'Open navigation menu' }).click()
  await publicScope.getByRole('button', { name: 'Open navigation menu' }).click()
  await expect(
    preview.getByRole('navigation', { name: 'Website navigation', exact: true }),
  ).toBeVisible()
  await page.mouse.move(0, 0)
  await publicPage.mouse.move(0, 0)
  expectSameRendering(await rendering(preview), await rendering(publicScope), `${label} menu open`)
  await preview.getByRole('button', { name: 'Close navigation menu' }).click()
  await publicScope.getByRole('button', { name: 'Close navigation menu' }).click()
}

async function expectNativeScrolling(page: Page, width: number) {
  // Image loading scrolls individual images into view; begin the actual wheel check at the top.
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
  await page.mouse.move(width / 2, 400)
  await page.mouse.wheel(0, 650)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0)
  await expect
    .poll(
      async () => {
        // Firefox caps a single large wheel event. Exercise normal wheel increments in all engines.
        await page.mouse.wheel(0, 900)
        return page.locator('.section-footer').evaluate((footer) => {
          const bounds = footer.getBoundingClientRect()
          return scrollY > 0 && bounds.top < innerHeight && bounds.bottom <= innerHeight + 1
        })
      },
      { timeout: 10000 },
    )
    .toBe(true)
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
}

test('manual zoom preserves magnification until Fit is requested', async ({ page }, testInfo) => {
  test.setTimeout(60000)
  await mockWebsite(page, fixture())
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  const controls = page.getByRole('group', { name: 'Canvas controls', exact: true })
  const fit = controls.getByRole('button', { name: 'Fit', exact: true })
  const zoom = controls.getByRole('button', { name: 'Reset zoom', exact: true })
  const preview = page.locator('.preview-frame')
  const canvas = preview.locator('.website-canvas').first()
  const scale = () =>
    preview.evaluate((element) => {
      const style = getComputedStyle(element)
      return element.getBoundingClientRect().width / parseFloat(style.width)
    })
  const displayedType = () =>
    preview.evaluate((element) => {
      const magnification =
        element.getBoundingClientRect().width / parseFloat(getComputedStyle(element).width)
      return ['.section-hero .widget-text', '.section-navigation [data-text-field="brand"]'].map(
        (selector) => {
          const target = element.querySelector(selector)!
          return parseFloat(getComputedStyle(target).fontSize) * magnification
        },
      )
    })
  const devices = [
    { label: 'Desktop', key: 'desktop', width: 1080, fitted: 'false' },
    { label: 'Tablet', key: 'tablet', width: 820, fitted: 'false' },
    { label: 'Mobile', key: 'mobile', width: 390, fitted: 'false' },
  ]
  await controls.getByRole('button', { name: 'Desktop', exact: true }).click()
  await fit.click()
  await ready(page, preview)
  await controls.getByRole('button', { name: 'Zoom out', exact: true }).click()
  const initialScale = await scale()
  const initialTransform = await preview.evaluate((element) => getComputedStyle(element).transform)
  const initialLabel = await zoom.textContent()
  expect(initialScale).toBeLessThan(0.9)
  let previousType = await displayedType()

  for (const device of devices) {
    await controls.getByRole('button', { name: device.label, exact: true }).click()
    await expect(preview).toHaveCSS('width', `${device.width}px`)
    await expect(canvas).toHaveAttribute('data-device', device.key)
    await expect(preview).toHaveCSS('transform', initialTransform)
    // Firefox rounds rendered bounds to layout subpixels independently at each width.
    await expect.poll(scale).toBeCloseTo(initialScale, 4)
    await expect(zoom).toHaveText(initialLabel!)
    await expect(fit).toHaveAttribute('aria-pressed', device.fitted)
    await ready(page, preview)
    const currentType = await displayedType()
    for (const [index, size] of currentType.entries()) {
      expect(size, `${device.label}: body and navigation must not grow`).toBeLessThanOrEqual(
        previousType[index]! + 0.01,
      )
    }
    previousType = currentType
    if (testInfo.project.name === 'chromium') {
      await page.locator('.preview-scroll').evaluate((element) => element.scrollTo(0, 0))
      await page.screenshot({ path: `.security-work/preview-same-scale-${device.key}.png` })
    }
  }
  await controls.getByRole('button', { name: 'Desktop', exact: true }).click()
  await expect(preview).toHaveCSS('width', '1080px')
  await expect(preview).toHaveCSS('transform', initialTransform)
  await expect.poll(scale).toBeCloseTo(initialScale, 4)
  await expect(zoom).toHaveText(initialLabel!)

  // Fitting a selected device is an explicit request to change its magnification.
  await controls.getByRole('button', { name: 'Tablet', exact: true }).click()
  await fit.click()
  // Fitting the whole tablet screen can be limited by height rather than width.
  await expect.poll(scale).toBeGreaterThan(initialScale + 0.01)
  await expect(fit).toHaveAttribute('aria-pressed', 'true')
  await controls.getByRole('button', { name: 'Tablet', exact: true }).click()
  await expect(fit).toHaveAttribute('aria-pressed', 'true')
  await controls.getByRole('button', { name: 'Mobile', exact: true }).click()
  await expect.poll(scale).toBeGreaterThan(initialScale)
  await expect(fit).toHaveAttribute('aria-pressed', 'true')

  // Actual-size comparison stays at 100% even when the wider page requires scrolling.
  await zoom.click()
  await expect(zoom).toHaveText('100%')
  const actualSizeTransform = await preview.evaluate(
    (element) => getComputedStyle(element).transform,
  )
  for (const device of devices) {
    await controls.getByRole('button', { name: device.label, exact: true }).click()
    await expect(preview).toHaveCSS('width', `${device.width}px`)
    await expect(canvas).toHaveAttribute('data-device', device.key)
    await expect(preview).toHaveCSS('transform', actualSizeTransform)
    await expect.poll(scale).toBeCloseTo(1, 4)
    await expect(zoom).toHaveText('100%')
    await expect(fit).toHaveAttribute('aria-pressed', 'false')
  }
})

test('device screens have fixed heights, scroll internally and restart at the top on navigation', async ({
  page,
}, testInfo) => {
  test.setTimeout(60000)
  await mockWebsite(page, fixture())
  const mutations: string[] = []
  page.on('request', (request) => {
    if (request.url().endsWith('/websiteBuilder') && request.method() === 'POST') {
      const action = request.postDataJSON()?.data?.action
      if (['save', 'publish'].includes(action)) mutations.push(action)
    }
  })
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  const viewport = page.locator('.preview-viewport')
  const workspace = page.locator('.preview-scroll')
  for (const device of [
    { label: 'Desktop', width: 1080, height: 720 },
    { label: 'Tablet', width: 820, height: 1180 },
    { label: 'Mobile', width: 390, height: 844 },
  ]) {
    await page.getByRole('button', { name: device.label, exact: true }).click()
    await page.getByRole('button', { name: 'Fit', exact: true }).click()
    await ready(page, viewport)
    await expect(page.getByLabel('Preview viewport size')).toHaveText(
      `${device.width} × ${device.height}`,
    )
    await expect
      .poll(() => viewport.evaluate((element) => [element.clientWidth, element.clientHeight]))
      .toEqual([device.width, device.height])
    await expect
      .poll(() => workspace.evaluate((element) => element.scrollHeight - element.clientHeight))
      .toBeLessThanOrEqual(1)
    const screen = (await viewport.boundingBox())!
    const bounds = (await workspace.boundingBox())!
    expect(screen.y + screen.height).toBeLessThanOrEqual(bounds.y + bounds.height)
    await page.mouse.move(screen.x + screen.width / 2, screen.y + screen.height / 2)
    await page.mouse.wheel(0, 500)
    await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    expect(await workspace.evaluate((element) => element.scrollTop)).toBe(0)
    expect(await page.evaluate(() => scrollY)).toBe(0)
    await viewport.evaluate((element) => element.scrollTo(0, element.scrollHeight))
    const footer = (await viewport.locator('.section-footer').boundingBox())!
    expect(footer.y + footer.height).toBeLessThanOrEqual(screen.y + screen.height + 1)
    await page.getByRole('button', { name: 'Company /company', exact: true }).click()
    await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBe(0)
    await page.getByRole('button', { name: 'Home /home', exact: true }).click()
    if (testInfo.project.name === 'chromium') {
      await page.screenshot({
        path: `.security-work/device-screen-${device.label.toLowerCase()}.png`,
      })
    }
  }
  // Keyboard users can scroll the screen without moving the surrounding application.
  await viewport.focus()
  await page.keyboard.press('PageDown')
  await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  // Running custom code gets a real bounded iframe viewport as well.
  await page.getByRole('button', { name: 'Code', exact: true }).click()
  await page.getByRole('button', { name: 'Run code preview', exact: true }).click()
  const runtime = page.frameLocator('iframe[title="Website code preview"]')
  await expect(runtime.locator('.section-hero')).toBeVisible()
  await expect
    .poll(() =>
      runtime.locator('body').evaluate(() => [document.documentElement.clientWidth, innerHeight]),
    )
    .toEqual([390, 844])
  await runtime.locator('body').evaluate(() => window.scrollTo(0, 400))
  await expect.poll(() => runtime.locator('body').evaluate(() => scrollY)).toBeGreaterThan(0)
  expect(mutations).toEqual([])
})

for (const device of [
  { label: 'Desktop', width: 1080, key: 'desktop', maxScale: 0.99 },
  { label: 'Tablet', width: 820, key: 'tablet', maxScale: 1 },
  { label: 'Mobile', width: 390, key: 'mobile', maxScale: 1 },
]) {
  test(`${device.label} Content and Design previews match public layout at ${device.width} CSS pixels`, async ({
    page,
    context,
  }, testInfo) => {
    test.setTimeout(60000)
    const draft = fixture()
    const publicPage = await context.newPage()
    await mockWebsite(page, draft)
    await mockWebsite(publicPage, draft)
    await publicPage.setViewportSize({ width: device.width, height: 1000 })
    const publicScope = publicPage.locator('.public-website')
    await page.setViewportSize({ width: 1600, height: 1000 })
    await gotoPhase2App(page, '/admin/website', createJobsFixture())
    await page.getByRole('button', { name: device.label, exact: true }).click()
    const preview = page.locator('.preview-frame')
    await expect(preview).toHaveCSS('width', `${device.width}px`)
    for (const [slug, title] of [
      ['home', 'Home'],
      ['services', 'Services'],
    ]) {
      await publicPage.goto(`/website/${slug}`)
      await ready(publicPage, publicScope)
      await expectNativeScrolling(publicPage, device.width)
      const publicClosed = await rendering(publicScope)
      expect(publicClosed.width).toBe(device.width)
      expect(publicClosed.device).toBe(device.key)
      await page.getByRole('button', { name: 'Pages', exact: true }).click()
      await page.getByRole('button', { name: `${title} /${slug}`, exact: true }).click()
      for (const mode of ['Content', 'Design']) {
        await page.getByRole('button', { name: mode, exact: true }).click()
        await page.getByRole('button', { name: 'Reset zoom', exact: true }).click()
        await expect(page.getByRole('button', { name: 'Reset zoom', exact: true })).toHaveText(
          '100%',
        )
        await ready(page, preview)
        const editorClosed = await rendering(preview)
        const evidence = testInfo.outputPath(`${slug}-${mode}-${device.key}-rendering.json`)
        writeFileSync(evidence, JSON.stringify({ preview: editorClosed, publicSite: publicClosed }))
        await testInfo.attach(`${slug}-${mode}-${device.key}-rendering`, {
          contentType: 'application/json',
          path: evidence,
        })
        expect(editorClosed.scale).toBe(1)
        expectSameRendering(editorClosed, publicClosed, `${mode} ${device.label}`)
        await expectMenuParity(
          page,
          publicPage,
          device.key !== 'desktop',
          `${mode} ${device.label}`,
        )
        await page.getByRole('button', { name: 'Fit', exact: true }).click()
        await ready(page, preview)
        const fitted = await rendering(preview)
        expect(fitted.scale).toBeLessThanOrEqual(device.maxScale)
        expectSameRendering(fitted, publicClosed, `${mode} ${device.label} Fit`, false)
        await expect
          .poll(() =>
            page.locator('.preview-scroll').evaluate((scroller) => {
              const frame = scroller.querySelector('.preview-scale')!
              const style = getComputedStyle(scroller)
              const content =
                frame.getBoundingClientRect().height +
                parseFloat(style.paddingTop) +
                parseFloat(style.paddingBottom)
              return scroller.scrollHeight - Math.max(scroller.clientHeight, content)
            }),
          )
          .toBeLessThanOrEqual(50)
      }
    }
    // The public route must relinquish document scrolling when returning to the application.
    await gotoPhase2App(publicPage, '/jobs', createJobsFixture())
    await expect(publicPage.locator('.public-website')).toHaveCount(0)
    await expect(publicPage.locator('body')).toHaveCSS('overflow', 'hidden')
    await publicPage.close()
  })
}

test('IME composition keeps Escape inside the active inline editor', async ({ page }) => {
  await mockWebsite(page, fixture())
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  await page.locator('.preview-frame .section-hero .widget-title').first().click()
  const editor = page.getByRole('textbox', { name: 'Edit heading on page' })
  await expect(editor).toBeFocused()
  await editor.dispatchEvent('keydown', { key: 'Escape', code: 'Escape', isComposing: true })
  await expect(editor).toBeVisible()
  await expect(editor).toBeFocused()
  await editor.press('Escape')
  await expect(editor).toHaveCount(0)
})

for (const width of [1440, 820, 390]) {
  test(`editable starter-site visual review across all nine pages at ${width}px`, async ({ page }, testInfo) => {
    const draft = fixture()
    await mockWebsite(page, draft)
    await page.setViewportSize({ width, height: 950 })
    await gotoPhase2App(page, '/website', createJobsFixture())
    for (const entry of draft.pages) {
      await page.goto(entry.slug === 'home' ? '/' : `/website/${entry.slug}`)
      await expect(page.locator('.public-website').getByRole('heading', { level: 1 })).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      for (const img of await page.locator('.public-website img').all()) {
        await img.scrollIntoViewIfNeeded()
        await expect.poll(() => img.evaluate((el: HTMLImageElement) =>
          el.complete && el.naturalWidth > 0)).toBe(true)
      }
      await expect.poll(() => page.evaluate(() =>
        document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
      if (width === 820) {
        for (const group of await page.locator('.custom-card-trio').all()) {
          const cards = await group.locator('.custom-detail-card').evaluateAll((elements) =>
            elements.map((el) => ({ y: el.getBoundingClientRect().y, width: el.getBoundingClientRect().width })))
          expect(cards).toHaveLength(3)
          expect(Math.max(...cards.map((card) => card.y)) - Math.min(...cards.map((card) => card.y))).toBeLessThan(1)
          expect(cards.every((card) => card.width > 200)).toBe(true)
        }
      }
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: testInfo.outputPath(`${entry.slug}-${width}.png`), fullPage: true, animations: 'disabled' })
    }
  })
}
