import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { expect, test } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { phase2Site } from '../src/features/website/phase2Site.js'
const { validateWebsite, publishedWebsite } = createRequire(import.meta.url)(
  '../functions/websiteModel.js',
)

test('Shared Phase 2 site opens directly, supports content edits, and renders every page', async ({
  page,
}) => {
  let draft = validateWebsite(
      phase2Site({
        logo: 'site-logo',
        interior: 'site-interior',
        architecture: 'site-architecture',
        finished: 'site-finished',
        planning: 'site-planning',
      }),
    ),
    version = 1
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
  const pageHeading = (slug: string) =>
    draft.pages
      .find((entry: { slug: string }) => entry.slug === slug)
      .sections.find((section: { type: string }) => section.type === 'hero')
      .title.replace(/\s+/g, ' ')
  const captureWebsite = async (path: string) => {
    await page.evaluate(() => document.fonts.ready)
    for (const image of await page.locator('img').all()) {
      await image.scrollIntoViewIfNeeded()
      await expect
        .poll(() =>
          image.evaluate(
            (element: HTMLImageElement) => element.complete && element.naturalWidth > 0,
          ),
        )
        .toBe(true)
    }
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect
      .poll(() =>
        page
          .locator('img')
          .evaluateAll((images: HTMLImageElement[]) =>
            images.every((image) => image.complete && image.naturalWidth > 0),
          ),
      )
      .toBe(true)
    await page.screenshot({ path, fullPage: true, animations: 'disabled' })
  }
  const expectCareersFormContained = async () => {
    // ResizeObserver updates responsive layout after the viewport changes. Measure
    // every bound in one DOM snapshot and wait for the contained layout to settle.
    await expect
      .poll(() =>
        page.locator('.section-form').evaluate((element) => {
          const card = element.getBoundingClientRect()
          const footer = document.querySelector('.section-footer')?.getBoundingClientRect()
          const controls = [
            element.querySelector('button[type="submit"]'),
            element.querySelector('textarea'),
          ]
          return (
            !!footer &&
            controls.every((element) => {
              if (!element) return false
              const control = element.getBoundingClientRect()
              return (
                control.width > 0 &&
                control.height > 0 &&
                control.left >= card.left &&
                control.right <= card.right &&
                control.top >= card.top &&
                control.bottom <= card.bottom &&
                control.bottom <= footer.top
              )
            })
          )
        }),
      )
      .toBe(true)
  }
  await page.route('**/websiteBuilder', async (route) => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers })
      return
    }
    const data = route.request().postDataJSON().data
    let result: unknown = { draft, version, publishedAt: null, hasPrevious: false }
    if (data.action === 'getImage')
      result = {
        base64: readFileSync(images[data.id]!.path).toString('base64'),
        contentType: images[data.id]!.contentType,
      }
    if (data.action === 'save') {
      draft = validateWebsite(data.site)
      result = { version: ++version }
    }
    await route.fulfill({ headers, json: { result } })
  })
  await page.route('**/getPublishedWebsite', (route) => {
    const review = structuredClone(draft)
    review.forms.forEach((form: { delivery: { to: string[] } }) => {
      form.delivery.to = ['review@example.com']
    })
    return route.fulfill({
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      json: { result: { site: publishedWebsite(review) } },
    })
  })
  await page.route('**/website-image?*', (route) =>
    route.fulfill(images[new URL(route.request().url()).searchParams.get('id')!]!),
  )
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Design', exact: true }).click()
  const hero = page.locator('.preview-frame').getByRole('heading', { name: /Good work starts/ })
  await expect(hero).toBeVisible()
  await page.getByRole('button', { name: 'Publishing', exact: true }).click()
  const checks = page.locator('.publishing-checks')
  await expect(checks.getByRole('button', { name: /^Fix:/ })).toHaveCount(1)
  for (const [pageName, formName] of [['Careers', 'Introduce yourself']]) {
    await checks
      .getByRole('button', {
        name: `Fix: ${pageName}: add an email recipient for the “${formName}” form.`,
        exact: true,
      })
      .click()
    const settings = page.getByRole('region', { name: 'Form settings', exact: true })
    await expect(settings.getByLabel('Form name', { exact: true })).toHaveValue(formName!)
    await expect(settings.getByLabel('To recipients', { exact: true })).toBeFocused()
  }
  await page.getByRole('button', { name: 'Pages', exact: true }).click()
  await page.getByRole('button', { name: 'Home /home', exact: true }).click()
  // Capture the editor's normal materialized layout defaults before browsing.
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  const original = structuredClone(draft)
  const canvas = page.locator('.preview-frame')
  const nav = canvas.getByRole('navigation', { name: 'Website navigation', exact: true })
  const menuEditor = page.getByRole('textbox', { name: 'Edit menu label on page' })
  for (const mode of ['Design', 'Content']) {
    await page.getByRole('button', { name: mode, exact: true }).click()
    for (const title of ['Company', 'Safety', 'Company', 'Services']) {
      await nav.getByRole('link', { name: title, exact: true }).click()
      await expect(canvas.getByRole('heading', { level: 1 })).toHaveText(
        pageHeading(title.toLowerCase()),
      )
      await expect(menuEditor).toHaveCount(0)
      await expect(page).toHaveURL(/\/admin\/website$/)
    }
  }
  // A deliberate edit opens the shared layout, then ordinary links still navigate.
  await nav.getByRole('link', { name: 'Company', exact: true }).dblclick()
  await expect(menuEditor).toBeFocused()
  await expect(menuEditor).toHaveText('Company')
  await menuEditor.press('Escape')
  await nav.getByRole('link', { name: 'Company', exact: true }).press('F2')
  await expect(menuEditor).toBeFocused()
  await menuEditor.press('Escape')
  await nav.getByRole('link', { name: 'Safety', exact: true }).press('Enter')
  await expect(canvas.getByRole('heading', { level: 1 })).toHaveText(pageHeading('safety'))
  // Custom footer links use the same page navigation as automatic navbar links.
  await canvas
    .getByRole('navigation', { name: 'Footer navigation', exact: true })
    .getByRole('link', { name: 'Company', exact: true })
    .click()
  await expect(canvas.getByRole('heading', { level: 1 })).toHaveText(pageHeading('company'))
  await page.getByRole('button', { name: 'Home /home', exact: true }).click()
  await expect(hero).toBeVisible()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(draft).toEqual(original)
  await page.getByRole('button', { name: 'Design', exact: true }).click()
  await hero.click()
  await page
    .getByRole('region', { name: 'Selected element editor' })
    .getByLabel('Heading', { exact: true })
    .fill('Good work. Great people.')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect.poll(() => pageHeading('home')).toBe('Good work. Great people.')
  expect(draft.pages).toHaveLength(9)
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled()
  await page.reload()
  await expect(
    page.locator('.preview-frame').getByRole('heading', { name: 'Good work. Great people.' }),
  ).toBeVisible()
  await page.screenshot({ path: '.security-work/phase2-site-editor.png' })
  await page.goto('/website')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Good work. Great people.' }),
  ).toBeVisible()
  await captureWebsite('.security-work/phase2-site-desktop.png')
  await expect(
    page
      .getByRole('navigation', { name: 'Website navigation' })
      .getByRole('link', { name: 'Employee login', exact: true }),
  ).toHaveAttribute('href', '/login')
  for (const width of [1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true)
  }
  await captureWebsite('.security-work/phase2-site-phone.png')
  for (const slug of [
    'company',
    'services',
    'location',
    'safety',
    'careers',
    'insights',
    'projects',
    'awards',
  ]) {
    await page.goto(`/website/${slug}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(pageHeading(slug))
    await expect(page.getByRole('heading').first()).toHaveText(pageHeading(slug))
    await expect(page.getByRole('navigation', { name: 'Footer navigation' })).toBeVisible()
    for (const viewport of [
      { name: 'desktop', width: 1600, height: 1000 },
      { name: 'phone', width: 390, height: 900 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true)
      await captureWebsite(`.security-work/phase2-premium-${slug}-${viewport.name}.png`)
    }
  }
  await page.goto('/website/careers')
  await expect(page.getByLabel('Tell us about your experience and interests')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Contact', exact: true })).toHaveCount(0)
  for (const width of [1600, 820, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.evaluate(() => document.fonts.ready)
    await expectCareersFormContained()
  }
  await captureWebsite('.security-work/phase2-site-careers-phone.png')
  // Restore the mock's authored content for visual review after the save/reload regression.
  draft = structuredClone(original)
  await page.goto('/website')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(pageHeading('home'))
  for (const viewport of [
    { name: 'desktop', width: 1600, height: 1000 },
    { name: 'phone', width: 390, height: 900 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await captureWebsite(`.security-work/phase2-premium-home-${viewport.name}.png`)
  }
})

test('Shared navigation and footer stay editable in the current page context', async ({ page }) => {
  let draft = validateWebsite(phase2Site({ logo: 'shared-logo', interior: 'shared-interior' })),
    version = 1
  await page.route('**/websiteBuilder', async (route) => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers })
      return
    }
    const data = route.request().postDataJSON().data
    let result: unknown = { draft, version, publishedAt: null, hasPrevious: false }
    if (data.action === 'getImage')
      result = {
        base64: readFileSync(
          data.id === 'shared-logo'
            ? 'src/assets/images/phase2-logo.png'
            : 'src/assets/images/construction-placeholder.webp',
        ).toString('base64'),
      }
    if (data.action === 'save') {
      draft = validateWebsite(data.site)
      result = { version: ++version }
    }
    await route.fulfill({ headers, json: { result } })
  })
  const headingFor = (slug: string) =>
    draft.pages
      .find((entry: { slug: string }) => entry.slug === slug)
      .sections.find((section: { type: string }) => section.type === 'hero')
      .title.replace(/\s+/g, ' ')
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const canvas = page.locator('.preview-frame')
  const title = canvas.getByRole('heading', { level: 1 })
  const nav = canvas.getByRole('navigation', { name: 'Website navigation', exact: true })
  const currentScope = page.getByRole('button', { name: 'Current page', exact: true })
  const sharedScope = page.getByRole('button', { name: 'Site layout', exact: true })
  for (const mode of ['Design', 'Content']) {
    await page.getByRole('button', { name: mode, exact: true }).click()
    await page.getByRole('button', { name: 'Pages', exact: true }).click()
    await page.getByRole('button', { name: 'Home /home', exact: true }).click()
    await expect(title).toHaveText(headingFor('home'))
    // The actual padded widget background, rather than a navbar link, selects shared chrome.
    await canvas.locator('.section-navigation').click({ position: { x: 4, y: 4 } })
    await expect(sharedScope).toHaveAttribute('aria-pressed', 'true')
    await expect(title).toHaveText(headingFor('home'))
    await expect(canvas.locator('.section-navigation.selected')).toBeVisible()
    await currentScope.click()
    await expect(title).toHaveText(headingFor('home'))
    await sharedScope.click()
    await expect(title).toHaveText(headingFor('home'))
    await nav.getByRole('link', { name: 'Company', exact: true }).click()
    await expect(title).toHaveText(headingFor('company'))
    await canvas.locator('.section-footer').click({ position: { x: 4, y: 4 } })
    await expect(sharedScope).toHaveAttribute('aria-pressed', 'true')
    await expect(title).toHaveText(headingFor('company'))
    await expect(canvas.locator('.section-footer.selected')).toBeVisible()
    // Selecting page content returns to page editing without losing the shared frame.
    await canvas.locator('.section-hero').click({ position: { x: 4, y: 4 } })
    await expect(currentScope).toHaveAttribute('aria-pressed', 'true')
    await expect(title).toHaveText(headingFor('company'))
    await sharedScope.click()
    await page.getByRole('button', { name: 'Home /home', exact: true }).click()
    await expect(title).toHaveText(headingFor('home'))
    await expect(canvas.locator('.section-navigation')).toBeVisible()
    await expect(canvas.locator('.section-footer')).toBeVisible()
  }
  // Link text changes are reflected immediately across page switches, with no refresh.
  await nav.getByRole('link', { name: 'Company', exact: true }).dblclick()
  const editor = page.getByRole('textbox', { name: 'Edit menu label on page', exact: true })
  await expect(editor).toBeFocused()
  await editor.fill('Our company')
  await editor.press('Enter')
  await expect(nav.getByRole('link', { name: 'Our company', exact: true })).toBeVisible()
  await nav.getByRole('link', { name: 'Services', exact: true }).click()
  await expect(title).toHaveText(headingFor('services'))
  await nav.getByRole('link', { name: 'Our company', exact: true }).click()
  await expect(title).toHaveText(headingFor('company'))
  await sharedScope.click()
  await title.click()
  const headingEditor = page.getByRole('textbox', { name: 'Edit heading on page', exact: true })
  await expect(headingEditor).toBeFocused()
  await expect(currentScope).toHaveAttribute('aria-pressed', 'true')
  await headingEditor.press('Escape')
  await expect(title).toHaveText(headingFor('company'))
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  await expect(nav.getByRole('link', { name: 'Our company', exact: true })).toBeVisible()
})

test('Shared layout selection yields to page background marquee and menu actions', async ({
  page,
}) => {
  const widget = (
    id: string,
    type: string,
    title: string,
    layout = { x: 0, y: 0, w: 24, h: 3, z: 0 },
  ) => ({
    id,
    type,
    title,
    text: '',
    imageId: '',
    alt: '',
    linkLabel: '',
    linkUrl: '',
    hidden: false,
    items: [],
    layout,
    appearance: { padding: 16, headingSize: 24 },
  })
  let draft = validateWebsite({
      name: 'Shared layout regression',
      accent: '#075486',
      pages: [
        {
          id: 'grid-home',
          slug: 'home',
          title: 'Home',
          description: '',
          inNavigation: true,
          chrome: 'widgets',
          useSiteLayout: true,
          layout: { desktop: 'grid', tablet: 'scale', mobile: 'scale' },
          sections: [
            widget('page-one', 'card', 'Page one', { x: 4, y: 3, w: 6, h: 4, z: 0 }),
            widget('page-two', 'card', 'Page two', { x: 12, y: 3, w: 6, h: 4, z: 1 }),
          ],
        },
      ],
      sharedLayout: {
        id: 'shell',
        slug: 'site-layout',
        title: 'Site layout',
        description: '',
        inNavigation: false,
        chrome: 'widgets',
        layout: { desktop: 'flow', tablet: 'flow', mobile: 'flow', gap: 0, padding: 0 },
        sections: [
          widget('shell-nav', 'navigation', 'Shared navigation'),
          widget('shell-slot', 'page-content', 'Page content'),
          widget('shell-footer', 'footer', 'Shared footer'),
        ],
      },
    }),
    version = 1
  await page.route('**/websiteBuilder', async (route) => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers })
      return
    }
    const data = route.request().postDataJSON().data
    let result: unknown = { draft, version, publishedAt: null, hasPrevious: false }
    if (data.action === 'save') {
      draft = validateWebsite(data.site)
      result = { version: ++version }
    }
    await route.fulfill({ headers, json: { result } })
  })
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Design', exact: true }).click()
  const canvas = page.locator('.preview-frame')
  const currentScope = page.getByRole('button', { name: 'Current page', exact: true })
  const sharedScope = page.getByRole('button', { name: 'Site layout', exact: true })
  const surface = canvas.locator('.grid-surface')
  await canvas.locator('.section-navigation').click({ position: { x: 4, y: 4 } })
  await expect(sharedScope).toHaveAttribute('aria-pressed', 'true')
  const bounds = (await surface.boundingBox())!
  const scale = bounds.width / 1080
  await page.mouse.move(bounds.x + 21 * 45 * scale, bounds.y + 11 * 32 * scale)
  await page.mouse.down()
  await page.mouse.move(bounds.x + 3 * 45 * scale, bounds.y + 2 * 32 * scale, { steps: 12 })
  await expect(currentScope).toHaveAttribute('aria-pressed', 'true')
  await expect(surface.locator('.grid-marquee')).toBeVisible()
  await page.mouse.up()
  await expect(canvas.locator('.grid-selected[data-widget-id="page-one"]')).toBeVisible()
  await expect(canvas.locator('.grid-selected[data-widget-id="page-two"]')).toBeVisible()
  await expect(canvas.locator('.grid-selected[data-widget-id^="shell-"]')).toHaveCount(0)
  await canvas.locator('.section-navigation').click({ position: { x: 4, y: 4 } })
  await expect(sharedScope).toHaveAttribute('aria-pressed', 'true')
  const menuBounds = (await surface.boundingBox())!
  const menuScale = menuBounds.width / 1080
  await page.mouse.click(menuBounds.x + 21 * 45 * menuScale, menuBounds.y + 11 * 32 * menuScale, {
    button: 'right',
  })
  await expect(currentScope).toHaveAttribute('aria-pressed', 'true')
  const menu = page.getByRole('menu', { name: 'Widget actions', exact: true })
  await expect(menu).toBeVisible()
  await menu.getByRole('menuitem', { name: 'Select all widgets', exact: true }).click()
  await expect(canvas.locator('.grid-selected[data-widget-id="page-one"]')).toBeVisible()
  await expect(canvas.locator('.grid-selected[data-widget-id="page-two"]')).toBeVisible()
  await expect(canvas.locator('.grid-selected[data-widget-id^="shell-"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(draft.pages[0].sections.map((section: { id: string }) => section.id)).toEqual([
    'page-one',
    'page-two',
  ])
  expect(draft.sharedLayout.sections.map((section: { id: string }) => section.id)).toEqual([
    'shell-nav',
    'shell-slot',
    'shell-footer',
  ])
})
