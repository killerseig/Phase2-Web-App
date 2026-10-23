import { expect, test, type Page } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { withWebsiteDefaults, type WebsiteSite } from '../src/features/website/types.js'

const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
const site: WebsiteSite = withWebsiteDefaults({ name: 'Synthetic comparison', accent: '#174878', pages: [{ id: 'home', chrome: 'widgets', title: 'Home', slug: 'home', description: '', inNavigation: true, sections: [{ id: 'hero', type: 'hero', title: 'Synthetic heading', text: 'Local fixture only.', imageId: '', alt: '', linkLabel: '', linkUrl: '', hidden: false, items: [] }] }] })
const definition = { title: 'Alpha report', description: '', recipients: [], fields: [{ id: 'notes', kind: 'text', label: 'Notes', required: false, options: [] }] }
async function fixtures(page: Page, path: string) {
  const calls: { service: string; action: string }[] = []
  await page.addInitScript(() => { window.__PHASE2_FORM_SERVER__ = true })
  await page.route('**/websiteBuilder', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const data = route.request().postDataJSON().data; calls.push({ service: 'website', action: data.action })
    if (data.action !== 'load') throw new Error('Website mutation is outside UI alignment verification: ' + data.action)
    await route.fulfill({ json: { result: { draft: structuredClone(site), version: 3, publishedAt: null, hasPrevious: false } }, headers })
  })
  await page.route('**/formTemplates', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const data = route.request().postDataJSON().data; calls.push({ service: 'forms', action: data.action })
    if (data.action !== 'list') throw new Error('Form mutation is outside UI alignment verification: ' + data.action)
    await route.fulfill({ json: { result: { templates: ['Alpha report', 'Beta report'].map((title, index) => ({ id: 'synthetic-' + index, draft: { ...definition, title }, revision: 3, latestVersion: 0, archived: false, used: false })) } }, headers })
  })
  await page.route('**/sdsWorkspace', route => route.fulfill({ json: { result: { sheets: [], after: '', scanned: 0 } }, headers }))
  await gotoPhase2App(page, path, createJobsFixture())
  return calls
}
async function mobilePanel(page: Page, name: string, width: number) {
  if (width <= 900) await page.getByRole('navigation', { name: 'Builder panels' }).getByRole('button', { name, exact: true }).click()
}
async function stableDisclosure(page: Page, label: string, sibling: string) {
  const button = page.getByRole('button', { name: label, exact: true }), other = page.getByRole('button', { name: sibling, exact: true })
  // Font swap changes the phone header height by one pixel independently of
  // disclosure activation. Measure the interaction after typography settles.
  await page.evaluate(async () => { await document.fonts.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))) })
  await button.scrollIntoViewIfNeeded(); const before = await button.boundingBox(), otherBefore = await other.boundingBox()
  const scrollState = () => button.evaluate(el => { const ancestors = []; for (let p: HTMLElement | null = el.parentElement; p; p = p.parentElement) if (p.scrollTop || p.scrollHeight > p.clientHeight) ancestors.push({ tag: p.tagName, class: p.className, top: p.scrollTop, height: p.clientHeight, content: p.scrollHeight }); return { ancestors, fonts: document.fonts.status, header: document.querySelector('.builder-header')?.getBoundingClientRect().toJSON() } })
  const scrollBefore = await scrollState()
  await button.focus(); const focused = await button.boundingBox(), scrollFocused = await scrollState()
  await page.keyboard.press('Enter'); await expect(button).toHaveAttribute('aria-expanded', 'true')
  const after = await button.boundingBox()
  if (JSON.stringify(before) !== JSON.stringify(after)) console.log('DISCLOSURE_POSITION', JSON.stringify({ label, before, focused, after, scrollBefore, scrollFocused, scrollAfter: await scrollState() }))
  expect(await button.boundingBox()).toEqual(before); expect(await other.boundingBox()).toEqual(otherBefore)
  await page.keyboard.press('Space'); await expect(button).toHaveAttribute('aria-expanded', 'false')
}

for (const width of [1600, 900, 768, 390]) {
  test('Form builder shared tools, mobile panels and keyboard at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); const calls = await fixtures(page, '/admin/forms')
    await page.getByRole('button', { name: 'Alpha report', exact: true }).click()
    const inspector = page.getByRole('complementary', { name: 'Form inspector' }); await expect(inspector).toBeVisible()
    await stableDisclosure(page, 'Form actions', 'Add fields')
    const tabs = page.getByRole('tablist', { name: 'Form settings' })
    await tabs.getByRole('tab', { name: 'Form', exact: true }).focus(); await page.keyboard.press('End')
    await expect(tabs.getByRole('tab', { name: 'Publishing', exact: true })).toBeFocused()
    await expect(page.getByRole('region', { name: 'Publishing checks' })).toBeVisible()
    await page.keyboard.press('ArrowLeft'); await expect(tabs.getByRole('tab', { name: 'Field', exact: true })).toHaveAttribute('aria-selected', 'true')
    await mobilePanel(page, 'Canvas', width)
    await expect(inspector).toBeVisible({ visible: width > 900 })
    await expect(page.getByRole('complementary', { name: 'Form library' })).toBeVisible({ visible: width > 900 })
    await page.getByRole('article', { name: 'Field 1', exact: true }).focus(); await page.keyboard.press('Enter')
    await expect(inspector).toBeVisible()
    await expect.poll(() => inspector.evaluate(el => el === document.activeElement)).toBe(width <= 900)
    await page.getByRole('button', { name: 'Add fields', exact: true }).click(); await expect(page.getByRole('region', { name: 'Field palette' })).toBeVisible(); await page.getByRole('button', { name: 'Add fields', exact: true }).click()
    await mobilePanel(page, 'Forms', width)
    const library = page.getByRole('complementary', { name: 'Form library' })
    await expect(library.locator('input,select,textarea,details')).toHaveCount(0)
    await page.getByRole('button', { name: 'Beta report', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: 'Publishing settings', exact: true }).click(); await expect(page.getByRole('region', { name: 'Publishing checks' })).toBeVisible()
    await page.getByRole('navigation', { name: 'Builder modes' }).getByRole('button', { name: 'Preview', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Full-page form preview' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Builder panels' })).toHaveCount(0)
    await page.getByRole('navigation', { name: 'Builder modes' }).getByRole('button', { name: 'Edit', exact: true }).click(); await expect(inspector).toBeVisible()
    expect(calls.every(call => call.action === 'list')).toBe(true)
    expect(await page.locator('.form-builder').evaluate(el => el.scrollWidth > el.clientWidth + 1)).toBe(false)
  })

  test('Website builder shared tools without publication or save changes at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); const calls = await fixtures(page, '/admin/website')
    await page.getByRole('button', { name: 'Design', exact: true }).click()
    const inspector = page.getByRole('complementary', { name: 'Content editor' })
    await stableDisclosure(page, 'Page actions', 'Add widgets')
    await page.getByRole('button', { name: 'Add widgets', exact: true }).click()
    await expect(page.getByRole('searchbox', { name: 'Find widgets' })).toBeFocused()
    await expect(page.getByRole('button', { name: 'Add Hero banner widget', exact: true })).toBeVisible()
    await mobilePanel(page, 'Editor', width)
    await page.getByRole('button', { name: 'Add widgets', exact: true }).focus(); await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Add widgets', exact: true })).toBeFocused()
    await expect(page.getByRole('button', { name: 'Add widgets', exact: true })).toHaveAttribute('aria-expanded', 'false')
    await mobilePanel(page, 'Pages & widgets', width)
    await page.getByRole('navigation', { name: 'Workspace tools' }).getByRole('button', { name: 'Pages', exact: true }).click()
    await page.locator('.widget-outline-row').getByRole('button').filter({ hasText: 'Synthetic heading' }).click()
    await expect(inspector).toBeVisible(); await stableDisclosure(page, 'Widget actions', 'Add widgets')
    const tabs = page.getByRole('tablist', { name: 'Widget settings' }); await tabs.getByRole('tab', { name: 'Content', exact: true }).focus(); await page.keyboard.press('ArrowRight')
    await expect(tabs.getByRole('tab', { name: 'Appearance', exact: true })).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('Home'); await expect(tabs.getByRole('tab', { name: 'Content', exact: true })).toBeFocused()
    await mobilePanel(page, 'Canvas', width)
    await expect(inspector).toBeVisible({ visible: width > 900 })
    await expect(page.locator('.preview-pane')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Phone', exact: true })).toBeAttached()
    await mobilePanel(page, 'Editor', width); await expect(inspector).toBeVisible()
    expect(calls.every(call => call.action === 'load')).toBe(true)
    expect(await page.locator('.website-builder').evaluate(el => el.scrollWidth > el.clientWidth + 1)).toBe(false)
  })
}

test('Website toolbar font timing diagnostic', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 900 })
  let release!: () => void
  const heldFonts = new Promise<void>(resolve => { release = resolve })
  await page.route('**/*.ttf', async route => { await heldFonts; await route.continue() })
  const loaded = fixtures(page, '/admin/website')
  try {
    await page.getByRole('button', { name: 'Design', exact: true }).click()
    const action = page.getByRole('button', { name: 'Page actions', exact: true })
    const metrics = () => action.evaluate(el => ({ button: el.getBoundingClientRect().toJSON(), header: document.querySelector('.builder-header')?.getBoundingClientRect().toJSON(), fonts: document.fonts.status }))
    const fallback = await metrics()
    release(); await loaded; await page.evaluate(async () => { await document.fonts.ready; await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))) })
    const webfont = await metrics()
    expect(fallback.fonts).toBe('loading')
    expect(webfont.fonts).toBe('loaded')
    console.log('FONT_TIMING', JSON.stringify({ fallback, webfont }))
    await testInfo.attach('font-timing', { body: JSON.stringify({ fallback, webfont }, null, 2), contentType: 'application/json' })
    await stableDisclosure(page, 'Page actions', 'Add widgets')
  } finally { release(); await loaded }
})
