import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { expect, test, type Page } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { phase2Site } from '../src/features/website/phase2Site.js'
import type { WebsiteSite } from '../src/features/website/types.js'

const { validateWebsite, publishedWebsite } = createRequire(import.meta.url)(
  '../functions/websiteModel.js',
)
const imagePath = 'src/assets/images/phase2-logo.png'
const image = readFileSync(imagePath).toString('base64')
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }

async function mockWebsite(
  page: Page,
  options: { dropdown?: boolean; fixedHeight?: boolean } = {},
) {
  let draft: WebsiteSite = validateWebsite(phase2Site({ logo: 'logo', interior: 'photo' }))
  const navigation = draft.sharedLayout!.sections.find((section) => section.type === 'navigation')!
  if (options.fixedHeight) navigation.devices!.mobile!.sizing = { height: 96 }
  if (options.dropdown) {
    navigation.navigation!.links = [
      {
        id: 'resources',
        label: 'Resources',
        url: '',
        children: [{ id: 'safety', label: 'Safety resources', url: '/website/safety' }],
      },
    ]
  }
  let version = 1
  let saves = 0
  await page.route('**/websiteBuilder', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers })
      return
    }
    const data = route.request().postDataJSON().data
    let result: unknown = { draft, version, publishedAt: null, hasPrevious: false }
    if (data.action === 'getImage') result = { base64: image, contentType: 'image/png' }
    if (data.action === 'listRevisions') result = { revisions: [], activity: [] }
    if (data.action === 'save') {
      draft = validateWebsite(data.site)
      saves++
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
    review.forms!.forEach((form) => {
      form.delivery!.to = ['careers@example.com']
    })
    await route.fulfill({ headers, json: { result: { site: publishedWebsite(review) } } })
  })
  await page.route('**/website-image?*', (route) =>
    route.fulfill({ path: imagePath, contentType: 'image/png' }),
  )
  return { saves: () => saves }
}

for (const mode of ['Content', 'Design']) {
  test(`builder Phone navigation collapses inside a wide browser and remains editable in ${mode}`, async ({
    page,
  }) => {
    const api = await mockWebsite(page)
    await page.setViewportSize({ width: 1700, height: 1100 })
    await gotoPhase2App(page, '/admin/website', createJobsFixture())
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await expect(page.locator('.builder-title p')).toContainText('Draft saved')
    const initialSaves = api.saves()
    await page.getByRole('button', { name: mode, exact: true }).click()
    await page.getByRole('button', { name: 'Mobile', exact: true }).click()
    const canvas = page.locator('.preview-frame')
    const header = canvas.locator('.section-navigation')
    const toggle = header.getByRole('button', { name: /navigation menu/i })
    const nav = header.locator('nav[aria-label="Website navigation"]')
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(nav).toBeHidden()
    expect(await header.evaluate((element) => (element as HTMLElement).offsetHeight)).toBeLessThan(
      160,
    )
    await header.screenshot({
      path: `.security-work/mobile-menu-builder-${mode.toLowerCase()}-closed.png`,
    })
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(nav.getByRole('link', { name: 'Company', exact: true })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Employee login', exact: true })).toBeVisible()
    await nav.getByRole('link', { name: 'Company', exact: true }).press('Escape')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(toggle).toBeFocused()
    await toggle.press('Enter')
    await nav.getByRole('link', { name: 'Company', exact: true }).click()
    await expect(canvas.getByRole('heading', { level: 1 })).toHaveText(
      'People behind the progress.',
    )
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(nav).toBeHidden()
    await toggle.click()
    await canvas.locator('.section-hero').click({ position: { x: 4, y: 4 } })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('.builder-title p')).toContainText('Draft saved')
    await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
    expect(api.saves()).toBe(initialSaves)
    await toggle.click()
    await nav.getByRole('link', { name: 'Company', exact: true }).dblclick()
    const editor = page.getByRole('textbox', { name: 'Edit menu label on page', exact: true })
    await expect(editor).toBeFocused()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await editor.fill('Our company')
    await editor.press('Enter')
    const renamed = nav.getByRole('link', { name: 'Our company', exact: true })
    await expect(renamed).toBeVisible()
    await renamed.press('F2')
    await expect(editor).toBeFocused()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await editor.fill('Company')
    await editor.press('Enter')
    await expect(page).toHaveURL(/\/admin\/website$/)
    await page.getByRole('button', { name: 'Desktop', exact: true }).click()
    await expect(toggle).toBeHidden()
    await expect(nav.getByRole('link', { name: 'Company', exact: true })).toBeVisible()
    expect(await nav.evaluate((element) => getComputedStyle(element).flexDirection)).toBe('row')
    await page.getByRole('button', { name: 'Mobile', exact: true }).click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(nav).toBeHidden()
    await toggle.click()
    await nav.getByRole('link', { name: 'Employee login', exact: true }).click()
    await expect(page).toHaveURL(/\/jobs$/)
    await expect(page.getByTestId('jobs-search')).toBeVisible()
  })
}

test('tablet and phone menus follow preview size and public breakpoints while desktop and footer stay expanded', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await page.setViewportSize({ width: 1700, height: 1100 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.locator('.builder-title p')).toContainText('Draft saved')
  const initialSaves = api.saves()
  const canvas = page.locator('.preview-frame')
  const previewHeader = canvas.locator('.section-navigation')
  const previewToggle = previewHeader.getByRole('button', { name: /navigation menu/i })
  const previewNav = previewHeader.locator('nav[aria-label="Website navigation"]')
  async function openCompactPreview(device: 'Tablet' | 'Mobile') {
    await page.getByRole('button', { name: device, exact: true }).click()
    // Moving between compact devices also closes a previously open menu.
    await expect(previewToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(previewNav).toBeHidden()
    await previewToggle.click()
    await expect(previewToggle).toHaveAttribute('aria-expanded', 'true')
    await expect(previewNav.getByRole('link', { name: 'Company', exact: true })).toBeVisible()
    await expect(
      canvas
        .getByRole('navigation', { name: 'Footer navigation', exact: true })
        .getByRole('link', { name: 'Company', exact: true }),
    ).toBeVisible()
  }
  await openCompactPreview('Tablet')
  await openCompactPreview('Mobile')
  await page.getByRole('button', { name: 'Desktop', exact: true }).click()
  await expect(previewToggle).toHaveCount(0)
  await expect(previewNav.getByRole('link', { name: 'Company', exact: true })).toBeVisible()
  await openCompactPreview('Tablet')
  await expect(page.locator('.builder-title p')).toContainText('Draft saved')
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
  expect(api.saves()).toBe(initialSaves)

  await page.goto('/website')
  const header = page.locator('.section-navigation')
  const toggle = header.getByRole('button', { name: /navigation menu/i })
  const nav = header.locator('nav[aria-label="Website navigation"]')
  async function checkPublicFooterAndWidth() {
    await expect(
      page
        .getByRole('navigation', { name: 'Footer navigation', exact: true })
        .getByRole('link', { name: 'Company', exact: true }),
    ).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true)
  }
  async function openCompactPublic(width: number) {
    await page.setViewportSize({ width, height: 1000 })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(nav).toBeHidden()
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(nav.getByRole('link', { name: 'Company', exact: true })).toBeVisible()
    expect(await nav.evaluate((element) => getComputedStyle(element).flexDirection)).toBe('column')
    await checkPublicFooterAndWidth()
  }
  async function checkDesktopPublic(width: number) {
    await page.setViewportSize({ width, height: 1000 })
    await expect(toggle).toHaveCount(0)
    await expect(nav.getByRole('link', { name: 'Company', exact: true })).toBeVisible()
    expect(await nav.evaluate((element) => getComputedStyle(element).flexDirection)).toBe('row')
    await checkPublicFooterAndWidth()
  }
  await openCompactPublic(820)
  await openCompactPublic(390)
  await checkDesktopPublic(1024)
  await openCompactPublic(768)
  await checkDesktopPublic(1600)
})

test.describe('published phone navigation', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } })

  test('touch menu is compact, navigates, closes and opens the existing login portal', async ({
    page,
  }) => {
    await mockWebsite(page)
    await page.goto('/website')
    const header = page.locator('.section-navigation')
    const toggle = header.getByRole('button', { name: /navigation menu/i })
    const nav = header.locator('nav[aria-label="Website navigation"]')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(nav).toBeHidden()
    expect(await header.evaluate((element) => (element as HTMLElement).offsetHeight)).toBeLessThan(
      160,
    )
    await expect(
      page
        .getByRole('navigation', { name: 'Footer navigation', exact: true })
        .getByRole('link', { name: 'Company', exact: true }),
    ).toBeVisible()
    await expect(
      page
        .getByRole('navigation', { name: 'Footer navigation', exact: true })
        .getByRole('button', { name: /navigation menu/i }),
    ).toHaveCount(0)
    await page.screenshot({ path: '.security-work/mobile-menu-public-closed.png' })
    await toggle.tap()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(nav.getByRole('link', { name: 'Company', exact: true })).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true)
    await page.screenshot({ path: '.security-work/mobile-menu-public-open.png' })
    await nav.getByRole('link', { name: 'Company', exact: true }).tap()
    await expect(page).toHaveURL(/\/website\/company$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('People behind the progress.')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.tap()
    await page.locator('.section-hero').tap({ position: { x: 4, y: 4 } })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true)
    await toggle.tap()
    await nav.getByRole('link', { name: 'Employee login', exact: true }).tap()
    await expect(page).toHaveURL(/\/login$/)
    await expect(
      page.getByRole('heading', { name: 'Phase 2 Web Application', exact: true }),
    ).toBeVisible()
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
  })

  test('nested links expand within the phone menu and close after touch navigation', async ({
    page,
  }) => {
    await mockWebsite(page, { dropdown: true })
    await page.goto('/website')
    const header = page.locator('.section-navigation')
    const toggle = header.getByRole('button', { name: /navigation menu/i })
    const submenu = header.getByRole('button', { name: /Resources submenu/i })
    const child = header.getByRole('link', { name: 'Safety resources', exact: true })
    await toggle.tap()
    await submenu.tap()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(submenu).toHaveAttribute('aria-expanded', 'true')
    await expect(child).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true)
    await child.press('Escape')
    await expect(submenu).toHaveAttribute('aria-expanded', 'false')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(submenu).toBeFocused()
    await submenu.tap()
    await child.tap()
    await expect(page).toHaveURL(/\/website\/safety$/)
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.tap()
    await expect(submenu).toHaveAttribute('aria-expanded', 'false')
  })

  test('fixed-height phone header keeps its toggle stable and exposes clickable menu links', async ({
    page,
  }) => {
    await mockWebsite(page, { fixedHeight: true })
    await page.goto('/website')
    const header = page.locator('.section-navigation')
    const toggle = header.getByRole('button', { name: /navigation menu/i })
    await expect(toggle).toBeVisible()
    const closedHeader = (await header.boundingBox())!
    const closedToggle = (await toggle.boundingBox())!
    expect(closedHeader.height).toBeCloseTo(96, 0)
    await toggle.tap()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const openToggle = (await toggle.boundingBox())!
    expect(openToggle.y).toBeCloseTo(closedToggle.y, 0)
    expect(openToggle.y).toBeGreaterThanOrEqual(closedHeader.y)
    expect(openToggle.y + openToggle.height).toBeLessThanOrEqual(
      closedHeader.y + closedHeader.height,
    )
    const panel = header.locator('.navigation-panel')
    const panelBounds = (await panel.boundingBox())!
    // The panel may start in the header's bottom padding, but cannot overlap its controls.
    expect(panelBounds.y).toBeGreaterThanOrEqual(openToggle.y + openToggle.height)
    const careers = panel.getByRole('link', { name: 'Careers', exact: true })
    await expect(careers).toBeVisible()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true)
    await page.screenshot({ path: '.security-work/mobile-menu-fixed-open.png' })
    await careers.tap()
    await expect(page).toHaveURL(/\/website\/careers$/)
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})
