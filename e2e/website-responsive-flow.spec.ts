import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import type { Locator } from '@playwright/test'
import { expect, test, type Page } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { phase2Site } from '../src/features/website/phase2Site.js'
import { newSection, type WebsiteSection, type WebsiteSite } from '../src/features/website/types.js'

const { validateWebsite, publishedWebsite } = createRequire(import.meta.url)(
  '../functions/websiteModel.js',
)
const imagePath = 'src/assets/images/phase2-logo.png'
const image = readFileSync(imagePath).toString('base64')
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }

function widget(type: WebsiteSection['type'], id: string, extra: Partial<WebsiteSection> = {}) {
  return { ...newSection(type), id, title: id, styleClass: `custom-${id}`, ...extra }
}

function responsiveFixture(): WebsiteSite {
  const sections: WebsiteSection[] = [
    widget('navigation', 'navigation', {
      navigation: {
        showBrand: true,
        brandText: 'Responsive site',
        showPages: true,
        showLogin: false,
        links: [],
      },
      sizing: { height: 96 },
      appearance: { padding: 12 },
      layout: { x: 0, y: 0, w: 24, h: 3, z: 1 },
    }),
    widget('container', 'row', {
      container: { direction: 'row', gap: 24, wrap: false, align: 'center' },
      appearance: { padding: 64, paddingLeft: 120, margin: 48 },
      sizing: { height: 640, minHeight: 740 },
      layout: { x: 0, y: 4, w: 24, h: 23, z: 2 },
    }),
    ...['first', 'second', 'third'].map((id, index) =>
      widget('card', id, {
        parentId: 'row',
        text: 'The layout should grow naturally as this card wraps onto more lines. '.repeat(10),
        appearance: { padding: 8, headingSize: 20, fontSize: 16 },
        sizing: {
          grow: index + 1,
          basis: index === 1 ? 50 : 25,
          height: 220,
          minHeight: 220,
          ...(index === 0 ? { align: 'start' as const } : {}),
        },
      }),
    ),
    widget('image', 'photo', {
      imageId: 'photo',
      alt: 'Responsive placeholder',
      sizing: { height: 180 },
      appearance: { padding: 0 },
      layout: { x: 0, y: 28, w: 12, h: 6, z: 3 },
    }),
    widget('spacer', 'spacer', {
      sizing: { height: 48 },
      appearance: { padding: 0 },
      layout: { x: 0, y: 35, w: 24, h: 2, z: 4 },
    }),
  ]
  return {
    name: 'Responsive site',
    accent: '#174878',
    pages: [
      {
        id: 'home',
        slug: 'home',
        title: 'Home',
        chrome: 'widgets',
        description: '',
        inNavigation: true,
        sections,
      },
      {
        id: 'scaled',
        slug: 'scaled',
        title: 'Scaled',
        chrome: 'widgets',
        description: '',
        inNavigation: true,
        sections: structuredClone(sections),
        layout: { tablet: 'scale', mobile: 'scale' },
      },
    ],
  }
}

async function mockWebsite(page: Page, content = responsiveFixture()) {
  let draft: WebsiteSite = validateWebsite(content)
  let version = 1
  const actions: string[] = []
  await page.route('**/websiteBuilder', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers })
      return
    }
    const data = route.request().postDataJSON().data
    actions.push(data.action)
    let result: unknown = { draft, version, publishedAt: null, hasPrevious: false }
    if (data.action === 'getImage') result = { base64: image, contentType: 'image/png' }
    if (data.action === 'listRevisions') result = { revisions: [], activity: [] }
    if (data.action === 'save') {
      draft = validateWebsite(data.site)
      result = { version: ++version }
    }
    await route.fulfill({ headers, json: { result } })
  })
  await page.route('**/getPublishedWebsite', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers })
      return
    }
    const review = structuredClone(draft)
    review.forms?.forEach((form) => {
      form.delivery!.to = ['careers@example.com']
    })
    await route.fulfill({ headers, json: { result: { site: publishedWebsite(review) } } })
  })
  await page.route('**/website-image?*', (route) =>
    route.fulfill({ path: imagePath, contentType: 'image/png' }),
  )
  return { draft: () => structuredClone(draft), actions }
}

async function expectNaturalLayout(scope: Locator, device: 'tablet' | 'mobile') {
  await expect(scope.locator('.website-canvas').first()).toHaveAttribute('data-device', device)
  await expect(scope.locator('.website-content').first()).toHaveClass(/flow-surface/)
  const section = scope.locator('.custom-row')
  const row = section.locator('> .container-children')
  const children = row.locator('> .contained-widget')
  await expect(children).toHaveCount(3)
  await expect(row).toHaveCSS('flex-direction', device === 'tablet' ? 'row' : 'column')
  await expect(section).toHaveCSS('padding-left', device === 'tablet' ? '32px' : '24px')
  await expect(section).toHaveCSS('margin-left', device === 'tablet' ? '32px' : '24px')
  const boxes = await children.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect()
      return { top: box.top, bottom: box.bottom, width: box.width }
    }),
  )
  if (device === 'tablet') {
    await expect(row).toHaveCSS('flex-wrap', 'wrap')
    expect(boxes[0]!.top).toBeCloseTo(boxes[1]!.top, 0)
    expect(boxes[0]!.width).toBeCloseTo(boxes[1]!.width, 0)
    expect(boxes[2]!.top).toBeGreaterThanOrEqual(boxes[0]!.bottom - 1)
  } else {
    await expect(row).toHaveCSS('align-items', 'stretch')
    for (let index = 1; index < boxes.length; index++) {
      expect(boxes[index]!.top).toBeGreaterThanOrEqual(boxes[index - 1]!.bottom - 1)
    }
    await expect(children.first()).toHaveCSS('flex-basis', 'auto')
    await expect(children.first()).toHaveCSS('align-self', 'auto')
  }
  for (const child of await children.all()) {
    expect(await child.evaluate((element) => (element as HTMLElement).style.height)).toBe('')
    expect(await child.evaluate((element) => (element as HTMLElement).style.minHeight)).toBe('')
    expect(
      await child
        .locator('> section')
        .evaluate((element) => element.scrollHeight - element.clientHeight),
    ).toBeLessThanOrEqual(1)
  }
  for (const [id, height] of [
    ['navigation', 96],
    ['photo', 180],
    ['spacer', 48],
  ] as const) {
    expect(
      await scope
        .locator(`.custom-${id}`)
        .locator('..')
        .evaluate((element) => (element as HTMLElement).offsetHeight),
    ).toBe(height)
  }
}

test('wide builder previews automatically reflow plain desktop widgets without changing the draft', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await page.setViewportSize({ width: 1700, height: 1100 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.locator('.builder-title p')).toContainText('Draft saved')
  const baseline = api.draft()
  const canvas = page.locator('.preview-frame')
  const readDesktopStyles = () =>
    canvas
      .locator('.custom-first')
      .locator('..')
      .evaluate((element) => {
        const style = (element as HTMLElement).style
        return Array.from(style)
          .sort()
          .map((property) => [property, style.getPropertyValue(property)])
      })
  const desktopStyles = await readDesktopStyles()
  await expect(canvas.locator('.website-content')).toHaveClass(/grid-surface/)
  await expect(canvas.locator('.custom-row > .container-children')).toHaveCSS('flex-wrap', 'nowrap')
  for (const [button, device] of [
    ['Tablet', 'tablet'],
    ['Mobile', 'mobile'],
  ] as const) {
    await page.getByRole('button', { name: button, exact: true }).click()
    await expectNaturalLayout(canvas, device)
    await page.screenshot({ path: `.security-work/responsive-default-${device}-builder.png` })
  }
  await page.getByRole('button', { name: 'Desktop', exact: true }).click()
  await expect(canvas.locator('.website-content')).toHaveClass(/grid-surface/)
  await expect.poll(readDesktopStyles).toEqual(desktopStyles)
  await expect(canvas.locator('.custom-row')).toHaveCSS('padding-left', '120px')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.locator('.builder-title p')).toContainText('Draft saved')
  expect(api.draft()).toEqual(baseline)
  expect(api.actions).not.toContain('publish')
})

test('explicit phone row sizing and scale layouts remain authoritative', async ({ page }) => {
  const fixture = responsiveFixture()
  const sections = fixture.pages[0]!.sections
  sections.find((section) => section.id === 'row')!.devices = {
    mobile: {
      container: { direction: 'row', gap: 8, wrap: false, align: 'stretch' },
      appearance: { padding: 12, margin: 10 },
    },
  }
  sections.find((section) => section.id === 'first')!.devices = {
    mobile: { sizing: { height: 120, minHeight: 90, basis: 30, grow: 2 } },
  }
  sections.find((section) => section.id === 'second')!.devices = { mobile: { hidden: true } }
  sections
    .filter((section) => section.parentId)
    .forEach((section) => {
      section.text = 'Short card.'
    })
  const api = await mockWebsite(page, fixture)
  await page.setViewportSize({ width: 1700, height: 1100 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Mobile', exact: true }).click()
  const canvas = page.locator('.preview-frame')
  const row = canvas.locator('.custom-row')
  await expect(row.locator('> .container-children')).toHaveCSS('flex-direction', 'row')
  await expect(row.locator('> .container-children')).toHaveCSS('gap', '8px')
  await expect(row).toHaveCSS('padding-left', '12px')
  await expect(row).toHaveCSS('padding-right', '12px')
  await expect(canvas.locator('.custom-second')).toHaveCount(0)
  const child = canvas.locator('.custom-first').locator('..')
  await expect(child).toHaveCSS('height', '120px')
  await expect(child).toHaveCSS('min-height', '90px')
  await expect(child).toHaveCSS('flex-basis', '30%')
  await expect(child).toHaveCSS('flex-grow', '2')
  await page.getByRole('button', { name: 'Pages', exact: true }).click()
  await page.getByRole('button', { name: 'Scaled /scaled', exact: true }).click()
  await expect(canvas.locator('.website-content')).toHaveClass(/grid-surface/)
  await expect(canvas.locator('.custom-row > .container-children')).toHaveCSS('flex-wrap', 'nowrap')
  await expect(canvas.locator('.custom-first').locator('..')).toHaveCSS('height', '220px')
  expect(
    await canvas
      .locator('.website-content')
      .evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a),
  ).toBeLessThan(1)
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.locator('.builder-title p')).toContainText('Draft saved')
  expect(
    api.draft().pages[0]!.sections.find((section) => section.id === 'first')!.devices!.mobile!
      .sizing,
  ).toEqual({ height: 120, minHeight: 90, basis: 30, grow: 2 })
  expect(api.draft().pages[1]!.layout).toMatchObject({ tablet: 'scale', mobile: 'scale' })
})

test('public responsive defaults use actual page width across breakpoint boundaries', async ({
  page,
}) => {
  await mockWebsite(page)
  await page.goto('/website')
  const scope = page.locator('.public-website')
  await page.setViewportSize({ width: 1024, height: 1000 })
  await expect(page.locator('.website-canvas')).toHaveAttribute('data-device', 'desktop')
  await expect(page.locator('.website-content')).toHaveClass(/grid-surface/)
  for (const width of [1023, 768, 767, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    await expectNaturalLayout(scope, width >= 768 ? 'tablet' : 'mobile')
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true)
  }
  await page.goto('/website/scaled')
  await expect(page.locator('.website-content')).toHaveClass(/grid-surface/)
  expect(
    await page
      .locator('.website-content')
      .evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a),
  ).toBeLessThan(1)
})

test('Phase 2 tablet preview and public Careers keep shared navigation and form content usable', async ({
  page,
}) => {
  await mockWebsite(page, phase2Site({ logo: 'logo', interior: 'photo' }))
  await page.setViewportSize({ width: 1700, height: 1100 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Tablet', exact: true }).click()
  const canvas = page.locator('.preview-frame')
  const toggle = canvas
    .locator('.section-navigation')
    .getByRole('button', { name: /navigation menu/i })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await canvas
    .getByRole('navigation', { name: 'Website navigation', exact: true })
    .getByRole('link', { name: 'Careers', exact: true })
    .click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(canvas.locator('.section-form')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Jobs', exact: true })).toBeVisible()
  await page.goto('/website/careers')
  for (const width of [820, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    const button = page.getByRole('button', { name: 'Send introduction', exact: true })
    await expect(button).toBeVisible()
    const submit = (await button.boundingBox())!
    const form = (await page.locator('.section-form').boundingBox())!
    const footer = (await page.locator('.section-footer').boundingBox())!
    expect(submit.y + submit.height).toBeLessThanOrEqual(form.y + form.height)
    expect(submit.y + submit.height).toBeLessThanOrEqual(footer.y)
    await expect(
      page.locator('.section-navigation').getByRole('button', { name: /navigation menu/i }),
    ).toHaveAttribute('aria-expanded', 'false')
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true)
  }
})
