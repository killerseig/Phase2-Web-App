import { createRequire } from 'node:module'
const { customDefinition, customMarkup, resolvedCustom, visibleCustomSections } = createRequire(
  import.meta.url,
)('../functions/websiteCustom.js')
import { readFileSync } from 'node:fs'
const { compareWebsites } = createRequire(import.meta.url)('../functions/websiteChanges.js')
import { expect, test, type Page } from './helpers/test.js'

import {
  createJobsFixture,
  createJobDashboardFixture,
  gotoPhase2App,
} from './helpers/phase2AppFixture.js'
import {
  newSection,
  newItem,
  sectionLabels,
  type SectionType,
  type WebsiteSite,
} from '../src/features/website/types.js'

// WebKit runs with Mac keyboard conventions even on a Windows test host.
async function shortcut(page: Page, key: string) {
  const mac = await page.evaluate(() => /Mac|iPhone|iPad/.test(navigator.platform))
  return `${mac ? 'Meta' : 'Control'}+${key}`
}

async function selectCanvasWidget(page: Page, title: string) {
  await page
    .locator('.preview-frame')
    .getByLabel(`Select ${title} widget`, { exact: true })
    .first()
    .click({ position: { x: 8, y: 8 } })
}

const initial: WebsiteSite = {
  name: 'Phase 2',
  accent: '#174878',
  pages: [
    {
      id: 'home',
      chrome: 'widgets',
      title: 'Home',
      slug: 'home',
      description: '',
      inNavigation: true,
      sections: [
        {
          id: 'hero',
          type: 'hero',
          title: 'Welcome to Phase 2',
          text: 'Our company introduction.',
          imageId: '',
          alt: '',
          linkLabel: '',
          linkUrl: '',
          hidden: false,
          items: [],
        },
      ],
    },
  ],
}
async function mockWebsite(
  page: Page,
  startPublished = false,
  longPage = false,
  content = initial,
) {
  let draft = structuredClone(content),
    published: WebsiteSite | null = startPublished ? structuredClone(content) : null,
    previous: WebsiteSite | null = null,
    version = 0
  if (longPage)
    draft.pages[0]!.sections = Array.from({ length: 20 }, (_, index) => ({
      ...structuredClone(initial.pages[0]!.sections[0]!),
      id: `section-${index}`,
      title: `Section ${index + 1}`,
      text: 'A long website section for checking the preview scroll area.\n'.repeat(8),
    }))
  if (longPage)
    draft.pages[0]!.sections.push({
      ...structuredClone(initial.pages[0]!.sections[0]!),
      id: 'footer',
      type: 'footer',
      title: 'Footer',
      text: '',
    })
  const revisions: {
    id: string
    version: number
    savedAt: number
    name: string
    draft: WebsiteSite
  }[] = []
  const actions: string[] = []
  let failSave = false
  await page.route('**/websiteBuilder', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
      })
      return
    }
    const data = route.request().postDataJSON().data
    actions.push(data.action)
    let result: unknown = { version }
    if (data.action === 'load')
      result = { draft, version, publishedAt: published ? 1 : null, hasPrevious: Boolean(previous) }
    if (data.action === 'save') {
      if (failSave) {
        await route.fulfill({
          status: 409,
          json: {
            error: {
              status: 'ABORTED',
              message: 'Another admin changed the website. Reload and review before saving.',
            },
          },
          headers: { 'access-control-allow-origin': '*' },
        })
        return
      }
      draft = structuredClone(data.site)
      version++
      revisions.unshift({
        id: 'revision-' + version,
        version,
        savedAt: Date.now(),
        name: draft.name,
        draft: structuredClone(draft),
      })
      result = { version }
    }
    if (data.action === 'listRevisions')
      result = {
        revisions: revisions.map(({ draft: _draft, ...meta }) => meta),
        activity: revisions.map(({ id, version, savedAt }) => ({
          id,
          version,
          savedAt,
          action: 'save',
          savedBy: 'Test admin',
        })),
      }
    if (data.action === 'getRevision')
      result = { draft: revisions.find((entry) => entry.id === data.revisionId)!.draft }
    if (data.action === 'comparePublished')
      result = { ...compareWebsites(published, data.site), publishedAt: published ? 1 : null }
    if (data.action === 'restoreRevision') {
      draft = structuredClone(revisions.find((entry) => entry.id === data.revisionId)!.draft)
      version++
      result = { version, draft }
    }
    if (data.action === 'publish') {
      previous = published
      published = structuredClone(draft)
      delete published.savedSections
      published.pages.forEach((page) => {
        page.sections = page.sections
          .filter((section) => !section.hidden)
          .map((section) => {
            if (!section.custom) return section
            const definition = resolvedCustom(
              customDefinition(section.custom, published!.customWidgets)!,
              section.custom.values,
            )
            definition.sections = visibleCustomSections(definition.sections)
            if (definition.kind === 'code') Object.assign(definition, customMarkup(definition))
            definition.fields = []
            return { ...section, custom: { inline: definition, values: {} } }
          })
      })
      if (published.forms) {
        const ids = new Set(
          published.pages.flatMap((page) => page.sections.map((section) => section.formId)),
        )
        published.forms = published.forms
          .filter((form) => ids.has(form.id))
          .map((form) => {
            const { delivery: _delivery, ...publicForm } = form
            return publicForm
          })
      }
      delete published.customWidgets
      version++
      result = { version, publishedAt: 1, hasPrevious: Boolean(previous) }
    }
    if (data.action === 'unpublish') {
      previous = published
      published = null
      version++
      result = { version, publishedAt: null, hasPrevious: true }
    }
    if (data.action === 'restore' && previous) {
      draft = {
        ...structuredClone(previous),
        ...(draft.savedSections ? { savedSections: structuredClone(draft.savedSections) } : {}),
      }
      version++
      result = { version, draft }
    }
    if (data.action === 'uploadImage' || data.action === 'getImage')
      result = { id: 'photo', base64: readFileSync('e2e/fixtures/site.webp').toString('base64') }
    if (data.action === 'listImages')
      result = data.cursor
        ? {
            images: [{ id: 'logo', name: 'Company logo.webp', size: 1000, createdAt: 1 }],
            nextCursor: null,
          }
        : {
            images: [{ id: 'photo', name: 'Project photo.webp', size: 1000, createdAt: 1 }],
            nextCursor: 'photo',
          }
    await route.fulfill({ json: { result }, headers: { 'access-control-allow-origin': '*' } })
  })
  await page.route('**/getPublishedWebsite', (route) =>
    route.fulfill({
      json: { result: { site: published } },
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' },
    }),
  )
  await page.route('**/website-image?*', (route) =>
    route.fulfill({ path: 'e2e/fixtures/site.webp', contentType: 'image/webp' }),
  )
  return {
    actions,
    draft: () => draft,
    published: () => published,
    failSave: () => {
      failSave = true
    },
  }
}

async function openTool(page: Page, name: 'Pages' | 'Widgets' | 'Layers' | 'Publishing') {
  const mobilePanels = page.getByRole('navigation', { name: 'Builder panels' })
  const outlineButton = mobilePanels.getByRole('button', { name: 'Pages & widgets' })
  if (
    (await mobilePanels.isVisible()) &&
    (await outlineButton.getAttribute('aria-pressed')) !== 'true'
  )
    await outlineButton.click()
  const tool = page
    .getByRole('navigation', { name: 'Workspace tools' })
    .getByRole('button', { name, exact: true })
  if ((await tool.getAttribute('aria-pressed')) !== 'true') await tool.click()
}

test('publishing comparison and change history review edits without altering the live site', async ({
  page,
}) => {
  const api = await mockWebsite(page, true)
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await selectCanvasWidget(page, 'Welcome to Phase 2')
  await openInspectorFor(page, 'Heading')
  const heading = page
    .getByRole('complementary', { name: 'Content editor' })
    .getByLabel('Heading', { exact: true })
  await heading.fill('First saved heading')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  await heading.fill('Current heading')
  await openTool(page, 'Publishing')
  await page.getByText('Compare with live site', { exact: true }).click()
  await page.getByRole('button', { name: 'Compare current draft', exact: true }).click()
  const liveComparison = page.locator('.publish-comparison')
  await liveComparison
    .getByText('changed Pages / Home / Widgets / Current heading / Title', { exact: true })
    .click()
  await expect(liveComparison).toContainText('Welcome to Phase 2')
  await expect(liveComparison).toContainText('Current heading')
  await page.getByText('Change history', { exact: true }).click()
  await page.getByRole('button', { name: 'Compare draft version 1', exact: true }).click()
  const savedComparison = page
    .locator('article')
    .filter({ has: page.getByRole('button', { name: 'Compare draft version 1', exact: true }) })
  await savedComparison
    .getByText('changed Pages / Home / Widgets / Current heading / Title', { exact: true })
    .click()
  await expect(savedComparison).toContainText('First saved heading')
  await expect(savedComparison).toContainText('Current draft (including unsaved edits)')
  await page.getByText('Recent activity', { exact: true }).click()
  await expect(page.locator('.activity')).toContainText('Test admin')
  await page.screenshot({ path: '.security-work/website-change-history.png', fullPage: true })
  expect(api.published()!.pages[0]!.sections[0]!.title).toBe('Welcome to Phase 2')
  expect(api.actions).not.toContain('publish')
  expect(api.actions).not.toContain('restoreRevision')
  await heading.fill('Changed after comparison')
  await expect(liveComparison).toContainText('Compare again to refresh')
  await expect(liveComparison.locator('.change-list')).toHaveCount(0)
})

async function openInspectorFor(page: Page, label: string) {
  const tabs = page.getByRole('tablist', { name: 'Widget settings' })
  if (!(await tabs.isVisible())) return
  const name =
    /^(Widget [xywhz]|Container|Child |Wrap |Grow proportion|Starting size|Item alignment|Minimum height|Hide |Lock position|Reset .* overrides|Ungroup container)/.test(
      label,
    )
      ? 'Layout'
      : /^(Rotation|Padding|Background color|Text color|Border |Font family|Text alignment|Image fit|Text size|Heading size|Corner radius|Opacity|Reset appearance)/.test(
            label,
          )
        ? 'Appearance'
        : 'Content'
  const tab = tabs.getByRole('tab', { name, exact: true })
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click()
  const group = /^(Rotation|Border |Opacity)/.test(label)
    ? 'Advanced style'
    : /^(Font family|Text alignment|Text size|Heading size)/.test(label)
      ? 'Text'
      : /^Widget [xyz]$/.test(label)
        ? 'Position and layer'
        : ''
  if (group) {
    const summary = page
      .getByRole('complementary', { name: 'Content editor' })
      .locator('summary')
      .filter({ hasText: new RegExp(`^${group}$`) })
    if ((await summary.locator('..').getAttribute('open')) === null) await summary.click()
  }
}

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.title.startsWith('editor modes')) return
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('website-editor-mode'))
      sessionStorage.setItem('website-editor-mode', 'design')
  })
})

test('full text toolbar preserves typography, heading formatting, undo and publication', async ({
  page,
}) => {
  const api = await mockWebsite(page, true)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  const canvas = page.locator('.preview-frame')
  const bar = page.getByRole('group', { name: 'Text formatting' })
  await canvas.getByText('Our company introduction.', { exact: true }).click()
  const body = page.getByRole('textbox', { name: 'Edit text on page' })
  await expect(body).toBeFocused()
  await body.fill('Build with Phase 2')
  await body.press(await shortcut(page, 'a'))
  await expect(bar.getByLabel('Font family', { exact: true })).toBeHidden()
  expect((await bar.boundingBox())!.height).toBeLessThanOrEqual(44)
  await page.screenshot({ path: '.security-work/compact-text-desktop.png' })
  await bar.getByRole('button', { name: 'Underline', exact: true }).click()
  await expect(body.locator('u')).toHaveText('Build with Phase 2')
  await bar.getByRole('button', { name: 'More formatting', exact: true }).click()
  await bar.getByRole('button', { name: 'Strikethrough', exact: true }).click()
  await bar.getByLabel('Font family', { exact: true }).selectOption('Georgia')
  await expect(body.locator('span')).toHaveCSS('font-family', 'Georgia')
  await expect(body).toBeFocused()
  await bar.getByLabel('Font size', { exact: true }).fill('24')
  await expect(bar.getByLabel('Font size', { exact: true })).toHaveValue('24')
  await bar.getByLabel('Font size', { exact: true }).press('Tab')
  await bar.getByLabel('Text color', { exact: true }).fill('#1255aa')
  await bar.getByLabel('Highlight color', { exact: true }).fill('#fff59d')
  await bar.getByRole('button', { name: 'Align center', exact: true }).click()
  await bar.getByLabel('Line spacing', { exact: true }).selectOption('1.8')
  await bar.getByRole('button', { name: 'Increase indent', exact: true }).click()
  await expect(body.locator('u')).toHaveText('Build with Phase 2')
  await expect(body.locator('s')).toHaveText('Build with Phase 2')
  await expect(body.locator('p')).toHaveCSS('text-align', 'center')
  await page.screenshot({ path: '.security-work/rich-text-desktop.png' })
  await bar.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(canvas.locator('.website-rich-text u')).toHaveText('Build with Phase 2')
  await expect(canvas.locator('.website-rich-text span[style]')).toHaveCSS('font-size', '24px')
  await canvas.getByRole('heading', { name: 'Welcome to Phase 2' }).click()
  const heading = page.getByRole('textbox', { name: 'Edit heading on page' })
  await heading.press(await shortcut(page, 'a'))
  await bar.getByRole('button', { name: 'Underline', exact: true }).click()
  await bar.getByRole('button', { name: 'More formatting', exact: true }).click()
  await bar.getByLabel('Font family', { exact: true }).selectOption('Georgia')
  await bar.getByRole('button', { name: 'Align right', exact: true }).click()
  await bar.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(canvas.locator('h1 u')).toHaveText('Welcome to Phase 2')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(canvas.locator('h1 u')).toHaveCount(0)
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(canvas.locator('h1 u')).toHaveText('Welcome to Phase 2')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect.poll(() => api.draft().pages[0]!.sections[0]!.text).toBe('Build with Phase 2')
  expect(api.draft().pages[0]!.sections[0]!.textRichText).toBeTruthy()
  expect(api.draft().pages[0]!.sections[0]!.titleRichText).toBeTruthy()
  expect(api.published()!.pages[0]!.sections[0]!.textRichText).toBeUndefined()
  await page.reload()
  await expect(canvas.locator('h1 u')).toHaveText('Welcome to Phase 2')
  await expect(canvas.locator('.widget-text p')).toHaveCSS('text-align', 'center')
  await canvas.getByText('Build with Phase 2', { exact: true }).click()
  await bar.getByRole('button', { name: 'More formatting', exact: true }).click()
  await expect(bar.getByLabel('Font family', { exact: true })).toHaveValue('Georgia')
  await expect(bar.getByLabel('Font size', { exact: true })).toHaveValue('24')
  await bar.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.goto('/website')
  await expect(page.locator('h1 u')).toHaveText('Welcome to Phase 2')
  await expect(page.locator('.widget-text p')).toHaveCSS('text-align', 'center')
  await expect(page.locator('.widget-text span[style]')).toHaveCSS('color', 'rgb(18, 85, 170)')
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
})

test('full text toolbar supports nested lists, scripts, quotes and safe sidebar editing', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  const canvas = page.locator('.preview-frame')
  const bar = page.getByRole('group', { name: 'Text formatting' })
  await canvas.getByText('Our company introduction.', { exact: true }).click()
  const body = page.getByRole('textbox', { name: 'Edit text on page' })
  await body.fill('Parent')
  await bar.getByRole('button', { name: 'Bulleted list', exact: true }).click()
  await body.press('End')
  await body.press('Enter')
  await body.pressSequentially('Nested')
  await bar.getByRole('button', { name: 'More formatting', exact: true }).click()
  await bar.getByRole('button', { name: 'Increase indent', exact: true }).click()
  await expect(body.locator('ul ul li')).toHaveText('Nested')
  await bar.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(canvas.locator('.widget-text ul ul li')).toHaveText('Nested')
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  await inspector.getByRole('button', { name: 'Edit formatted text', exact: true }).click()
  await body.press(await shortcut(page, 'a'))
  await bar.getByRole('button', { name: 'Clear formatting', exact: true }).click()
  await body.fill('H2O')
  await body.press(await shortcut(page, 'a'))
  await bar.getByRole('button', { name: 'More formatting', exact: true }).click()
  await bar.getByRole('button', { name: 'Subscript', exact: true }).click()
  await expect(body.locator('sub')).toHaveText('H2O')
  await bar.getByRole('button', { name: 'Superscript', exact: true }).click()
  await expect(body.locator('sup')).toHaveText('H2O')
  await expect(body.locator('sub')).toHaveCount(0)
  await bar.getByRole('button', { name: 'Block quote', exact: true }).click()
  await expect(body.locator('blockquote')).toHaveText('H2O')
  await bar.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect
    .poll(() => api.draft().pages[0]!.sections[0]!.textRichText?.content?.[0]?.type)
    .toBe('blockquote')
  await page.reload()
  await expect(canvas.locator('blockquote sup')).toHaveText('H2O')
})

test('full text toolbar keeps code literal and preserves line breaks and dividers', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await page.setViewportSize({ width: 1440, height: 950 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  const canvas = page.locator('.preview-frame')
  await canvas.getByText('Our company introduction.', { exact: true }).click()
  const body = page.getByRole('textbox', { name: 'Edit text on page' })
  const bar = page.getByRole('group', { name: 'Text formatting' })
  await body.fill('First')
  await body.press('End')
  await body.press('Shift+Enter')
  await body.pressSequentially('Second')
  await expect(body.locator('br')).toHaveCount(1)
  await body.press('Enter')
  await body.pressSequentially('<script>literal()</script>')
  await bar.getByRole('button', { name: 'More formatting', exact: true }).click()
  await bar.getByRole('button', { name: 'Code block', exact: true }).click()
  await expect(body.locator('pre code')).toHaveText('<script>literal()</script>')
  await body.press('ArrowDown')
  await bar.getByRole('button', { name: 'Horizontal rule', exact: true }).click()
  await expect(body.locator('hr')).toHaveCount(1)
  await bar.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect.poll(() => api.draft().pages[0]!.sections[0]!.textRichText?.type).toBe('doc')
  await page.reload()
  await expect(canvas.locator('.widget-text br')).toHaveCount(1)
  await expect(canvas.locator('.widget-text hr')).toHaveCount(1)
  await expect(canvas.locator('.widget-text pre code')).toHaveText('<script>literal()</script>')
  await expect(canvas.locator('.widget-text script')).toHaveCount(0)
})

test('brand presets, font previews and responsive text styles survive publication', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Site settings', exact: true }).click()
  await expect(page.getByLabel('Selection scope', { exact: true })).toContainText('Entire website')
  await page.getByText('Brand presets', { exact: true }).click()
  await page.getByRole('button', { name: 'Apply Phase 2 brand', exact: true }).click()
  await page.getByRole('button', { name: 'Preview body font choices', exact: true }).click()
  await page.screenshot({ path: '.security-work/design-font-previews.png' })
  await page.getByRole('button', { name: 'Work Sans', exact: true }).click()
  await expect(page.getByLabel('Body font', { exact: true })).toHaveValue('Work Sans')
  await page.getByText('Reusable text styles', { exact: true }).click()
  await page.getByLabel('Text style size', { exact: true }).fill('52')
  await page.getByLabel('Text style size', { exact: true }).press('Tab')
  await page.getByLabel('Typography screen size').selectOption('mobile')
  await page.getByLabel('Text style size', { exact: true }).fill('28')
  await page.getByLabel('Text style size', { exact: true }).press('Tab')
  await page.getByLabel('Preset name', { exact: true }).fill('Company blue')
  await page.getByRole('button', { name: 'Save brand preset', exact: true }).click()
  await page.getByLabel('Typography screen size').selectOption('desktop')
  await page.getByLabel('Text style size', { exact: true }).fill('44')
  await page.getByLabel('Text style size', { exact: true }).press('Tab')
  await page.getByRole('button', { name: 'Apply Company blue', exact: true }).click()
  await expect(page.getByLabel('Text style size', { exact: true })).toHaveValue('52')
  const heading = page.locator('.preview-frame h1.widget-title')
  await expect
    .poll(() => heading.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)))
    .toBeCloseTo(52, 2)
  await page.getByRole('button', { name: 'Mobile', exact: true }).click()
  await expect(heading).toHaveCSS('font-size', '28px')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect.poll(() => api.draft().theme?.presets?.length).toBe(1)
  await page.reload()
  await expect
    .poll(() =>
      page
        .locator('.preview-frame h1.widget-title')
        .evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
    )
    .toBeCloseTo(52, 2)
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/website')
  await expect(page.locator('h1.widget-title')).toHaveCSS('font-size', '28px')
})

test('image gradients and entrance animations preserve edits and respect reduced motion', async ({
  page,
}) => {
  const content = structuredClone(initial)
  Object.assign(content.pages[0]!.sections[0]!, { imageId: 'photo', alt: 'Job photo' })
  const api = await mockWebsite(page, false, false, content)
  await page.addInitScript(() => {
    const target = window as Window & { motionCalls?: number }
    target.motionCalls = 0
    const animate = Element.prototype.animate
    Element.prototype.animate = function (...args) {
      target.motionCalls!++
      return animate.apply(this, args)
    }
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const canvas = page.locator('.preview-frame')
  await canvas.getByRole('button', { name: 'Edit image: Job photo' }).dblclick()
  const editor = page.getByRole('region', { name: 'Image editor', exact: true })
  await editor.getByText('Image overlay and gradient', { exact: true }).click()
  await editor.getByLabel('Overlay style', { exact: true }).selectOption('linear')
  await editor.getByRole('slider', { name: 'Overlay opacity', exact: true }).fill('65')
  await editor.getByRole('slider', { name: 'Gradient direction', exact: true }).fill('180')
  await expect(canvas.locator('.media-overlay')).toHaveCSS('opacity', '0.65')
  await expect(canvas.locator('.media-overlay')).toHaveCSS('background-image', /linear-gradient/)
  await editor.getByRole('button', { name: 'Done', exact: true }).click()
  await selectCanvasWidget(page, 'Welcome to Phase 2')
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  await inspector.getByRole('tab', { name: 'Appearance', exact: true }).click()
  await inspector.getByText('Animation and fading', { exact: true }).click()
  await inspector.getByLabel('Entrance animation', { exact: true }).selectOption('rise')
  await inspector.getByLabel('Animation duration (ms)', { exact: true }).fill('1200')
  await inspector.getByLabel('Animation duration (ms)', { exact: true }).press('Tab')
  await inspector.getByRole('button', { name: 'Preview animation', exact: true }).click()
  await page.screenshot({ path: '.security-work/design-motion-controls.png' })
  expect(await page.evaluate(() => (window as Window & { motionCalls?: number }).motionCalls)).toBe(
    1,
  )
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect
    .poll(() => api.draft().pages[0]!.sections[0]!.appearance?.motion?.effect)
    .toBe('rise')
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.goto('/website')
  await expect
    .poll(() => page.evaluate(() => (window as Window & { motionCalls?: number }).motionCalls))
    .toBe(1)
  await expect(page.locator('.media-overlay')).toHaveCSS('opacity', '0.65')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Welcome to Phase 2' })).toBeVisible()
  expect(await page.evaluate(() => (window as Window & { motionCalls?: number }).motionCalls)).toBe(
    0,
  )
})

test('hero titles support heading styles and lists with self-hosted fonts through publication', async ({
  page,
}) => {
  const content = structuredClone(initial)
  content.theme = { bodyFont: 'Inter', headingFont: 'Lora' }
  const api = await mockWebsite(page, true, false, content)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  const canvas = page.locator('.preview-frame')
  const toolbar = page.getByRole('group', { name: 'Text formatting' })
  await canvas.getByRole('heading', { name: 'Welcome to Phase 2' }).click()
  const editor = page.getByRole('textbox', { name: 'Edit heading on page' })
  await toolbar.getByLabel('Text style', { exact: true }).selectOption('h2')
  await expect(editor.locator('h2')).toHaveText('Welcome to Phase 2')
  await expect(editor.locator('h2')).toHaveCSS('font-family', 'Lora, Georgia, serif')
  await editor.press(await shortcut(page, 'a'))
  await toolbar.getByRole('button', { name: 'More formatting', exact: true }).click()
  await toolbar.getByLabel('Font family', { exact: true }).selectOption('Montserrat')
  await expect(editor.locator('span')).toHaveCSS('font-family', 'Montserrat')
  expect(
    await page.evaluate(async () => (await document.fonts.load('600 24px Montserrat')).length),
  ).toBeGreaterThan(0)
  await toolbar.getByRole('button', { name: 'Bulleted list', exact: true }).click()
  await expect(editor.locator('ul li')).toHaveText('Welcome to Phase 2')
  await editor.press('End')
  await expect
    .poll(() => editor.evaluate(() => window.getSelection()?.isCollapsed))
    .toBe(true)
  await editor.press('Enter')
  await expect(editor.locator('ul li')).toHaveCount(2)
  await editor.pressSequentially('Built together')
  await expect(editor.locator('ul li')).toHaveCount(2)
  await toolbar.getByRole('button', { name: 'Numbered list', exact: true }).click()
  await expect(editor.locator('ol li')).toHaveCount(2)
  await toolbar.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(canvas.locator('.widget-title ol li')).toHaveCount(2)
  await expect(canvas.locator('h1 ol, h2 ol')).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(canvas.getByRole('heading', { name: 'Welcome to Phase 2' })).toBeVisible()
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(canvas.locator('.widget-title ol li')).toHaveCount(2)
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect
    .poll(() => api.draft().pages[0]!.sections[0]!.titleRichText?.content?.[0]?.type)
    .toBe('orderedList')
  await page.reload()
  await expect(canvas.locator('.widget-title ol li')).toHaveCount(2)
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.goto('/website')
  await expect(page.locator('.widget-title ol li')).toHaveCount(2)
  await expect(page.locator('.widget-title ol li span').first()).toHaveCSS(
    'font-family',
    'Montserrat',
  )
})

test('image darkening previews live and survives save, reload and publication', async ({
  page,
}) => {
  const content = structuredClone(initial)
  Object.assign(content.pages[0]!.sections[0]!, { imageId: 'photo', alt: 'Job photo' })
  const api = await mockWebsite(page, false, false, content)
  await page.setViewportSize({ width: 1440, height: 950 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const canvas = page.locator('.preview-frame')
  await canvas.getByRole('button', { name: 'Edit image: Job photo' }).dblclick()
  const panel = page.getByRole('region', { name: 'Image editor', exact: true })
  await panel.getByRole('slider', { name: 'Darken image', exact: true }).fill('45')
  await expect(canvas.locator('.website-media img')).toHaveCSS('filter', 'brightness(0.55)')
  await expect(panel.locator('.focal-preview img')).toHaveCSS('filter', 'brightness(0.55)')
  await panel.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(canvas.locator('.website-media img')).toHaveCSS('filter', 'none')
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect.poll(() => api.draft().pages[0]!.sections[0]!.imageSettings?.darken).toBe(45)
  await page.reload()
  await expect(canvas.locator('.website-media img')).toHaveCSS('filter', 'brightness(0.55)')
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.goto('/website')
  await expect(page.locator('.website-media img')).toHaveCSS('filter', 'brightness(0.55)')
})

test('inline text edits stay synchronized, undo as a session, and only save the draft', async ({
  page,
}) => {
  const api = await mockWebsite(page, true)
  await page.setViewportSize({ width: 1440, height: 950 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  const canvas = page.locator('.preview-frame')
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  await canvas.getByRole('heading', { name: 'Welcome to Phase 2', exact: true }).click()
  const heading = page.getByRole('textbox', { name: 'Edit heading on page' })
  await expect(heading).toBeFocused()
  await heading.press(await shortcut(page, 'a'))
  await heading.pressSequentially('Built together')
  await expect(inspector.getByLabel('Heading', { exact: true })).toHaveValue('Built together')
  await heading.press('Escape')
  await expect(page.getByRole('group', { name: 'Text formatting' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(
    canvas.getByRole('heading', { name: 'Welcome to Phase 2', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await canvas.getByText('Our company introduction.', { exact: true }).click()
  const body = page.getByRole('textbox', { name: 'Edit text on page' })
  await body.press(await shortcut(page, 'a'))
  await body.pressSequentially('New introduction')
  await body.press(await shortcut(page, 'a'))
  await page.getByRole('button', { name: 'Bold', exact: true }).click()
  await expect(body.locator('strong')).toHaveText('New introduction')
  await expect(inspector.getByLabel('Text', { exact: true })).toHaveValue('**New introduction**')
  // Saving directly from the text box must end the edit without dropping its final value.
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect.poll(() => api.draft().pages[0]!.sections[0]!.text).toBe('**New introduction**')
  expect(api.draft().pages[0]!.sections[0]!.title).toBe('Built together')
  expect(api.published()!.pages[0]!.sections[0]!.title).toBe('Welcome to Phase 2')
  expect(api.actions).not.toContain('publish')
  await page.reload()
  await expect(canvas.locator('.widget-text strong')).toHaveText('New introduction')
  await expect(canvas.getByRole('heading', { name: 'Built together' })).toBeVisible()
})

test('phone sizing overrides reset to automatic flow without changing desktop dimensions', async ({
  page,
}) => {
  const content = structuredClone(initial)
  content.pages[0]!.layout = { desktop: 'flow', mobile: 'flow' }
  content.pages[0]!.sections = [
    { ...newSection('container'), id: 'group', title: 'Group' },
    {
      ...newSection('text'),
      id: 'child',
      parentId: 'group',
      title: 'Child',
      sizing: { grow: 2, basis: 45, minHeight: 180, align: 'center' },
    },
  ]
  const api = await mockWebsite(page, false, false, content)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await selectCanvasWidget(page, 'Child')
  await page.getByRole('button', { name: 'Mobile', exact: true }).click()
  await openInspectorFor(page, 'Minimum height (px)')
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  const height = inspector.getByLabel('Minimum height (px)', { exact: true })
  const grow = inspector.getByLabel('Grow proportion', { exact: true })
  const growSource = inspector
    .locator('label')
    .filter({ has: page.getByRole('spinbutton', { name: 'Grow proportion', exact: true }) })
    .locator('.setting-source')
  await expect(growSource).toHaveText('Automatic')
  await grow.fill('3')
  await grow.press('Tab')
  await height.fill('90')
  await height.press('Tab')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect
    .poll(() => api.draft().pages[0]!.sections[1]!.devices?.mobile?.sizing)
    .toEqual({ grow: 3, minHeight: 90 })
  await height.fill('')
  await height.press('Tab')
  await expect(height).toHaveValue('')
  await inspector.getByLabel('Item alignment', { exact: true }).selectOption('end')
  await inspector.getByLabel('Item alignment', { exact: true }).selectOption('')
  await expect(inspector.getByLabel('Item alignment', { exact: true })).toHaveValue('auto')
  await page.getByRole('button', { name: 'Desktop', exact: true }).click()
  await height.fill('220')
  await height.press('Tab')
  await page.getByRole('button', { name: 'Mobile', exact: true }).click()
  await expect(height).toHaveValue('')
  await expect(grow).toHaveValue('3')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect
    .poll(() => api.draft().pages[0]!.sections[1]!.devices?.mobile?.sizing)
    .toEqual({ grow: 3 })
  await page.reload()
  await selectCanvasWidget(page, 'Child')
  await page.getByRole('button', { name: 'Mobile', exact: true }).click()
  await openInspectorFor(page, 'Minimum height (px)')
  await expect(height).toHaveValue('')
  await expect(grow).toHaveValue('3')
  await expect(growSource).toHaveText('Override')
  await inspector.getByRole('button', { name: 'Use automatic sizing', exact: true }).click()
  await expect(grow).toHaveValue('0')
  await expect(growSource).toHaveText('Automatic')
  await expect(height).toHaveValue('')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect
    .poll(() => api.draft().pages[0]!.sections[1]!.devices?.mobile?.sizing)
    .toBeUndefined()
  await page.getByRole('button', { name: 'Desktop', exact: true }).click()
  await expect(grow).toHaveValue('2')
  await expect(height).toHaveValue('220')
})

test('simplified settings preserve desktop inheritance and reset individual phone styles', async ({
  page,
}) => {
  const content = structuredClone(initial)
  content.pages[0]!.sections[0]!.appearance = {
    padding: 24,
    radius: 12,
    background: '#123456',
    rotation: 10,
  }
  const api = await mockWebsite(page, false, false, content)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page
    .locator('.preview-frame')
    .getByRole('heading', { name: 'Welcome to Phase 2', exact: true })
    .click({ modifiers: ['Shift'] })
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  await inspector.getByRole('tab', { name: 'Appearance', exact: true }).click()
  await expect(inspector.getByText('Desktop · Base styles', { exact: true })).toBeVisible()
  await expect(inspector.getByLabel('Padding (px)', { exact: true })).toBeVisible()
  await expect(inspector.getByLabel('Rotation (degrees)', { exact: true })).toBeHidden()
  await expect(inspector.getByLabel('Font family', { exact: true })).toBeHidden()
  await page.screenshot({ path: '.security-work/settings-desktop.png' })
  await page.getByRole('button', { name: 'Mobile', exact: true }).click()
  await expect(inspector.getByText('Phone · Overrides', { exact: true })).toBeVisible()
  const padding = inspector.getByLabel('Padding (px)', { exact: true })
  const source = inspector
    .locator('label')
    .filter({ has: page.getByRole('spinbutton', { name: 'Padding (px)', exact: true }) })
    .locator('.setting-source')
  await expect(source).toHaveText('Automatic')
  await expect(padding).toHaveValue('24')
  await expect(
    inspector.getByRole('button', { name: 'Reset padding (px)', exact: true }),
  ).toBeDisabled()
  await padding.fill('8')
  await padding.press('Tab')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect
    .poll(() => api.draft().pages[0]!.sections[0]!.devices?.mobile?.appearance)
    .toEqual({ padding: 8 })
  await expect(source).toHaveText('Override')
  await inspector.getByRole('button', { name: 'Reset padding (px)', exact: true }).click()
  await expect(padding).toHaveValue('24')
  await expect(source).toHaveText('Automatic')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(padding).toHaveValue('8')
  await expect(source).toHaveText('Override')
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(padding).toHaveValue('24')
  await page.getByRole('button', { name: 'Tablet', exact: true }).click()
  await padding.fill('0')
  await padding.press('Tab')
  await expect(source).toHaveText('Override')
  await page.getByRole('button', { name: 'Mobile', exact: true }).click()
  await expect(padding).toHaveValue('24')
  await expect(source).toHaveText('Automatic')
  await inspector.getByLabel('Background color', { exact: true }).fill('#abcdef')
  await page.getByRole('button', { name: 'Desktop', exact: true }).click()
  await inspector.getByLabel('Corner radius (px)', { exact: true }).fill('30')
  await inspector.getByLabel('Corner radius (px)', { exact: true }).press('Tab')
  await page.getByRole('button', { name: 'Mobile', exact: true }).click()
  await expect(inspector.getByLabel('Corner radius (px)', { exact: true })).toHaveValue('30')
  await expect(inspector.getByLabel('Background color', { exact: true })).toHaveValue('#abcdef')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect
    .poll(() =>
      page
        .locator('#app-shell-navigation')
        .evaluate((element) => element.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0)
  await page
    .getByRole('navigation', { name: 'Builder panels' })
    .getByRole('button', { name: 'Editor', exact: true })
    .click()
  await page.screenshot({ path: '.security-work/settings-phone.png' })
  await inspector.getByRole('button', { name: 'Reset background color', exact: true }).click()
  await expect(inspector.getByLabel('Background color', { exact: true })).toHaveValue('#123456')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect.poll(() => api.draft().pages[0]!.sections[0]!.appearance?.radius).toBe(30)
  expect(api.draft().pages[0]!.sections[0]!.devices?.mobile?.appearance).toBeUndefined()
})

test('floating widget actions support transforms, locks, history and safe removal', async ({
  page,
}) => {
  const content = structuredClone(initial)
  content.pages[0]!.sections[0]!.layout = { x: 3, y: 5, w: 12, h: 6, z: 1 }
  const api = await mockWebsite(page, false, false, content)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await selectCanvasWidget(page, 'Welcome to Phase 2')
  const toolbar = page.getByRole('group', { name: 'Widget actions', exact: true })
  const widget = page.locator('.preview-frame [data-widget-id="hero"]')
  await expect(toolbar).toBeVisible()
  const before = await widget.getAttribute('style')
  const move = toolbar.getByRole('button', { name: 'Move widget', exact: true })
  const moveBox = (await move.boundingBox())!
  await page.mouse.move(moveBox.x + moveBox.width / 2, moveBox.y + moveBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(moveBox.x + 60, moveBox.y + 50, { steps: 8 })
  await page.mouse.up()
  await expect(widget).not.toHaveAttribute('style', before!)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(widget).toHaveAttribute('style', before!)
  await move.press('ArrowRight')
  await toolbar.getByRole('button', { name: 'Resize widget', exact: true }).press('ArrowRight')
  const rotate = toolbar.getByRole('button', { name: 'Rotate widget', exact: true })
  const rotateBox = (await rotate.boundingBox())!
  const bounds = (await widget.boundingBox())!
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  const start = { x: rotateBox.x + rotateBox.width / 2, y: rotateBox.y + rotateBox.height / 2 }
  const dx = start.x - center.x,
    dy = start.y - center.y
  const angle = Math.PI / 6
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(
    center.x + dx * Math.cos(angle) - dy * Math.sin(angle),
    center.y + dx * Math.sin(angle) + dy * Math.cos(angle),
    { steps: 10 },
  )
  await page.mouse.up()
  await expect(widget).toHaveAttribute('style', /rotate\(/)
  await rotate.press('Home')
  await rotate.press('Shift+ArrowRight')
  await expect(widget).toHaveAttribute('style', /rotate\(15deg\)/)
  await toolbar.getByRole('button', { name: 'Lock widget', exact: true }).click()
  await expect(move).toBeDisabled()
  await expect(toolbar.getByRole('button', { name: 'Resize widget', exact: true })).toBeDisabled()
  await expect(rotate).toBeDisabled()
  await toolbar.getByRole('button', { name: 'Unlock widget', exact: true }).click()
  await expect(move).toBeEnabled()
  await page.screenshot({ path: '.security-work/widget-toolbar-desktop.png' })
  await toolbar.getByRole('button', { name: 'Widget settings', exact: true }).click()
  await expect(page.getByRole('complementary', { name: 'Content editor' })).toBeFocused()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect.poll(() => api.draft().pages[0]!.sections[0]!.layout?.x).toBe(4)
  expect(api.draft().pages[0]!.sections[0]!.layout?.w).toBe(13)
  await toolbar.getByRole('button', { name: 'Duplicate selection', exact: true }).click()
  await expect(page.locator('.preview-frame [data-widget-id]')).toHaveCount(2)
  await toolbar.getByRole('button', { name: 'Send to back', exact: true }).click()
  await toolbar.getByRole('button', { name: 'Bring to front', exact: true }).click()
  await toolbar.getByRole('button', { name: 'Delete widget', exact: true }).click()
  await page.locator('.builder-confirm[open]').getByRole('button').first().click()
  await expect(page.locator('.preview-frame [data-widget-id]')).toHaveCount(2)
  await toolbar.getByRole('button', { name: 'Delete widget', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.locator('.preview-frame [data-widget-id]')).toHaveCount(1)
  await expect(toolbar).toHaveCount(0)
})

test('website autosave saves idle edits as a draft without publishing', async ({ page }) => {
  const api = await mockWebsite(page)
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.locator('.preview-frame [data-text-field="title"]').click()
  const heading = page
    .getByRole('region', { name: 'Selected element editor' })
    .getByLabel('Heading', { exact: true })
  await heading.fill('Automatically saved headline')
  await expect
    .poll(() => api.draft().pages[0]!.sections[0]!.title, { timeout: 10000 })
    .toBe('Automatically saved headline')
  await expect(page.locator('.builder-title')).toContainText('Draft saved')
  expect(api.actions).not.toContain('publish')
  expect(api.published()).toBeNull()
  await page.reload()
  await expect(page.locator('.preview-frame [data-text-field="title"]')).toContainText(
    'Automatically saved headline',
  )
  await expect(page.getByLabel('Browser recovery', { exact: true })).toHaveCount(0)
})

test('offline website edits recover after reload and sync without publication', async ({
  page,
  context,
}) => {
  const api = await mockWebsite(page)
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.locator('.preview-frame [data-text-field="title"]').click()
  const heading = page
    .getByRole('region', { name: 'Selected element editor' })
    .getByLabel('Heading', { exact: true })
  await context.setOffline(true)
  await heading.fill('Work kept through a lost connection')
  await expect(page.locator('.builder-title')).toContainText('Saved in browser')
  expect(api.draft().pages[0]!.sections[0]!.title).not.toBe('Work kept through a lost connection')
  // Keep navigator offline during the refreshed editor's load; local assets/API mocks
  // remain reachable so this exercises draft recovery rather than browser cache policy.
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }),
  )
  await context.setOffline(false)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Recover edits', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Recover edits', exact: true }).click()
  await expect(page.locator('.preview-frame [data-text-field="title"]')).toContainText(
    'Work kept through a lost connection',
  )
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true })
    window.dispatchEvent(new Event('online'))
  })
  await expect
    .poll(() => api.draft().pages[0]!.sections[0]!.title, { timeout: 10000 })
    .toBe('Work kept through a lost connection')
  expect(api.actions).not.toContain('publish')
  await expect(page.locator('.builder-title')).toContainText('Draft saved')
})

test('autosave conflicts preserve edits and keep the browser recovery available', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  api.failSave()
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.locator('.preview-frame [data-text-field="title"]').click()
  const heading = page
    .getByRole('region', { name: 'Selected element editor' })
    .getByLabel('Heading', { exact: true })
  await heading.fill('Keep this conflicting work')
  await heading.press('Tab')
  await expect(page.getByText('Another saved version exists.', { exact: false })).toBeVisible({
    timeout: 10000,
  })
  await expect(heading).toHaveValue('Keep this conflicting work')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download recovery copy' }).click()
  expect((await download).suggestedFilename()).toContain('website-recovery-')
  expect(api.draft().pages[0]!.sections[0]!.title).not.toBe('Keep this conflicting work')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Recover edits', exact: true })).toBeVisible()
})

test('contextual inspector edits only the selected element and breadcrumbs return to its parent', async ({
  page,
}) => {
  const content = structuredClone(initial)
  const hero = content.pages[0]!.sections[0]!
  Object.assign(hero, {
    imageId: 'photo',
    alt: 'Job photo',
    linkLabel: 'Contact',
    linkUrl: 'https://example.com',
  })
  const api = await mockWebsite(page, false, false, content)
  await page.setViewportSize({ width: 1600, height: 1100 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const canvas = page.locator('.preview-frame')
  const heading = canvas.locator('[data-text-field="title"]')
  const inspector = page.getByRole('region', { name: 'Selected element editor', exact: true })
  await heading.click()
  await expect(page.getByLabel('Selection scope', { exact: true })).toContainText('Heading')
  await expect(page.getByLabel('Selection scope', { exact: true })).toContainText('Home')
  await expect(inspector.getByLabel('Heading', { exact: true })).toHaveValue(hero.title)
  await expect(inspector.getByLabel('Button link', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Selection path' })).toContainText('Heading')
  await inspector.getByLabel('Heading', { exact: true }).fill('A clearer headline')
  await inspector.getByLabel('Heading', { exact: true }).press('Tab')
  await inspector.getByLabel('Element Padding', { exact: true }).fill('12')
  await inspector.getByLabel('Element Padding', { exact: true }).press('Tab')
  await expect(heading).toContainText('A clearer headline')
  await expect(heading).toHaveCSS('padding-top', '12px')
  await inspector.getByRole('button', { name: 'Format heading', exact: true }).click()
  const formatted = page.getByRole('textbox', { name: 'Format selected heading', exact: true })
  await formatted.press(await shortcut(page, 'a'))
  await page
    .getByRole('group', { name: 'Text formatting' })
    .getByRole('button', { name: 'Bold', exact: true })
    .click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('button', { name: 'Select parent A clearer headline', exact: true }).click()
  await expect(inspector).toHaveCount(0)
  await expect(page.getByLabel('Selection scope', { exact: true })).toContainText('Widget')
  await expect(page.getByRole('tab', { name: 'Appearance', exact: true })).toBeVisible()
  await canvas.locator('.website-media .media-crop').click()
  await expect(inspector.getByLabel('Image description', { exact: true })).toHaveValue('Job photo')
  await expect(inspector.getByLabel('Heading', { exact: true })).toHaveCount(0)
  await inspector.getByRole('button', { name: 'Crop and focal point', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Image editor', exact: true })).toBeVisible()
  await page
    .getByRole('region', { name: 'Image editor', exact: true })
    .getByRole('button', { name: 'Done', exact: true })
    .click()
  await expect(inspector.getByLabel('Image description', { exact: true })).toBeVisible()
  await canvas.locator('.editable-button').click()
  await inspector.getByLabel('Button label', { exact: true }).fill('Call us')
  await inspector.getByLabel('Button label', { exact: true }).press('Tab')
  await inspector.getByLabel('Button link', { exact: true }).fill('mailto:office@example.com')
  await inspector.getByLabel('Button link', { exact: true }).press('Tab')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect.poll(() => api.draft().pages[0]!.sections[0]!.title).toBe('A clearer headline')
  expect(api.draft().pages[0]!.sections[0]).toMatchObject({
    text: hero.text,
    imageId: 'photo',
    linkLabel: 'Call us',
    linkUrl: 'mailto:office@example.com',
    textBoxes: { title: { padding: 12 } },
  })
  expect(api.draft().pages[0]!.sections[0]!.titleRichText).toBeTruthy()
})

test('right click selects covered elements without moving or reordering their widgets', async ({
  page,
}) => {
  const content = structuredClone(initial)
  const back = {
    ...newSection('text'),
    id: 'back',
    title: 'Behind',
    text: 'Underlapping text',
    layout: { x: 1, y: 2, w: 20, h: 10, z: 1 },
  }
  const front = {
    ...newSection('text'),
    id: 'front',
    title: 'In front',
    text: 'Overlapping text',
    layout: { x: 1, y: 2, w: 20, h: 10, z: 2 },
  }
  content.pages[0]!.sections = [back, front]
  const api = await mockWebsite(page, false, false, content)
  await page.setViewportSize({ width: 1600, height: 1100 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page
    .locator('.preview-frame [data-widget-id="front"] [data-text-field="title"]')
    .click({ button: 'right' })
  const target = page.getByRole('menuitem', {
    name: 'Select object: Behind / Heading',
    exact: true,
  })
  await expect(target).toBeVisible()
  await target.focus()
  await target.press('Enter')
  await expect(
    page
      .getByRole('region', { name: 'Selected element editor' })
      .getByLabel('Heading', { exact: true }),
  ).toHaveValue('Behind')
  await expect(
    page.locator('.preview-frame [data-widget-id="back"] [data-text-field="title"]'),
  ).toBeFocused()
  await page
    .getByRole('region', { name: 'Selected element editor' })
    .getByLabel('Heading', { exact: true })
    .fill('Found underneath')
  await page
    .getByRole('region', { name: 'Selected element editor' })
    .getByLabel('Heading', { exact: true })
    .press('Tab')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect.poll(() => api.draft().pages[0]!.sections[0]!.title).toBe('Found underneath')
  expect(api.draft().pages[0]!.sections.map((entry) => entry.layout)).toEqual([
    back.layout,
    front.layout,
  ])
})

test('long text and missing images remain usable in a narrow public flow layout', async ({
  page,
}) => {
  const content = structuredClone(initial)
  const hero = content.pages[0]!.sections[0]!
  Object.assign(hero, {
    title: 'A long project headline '.repeat(6).trim(),
    text: 'Specification'.repeat(25),
    imageId: 'missing',
    alt: 'Missing project photo',
    linkLabel: 'LearnMore'.repeat(8),
    linkUrl: 'https://example.com',
    appearance: { headingSize: 72 },
  })
  content.pages[0]!.layout = { desktop: 'flow', tablet: 'flow', mobile: 'flow' }
  await mockWebsite(page, true, false, content)
  await page.route('**/website-image?*', (route) => route.fulfill({ status: 404, body: '' }))
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoPhase2App(page, '/website/home', createJobsFixture())
  await expect(page.getByText('Image unavailable', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: hero.title, exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: hero.linkLabel, exact: true })).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
    .toBeLessThanOrEqual(1)
})

test('element inspector and nested layers keep responsive placement, resets and image proportions', async ({
  page,
}) => {
  const content = structuredClone(initial)
  const hero = content.pages[0]!.sections[0]!
  Object.assign(hero, {
    imageId: 'photo',
    alt: 'Job photo',
    linkLabel: 'Contact',
    linkUrl: 'https://example.com',
    layout: { x: 1, y: 4, w: 22, h: 15, z: 1 },
    textBoxes: { image: { width: 300, height: 180 }, title: { rotation: 12 } },
  })
  const api = await mockWebsite(page, false, false, content)
  await page.setViewportSize({ width: 1600, height: 1100 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Layers', exact: true }).click()
  await page.getByRole('button', { name: `Show elements in ${hero.title}`, exact: true }).click()
  const imageLayer = page.getByRole('button', { name: 'Select element Image', exact: true })
  await imageLayer.click()
  const photo = page.locator('.preview-frame .website-media')
  const fields = page.locator('[data-element-inspector]')
  await expect(photo.locator('.text-resize')).toHaveCount(8)
  await expect(fields.getByLabel('Keep proportions')).toBeChecked()
  await fields.getByLabel('Element Width', { exact: true }).fill('250')
  await fields.getByLabel('Element Width', { exact: true }).press('Tab')
  await expect(fields.getByLabel('Element Height', { exact: true })).toHaveValue('150')
  const resize = photo.getByRole('button', { name: 'Resize image from bottom-right', exact: true })
  await resize.hover()
  const corner = (await resize.boundingBox())!
  await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2)
  await page.mouse.down()
  await page.mouse.move(corner.x + 32, corner.y + 5, { steps: 5 })
  await page.mouse.up()
  const dimensions = await photo.evaluate((element) => [element.clientWidth, element.clientHeight])
  expect(dimensions[0]! / dimensions[1]!).toBeCloseTo(5 / 3, 1)
  await fields.getByRole('button', { name: 'Reset size', exact: true }).click()
  await expect.poll(() => photo.evaluate((element: HTMLElement) => element.style.width)).toBe('')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await imageLayer.click()
  await expect(photo).toHaveAttribute('style', /width:/)
  await page.getByRole('button', { name: 'Mobile', exact: true }).click()
  await imageLayer.click()
  await expect(fields.getByLabel('Element Width', { exact: true })).toHaveAttribute(
    'aria-description',
    'Follows desktop',
  )
  await fields.getByLabel('Keep proportions').uncheck()
  await expect(
    fields
      .locator('label')
      .filter({ has: page.getByRole('checkbox', { name: 'Keep proportions' }) })
      .locator('.setting-source'),
  ).toHaveText('Override')
  await fields.getByLabel('Element Width', { exact: true }).fill('200')
  await fields.getByLabel('Element Width', { exact: true }).press('Tab')
  await expect(fields.getByLabel('Element Width', { exact: true })).toHaveAttribute(
    'aria-description',
    'Override for this screen size',
  )
  const mobileRect = (await photo.boundingBox())!
  const mobileScale =
    mobileRect.width / (await photo.evaluate((element) => (element as HTMLElement).offsetWidth))
  await page.keyboard.down('Alt')
  await page.mouse.move(mobileRect.x + mobileRect.width / 2, mobileRect.y + mobileRect.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    mobileRect.x + mobileRect.width / 2 + 10,
    mobileRect.y + mobileRect.height / 2,
    { steps: 4 },
  )
  await page.mouse.up()
  await page.keyboard.up('Alt')
  await expect
    .poll(async () =>
      Math.abs(
        Number(await fields.getByLabel('Element X', { exact: true }).inputValue()) -
          10 / mobileScale,
      ),
    )
    .toBeLessThan(2)
  await fields.getByLabel('Element Angle', { exact: true }).fill('98')
  await fields.getByLabel('Element Angle', { exact: true }).press('Tab')
  await fields.getByLabel('Element X', { exact: true }).fill('14')
  await fields.getByLabel('Element X', { exact: true }).press('Tab')
  await fields.getByRole('button', { name: 'Reset position', exact: true }).click()
  await expect(fields.getByLabel('Element X', { exact: true })).toHaveValue('0')
  await fields.getByRole('button', { name: 'Reset angle', exact: true }).click()
  await expect(fields.getByLabel('Element Angle', { exact: true })).toHaveValue('0')
  await fields.getByLabel('Element Angle', { exact: true }).fill('98')
  await fields.getByLabel('Element Angle', { exact: true }).press('Tab')
  await page.getByRole('button', { name: 'Desktop', exact: true }).click()
  await imageLayer.dblclick()
  await expect(photo).toBeFocused()
  await expect(photo).toHaveAttribute('style', /rotate\(0deg\)/)
  await page.getByRole('button', { name: 'Select element Button', exact: true }).click()
  await expect(page.locator('.preview-frame .editable-button .text-resize')).toHaveCount(8)
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect
    .poll(() => api.draft().pages[0]!.sections[0]!.textBoxes?.image?.devices?.mobile)
    .toEqual({ width: 200, rotation: 98, lockAspect: false })
  expect(api.draft().pages[0]!.sections[0]!.textBoxes?.image?.rotation).toBeUndefined()
  await page.reload()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.goto('/website/home')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('.website-media')).toHaveAttribute('style', /width: 200px/)
  await expect(page.locator('.website-media')).toHaveAttribute('style', /rotate\(98deg\)/)
  await expect(page.locator('.text-resize')).toHaveCount(0)
})

test('images and buttons have direct handles, alignment guides and precise saved angles', async ({
  page,
}) => {
  const content = structuredClone(initial)
  const hero = content.pages[0]!.sections[0]!
  Object.assign(hero, {
    imageId: 'photo',
    alt: 'Job photo',
    linkLabel: 'Get in touch',
    linkUrl: 'https://example.com',
    layout: { x: 1, y: 4, w: 22, h: 15, z: 1 },
  })
  const api = await mockWebsite(page, false, false, content)
  await page.setViewportSize({ width: 1600, height: 1100 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const canvas = page.locator('.preview-frame')
  const banner = canvas.locator('[data-widget-id="hero"]')
  const parentStyle = await banner.getAttribute('style')
  const photo = banner.locator('.website-media')
  await photo.locator('.media-crop').click()
  await expect(photo.locator('.text-resize')).toHaveCount(8)
  await expect(page.getByRole('region', { name: 'Image editor', exact: true })).toHaveCount(0)
  const resize = photo.getByRole('button', { name: 'Resize image from bottom-right', exact: true })
  await resize.hover()
  const corner = (await resize.boundingBox())!
  await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2)
  await page.mouse.down()
  await page.mouse.move(corner.x - 45, corner.y - 25, { steps: 6 })
  await page.mouse.up()
  await expect(photo).toHaveAttribute('style', /width:/)
  await expect(banner).toHaveAttribute('style', parentStyle!)
  const rotate = photo.getByRole('button', { name: 'Rotate image', exact: true })
  await rotate.hover()
  const handle = (await rotate.boundingBox())!
  const rect = (await photo.boundingBox())!
  const cx = rect.x + rect.width / 2,
    cy = rect.y + rect.height / 2
  const sx = handle.x + handle.width / 2,
    sy = handle.y + handle.height / 2
  const angle = (96 * Math.PI) / 180
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(
    cx + (sx - cx) * Math.cos(angle) - (sy - cy) * Math.sin(angle),
    cy + (sx - cx) * Math.sin(angle) + (sy - cy) * Math.cos(angle),
    { steps: 4 },
  )
  await expect(photo.locator('.rotation-reading')).toContainText('snapped')
  await page.mouse.up()
  await expect(photo).toHaveAttribute('style', /rotate\(90deg\)/)
  for (let index = 0; index < 8; index++) await rotate.press('ArrowRight')
  await expect(photo).toHaveAttribute('style', /rotate\(98deg\)/)
  const button = banner.locator('.editable-button')
  await button.click()
  await expect(button.locator('.text-resize')).toHaveCount(8)
  const title = banner.locator('[data-text-field="title"]')
  const textRect = (await title.boundingBox())!
  const buttonRect = (await button.boundingBox())!
  const start = { x: buttonRect.x + buttonRect.width / 2, y: buttonRect.y + buttonRect.height / 2 }
  await button.evaluate((element) =>
    element.addEventListener(
      'pointerdown',
      (event) => {
        element.setAttribute('data-test-pointer', String((event as PointerEvent).pointerId))
      },
      { once: true },
    ),
  )
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + textRect.x - buttonRect.x + 3, start.y - 16, { steps: 5 })
  // A slow pointer adjustment must keep the element on its visible guide.
  await button.evaluate(
    (element, point) => {
      const event = new PointerEvent('pointermove', {
        pointerId: Number(element.getAttribute('data-test-pointer')),
        isPrimary: true,
        clientX: point.x,
        clientY: point.y,
        bubbles: true,
      })
      Object.defineProperty(event, 'timeStamp', { value: performance.now() + 1000 })
      window.dispatchEvent(event)
    },
    { x: start.x + textRect.x - buttonRect.x + 3.25, y: start.y - 16 },
  )
  await expect
    .poll(async () => Math.abs((await button.boundingBox())!.x - textRect.x))
    .toBeLessThan(0.75)
  const alignedBeforeRelease = (await button.boundingBox())!.x
  await expect(page.locator('.alignment-guide').first()).toBeVisible()
  await page.mouse.up()
  await expect(page.locator('.alignment-guide')).toHaveCount(0)
  await expect
    .poll(async () => Math.abs((await button.boundingBox())!.x - alignedBeforeRelease))
    .toBeLessThan(0.75)
  await expect(banner).toHaveAttribute('style', parentStyle!)
  await button.dblclick()
  await expect(page.getByRole('textbox', { name: 'Edit button label on page' })).toBeFocused()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect.poll(() => api.draft().pages[0]!.sections[0]!.textBoxes?.image?.rotation).toBe(98)
  expect(api.draft().pages[0]!.sections[0]!.textBoxes?.button).toBeTruthy()
  expect(api.draft().pages[0]!.sections[0]!.layout).toEqual(hero.layout)
  await page.reload()
  await expect(photo).toHaveAttribute('style', /rotate\(98deg\)/)
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.goto('/website/home')
  await expect(page.locator('.website-media')).toHaveAttribute('style', /rotate\(98deg\)/)
  await expect(page.getByRole('link', { name: 'Get in touch', exact: true })).toHaveAttribute(
    'href',
    'https://example.com',
  )
  await expect(page.locator('.text-resize, .alignment-guide')).toHaveCount(0)
})

test('text has its own resize circles and rotation handle without moving its banner', async ({
  page,
}) => {
  const content = structuredClone(initial)
  const hero = content.pages[0]!.sections[0]!
  hero.title = 'Build your next chapter'
  hero.layout = { x: 2, y: 4, w: 18, h: 12, z: 1 }
  const api = await mockWebsite(page, false, false, content)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const canvas = page.locator('.preview-frame')
  const banner = canvas.locator('[data-widget-id="hero"]')
  const heading = canvas.getByRole('heading', { name: 'Build your next chapter', exact: true })
  const bannerStyle = await banner.getAttribute('style')
  await heading.click()
  await expect(heading.locator('.text-resize')).toHaveCount(8)
  await expect(heading.getByRole('button', { name: 'Rotate text', exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Text formatting' })).toHaveCount(0)
  await expect(banner.locator(':scope > .grid-resize')).toHaveCount(0)
  await page.screenshot({ path: '.security-work/text-selection-handles.png' })
  const bounds = (await heading.boundingBox())!
  await page.mouse.move(bounds.x + 50, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(bounds.x + 90, bounds.y + bounds.height / 2 + 20, { steps: 8 })
  await page.mouse.up()
  await expect(heading).toHaveAttribute('style', /translate\(/)
  await expect(banner).toHaveAttribute('style', bannerStyle!)
  const moved = await heading.getAttribute('style')
  const resize = heading.getByRole('button', { name: 'Resize text from bottom-right', exact: true })
  await resize.hover()
  const corner = (await resize.boundingBox())!
  await page.mouse.move(corner.x + 6, corner.y + 6)
  await page.mouse.down()
  await page.mouse.move(corner.x + 60, corner.y + 30, { steps: 8 })
  await page.mouse.up()
  await expect(heading).not.toHaveAttribute('style', moved!)
  const resized = await heading.getAttribute('style')
  const rotate = heading.getByRole('button', { name: 'Rotate text', exact: true })
  await rotate.hover()
  const handle = (await rotate.boundingBox())!
  const rect = (await heading.boundingBox())!
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  const sx = handle.x + handle.width / 2,
    sy = handle.y + handle.height / 2
  const dx = sx - center.x,
    dy = sy - center.y
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(
    center.x + dx * Math.cos(Math.PI / 6) - dy * Math.sin(Math.PI / 6),
    center.y + dx * Math.sin(Math.PI / 6) + dy * Math.cos(Math.PI / 6),
    { steps: 10 },
  )
  await page.mouse.up()
  await expect(heading).not.toHaveAttribute('style', resized!)
  await expect(banner).toHaveAttribute('style', bannerStyle!)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(heading).toHaveAttribute('style', resized!)
  await heading.click()
  await heading.getByRole('button', { name: 'Rotate text', exact: true }).press('Shift+ArrowRight')
  await expect(heading).toHaveAttribute('style', /rotate\(15deg\)/)
  const stable = await heading.getAttribute('style')
  const cancelHandle = (await heading
    .getByRole('button', { name: 'Resize text from bottom-right', exact: true })
    .boundingBox())!
  await page.mouse.move(cancelHandle.x + 6, cancelHandle.y + 6)
  await page.mouse.down()
  await page.mouse.move(cancelHandle.x + 70, cancelHandle.y + 40, { steps: 6 })
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(heading).toHaveAttribute('style', stable!)
  await heading.dblclick()
  const editor = page.getByRole('textbox', { name: 'Edit heading on page' })
  await expect(editor).toBeFocused()
  await editor.press('End')
  await editor.pressSequentially(' today')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect.poll(() => api.draft().pages[0]!.sections[0]!.textBoxes?.title?.rotation).toBe(15)
  expect(api.draft().pages[0]!.sections[0]!.layout).toEqual(hero.layout)
  expect(api.draft().pages[0]!.sections[0]!.text).toBe(hero.text)
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.goto('/website/home')
  const published = page.getByRole('heading', { name: 'Build your next chapter today' })
  await expect(published).toHaveAttribute('style', /rotate\(15deg\)/)
  await expect(page.locator('.text-resize, .text-rotate')).toHaveCount(0)
})

test('floating widget actions fit phones and yield to inline text editing', async ({ page }) => {
  await mockWebsite(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const panels = page.getByRole('navigation', { name: 'Builder panels' })
  await panels.getByRole('button', { name: 'Preview', exact: true }).click()
  await selectCanvasWidget(page, 'Welcome to Phase 2')
  await panels.getByRole('button', { name: 'Preview', exact: true }).click()
  const toolbar = page.getByRole('group', { name: 'Widget actions', exact: true })
  await expect(toolbar).toBeVisible()
  const bounds = (await toolbar.boundingBox())!
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844)
  await page.screenshot({ path: '.security-work/widget-toolbar-mobile.png' })
  await page
    .locator('.preview-frame')
    .getByRole('heading', { name: 'Welcome to Phase 2' })
    .dblclick()
  await expect(toolbar).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Text formatting' })).toBeVisible()
  const textToolbar = page.getByRole('group', { name: 'Text formatting' })
  const textBounds = (await textToolbar.boundingBox())!
  expect(textBounds.x).toBeGreaterThanOrEqual(0)
  expect(textBounds.x + textBounds.width).toBeLessThanOrEqual(390)
  expect(textBounds.y + textBounds.height).toBeLessThanOrEqual(844)
  await expect(textToolbar.getByRole('button', { name: 'Rotate widget', exact: true })).toHaveCount(
    0,
  )
  await textToolbar.getByRole('button', { name: 'Done', exact: true }).click()
  // Finishing text editing preserves the element selection and its direct handles.
  await expect(page.getByRole('button', { name: 'Rotate text', exact: true })).toBeVisible()
  await selectCanvasWidget(page, 'Welcome to Phase 2')
  await panels.getByRole('button', { name: 'Preview', exact: true }).click()
  await expect(toolbar).toBeVisible()
  await toolbar.getByRole('button', { name: 'Widget settings', exact: true }).click()
  await expect(page.getByRole('complementary', { name: 'Content editor' })).toBeVisible()
  await expect(toolbar).toBeHidden()
})

test('canvas image editing replaces, crops and describes a photo without moving its widget', async ({
  page,
}) => {
  const content = structuredClone(initial)
  Object.assign(content.pages[0]!.sections[0]!, { imageId: 'photo', alt: 'Original job photo' })
  const api = await mockWebsite(page, false, false, content)
  await page.setViewportSize({ width: 1440, height: 950 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const canvas = page.locator('.preview-frame')
  const widget = canvas.locator('[data-widget-id="hero"]')
  const geometry = await widget.getAttribute('style')
  await canvas.getByRole('button', { name: 'Edit image: Original job photo' }).dblclick()
  const editor = page.getByRole('region', { name: 'Image editor', exact: true })
  await expect(editor).toBeVisible()
  await editor.getByText('Crop and focal point', { exact: true }).click()
  const focal = editor.getByRole('button', { name: 'Set image focal point' })
  const focalBox = await focal.boundingBox()
  await focal.click({ position: { x: focalBox!.width * 0.75, y: focalBox!.height * 0.25 } })
  await expect(editor.getByRole('slider', { name: 'Horizontal focal point' })).toHaveValue('75')
  await expect(editor.getByRole('slider', { name: 'Vertical focal point' })).toHaveValue('25')
  await editor.getByRole('button', { name: 'Reset crop' }).click()
  await focal.press('ArrowRight')
  await expect(editor.getByRole('slider', { name: 'Horizontal focal point' })).toHaveValue('55')
  await editor.getByRole('slider', { name: 'Crop zoom' }).fill('1.5')
  await expect(widget.locator('img')).toHaveCSS('transform', 'matrix(1.5, 0, 0, 1.5, 0, 0)')
  await editor.getByRole('button', { name: 'Reset crop' }).click()
  await expect(editor.getByRole('slider', { name: 'Crop zoom' })).toHaveValue('1')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(editor.getByRole('slider', { name: 'Crop zoom' })).toHaveValue('1.5')
  await editor.getByRole('button', { name: 'Choose image from library' }).click()
  const library = page.getByRole('dialog', { name: 'Website image library' })
  await library.getByRole('button', { name: 'Load more images' }).click()
  await page.evaluate(() => document.fonts.ready)
  await library.screenshot({ path: '.security-work/gui-image-library.png' })
  await library.getByRole('button', { name: 'Use Company logo.webp' }).click()
  await editor.getByLabel('Image description', { exact: true }).fill('Crew completing the project')
  await editor.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(widget).toHaveAttribute('style', geometry!)
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect.poll(() => api.draft().pages[0]!.sections[0]!.imageId).toBe('logo')
  expect(api.draft().pages[0]!.sections[0]!.imageSettings).toMatchObject({ focusX: 55, zoom: 1.5 })
  expect(api.draft().pages[0]!.sections[0]!.alt).toBe('Crew completing the project')
  expect(api.actions).not.toContain('publish')
  await page.reload()
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  await canvas
    .getByRole('button', { name: 'Edit image: Crew completing the project' })
    .press('Enter')
  await expect(editor.getByLabel('Image description', { exact: true })).toHaveValue(
    'Crew completing the project',
  )
  await page.screenshot({ path: '.security-work/image-editor-desktop.png' })
})

test('phone image editing targets the selected gallery photo and leaves public images read only', async ({
  page,
}) => {
  const content = structuredClone(initial)
  content.pages[0]!.sections = [
    {
      ...newSection('gallery'),
      id: 'gallery',
      items: [
        { ...newSection('image'), id: 'first-photo', imageId: 'photo', alt: 'First photo' },
        { ...newSection('image'), id: 'second-photo', imageId: 'logo', alt: 'Second photo' },
      ],
    },
  ]
  const api = await mockWebsite(page, true, false, content)
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  await page
    .getByRole('navigation', { name: 'Builder panels' })
    .getByRole('button', { name: 'Preview', exact: true })
    .click()
  await page
    .locator('.preview-frame')
    .getByRole('button', { name: 'Edit image: Second photo' })
    .dblclick()
  const editor = page.getByRole('region', { name: 'Image editor', exact: true })
  await expect(editor).toBeVisible()
  await editor.getByLabel('Image description', { exact: true }).fill('Updated second photo')
  await page.screenshot({ path: '.security-work/image-editor-mobile.png' })
  await editor.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect
    .poll(() => api.draft().pages[0]!.sections[0]!.items[1]!.alt)
    .toBe('Updated second photo')
  expect(api.draft().pages[0]!.sections[0]!.items[0]!.alt).toBe('First photo')
  await page.goto('/website')
  await expect(page.getByRole('img', { name: 'Second photo', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Edit image:/ })).toHaveCount(0)
})

test('inline design editing protects widget geometry and supports links and formatting', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await page.setViewportSize({ width: 1440, height: 950 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const canvas = page.locator('.preview-frame')
  const widget = canvas.locator('[data-widget-id="hero"]')
  const before = await widget.getAttribute('style')
  const heading = canvas.getByRole('heading', { name: 'Welcome to Phase 2', exact: true })
  await heading.dblclick()
  await expect(page.getByRole('textbox', { name: 'Edit heading on page' })).toBeFocused()
  const toolbar = page.getByRole('group', { name: 'Text formatting' })
  await expect(toolbar).toBeVisible()
  await expect(toolbar.getByRole('combobox', { name: 'Font family' })).toBeHidden()
  await page.getByRole('textbox', { name: 'Edit heading on page' }).fill('Click to edit')
  await page.keyboard.press('Escape')
  await canvas.getByText('Our company introduction.', { exact: true }).dblclick()
  const body = page.getByRole('textbox', { name: 'Edit text on page' })
  await body.fill('Read more')
  await body.press(await shortcut(page, 'a'))
  await page.getByRole('button', { name: 'Italic', exact: true }).click()
  await page.getByRole('button', { name: 'Link', exact: true }).click()
  await page.getByRole('textbox', { name: 'Link address' }).fill('javascript:alert(1)')
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('HTTPS')
  await page.getByRole('textbox', { name: 'Link address' }).fill('https://example.com')
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(body.locator('a')).toHaveAttribute('href', 'https://example.com')
  await expect(body.locator('em')).toHaveText('Read more')
  await body.press('ArrowRight')
  await body.press('ArrowLeft')
  await body.press(await shortcut(page, 'a'))
  await page.getByRole('button', { name: 'Bulleted list', exact: true }).click()
  await expect(body.locator('ul li')).toHaveText('Read more')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(widget).toHaveAttribute('style', before!)
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect.poll(() => api.draft().pages[0]!.sections[0]!.textFormat).toBe('markdown')
  await expect(canvas.locator('.widget-text ul li a')).toHaveText('Read more')
})

test('inline editing preserves literal pasted text and rejects oversized edits', async ({
  page,
}) => {
  await mockWebsite(page)
  await page.setViewportSize({ width: 1440, height: 950 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  const canvas = page.locator('.preview-frame')
  await canvas.getByRole('heading', { name: 'Welcome to Phase 2' }).click()
  await expect(page.getByRole('textbox', { name: 'Edit heading on page' })).toBeFocused()
  const heading = page.getByRole('textbox', { name: 'Edit heading on page' })
  await heading.press(await shortcut(page, 'a'))
  await heading.pressSequentially('x'.repeat(161))
  await expect(heading).toHaveText('x'.repeat(160))
  await expect(page.getByRole('alert')).toContainText('160')
  await heading.press('Escape')
  await canvas.getByText('Our company introduction.', { exact: true }).click()
  const body = page.getByRole('textbox', { name: 'Edit text on page' })
  await body.press(await shortcut(page, 'a'))
  await body.evaluate((element) => {
    const data = new DataTransfer()
    data.setData('text/plain', '<img onerror=alert(1)> **literal**')
    data.setData('text/html', '<img src=x onerror=alert(1)><b>literal</b>')
    element.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    )
  })
  await expect(body).toHaveText('<img onerror=alert(1)> **literal**')
  await expect(body.locator('img, strong')).toHaveCount(0)
  await body.press(await shortcut(page, 'a'))
  await page.getByRole('button', { name: 'Bold', exact: true }).click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(canvas.locator('.widget-text strong')).toHaveText(
    '<img onerror=alert(1)> **literal**',
  )
  await expect(canvas.locator('.widget-text img')).toHaveCount(0)
})

test('inline text preserves shift selection and keyboard access to formatting', async ({
  page,
}) => {
  const content = structuredClone(initial)
  content.pages[0]!.sections.push({ ...newSection('text'), id: 'second', title: 'Second widget' })
  await mockWebsite(page, false, false, content)
  await page.setViewportSize({ width: 1440, height: 950 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const canvas = page.locator('.preview-frame')
  await canvas.getByRole('heading', { name: 'Welcome to Phase 2' }).dblclick()
  await expect(page.getByRole('textbox', { name: 'Edit heading on page' })).toBeFocused()
  await canvas
    .getByRole('heading', { name: 'Second widget', exact: true })
    .click({ modifiers: ['Shift'] })
  await expect(canvas.locator('.grid-selected')).toHaveCount(2)
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
  await canvas.locator('[data-widget-id="hero"] .inline-body').focus()
  await page.keyboard.press('Enter')
  const body = page.getByRole('textbox', { name: 'Edit text on page' })
  await expect(body).toBeFocused()
  await body.press(await shortcut(page, 'a'))
  await page.getByRole('combobox', { name: 'Text style' }).selectOption('h3')
  await expect(body.locator('h3')).toHaveText('Our company introduction.')
  await page.getByRole('button', { name: 'Clear formatting', exact: true }).click()
  await expect(body.locator('p')).toHaveText('Our company introduction.')
  await body.press('Tab')
  await expect(
    page
      .getByRole('group', { name: 'Text formatting' })
      .getByRole('button', { name: 'Bold', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(body.locator('strong')).toHaveText('Our company introduction.')
  await body.press(await shortcut(page, 'z'))
  await expect(body.locator('strong')).toHaveCount(0)
  await body.press('Escape')
  await expect(page.getByRole('group', { name: 'Text formatting' })).toHaveCount(0)
  await expect(canvas.locator('[data-widget-id="hero"] .inline-body')).toBeFocused()
})

test('inline toolbar stays usable on phones and public pages stay read only', async ({ page }) => {
  await mockWebsite(page, true)
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  await page
    .getByRole('navigation', { name: 'Builder panels' })
    .getByRole('button', { name: 'Preview', exact: true })
    .click()
  const canvas = page.locator('.preview-frame')
  await canvas.getByText('Our company introduction.', { exact: true }).click()
  const body = page.getByRole('textbox', { name: 'Edit text on page' })
  // Wait for the editor's initial focus/selection before replacing its contents.
  await expect(body).toBeFocused()
  await body.fill('Phone edit')
  const toolbar = page.getByRole('group', { name: 'Text formatting' })
  await expect(toolbar).toBeVisible()
  const rect = await toolbar.boundingBox()
  expect(rect!.height).toBeLessThanOrEqual(90)
  expect(rect!.x).toBeGreaterThanOrEqual(0)
  expect(rect!.x + rect!.width).toBeLessThanOrEqual(390)
  expect(rect!.y).toBeGreaterThanOrEqual(0)
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(844)
  await page.screenshot({ path: '.security-work/inline-text-mobile.png' })
  await toolbar.getByRole('button', { name: 'More formatting' }).click()
  await expect(toolbar.getByLabel('Font family', { exact: true })).toBeVisible()
  await toolbar.getByRole('button', { name: 'More formatting' }).click()
  await expect(toolbar.getByLabel('Font family', { exact: true })).toBeHidden()
  await expect(body).toHaveText('Phone edit')
  await toolbar.getByRole('button', { name: 'Done' }).click()
  await expect(canvas.getByText('Phone edit', { exact: true })).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await page.goto('/website')
  await expect(page.getByRole('heading', { name: 'Welcome to Phase 2' })).toBeVisible()
  await expect(page.locator('[contenteditable="true"]')).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Text formatting' })).toHaveCount(0)
})

test('inspector tabs preserve edits, support keyboard navigation and work on phones', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await page.setViewportSize({ width: 1440, height: 950 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await selectCanvasWidget(page, 'Welcome to Phase 2')
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  const tabs = inspector.getByRole('tablist', { name: 'Widget settings' })
  await inspector.getByLabel('Heading', { exact: true }).fill('Edited through tabs')
  await tabs.getByRole('tab', { name: 'Content', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(tabs.getByRole('tab', { name: 'Appearance' })).toBeFocused()
  await expect(inspector.getByRole('tabpanel', { name: 'Content', exact: true })).toBeHidden()
  await inspector
    .locator('summary')
    .filter({ hasText: /^Advanced style$/ })
    .click()
  await inspector.getByLabel('Rotation (degrees)', { exact: true }).fill('12')
  await inspector.getByLabel('Rotation (degrees)', { exact: true }).press('Tab')
  await tabs.getByRole('tab', { name: 'Appearance' }).focus()
  await page.keyboard.press('End')
  await expect(tabs.getByRole('tab', { name: 'Layout' })).toBeFocused()
  await inspector
    .locator('summary')
    .filter({ hasText: /^Position and layer$/ })
    .click()
  await inspector.getByLabel('Widget x', { exact: true }).fill('2')
  await inspector.getByLabel('Widget x', { exact: true }).press('Tab')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(api.draft().pages[0]!.sections[0]).toMatchObject({
    title: 'Edited through tabs',
    layout: { x: 2 },
    appearance: { rotation: 12 },
  })
  expect(api.actions).not.toContain('publish')
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: '.security-work/inspector-tabs-desktop.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page
    .getByRole('navigation', { name: 'Builder panels' })
    .getByRole('button', { name: 'Editor', exact: true })
    .click()
  await tabs.getByRole('tab', { name: 'Layout' }).focus()
  await page.keyboard.press('Home')
  await expect(inspector.getByLabel('Heading', { exact: true })).toHaveValue('Edited through tabs')
  await expect(tabs.getByRole('tab', { name: 'Content', exact: true })).toBeFocused()
  await expect
    .poll(() =>
      page
        .locator('.app-shell__sidebar')
        .evaluate((element) => element.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0)
  await page.screenshot({ path: '.security-work/inspector-tabs-mobile.png' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page
    .getByRole('group', { name: 'Editor mode' })
    .getByRole('button', { name: 'Content', exact: true })
    .click()
  await expect(tabs).toHaveCount(0)
  await expect(inspector.getByLabel('Heading', { exact: true })).toBeVisible()
})

test('refined workspace keeps tools separate and expands the canvas without losing edits', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await expect(page.locator('.widget-library')).toBeHidden()
  await expect(page.locator('.history-actions')).toBeHidden()
  await selectCanvasWidget(page, 'Welcome to Phase 2')
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  await openInspectorFor(page, 'Heading')
  await inspector.getByLabel('Heading', { exact: true }).fill('An easier editor')
  await expect(inspector.getByRole('tabpanel', { name: 'Content', exact: true })).toBeVisible()
  await expect(inspector.getByRole('tabpanel', { name: 'Layout', exact: true })).toBeHidden()
  const originalWidth = (await page.locator('.preview-pane').boundingBox())!.width
  await page.getByRole('button', { name: 'Focus canvas', exact: true }).click()
  expect((await page.locator('.preview-pane').boundingBox())!.width).toBeGreaterThan(
    originalWidth + 400,
  )
  await expect(inspector).toBeHidden()
  await page.getByRole('button', { name: 'Focus canvas', exact: true }).click()
  await expect(inspector.getByLabel('Heading', { exact: true })).toHaveValue('An easier editor')
  await openTool(page, 'Widgets')
  await page.getByLabel('Find widgets', { exact: true }).fill('Card')
  await page.getByRole('button', { name: 'Add Card widget', exact: true }).click()
  await expect(
    page.locator('.section-card').getByRole('heading', { name: 'Card', exact: true }),
  ).toBeVisible()
  await openTool(page, 'Layers')
  await expect(page.getByRole('region', { name: 'Page layers' })).toBeVisible()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(api.draft().pages[0]!.sections[0]!.title).toBe('An easier editor')
  expect(api.draft().pages[0]!.sections).toHaveLength(2)
  expect(api.actions).not.toContain('publish')
  const controls = page.getByRole('group', { name: 'Canvas controls', exact: true })
  await expect(controls.getByRole('group', { name: 'Zoom and pan' })).toBeVisible()
  expect((await controls.boundingBox())!.height).toBeLessThan(50)
  expect(
    (await page.getByRole('group', { name: 'Widget actions', exact: true }).boundingBox())!.height,
  ).toBeLessThan(45)
  await page.screenshot({ path: '.security-work/builder-refined-desktop.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page
    .getByRole('navigation', { name: 'Builder panels' })
    .getByRole('button', { name: 'Preview', exact: true })
    .click()
  await expect(controls.getByRole('button', { name: 'Mobile', exact: true })).toBeVisible()
  expect(await controls.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1)
  expect((await controls.boundingBox())!.height).toBeLessThan(55)
  await expect
    .poll(() =>
      page.locator('.app-shell__sidebar').evaluate((el) => el.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0)
  await page.screenshot({ path: '.security-work/builder-controls-mobile.png' })
  await page.getByRole('button', { name: 'Deselect widgets', exact: true }).click()
  await expect(page.locator('.selection-toolbar')).toHaveCount(0)
  await expect(page.locator('.grid-selected')).toHaveCount(0)
  await expect(page.locator('.grid-widget')).toHaveCount(2)
})

test('canvas zoom works across devices and fit follows the available workspace without editing the draft', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  const controls = page.getByRole('group', { name: 'Canvas controls', exact: true })
  const frame = page.locator('.preview-frame')
  const width = async () => (await frame.boundingBox())!.width
  const fit = controls.getByRole('button', { name: 'Fit', exact: true })
  for (const device of ['Desktop', 'Tablet', 'Mobile']) {
    await controls.getByRole('button', { name: device, exact: true }).click()
    await controls.getByRole('button', { name: 'Reset zoom', exact: true }).click()
    const baseline = await width()
    await controls.getByRole('button', { name: 'Zoom in', exact: true }).click()
    await expect.poll(width).toBeGreaterThan(baseline * 1.09)
    await expect(fit).toHaveAttribute('aria-pressed', 'false')
    await controls.getByRole('button', { name: 'Zoom out', exact: true }).click()
    await expect.poll(width).toBeCloseTo(baseline, 0)
    await fit.click()
    await expect(fit).toHaveAttribute('aria-pressed', 'true')
    expect(await width()).toBeLessThanOrEqual(
      (await page.locator('.preview-scroll').boundingBox())!.width,
    )
  }
  await controls.getByRole('button', { name: 'Desktop', exact: true }).click()
  await fit.click()
  const fitted = await width()
  await controls.getByRole('button', { name: 'Focus canvas', exact: true }).click()
  await expect.poll(width).toBeGreaterThan(fitted + 300)
  await controls.getByRole('button', { name: 'Reset zoom', exact: true }).click()
  const manualWidth = await width()
  await controls.getByRole('button', { name: 'Focus canvas', exact: true }).click()
  await expect.poll(width).toBeCloseTo(manualWidth, 0)
  await fit.click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page
    .getByRole('navigation', { name: 'Builder panels' })
    .getByRole('button', { name: 'Preview', exact: true })
    .click()
  await expect.poll(width).toBeLessThan(390)
  await expect(page.locator('.builder-header .subtle')).toContainText('Draft saved')
  expect(api.actions[0]).toBe('load')
  expect(api.actions.filter((action) => action !== 'load')).toEqual(['save'])
})

test('publishing checks open the correct widget and shared layout so blockers can be fixed', async ({
  page,
}) => {
  const content = structuredClone(initial)
  content.pages.push({
    ...structuredClone(content.pages[0]!),
    id: 'services',
    slug: 'services',
    title: 'Services',
    sections: [
      {
        ...newSection('text'),
        id: 'service-intro',
        title: 'Our services',
        linkLabel: 'Learn more',
      },
    ],
  })
  const nav = newSection('navigation')
  nav.title = 'Shared menu'
  nav.navigation!.links = [{ id: 'missing-link', label: 'Contact us', url: '/website/missing' }]
  content.sharedLayout = {
    id: 'layout',
    title: 'Site layout',
    slug: 'site-layout',
    description: '',
    inNavigation: false,
    chrome: 'widgets',
    sections: [nav, newSection('page-content')],
  }
  content.pages[0]!.useSiteLayout = true
  const api = await mockWebsite(page, false, false, content)
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await openTool(page, 'Publishing')
  const checks = page.locator('.publishing-checks')
  await checks.getByRole('button', { name: /Fix: Services: complete both/ }).click()
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  await expect(inspector.getByLabel('Heading', { exact: true })).toHaveValue('Our services')
  await inspector.getByLabel('Button link', { exact: true }).fill('/website')
  await expect(checks.getByRole('button', { name: /Fix: Services: complete both/ })).toHaveCount(0)
  await checks.getByRole('button', { name: /Fix: Site layout: link/ }).click()
  await expect(inspector.getByLabel('Widget name', { exact: true })).toHaveValue('Shared menu')
  await inspector.getByLabel('Menu URL', { exact: true }).fill('/website/services')
  await expect(checks.getByRole('button', { name: /^Fix:/ })).toHaveCount(0)
  await checks.getByRole('button', { name: /Review: Services: add a page description/ }).click()
  await expect(inspector.getByLabel('Page title', { exact: true })).toHaveValue('Services')
  await inspector.getByLabel('Page description', { exact: true }).fill('Our construction services.')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled()
  expect(api.draft().sharedLayout!.sections[0]!.navigation!.links[0]!.url).toBe('/website/services')
  expect(api.draft().pages[1]!.sections[0]!.linkUrl).toBe('/website')
  await page.screenshot({ path: '.security-work/builder-publishing-review.png' })
})

test('site code is available without a shared layout and publishing checks return to it', async ({
  page,
}) => {
  const content = structuredClone(initial)
  content.css = 'body { color: red; }'
  const api = await mockWebsite(page, false, false, content)
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await openTool(page, 'Publishing')
  await page.locator('.publishing-checks').getByRole('button', { name: /^Fix:/ }).click()
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  await expect(
    page
      .getByRole('group', { name: 'Editor mode' })
      .getByRole('button', { name: 'Code', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(inspector.getByLabel('Site CSS', { exact: true })).toHaveValue(content.css)
  await expect(inspector.getByLabel('Site layout HTML', { exact: true })).toHaveCount(0)
  await inspector.getByLabel('Site CSS', { exact: true }).fill('.widget-title { color: #124578; }')
  await expect(page.locator('.website-canvas .widget-title').first()).toHaveCSS(
    'color',
    'rgb(18, 69, 120)',
  )
  await inspector.getByText('Site JavaScript', { exact: true }).first().click()
  await inspector
    .getByLabel('Site JavaScript', { exact: true })
    .fill("document.body.dataset.siteCode = 'ready'")
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(api.draft().sharedLayout).toBeUndefined()
  expect(api.draft().css).toContain('#124578')
  expect(api.draft().js).toContain('siteCode')
  expect(api.draft().pages[0]!.css).toBeUndefined()
})

test('owners edit content in one inspector, preserve shared designs and see accurate save state', async ({
  page,
}) => {
  const content = structuredClone(initial)
  content.customWidgets = [
    {
      id: 'shared-card',
      name: 'Company card',
      kind: 'code',
      html: '<h2>{{headline}}</h2>',
      css: '',
      sections: [],
      fields: [
        { key: 'headline', label: 'Card headline', type: 'text', defaultValue: 'Original heading' },
      ],
    },
  ]
  content.pages[0]!.sections.push(
    { ...newSection('image'), id: 'photo', title: 'Job photo' },
    { ...newSection('spacer'), id: 'space' },
    {
      ...newSection('custom'),
      id: 'custom-one',
      title: 'Company card one',
      custom: { definitionId: 'shared-card', values: {} },
    },
    {
      ...newSection('custom'),
      id: 'custom-two',
      title: 'Company card two',
      custom: { definitionId: 'shared-card', values: {} },
    },
  )
  const api = await mockWebsite(page, false, false, content)
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page
    .getByRole('group', { name: 'Editor mode' })
    .getByRole('button', { name: 'Content', exact: true })
    .click()
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  const outline = page.getByRole('complementary', { name: 'Website structure' })
  await outline.getByRole('button', { name: 'Welcome to Phase 2 Hero banner', exact: true }).click()
  await inspector.getByLabel('Heading', { exact: true }).fill('Built with care')
  await expect(inspector.getByLabel('Button link', { exact: true })).toBeHidden()
  await inspector
    .locator('summary')
    .filter({ hasText: /^Button$/ })
    .click()
  await inspector.getByLabel('Button label', { exact: true }).fill('Learn more')
  await inspector.getByLabel('Button link', { exact: true }).fill('/website')
  await outline.getByRole('button', { name: 'Job photo Image', exact: true }).click()
  await expect(inspector.getByLabel('Heading', { exact: true })).toHaveCount(0)
  await expect(inspector.getByLabel('Upload image', { exact: true })).toBeVisible()
  await outline.getByRole('button', { name: 'Spacer Spacer', exact: true }).click()
  await expect(inspector.getByText(/no editable content/)).toBeVisible()
  await expect(inspector.getByLabel('Heading', { exact: true })).toHaveCount(0)
  await outline.getByRole('button', { name: 'Company card one Custom widget', exact: true }).click()
  await expect(inspector.getByLabel('Card headline', { exact: true })).toHaveValue(
    'Original heading',
  )
  await inspector.getByLabel('Card headline', { exact: true }).fill('Local content')
  await expect(
    outline.getByRole('article', { name: 'Selected custom widget settings' }),
  ).toHaveCount(0)
  await expect(inspector.getByRole('button', { name: 'Edit shared widget' })).toHaveCount(0)
  let releaseSave!: () => void
  const saveGate = new Promise<void>((resolve) => {
    releaseSave = resolve
  })
  await page.route('**/websiteBuilder', async (route) => {
    if (
      route.request().method() === 'POST' &&
      route.request().postDataJSON().data.action === 'save'
    )
      await saveGate
    await route.fallback()
  })
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.locator('.builder-header .subtle')).toContainText('Saving draft')
  await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toBeDisabled()
  releaseSave()
  await expect(page.locator('.builder-header .subtle')).toContainText('Draft saved')
  expect(
    api.draft().pages[0]!.sections.find((entry) => entry.id === 'custom-one')!.custom!.values
      .headline,
  ).toBe('Local content')
  expect(
    api.draft().pages[0]!.sections.find((entry) => entry.id === 'custom-two')!.custom!.values,
  ).toEqual({})
  expect(api.draft().customWidgets![0]!.fields[0]!.defaultValue).toBe('Original heading')
  await inspector.getByLabel('Card headline', { exact: true }).fill('Another edit')
  await expect(page.locator('.builder-header .subtle')).toContainText('Unsaved changes')
  await expect(page.locator('.builder-status')).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(inspector.getByLabel('Card headline', { exact: true })).toBeVisible()
  await expect
    .poll(() =>
      page.locator('.app-shell__sidebar').evaluate((el) => el.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0)
  await page.screenshot({ path: '.security-work/builder-content-owner-mobile.png' })
  api.failSave()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Another admin changed')
  await expect(inspector.getByLabel('Card headline', { exact: true })).toHaveValue('Another edit')
  await expect(page.locator('.builder-header .subtle')).toContainText('Save conflict')
})

test('refined workspace guides an empty page into adding its first widget on mobile', async ({
  page,
}) => {
  const content = structuredClone(initial)
  content.pages[0]!.sections = []
  await mockWebsite(page, false, false, content)
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page
    .getByRole('group', { name: 'Editor mode' })
    .getByRole('button', { name: 'Content', exact: true })
    .click()
  const panels = page.getByRole('navigation', { name: 'Builder panels' })
  await panels.getByRole('button', { name: 'Preview', exact: true }).click()
  await page.getByRole('button', { name: 'Add your first widget' }).click()
  await page.getByLabel('Find widgets', { exact: true }).fill('photo')
  await expect(page.getByRole('button', { name: 'Add Image widget', exact: true })).toBeVisible()
  await page.getByLabel('Widget category', { exact: true }).selectOption('Data')
  await expect(page.getByText('No matching widgets.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await expect(page.getByLabel('Find widgets', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Widget category', { exact: true })).toHaveValue('All')
  await page.getByLabel('Find widgets', { exact: true }).fill('card')
  await page.screenshot({ path: '.security-work/builder-widget-catalog-mobile.png' })
  await expect(page.getByRole('button', { name: 'Add Card widget', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Add Card widget', exact: true }).click()
  await panels.getByRole('button', { name: 'Editor', exact: true }).click()
  await expect(
    page
      .getByRole('complementary', { name: 'Content editor' })
      .getByLabel('Heading', { exact: true }),
  ).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: '.security-work/builder-refined-mobile.png' })
})

test('admin edits, previews, saves and deliberately publishes pages; draft changes remain private', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await expect(page.getByRole('link', { name: 'Website Builder', exact: true })).toBeVisible()
  await selectCanvasWidget(page, 'Welcome to Phase 2')
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  await openInspectorFor(page, 'Heading')
  await inspector.getByLabel('Heading', { exact: true }).fill('Built by Phase 2')
  await inspector
    .getByLabel('Text', { exact: true })
    .fill('<script>window.websiteInjected = true</script>')
  await inspector.getByLabel('Upload image', { exact: true }).setInputFiles('e2e/fixtures/site.png')
  await inspector.getByLabel('Image description').fill('Project photo')
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(api.published()).toBeNull()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open]').getByRole('button').first().click()
  expect(api.actions).not.toContain('publish')
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await openInspectorFor(page, 'Heading')
  await inspector.getByLabel('Heading', { exact: true }).fill('Unpublished change')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(api.published()?.pages[0]?.sections[0]?.title).toBe('Built by Phase 2')
  await openTool(page, 'Pages')
  await page.getByRole('button', { name: '+ Page', exact: true }).click()
  await openInspectorFor(page, 'Page title')
  await inspector.getByLabel('Page title', { exact: true }).fill('Careers')
  await openInspectorFor(page, 'Page URL')
  await inspector.getByLabel('Page URL', { exact: true }).fill('careers')
  await openTool(page, 'Widgets')
  await page
    .getByRole('button', {
      name: `Add ${sectionLabels['cards' as SectionType]} widget`,
      exact: true,
    })
    .click()
  await openInspectorFor(page, 'Heading')
  await inspector.getByLabel('Heading', { exact: true }).fill('Join the team')
  await page.getByRole('button', { name: '+ Add item', exact: true }).click()
  await page.getByText('Item 1', { exact: true }).click()
  await openInspectorFor(page, 'Heading')
  await inspector.getByLabel('Heading', { exact: true }).nth(1).fill('Foreman opening')
  await page.getByRole('button', { name: 'Mobile', exact: true }).click()
  expect((await page.locator('.preview-frame').boundingBox())!.width).toBeLessThanOrEqual(390)
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await openTool(page, 'Publishing')
  await page.getByRole('button', { name: 'Restore previous to draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Previous published version restored')
  expect(api.draft().pages).toHaveLength(1)
  expect(api.published()?.pages).toHaveLength(2)
  await page.screenshot({ path: '.security-work/website-builder.png', fullPage: true })
  await page.goto('/website/careers')
  await expect(page.getByRole('heading', { name: 'Join the team' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Foreman opening' })).toBeVisible()
  await expect(page.locator('.website-canvas header')).toHaveCount(0)
  await page.goto('/website')
  await expect(page.getByRole('heading', { name: 'Unpublished change' })).toBeVisible()
  expect(await page.evaluate(() => 'websiteInjected' in window)).toBe(false)
})

test('templates, copies and local history edit the draft without changing publication', async ({
  page,
}) => {
  const api = await mockWebsite(page, true)
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  const undo = page.getByRole('button', { name: 'Undo', exact: true })
  const redo = page.getByRole('button', { name: 'Redo', exact: true })
  await expect(undo).toBeDisabled()
  await page.getByText('Page templates', { exact: true }).click()
  await page.getByLabel('Page template', { exact: true }).selectOption('projects')
  await page.getByRole('button', { name: 'Create from template', exact: true }).click()
  await expect(inspector.getByLabel('Page URL', { exact: true })).toHaveValue('projects')
  await page.getByRole('button', { name: 'Duplicate page', exact: true }).click()
  await expect(inspector.getByLabel('Page URL', { exact: true })).toHaveValue('projects-copy')
  await undo.click()
  await expect(inspector.getByLabel('Page URL', { exact: true })).toHaveValue('home')
  await redo.click()
  await openTool(page, 'Pages')
  await page
    .getByRole('complementary', { name: 'Website structure' })
    .getByRole('button', { name: 'Projects (copy) /projects-copy', exact: true })
    .click()
  await selectCanvasWidget(page, 'Our projects')
  await page.getByRole('button', { name: 'Duplicate widget', exact: true }).click()
  await openInspectorFor(page, 'Heading')
  await inspector.getByLabel('Heading', { exact: true }).first().fill('Copy only')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  const original = api.draft().pages.find((entry) => entry.slug === 'projects')!
  const copy = api.draft().pages.find((entry) => entry.slug === 'projects-copy')!
  expect(original.sections).toHaveLength(4)
  expect(copy.sections).toHaveLength(5)
  expect(copy.sections[4]!.title).toBe('Copy only')
  expect(copy.sections[4]!.items[0]!.id).not.toBe(copy.sections[2]!.items[0]!.id)
  expect(api.published()!.pages).toHaveLength(1)
  await undo.click()
  await expect(inspector.getByLabel('Heading', { exact: true }).first()).toHaveValue('Our projects')
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled()
  await redo.click()
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled()
  await openTool(page, 'Publishing')
  await page.getByRole('button', { name: 'Reload draft', exact: true }).click()
  await expect(undo).toBeDisabled()
  await expect(redo).toBeDisabled()
  expect(api.actions).not.toContain('publish')
})

test('grid widgets keep authored coordinates through move, resize, zoom, undo and publication', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  await openTool(page, 'Widgets')
  const source = page.getByRole('button', { name: 'Add Text widget', exact: true })
  await source.scrollIntoViewIfNeeded()
  const start = (await source.boundingBox())!
  const surface = page.locator('.grid-surface')
  const bounds = (await surface.boundingBox())!
  const scale = bounds.width / 1080
  await page.mouse.move(start.x + 20, start.y + 20)
  await page.mouse.down()
  await page.mouse.move(bounds.x + 3 * 45 * scale, bounds.y + 4 * 32 * scale, { steps: 15 })
  await expect(page.locator('.grid-drop-preview')).toBeVisible()
  await page.mouse.up()
  await expect(inspector.getByLabel('Widget x', { exact: true })).toHaveValue('3')
  await expect(inspector.getByLabel('Widget y', { exact: true })).toHaveValue('4')
  await openInspectorFor(page, 'Heading')
  await inspector.getByLabel('Heading', { exact: true }).fill('Grid note')
  const handle = page.getByRole('button', {
    name: 'Resize Grid note from bottom-right',
    exact: true,
  })
  const corner = (await handle.boundingBox())!
  await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    corner.x + corner.width / 2 + 2 * 45 * scale,
    corner.y + corner.height / 2 + 3 * 32 * scale,
    { steps: 15 },
  )
  await page.mouse.up()
  await expect(inspector.getByLabel('Widget w', { exact: true })).toHaveValue('10')
  await expect(inspector.getByLabel('Widget h', { exact: true })).toHaveValue('11')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(inspector.getByLabel('Widget w', { exact: true })).toHaveValue('8')
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(inspector.getByLabel('Widget w', { exact: true })).toHaveValue('10')
  await page.getByRole('button', { name: 'Reset zoom', exact: true }).click()
  const move = page.getByLabel('Select Grid note widget', { exact: true })
  await move.scrollIntoViewIfNeeded()
  const moveBounds = (await move.boundingBox())!
  await page.mouse.move(moveBounds.x + 10, moveBounds.y + 10)
  await page.mouse.down()
  await page.mouse.move(moveBounds.x + 55, moveBounds.y + 42, { steps: 15 })
  await page.mouse.up()
  await expect(inspector.getByLabel('Widget x', { exact: true })).toHaveValue('4')
  await expect(inspector.getByLabel('Widget y', { exact: true })).toHaveValue('5')
  const widget = page.getByLabel('Select Grid note widget', { exact: true })
  await widget.focus()
  await page.keyboard.press('ArrowRight')
  await expect(inspector.getByLabel('Widget x', { exact: true })).toHaveValue('5')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(api.draft().pages[0]!.sections[1]!.layout).toEqual({ x: 5, y: 5, w: 10, h: 11, z: 2 })
  const scroller = page.locator('.preview-scroll')
  await scroller.evaluate((element) => {
    element.scrollLeft = 0
  })
  await page.getByRole('button', { name: 'Pan', exact: true }).click()
  const viewport = (await scroller.boundingBox())!
  await page.mouse.move(viewport.x + viewport.width / 2, viewport.y + 120)
  await page.mouse.down()
  await page.mouse.move(viewport.x + viewport.width / 2 - 80, viewport.y + 120, { steps: 10 })
  await page.mouse.up()
  await expect.poll(() => scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(50)
  await page.getByRole('button', { name: 'Pan', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled()
  expect(api.draft().pages[0]!.sections[0]!.layout!.x).toBe(0)
  expect(api.published()).toBeNull()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.getByRole('button', { name: 'Fit', exact: true }).click()
  await page.screenshot({ path: '.security-work/website-network-grid.png' })
  await page.goto('/website')
  await expect(page.getByRole('heading', { name: 'Grid note', exact: true })).toBeVisible()
  await expect(page.locator('.grid-resize')).toHaveCount(0)
  await expect(page.locator('.show-grid')).toHaveCount(0)
  const publishedWidget = page.locator('.grid-widget').nth(1)
  await expect(publishedWidget).toHaveCSS('left', '225px')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
  await expect(page.locator('.flow-surface')).toBeVisible()
})

test('cancelled drags leave the draft intact and widget buttons work on phones', async ({
  page,
}) => {
  await mockWebsite(page)
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await openTool(page, 'Widgets')
  const source = page.getByRole('button', { name: 'Add Text widget', exact: true })
  await source.scrollIntoViewIfNeeded()
  const start = (await source.boundingBox())!
  const destination = (await page.locator('.widget-frame').boundingBox())!
  await page.mouse.move(start.x + 10, start.y + 10)
  await page.mouse.down()
  await page.mouse.move(destination.x + 30, destination.y + 30, { steps: 10 })
  await expect(page.locator('.grid-drop-preview')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(page.locator('.widget-frame')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Pages & widgets', exact: true }).click()
  await source.click()
  await expect(page.getByLabel('Heading', { exact: true })).toHaveValue('Text')
  await page.getByLabel('Heading', { exact: true }).fill('Phone widget')
  await page.getByRole('button', { name: 'Pages & widgets', exact: true }).click()
  await openTool(page, 'Pages')
  await page.getByRole('button', { name: 'Move section 2 up', exact: true }).click()
  await page
    .getByRole('navigation', { name: 'Builder panels' })
    .getByRole('button', { name: 'Preview', exact: true })
    .click()
  await expect(page.locator('.widget-frame').first()).toContainText('Phone widget')
})

test('multi-selection moves as a group, supports clipboard and layers, and undoes removal', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await page.setViewportSize({ width: 1600, height: 1100 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  const outline = page.getByRole('complementary', { name: 'Website structure' })
  async function add(title: string, x: string) {
    await openTool(page, 'Widgets')
    await page.getByRole('button', { name: 'Add Text widget', exact: true }).click()
    await openInspectorFor(page, 'Heading')
    await inspector.getByLabel('Heading', { exact: true }).fill(title)
    await openInspectorFor(page, 'Widget x')
    await inspector.getByLabel('Widget x', { exact: true }).fill(x)
    await openInspectorFor(page, 'Widget x')
    await inspector.getByLabel('Widget x', { exact: true }).press('Tab')
    await openInspectorFor(page, 'Widget y')
    await inspector.getByLabel('Widget y', { exact: true }).fill('13')
    await openInspectorFor(page, 'Widget y')
    await inspector.getByLabel('Widget y', { exact: true }).press('Tab')
  }
  await add('First group widget', '2')
  await add('Second group widget', '12')
  await openTool(page, 'Pages')
  await outline
    .getByRole('button', { name: 'First group widget Text', exact: true })
    .click({ modifiers: ['Shift'] })
  await expect(page.locator('.grid-selected')).toHaveCount(2)
  await expect(page.locator('.grid-resize')).toHaveCount(0)
  const first = page.getByLabel('Select First group widget widget', { exact: true })
  await first.scrollIntoViewIfNeeded()
  const bounds = (await first.boundingBox())!
  const scale = (await page.locator('.grid-surface').boundingBox())!.width / 1080
  await page.mouse.move(bounds.x + 10, bounds.y + 10)
  await page.mouse.down()
  await page.mouse.move(bounds.x + 10 + 45 * scale, bounds.y + 10 + 32 * scale, { steps: 10 })
  await page.mouse.up()
  await expect(inspector.getByLabel('Widget x', { exact: true })).toHaveValue('3')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(inspector.getByLabel('Widget x', { exact: true })).toHaveValue('2')
  await first.click({ button: 'right' })
  const menu = page.getByRole('menu', { name: 'Widget actions' })
  await menu.getByRole('menuitem', { name: 'Copy widgets', exact: true }).click()
  await first.focus()
  await page.keyboard.press('Control+v')
  await expect(page.locator('.grid-widget')).toHaveCount(5)
  await expect(page.locator('.grid-selected')).toHaveCount(2)
  await page.getByRole('button', { name: 'Send to back', exact: true }).click()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  const sections = api.draft().pages[0]!.sections
  expect(sections.slice(-2).map((entry) => entry.layout!.x)).toEqual([3, 13])
  expect(sections.slice(-2).map((entry) => entry.layout!.z)).toEqual([1, 2])
  expect(new Set(sections.map((entry) => entry.id)).size).toBe(5)
  const selected = page.locator('.grid-selected').first()
  await selected.focus()
  await page.keyboard.press('Delete')
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.locator('.grid-widget')).toHaveCount(3)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.locator('.grid-widget')).toHaveCount(5)
  expect(api.published()).toBeNull()
})

test('group arrangement persists, supports keyboard history and protects text editing', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await page.setViewportSize({ width: 1600, height: 1100 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  const outline = page.getByRole('complementary', { name: 'Website structure' })
  for (const [title, x, y, w] of [
    ['A', '1', '13', '3'],
    ['B', '6', '15', '4'],
    ['C', '19', '17', '5'],
  ]) {
    await openTool(page, 'Widgets')
    await page.getByRole('button', { name: 'Add Text widget', exact: true }).click()
    await openInspectorFor(page, 'Heading')
    await inspector.getByLabel('Heading', { exact: true }).fill(title!)
    for (const [field, value] of [
      ['x', x],
      ['y', y],
      ['w', w],
    ]) {
      await openInspectorFor(page, `Widget ${field}`)
      await inspector.getByLabel(`Widget ${field}`, { exact: true }).fill(value!)
      await openInspectorFor(page, `Widget ${field}`)
      await inspector.getByLabel(`Widget ${field}`, { exact: true }).press('Tab')
    }
  }
  await openTool(page, 'Pages')
  await outline.getByRole('button', { name: 'B Text', exact: true }).click({ modifiers: ['Shift'] })
  await expect(
    inspector.getByRole('button', { name: 'Distribute horizontally', exact: true }),
  ).toBeDisabled()
  await openTool(page, 'Pages')
  await outline.getByRole('button', { name: 'A Text', exact: true }).click({ modifiers: ['Shift'] })
  await inspector.getByRole('button', { name: 'Distribute horizontally', exact: true }).click()
  const widgetX = () =>
    page
      .locator('.grid-widget')
      .evaluateAll((widgets) =>
        widgets
          .slice(1)
          .map((widget) => Number.parseFloat((widget as HTMLElement).style.left) / 45),
      )
  await expect.poll(widgetX).toEqual([1, 9.5, 19])
  await page.keyboard.press('Control+z')
  await expect.poll(widgetX).toEqual([1, 6, 19])
  await page.keyboard.press('Control+Shift+z')
  await expect.poll(widgetX).toEqual([1, 9.5, 19])
  const heading = inspector.getByLabel('Heading', { exact: true })
  await heading.focus()
  await page.keyboard.press('Control+a')
  await page.keyboard.type('Edited A')
  await page.keyboard.press('Control+z')
  await expect(heading).not.toHaveValue('Edited A')
  expect(await widgetX()).toEqual([1, 9.5, 19])
  await heading.fill('A')
  await openTool(page, 'Pages')
  await outline.getByRole('button', { name: 'A Text', exact: true }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Align top', exact: true }).click()
  await inspector.getByRole('button', { name: 'Match width', exact: true }).click()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  const widgets = api.draft().pages[0]!.sections.slice(1)
  expect(widgets.map((widget) => widget.layout!.y)).toEqual([13, 13, 13])
  expect(widgets.map((widget) => widget.layout!.w)).toEqual([3, 3, 3])
  expect(api.published()).toBeNull()
  await openTool(page, 'Publishing')
  await page.getByRole('button', { name: 'Reload draft', exact: true }).click()
  await expect(page.locator('.grid-widget')).toHaveCount(4)
  expect(await widgetX()).toEqual([1, 9.5, 19])
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Pages & widgets', exact: true }).click()
  await openTool(page, 'Pages')
  await outline.getByRole('button', { name: 'A Text', exact: true }).click()
  await page.getByRole('button', { name: 'Pages & widgets', exact: true }).click()
  await openTool(page, 'Pages')
  await outline.getByRole('button', { name: 'B Text', exact: true }).click({ modifiers: ['Shift'] })
  await expect(inspector.getByRole('region', { name: 'Arrange widgets' })).toBeVisible()
  const bodyWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(bodyWidth).toBeLessThanOrEqual(390)
})

test('containers, appearance and rotation survive copying, undo and publication', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await page.setViewportSize({ width: 1600, height: 1100 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  const outline = page.getByRole('complementary', { name: 'Website structure' })
  for (const title of ['Alpha', 'Beta']) {
    await openTool(page, 'Widgets')
    await page.getByRole('button', { name: 'Add Text widget', exact: true }).click()
    await openInspectorFor(page, 'Heading')
    await inspector.getByLabel('Heading', { exact: true }).fill(title)
  }
  await openTool(page, 'Pages')
  await outline
    .getByRole('button', { name: 'Alpha Text', exact: true })
    .click({ modifiers: ['Shift'] })
  await page.getByRole('button', { name: 'Group in container', exact: true }).click()
  await expect(page.locator('.container-children > .contained-widget')).toHaveCount(2)
  await openInspectorFor(page, 'Heading')
  await inspector.getByLabel('Heading', { exact: true }).fill('Feature group')
  await openInspectorFor(page, 'Child layout')
  await inspector.getByLabel('Child layout', { exact: true }).selectOption('column')
  await openInspectorFor(page, 'Child gap (px)')
  await inspector.getByLabel('Child gap (px)', { exact: true }).fill('24')
  await openInspectorFor(page, 'Child gap (px)')
  await inspector.getByLabel('Child gap (px)', { exact: true }).press('Tab')
  await openInspectorFor(page, 'Rotation (degrees)')
  await inspector.getByLabel('Rotation (degrees)', { exact: true }).fill('-8')
  await openInspectorFor(page, 'Rotation (degrees)')
  await inspector.getByLabel('Rotation (degrees)', { exact: true }).press('Tab')
  await expect(page.locator('.grid-resize')).toHaveCount(8)
  await openInspectorFor(page, 'Padding (px)')
  await inspector.getByLabel('Padding (px)', { exact: true }).fill('32')
  await openInspectorFor(page, 'Padding (px)')
  await inspector.getByLabel('Padding (px)', { exact: true }).press('Tab')
  await openInspectorFor(page, 'Background color')
  await inspector.getByLabel('Background color', { exact: true }).evaluate((element) => {
    ;(element as HTMLInputElement).value = '#234567'
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await openTool(page, 'Pages')
  await outline.getByRole('button', { name: /Alpha Text/ }).click()
  await expect(inspector.getByLabel('Widget x', { exact: true })).toHaveCount(0)
  await openInspectorFor(page, 'Rotation (degrees)')
  await inspector.getByLabel('Rotation (degrees)', { exact: true }).fill('12')
  await openInspectorFor(page, 'Rotation (degrees)')
  await inspector.getByLabel('Rotation (degrees)', { exact: true }).press('Tab')
  await openInspectorFor(page, 'Font family')
  await inspector.getByLabel('Font family', { exact: true }).selectOption('serif')
  await openInspectorFor(page, 'Heading size (px)')
  await inspector.getByLabel('Heading size (px)', { exact: true }).fill('36')
  await openInspectorFor(page, 'Heading size (px)')
  await inspector.getByLabel('Heading size (px)', { exact: true }).press('Tab')
  await openTool(page, 'Pages')
  await outline.getByRole('button', { name: 'Feature group Container', exact: true }).click()
  await page.getByRole('button', { name: 'Duplicate selection', exact: true }).click()
  await expect(page.locator('.container-children')).toHaveCount(2)
  await expect(page.locator('.contained-widget')).toHaveCount(4)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.locator('.container-children')).toHaveCount(1)
  await openTool(page, 'Pages')
  await outline.getByRole('button', { name: 'Feature group Container', exact: true }).click()
  await openInspectorFor(page, 'Hide widget')
  await inspector.getByLabel('Hide widget', { exact: true }).check()
  await expect(page.locator('.contained-widget')).toHaveCount(0)
  await openInspectorFor(page, 'Hide widget')
  await inspector.getByLabel('Hide widget', { exact: true }).uncheck()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  const saved = api.draft().pages[0]!.sections
  const container = saved.find((entry) => entry.type === 'container')!
  expect(container.container).toEqual({ direction: 'column', gap: 24 })
  expect(container.appearance).toMatchObject({ rotation: -8, padding: 32, background: '#234567' })
  expect(saved.filter((entry) => entry.parentId === container.id)).toHaveLength(2)
  expect(saved.find((entry) => entry.title === 'Alpha')!.appearance).toMatchObject({
    rotation: 12,
    fontFamily: 'serif',
    headingSize: 36,
  })
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.goto('/website')
  await expect(page.locator('.section-container')).toHaveCSS('background-color', 'rgb(35, 69, 103)')
  await expect(page.locator('.section-container').locator('..')).toHaveAttribute(
    'style',
    /rotate\(-8deg\)/,
  )
  await expect(page.locator('.container-children')).toHaveCSS('flex-direction', 'column')
  await expect(page.locator('.container-children')).toHaveCSS('gap', '24px')
  await expect(page.getByRole('heading', { name: 'Alpha', exact: true })).toHaveCSS(
    'font-size',
    '36px',
  )
  await expect(page.locator('.grid-resize')).toHaveCount(0)
  await page.screenshot({ path: '.security-work/website-container-public.png', fullPage: true })
})

test('standalone photos rotate, move and render without a text block', async ({ page }) => {
  const api = await mockWebsite(page)
  await page.setViewportSize({ width: 1600, height: 1100 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await openTool(page, 'Widgets')
  await page.getByRole('button', { name: 'Add Image widget', exact: true }).click()
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  await openInspectorFor(page, 'Heading')
  await inspector.getByLabel('Heading', { exact: true }).fill('Slanted photo')
  await page.getByRole('button', { name: 'Choose image from library', exact: true }).click()
  await page.getByRole('button', { name: 'Use Project photo.webp', exact: true }).click()
  await openInspectorFor(page, 'Image description')
  await inspector.getByLabel('Image description', { exact: true }).fill('Our project')
  for (const [label, value] of [
    ['Widget x', '4'],
    ['Widget y', '14'],
    ['Rotation (degrees)', '-12'],
    ['Padding (px)', '0'],
  ]) {
    await openInspectorFor(page, label!)
    await inspector.getByLabel(label!, { exact: true }).fill(value!)
    await openInspectorFor(page, label!)
    await inspector.getByLabel(label!, { exact: true }).press('Tab')
  }
  await openInspectorFor(page, 'Image fit')
  await inspector.getByLabel('Image fit', { exact: true }).selectOption('contain')
  await expect(inspector.getByLabel('Text', { exact: true })).toHaveCount(0)
  const photo = page.getByLabel('Select Slanted photo widget', { exact: true })
  await expect(photo).toHaveAttribute('style', /rotate\(-12deg\)/)
  await photo.focus()
  await page.keyboard.press('ArrowRight')
  await expect(inspector.getByLabel('Widget x', { exact: true })).toHaveValue('5')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(api.draft().pages[0]!.sections[1]!.appearance).toMatchObject({
    rotation: -12,
    padding: 0,
    imageFit: 'contain',
  })
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.goto('/website')
  await expect(page.getByRole('img', { name: 'Our project', exact: true })).toHaveCSS(
    'object-fit',
    'contain',
  )
  await expect(page.getByRole('heading', { name: 'Slanted photo', exact: true })).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
})

test('canvas rotation handle snaps, resizes rotated widgets, cancels and saves one undo step per gesture', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await page.setViewportSize({ width: 1600, height: 1100 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await openTool(page, 'Widgets')
  await page.getByRole('button', { name: 'Add Text widget', exact: true }).click()
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  await openInspectorFor(page, 'Heading')
  await inspector.getByLabel('Heading', { exact: true }).fill('Transform me')
  for (const [field, value] of [
    ['x', '8'],
    ['y', '3'],
    ['w', '6'],
    ['h', '4'],
  ]) {
    await openInspectorFor(page, `Widget ${field}`)
    await inspector.getByLabel(`Widget ${field}`, { exact: true }).fill(value!)
    await openInspectorFor(page, `Widget ${field}`)
    await inspector.getByLabel(`Widget ${field}`, { exact: true }).press('Tab')
  }
  const widget = page.getByLabel('Select Transform me widget', { exact: true })
  const rotate = page.getByRole('button', { name: 'Rotate Transform me', exact: true })
  await rotate.scrollIntoViewIfNeeded()
  const bounds = (await widget.boundingBox())!,
    handle = (await rotate.boundingBox())!
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  const start = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }
  const radius = center.y - start.y
  await page.mouse.move(start.x, start.y)
  await page.keyboard.down('Shift')
  await page.mouse.down()
  await page.mouse.move(center.x + radius / Math.sqrt(2), center.y - radius / Math.sqrt(2), {
    steps: 10,
  })
  await expect(widget).toHaveAttribute('style', /rotate\(45deg\)/)
  await page.mouse.up()
  await page.keyboard.up('Shift')
  await expect(inspector.getByLabel('Rotation (degrees)', { exact: true })).toHaveValue('45')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(inspector.getByLabel('Rotation (degrees)', { exact: true })).toHaveValue('')
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  const resize = page.getByRole('button', {
    name: 'Resize Transform me from bottom-right',
    exact: true,
  })
  const corner = (await resize.boundingBox())!
  const scale = (await page.locator('.grid-surface').boundingBox())!.width / 1080
  await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    corner.x + corner.width / 2 + (45 * scale) / Math.sqrt(2),
    corner.y + corner.height / 2 + (45 * scale) / Math.sqrt(2),
    { steps: 10 },
  )
  await page.mouse.up()
  await expect(inspector.getByLabel('Widget w', { exact: true })).toHaveValue('7')
  await expect(inspector.getByLabel('Widget h', { exact: true })).toHaveValue('4')
  await expect(inspector.getByLabel('Rotation (degrees)', { exact: true })).toHaveValue('45')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(inspector.getByLabel('Widget w', { exact: true })).toHaveValue('6')
  await rotate.focus()
  await page.keyboard.press('Shift+ArrowRight')
  await expect(inspector.getByLabel('Rotation (degrees)', { exact: true })).toHaveValue('60')
  const current = (await rotate.boundingBox())!
  await page.mouse.move(current.x + current.width / 2, current.y + current.height / 2)
  await page.mouse.down()
  await page.mouse.move(current.x + 55, current.y + 50, { steps: 8 })
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(inspector.getByLabel('Rotation (degrees)', { exact: true })).toHaveValue('60')
  await widget.focus()
  await page.keyboard.press('ArrowRight')
  await expect(inspector.getByLabel('Widget x', { exact: true })).toHaveValue('9')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(api.draft().pages[0]!.sections[1]!.appearance!.rotation).toBe(60)
})

test('box selection and context-menu cancellation leave geometry unchanged', async ({ page }) => {
  await mockWebsite(page)
  await page.setViewportSize({ width: 1600, height: 1100 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const surface = page.locator('.grid-surface')
  const rect = (await surface.boundingBox())!
  const scale = rect.width / 1080
  await page.mouse.move(rect.x + 23 * 45 * scale, rect.y + 16 * 32 * scale)
  await page.mouse.down()
  await page.mouse.move(rect.x + 5 * 45 * scale, rect.y + 9 * 32 * scale, { steps: 12 })
  await expect(page.locator('.grid-marquee')).toBeVisible()
  await page.mouse.up()
  await expect(page.locator('.grid-selected')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
  const move = page.getByLabel('Select Welcome to Phase 2 widget', { exact: true })
  await move.click({ button: 'right', position: { x: 8, y: 8 } })
  await expect(page.getByRole('menu', { name: 'Widget actions' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu', { name: 'Widget actions' })).toHaveCount(0)
  await expect(move).toBeFocused()
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled()
})

test('non-admin cannot see or open Website Builder', async ({ page }) => {
  const api = await mockWebsite(page)
  await gotoPhase2App(page, '/admin/website', createJobDashboardFixture())
  await expect(page).toHaveURL(/\/jobs$/)
  await expect(page.getByRole('link', { name: 'Website Builder', exact: true })).toHaveCount(0)
  expect(api.actions).toHaveLength(0)
  await page.goto('/website')
  await expect(page).toHaveURL(/\/jobs$/)
  await expect(page.getByTestId('jobs-search')).toBeVisible()
})

test('admins reuse library images for the logo and sections and publish shared footer content', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Site settings', exact: true }).click()
  await page.getByRole('button', { name: 'Choose logo from library', exact: true }).click()
  const library = page.getByRole('dialog', { name: 'Website image library' })
  await expect(library.getByRole('button', { name: 'Use Project photo.webp' })).toBeVisible()
  await library.getByRole('button', { name: 'Load more images' }).click()
  await library.getByLabel('Search loaded images').fill('Company')
  await expect(library.getByRole('button', { name: 'Use Project photo.webp' })).toHaveCount(0)
  await library.getByRole('button', { name: 'Use Company logo.webp' }).click()
  await expect(library).toHaveCount(0)
  await page.getByLabel('Logo description', { exact: true }).fill('Phase 2 logo')
  await openTool(page, 'Widgets')
  await page.getByRole('button', { name: 'Add Footer widget', exact: true }).click()
  await page.getByLabel('Text', { exact: true }).fill('Company office and contact information.')
  await page.getByRole('button', { name: 'Add menu link', exact: true }).click()
  await page.getByLabel('Menu label', { exact: true }).fill('Contact us')
  await page.getByLabel('Menu URL', { exact: true }).fill('mailto:office@example.com')
  await selectCanvasWidget(page, 'Welcome to Phase 2')
  await page.getByRole('button', { name: 'Choose image from library', exact: true }).click()
  await library.getByRole('button', { name: 'Use Project photo.webp' }).click()
  await page.getByLabel('Image description', { exact: true }).fill('Completed project')
  await page.getByRole('button', { name: 'Choose image from library', exact: true }).click()
  await library.getByLabel('Search loaded images').fill('Missing image')
  await expect(library.getByText('No matching loaded images.')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'Choose image from library', exact: true }),
  ).toBeFocused()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(api.draft().branding?.logoId).toBe('logo')
  expect(api.draft().pages[0]?.sections[0]?.imageId).toBe('photo')
  expect(api.actions).not.toContain('uploadImage')
  expect(api.published()).toBeNull()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.goto('/website')
  await expect(page.getByRole('img', { name: 'Phase 2 logo', exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Completed project', exact: true })).toBeVisible()
  await expect(page.getByText('Company office and contact information.')).toBeVisible()
  await expect(
    page
      .getByRole('navigation', { name: 'Footer navigation' })
      .getByRole('link', { name: 'Contact us' }),
  ).toHaveAttribute('href', 'mailto:office@example.com')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
  await page.screenshot({ path: '.security-work/website-branding-mobile.png', fullPage: true })
})

test('signed-out visitors can read published pages without an app session', async ({ page }) => {
  const legacy = structuredClone(initial)
  delete legacy.pages[0]!.chrome
  const api = await mockWebsite(page, true, false, legacy)
  await page.goto('/website')
  await expect(page.getByRole('heading', { name: 'Welcome to Phase 2' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Employee Login', exact: true })).toHaveAttribute(
    'href',
    '/login',
  )
  expect(api.actions).toHaveLength(0)
  await page.goto('/website/does-not-exist')
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible()
})

test('builder fills the workspace and scrolls long content inside each pane', async ({ page }) => {
  await mockWebsite(page, false, true)
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await expect(page.getByRole('heading', { name: 'Section 1', exact: true })).toBeVisible()
  const preview = page.locator('.preview-viewport')
  const main = page.locator('.app-shell__content')
  const assertContained = async () => {
    expect(await main.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1)
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight),
    ).toBeLessThanOrEqual(1)
    const grid = (await page.locator('.builder-grid').boundingBox())!
    const content = (await main.boundingBox())!
    expect(grid.y + grid.height).toBeLessThanOrEqual(content.y + content.height)
    const statusHeight = (await page.locator('.builder-status').boundingBox())?.height ?? 0
    expect(content.y + content.height - grid.y - grid.height - statusHeight).toBeLessThan(10)
    // The editor uses the viewport, without a second app header or large title band.
    expect(grid.y).toBeLessThan(page.viewportSize()!.width <= 600 ? 150 : 80)
    expect(grid.height / page.viewportSize()!.height).toBeGreaterThan(0.78)
  }
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(size)
    await assertContained()
    await preview.evaluate((el) => {
      el.scrollTop = 0
    })
    const toolbarTop = (await page.locator('.preview-toolbar').boundingBox())!.y
    await preview.hover()
    await page.mouse.wheel(0, 600)
    await expect.poll(() => preview.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
    await preview.evaluate((el) => {
      el.scrollTop = el.scrollHeight
    })
    const bottom = (await preview.locator('footer').boundingBox())!
    const bounds = (await preview.boundingBox())!
    expect(bottom.y + bottom.height).toBeLessThanOrEqual(bounds.y + bounds.height)
    expect((await page.locator('.preview-toolbar').boundingBox())!.y).toBe(toolbarTop)
    expect(await main.evaluate((el) => el.scrollTop)).toBe(0)
    await page.locator('.outline-content').evaluate((el) => {
      el.scrollTop = el.scrollHeight
    })
    await expect
      .poll(() => page.locator('.outline-content').evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0)
    await page.locator('.inspector').evaluate((el) => {
      el.scrollTop = el.scrollHeight
    })
    await expect
      .poll(() => page.locator('.inspector').evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0)
  }
  await page.screenshot({ path: '.security-work/website-contained-desktop.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page
    .getByRole('navigation', { name: 'Builder panels' })
    .getByRole('button', { name: 'Preview', exact: true })
    .click()
  await assertContained()
  await preview.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  expect((await preview.locator('footer').boundingBox())!.y).toBeLessThan(844)
  await page.getByRole('button', { name: 'Pages & widgets', exact: true }).click()
  await page.getByRole('button', { name: 'Page settings', exact: true }).click()
  await expect(page.getByLabel('Page title', { exact: true })).toBeVisible()
  await assertContained()
  await page.screenshot({ path: '.security-work/website-contained-mobile.png' })
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  await expect(page.getByRole('link', { name: 'Jobs', exact: true })).toBeVisible()
  await page.locator('.app-shell__sidebar-close').click()
  await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
})

test('save conflicts preserve edits and warn before leaving; editor fits a phone', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Site settings', exact: true }).click()
  await page.getByLabel('Website name', { exact: true }).fill('Keep these edits')
  api.failSave()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Another admin changed')
  await expect(page.getByLabel('Website name', { exact: true })).toHaveValue('Keep these edits')
  await openTool(page, 'Publishing')
  await page.getByRole('button', { name: 'Reload draft', exact: true }).click()
  await page.locator('.builder-confirm[open]').getByRole('button').first().click()
  await expect(page.getByLabel('Website name', { exact: true })).toHaveValue('Keep these edits')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})

test('page CSS templates preview safely, validate, save and publish with responsive styling', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page
    .getByRole('group', { name: 'Editor mode', exact: true })
    .getByRole('button', { name: 'Code', exact: true })
    .click()
  await page.getByRole('button', { name: 'Insert starter template', exact: true }).click()
  const editor = page.getByRole('textbox', { name: 'Page CSS', exact: true })
  await expect(editor).toHaveValue(/widget-title/)
  const css =
    '.widget-title {color: #cc1122;} @media (max-width: 767px) {.widget-title {font-size: 28px;}}'
  await editor.fill(css)
  const heading = page.locator('.website-canvas .widget-title').first()
  await expect(heading).toHaveCSS('color', 'rgb(204, 17, 34)')
  await expect(page.getByRole('heading', { name: 'Website Builder', exact: true })).not.toHaveCSS(
    'color',
    'rgb(204, 17, 34)',
  )
  await editor.fill(css + ' body {color:red;}')
  await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toBeDisabled()
  await expect(heading).toHaveCSS('color', 'rgb(204, 17, 34)')
  await editor.fill(css)
  await page
    .getByRole('group', { name: 'Editor mode', exact: true })
    .getByRole('button', { name: 'Design', exact: true })
    .click()
  await page.getByLabel('mobile layout', { exact: true }).selectOption('flow')
  await page.getByRole('button', { name: 'Mobile', exact: true }).click()
  await expect(heading).toHaveCSS('font-size', '28px')
  await expect(page.locator('.flow-surface')).toHaveCount(1)
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(api.draft().pages[0]!.css).toBe(css)
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.goto('/website')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('.widget-title').first()).toHaveCSS('color', 'rgb(204, 17, 34)')
  await expect(page.locator('.widget-title').first()).toHaveCSS('font-size', '28px')
  await expect(page.locator('.flow-surface')).toHaveCount(1)
  await page.screenshot({ path: '.security-work/website-css-mobile.png', fullPage: true })
})

test('flow containers size to content and device overrides preserve desktop styling', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await page.setViewportSize({ width: 1600, height: 1100 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  const outline = page.getByRole('complementary', { name: 'Website structure' })
  await page.getByLabel('desktop layout', { exact: true }).selectOption('flow')
  await page.getByLabel('mobile layout', { exact: true }).selectOption('flow')
  for (const title of ['Small', 'Large']) {
    await openTool(page, 'Widgets')
    await page.getByRole('button', { name: 'Add Text widget', exact: true }).click()
    await openInspectorFor(page, 'Heading')
    await inspector.getByLabel('Heading', { exact: true }).fill(title)
  }
  await openTool(page, 'Pages')
  await outline
    .getByRole('button', { name: 'Small Text', exact: true })
    .click({ modifiers: ['Shift'] })
  await page.getByRole('button', { name: 'Group in container', exact: true }).click()
  await openInspectorFor(page, 'Heading')
  await inspector.getByLabel('Heading', { exact: true }).fill('Row group')
  await openTool(page, 'Pages')
  await outline.getByRole('button', { name: /Large Text/ }).click()
  await openInspectorFor(page, 'Grow proportion')
  await inspector.getByLabel('Grow proportion', { exact: true }).fill('2')
  await openInspectorFor(page, 'Grow proportion')
  await inspector.getByLabel('Grow proportion', { exact: true }).press('Tab')
  await openInspectorFor(page, 'Text')
  await inspector
    .getByLabel('Text', { exact: true })
    .fill('Long content in this flexible layout. '.repeat(100))
  const children = page.locator('.container-children > .contained-widget')
  const small = (await children.nth(0).boundingBox())!
  const large = (await children.nth(1).boundingBox())!
  expect(large.width / small.width).toBeCloseTo(2, 1)
  expect(large.height).toBeGreaterThan(300)
  expect(
    await children
      .nth(1)
      .locator('> section')
      .evaluate((el) => el.scrollHeight - el.clientHeight),
  ).toBeLessThanOrEqual(1)
  await page.getByRole('button', { name: 'Mobile', exact: true }).click()
  await openInspectorFor(page, 'Heading size (px)')
  await inspector.getByLabel('Heading size (px)', { exact: true }).fill('30')
  await openInspectorFor(page, 'Heading size (px)')
  await inspector.getByLabel('Heading size (px)', { exact: true }).press('Tab')
  await openInspectorFor(page, 'Hide on mobile')
  await inspector.getByLabel('Hide on mobile', { exact: true }).check()
  await expect(children).toHaveCount(1)
  await openInspectorFor(page, 'Hide on mobile')
  await inspector.getByLabel('Hide on mobile', { exact: true }).uncheck()
  await openTool(page, 'Pages')
  await outline.getByRole('button', { name: 'Row group Container', exact: true }).click()
  await openInspectorFor(page, 'Child layout')
  await inspector.getByLabel('Child layout', { exact: true }).selectOption('column')
  await expect(page.locator('.container-children')).toHaveCSS('flex-direction', 'column')
  const mobileChildren = await children.evaluateAll((elements) =>
    elements.map((element) => {
      const frame = element.getBoundingClientRect()
      const content = element.querySelector('section')!.getBoundingClientRect()
      return {
        top: frame.top,
        bottom: frame.bottom,
        height: frame.height,
        contentHeight: content.height,
      }
    }),
  )
  expect(mobileChildren[1]!.top).toBeGreaterThanOrEqual(mobileChildren[0]!.bottom)
  expect(mobileChildren[1]!.height).toBeGreaterThanOrEqual(mobileChildren[1]!.contentHeight - 1)
  await page.getByRole('button', { name: 'Tablet', exact: true }).click()
  await expect(page.locator('.preview-frame')).toHaveCSS('width', '820px')
  await expect(page.locator('.container-children')).toHaveCSS('flex-direction', 'row')
  await page.getByRole('button', { name: 'Desktop', exact: true }).click()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  const saved = api.draft().pages[0]!.sections
  expect(saved.find((s) => s.title === 'Large')!.devices?.mobile?.appearance?.headingSize).toBe(30)
  expect(saved.find((s) => s.title === 'Large')!.appearance?.headingSize).toBeUndefined()
  expect(saved.find((s) => s.title === 'Row group')!.devices?.mobile?.container?.direction).toBe(
    'column',
  )
  await openTool(page, 'Publishing')
  await page.getByRole('button', { name: 'Reload draft', exact: true }).click()
  await page.getByRole('button', { name: 'Mobile', exact: true }).click()
  await openTool(page, 'Pages')
  await outline.getByRole('button', { name: 'Row group Container', exact: true }).click()
  await openInspectorFor(page, 'Ungroup container')
  await page.getByRole('button', { name: 'Reset mobile overrides', exact: true }).click()
  await expect(page.locator('.container-children')).toHaveCSS('flex-direction', 'column')
})

function layerFixture(): WebsiteSite {
  const site = structuredClone(initial)
  const widget = site.pages[0]!.sections[0]!
  const section = (id: string, title: string, z: number, y = 0, parentId?: string) => ({
    ...structuredClone(widget),
    id,
    title,
    type: 'text' as const,
    parentId,
    layout: { x: 0, y, w: 12, h: 8, z },
  })
  site.pages[0]!.sections = [
    section('back', 'Back note', 1),
    {
      ...section('container', 'Group', 2, 16),
      type: 'container',
      container: { direction: 'row', gap: 16 },
    },
    section('inner-a', 'Inner A', 1, 0, 'container'),
    section('inner-b', 'Inner B', 99, 0, 'container'),
    section('far', 'Far note', 3, 80),
    section('front', 'Front note', 4),
    { ...section('hidden', 'Hidden note', 5), hidden: true },
  ]
  return site
}
async function dragLayer(
  page: Page,
  source: string,
  target: string,
  placement: 'before' | 'after' = 'before',
  release = true,
) {
  const panel = page.getByRole('region', { name: 'Page layers', exact: true })
  const grip = panel.getByRole('button', { name: 'Drag ' + source + ' layer', exact: true })
  await grip.scrollIntoViewIfNeeded()
  const start = (await grip.boundingBox())!
  const row = panel
    .getByRole('button', { name: 'Select layer ' + target, exact: true })
    .locator('..')
  const end = (await row.boundingBox())!
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    end.x + end.width / 2,
    placement === 'before' ? end.y + 5 : end.y + end.height - 5,
    { steps: 8 },
  )
  if (release) await page.mouse.up()
}

test('layers list matches hierarchy, reorders by dragging and keyboard, and saves stacking without moving objects', async ({
  page,
}) => {
  const fixture = layerFixture()
  const api = await mockWebsite(page, false, false, fixture)
  await page.setViewportSize({ width: 1600, height: 1100 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Layers', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Page layers', exact: true })
  const order = () =>
    panel
      .locator('[data-layer-id]')
      .evaluateAll((elements) => elements.map((el) => el.getAttribute('data-layer-id')))
  expect(await order()).toEqual([
    'hidden',
    'front',
    'far',
    'container',
    'inner-b',
    'inner-a',
    'back',
  ])
  await dragLayer(page, 'Back note', 'Front note')
  expect(await order()).toEqual([
    'hidden',
    'back',
    'front',
    'far',
    'container',
    'inner-b',
    'inner-a',
  ])
  await expect(page.locator('.grid-surface [data-widget-id="back"]')).toHaveCSS('z-index', '4')
  await expect(page.locator('.grid-surface [data-widget-id="back"]')).toHaveCSS('top', '0px')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  expect(await order()).toEqual([
    'hidden',
    'front',
    'far',
    'container',
    'inner-b',
    'inner-a',
    'back',
  ])
  await panel
    .getByRole('button', { name: 'Select layer Back note', exact: true })
    .press('Alt+ArrowUp')
  expect(await order()).toEqual([
    'hidden',
    'front',
    'far',
    'back',
    'container',
    'inner-b',
    'inner-a',
  ])
  await dragLayer(page, 'Inner A', 'Inner B')
  expect(await order()).toEqual([
    'hidden',
    'front',
    'far',
    'back',
    'container',
    'inner-a',
    'inner-b',
  ])
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  const saved = api.draft().pages[0]!.sections
  expect(saved.map((section) => section.id)).toEqual(
    fixture.pages[0]!.sections.map((section) => section.id),
  )
  for (const entry of saved) {
    const original = fixture.pages[0]!.sections.find((section) => section.id === entry.id)!
    expect({ ...entry.layout, z: 0 }).toEqual({ ...original.layout, z: 0 })
    expect(entry.parentId).toBe(original.parentId)
  }
  await openTool(page, 'Publishing')
  await page.getByRole('button', { name: 'Reload draft', exact: true }).click()
  await openTool(page, 'Layers')
  expect(await order()).toEqual([
    'hidden',
    'front',
    'far',
    'back',
    'container',
    'inner-a',
    'inner-b',
  ])
  await page.screenshot({ path: '.security-work/website-layers-desktop.png' })
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.goto('/website')
  const front = page
    .locator('.widget-frame')
    .filter({ has: page.getByRole('heading', { name: 'Front note', exact: true }) })
  await expect(front).toHaveCSS(
    'z-index',
    String(saved.find((section) => section.id === 'front')!.layout!.z),
  )
})

test('layer drag cancellation and cross-container drops leave the draft intact; double-click reveals objects', async ({
  page,
}) => {
  const api = await mockWebsite(page, false, false, layerFixture())
  await page.setViewportSize({ width: 1600, height: 1100 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Layers', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Page layers', exact: true })
  const order = () =>
    panel
      .locator('[data-layer-id]')
      .evaluateAll((elements) => elements.map((el) => el.getAttribute('data-layer-id')))
  const before = await order()
  await dragLayer(page, 'Back note', 'Front note', 'before', false)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  expect(await order()).toEqual(before)
  await dragLayer(page, 'Inner A', 'Front note')
  expect(await order()).toEqual(before)
  await dragLayer(page, 'Back note', 'Front note', 'before', false)
  await page.mouse.move(1, 1)
  await page.mouse.up()
  expect(await order()).toEqual(before)
  const preview = page.locator('.preview-viewport')
  await preview.evaluate((el) => {
    el.scrollTop = 0
  })
  await panel.getByRole('button', { name: 'Select layer Far note', exact: true }).dblclick()
  await expect(page.locator('.grid-surface [data-widget-id="far"]')).toBeFocused()
  expect(await preview.evaluate((el) => el.scrollTop)).toBeGreaterThan(500)
  const widgetBounds = (await page.locator('.grid-surface [data-widget-id="far"]').boundingBox())!
  const previewBounds = (await preview.boundingBox())!
  expect(widgetBounds.y).toBeGreaterThanOrEqual(previewBounds.y)
  expect(widgetBounds.y).toBeLessThan(previewBounds.y + previewBounds.height)
  expect(await page.locator('.app-shell__content').evaluate((el) => el.scrollTop)).toBe(0)
  await panel.getByRole('button', { name: 'Select layer Inner A', exact: true }).dblclick()
  await expect(page.locator('.grid-surface [data-widget-id="inner-a"]')).toBeFocused()
  await panel.getByRole('button', { name: 'Select layer Hidden note', exact: true }).dblclick()
  await expect(page.getByRole('status')).toContainText('hidden in this preview')
  await expect(page.getByLabel('Heading', { exact: true })).toHaveValue('Hidden note')
  expect(api.actions.filter((action) => action !== 'load')).toHaveLength(0)
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(api.draft().pages[0]!.sections).toEqual(layerFixture().pages[0]!.sections)
})

test('layers can be selected and revealed on phones without closing the list on the first click', async ({
  page,
}) => {
  await mockWebsite(page, false, false, layerFixture())
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Pages & widgets', exact: true }).click()
  await page.getByRole('button', { name: 'Layers', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Page layers', exact: true })
  await panel.getByRole('button', { name: 'Select layer Far note', exact: true }).click()
  await expect(panel).toBeVisible()
  await page.screenshot({ path: '.security-work/website-layers-phone.png' })
  await panel.getByRole('button', { name: 'Select layer Far note', exact: true }).dblclick()
  await expect(page.locator('.preview-scroll')).toBeVisible()
  await expect(page.locator('.grid-surface [data-widget-id="far"]')).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})

test('saved widgets preview privately, copy between pages, rename, undo removal and persist independently', async ({
  page,
}) => {
  const api = await mockWebsite(page, false, false, layerFixture())
  await page.setViewportSize({ width: 1600, height: 1100 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const outline = page.getByRole('complementary', { name: 'Website structure' })
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  await openTool(page, 'Pages')
  await outline.getByRole('button', { name: 'Group Container', exact: true }).click()
  await openTool(page, 'Widgets')
  await outline
    .locator('summary')
    .filter({ hasText: /^Saved widgets/ })
    .click()
  await openTool(page, 'Widgets')
  await outline.getByLabel('Saved widget name', { exact: true }).fill('Project intro')
  await openTool(page, 'Widgets')
  await outline.getByRole('button', { name: 'Save selection to library', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Added Project intro')
  await openTool(page, 'Pages')
  await outline.getByRole('button', { name: /Inner A Text/ }).click()
  await openInspectorFor(page, 'Heading')
  await inspector.getByLabel('Heading', { exact: true }).fill('Changed original')
  await openTool(page, 'Widgets')
  await outline
    .getByRole('button', { name: 'Preview saved widget Project intro', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Saved widget preview', exact: true })
  await expect(dialog.getByRole('heading', { name: 'Inner A', exact: true })).toBeVisible()
  await expect(dialog.locator('.grid-resize,.drag-widget,.edit-section')).toHaveCount(0)
  await page.screenshot({ path: '.security-work/saved-section-desktop.png' })
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(
    outline.getByRole('button', { name: 'Preview saved widget Project intro', exact: true }),
  ).toBeFocused()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  const saved = structuredClone(api.draft().savedSections![0]!)
  expect(saved.sections).toHaveLength(3)
  expect(saved.sections[1]!.parentId).toBe(saved.sections[0]!.id)
  expect(saved.sections[1]!.title).toBe('Inner A')
  expect(api.published()).toBeNull()
  await openTool(page, 'Pages')
  await openTool(page, 'Pages')
  await outline.getByRole('button', { name: '+ Page', exact: true }).click()
  await openInspectorFor(page, 'Page title')
  await inspector.getByLabel('Page title', { exact: true }).fill('Projects')
  await openTool(page, 'Widgets')
  await outline
    .getByRole('button', { name: 'Preview saved widget Project intro', exact: true })
    .click()
  await dialog.getByRole('button', { name: 'Insert on current page', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page.locator('.grid-surface .contained-widget')).toHaveCount(2)
  await openTool(page, 'Pages')
  await outline.getByRole('button', { name: /Inner A Text/ }).click()
  await openInspectorFor(page, 'Heading')
  await inspector.getByLabel('Heading', { exact: true }).fill('Copy heading')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(api.draft().savedSections![0]).toEqual(saved)
  expect(
    api
      .draft()
      .pages[1]!.sections.map((section) => section.id)
      .some((id) => saved.sections.some((section) => section.id === id)),
  ).toBe(false)
  expect(api.draft().pages[0]!.sections.find((section) => section.id === 'inner-a')!.title).toBe(
    'Changed original',
  )
  await openTool(page, 'Widgets')
  await outline
    .getByLabel('Rename saved widget Project intro', { exact: true })
    .fill('Project layout')
  await openTool(page, 'Widgets')
  await outline.getByLabel('Rename saved widget Project intro', { exact: true }).press('Tab')
  await openTool(page, 'Widgets')
  await outline
    .getByRole('button', { name: 'Remove saved widget Project layout', exact: true })
    .click()
  await expect(
    outline.getByRole('button', { name: 'Insert saved widget Project layout', exact: true }),
  ).toHaveCount(0)
  await expect(page.locator('.grid-surface .contained-widget')).toHaveCount(2)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(
    outline.getByRole('button', { name: 'Insert saved widget Project layout', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  await openTool(page, 'Publishing')
  await page.getByRole('button', { name: 'Reload draft', exact: true }).click()
  await openTool(page, 'Widgets')
  await expect(
    outline.getByLabel('Rename saved widget Project layout', { exact: true }),
  ).toHaveValue('Project layout')
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  expect(api.published()!.savedSections).toBeUndefined()
  await page.goto('/website/page-1')
  await expect(page.getByRole('heading', { name: 'Copy heading', exact: true })).toBeVisible()
})

test('saved widget previews load private images and enforce page capacity', async ({ page }) => {
  const fixture = structuredClone(initial)
  const image = {
    ...fixture.pages[0]!.sections[0]!,
    id: 'saved-image',
    type: 'image' as const,
    title: 'Private photo',
    imageId: 'photo',
    alt: 'Reusable project image',
    hidden: true,
    layout: { x: 0, y: 0, w: 8, h: 8, z: 1 },
  }
  fixture.savedSections = [{ id: 'saved', name: 'Private photo', sections: [image] }]
  const api = await mockWebsite(page, false, false, fixture)
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Pages & widgets', exact: true }).click()
  await openTool(page, 'Widgets')
  await page
    .locator('summary')
    .filter({ hasText: /^Saved widgets/ })
    .click()
  await page
    .getByRole('button', { name: 'Preview saved widget Private photo', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Saved widget preview', exact: true })
  await expect(
    dialog.getByRole('img', { name: 'Reusable project image', exact: true }),
  ).toBeVisible()
  expect(api.actions).toContain('getImage')
  await page.screenshot({ path: '.security-work/saved-section-phone.png' })
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  await dialog.getByRole('button', { name: 'Close preview', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Save selection to library', exact: true }),
  ).toBeDisabled()
  fixture.pages[0]!.sections = Array.from({ length: 30 }, (_, index) => ({
    ...fixture.pages[0]!.sections[0]!,
    id: 'full-' + index,
  }))
  await page.unroute('**/websiteBuilder')
  await mockWebsite(page, false, false, fixture)
  await openTool(page, 'Publishing')
  await page.getByRole('button', { name: 'Reload draft', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await page.getByRole('button', { name: 'Pages & widgets', exact: true }).click()
  await openTool(page, 'Widgets')
  await expect(
    page.getByRole('button', { name: 'Insert saved widget Private photo', exact: true }),
  ).toBeDisabled()
})

test('resizing a navbar shifts later rows live and saves one reversible layout change', async ({
  page,
}) => {
  const content = structuredClone(initial)
  content.pages[0]!.sections = [
    { ...newSection('navigation'), id: 'nav', layout: { x: 0, y: 0, w: 24, h: 4, z: 1 } },
    {
      ...newSection('text'),
      id: 'left',
      title: 'Left content',
      layout: { x: 0, y: 6, w: 12, h: 4, z: 2 },
    },
    {
      ...newSection('text'),
      id: 'right',
      title: 'Right content',
      layout: { x: 12, y: 6, w: 12, h: 4, z: 3 },
    },
    {
      ...newSection('footer'),
      id: 'foot',
      title: 'Page footer',
      layout: { x: 0, y: 12, w: 24, h: 4, z: 4 },
    },
  ]
  const api = await mockWebsite(page, false, false, content)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await selectCanvasWidget(page, 'Navigation')
  const canvas = page.locator('.preview-frame')
  const left = canvas.locator('[data-widget-id="left"]')
  const right = canvas.locator('[data-widget-id="right"]')
  const footer = canvas.locator('[data-widget-id="foot"]')
  const handle = page.getByRole('button', { name: 'Resize Navigation from bottom', exact: true })
  const box = (await handle.boundingBox())!
  const scale = await canvas
    .locator('.grid-surface')
    .evaluate((el) => el.getBoundingClientRect().width / (el as HTMLElement).offsetWidth)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 64 * scale, { steps: 8 })
  await expect.poll(() => left.evaluate((el) => (el as HTMLElement).style.top)).toBe('128px')
  await expect.poll(() => right.evaluate((el) => (el as HTMLElement).style.top)).toBe('128px')
  await expect.poll(() => footer.evaluate((el) => (el as HTMLElement).style.top)).toBe('320px')
  await page.mouse.up()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect.poll(() => left.evaluate((el) => (el as HTMLElement).style.top)).toBe('192px')
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect.poll(() => left.evaluate((el) => (el as HTMLElement).style.top)).toBe('128px')
  const next = (await handle.boundingBox())!
  await page.mouse.move(next.x + next.width / 2, next.y + next.height / 2)
  await page.mouse.down()
  await page.mouse.move(next.x + next.width / 2, next.y + next.height / 2 + 64 * scale, {
    steps: 8,
  })
  await expect.poll(() => left.evaluate((el) => (el as HTMLElement).style.top)).toBe('192px')
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect.poll(() => left.evaluate((el) => (el as HTMLElement).style.top)).toBe('128px')
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  await inspector.getByRole('tab', { name: 'Layout', exact: true }).click()
  await inspector.getByLabel('Widget h', { exact: true }).fill('6')
  await inspector.getByLabel('Widget h', { exact: true }).press('Tab')
  await expect.poll(() => left.evaluate((el) => (el as HTMLElement).style.top)).toBe('256px')
  await page
    .getByRole('group', { name: 'Widget actions' })
    .getByRole('button', { name: 'Resize widget', exact: true })
    .press('ArrowDown')
  await expect.poll(() => left.evaluate((el) => (el as HTMLElement).style.top)).toBe('288px')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(api.draft().pages[0]!.sections.map((section) => section.layout!.y)).toEqual([0, 9, 9, 15])
  expect(api.draft().pages[0]!.sections.map((section) => section.layout!.x)).toEqual([0, 0, 12, 0])
  await page.reload()
  await expect.poll(() => left.evaluate((el) => (el as HTMLElement).style.top)).toBe('288px')
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.goto('/website')
  await expect
    .poll(() =>
      page
        .locator('.widget-frame')
        .nth(1)
        .evaluate((el) => (el as HTMLElement).style.top),
    )
    .toBe('288px')
})

test('grid navbar margins stay inside its resized frame', async ({ page }) => {
  const content = structuredClone(initial)
  content.pages[0]!.sections = [
    { ...newSection('navigation'), id: 'nav', layout: { x: 0, y: 0, w: 24, h: 4, z: 1 } },
  ]
  const api = await mockWebsite(page, false, false, content)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await selectCanvasWidget(page, 'Navigation')
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  await inspector.getByRole('tab', { name: 'Appearance', exact: true }).click()
  for (const label of ['Padding (px)', 'Margin (px)']) {
    await inspector.getByLabel(label, { exact: true }).fill('4')
    await inspector.getByLabel(label, { exact: true }).press('Tab')
  }
  const resize = page
    .getByRole('group', { name: 'Widget actions' })
    .getByRole('button', { name: 'Resize widget', exact: true })
  await resize.press('ArrowUp')
  await resize.press('ArrowUp')
  const frame = page.locator('.preview-frame [data-widget-id="nav"]')
  await expect.poll(() => frame.evaluate((el) => (el as HTMLElement).offsetHeight)).toBe(64)
  await expect
    .poll(() =>
      frame
        .locator('.section-navigation')
        .evaluate((el) => parseFloat(getComputedStyle(el).height)),
    )
    .toBeCloseTo(56, 0)
  await expect
    .poll(() =>
      frame.locator('.section-navigation').evaluate((el) => parseFloat(getComputedStyle(el).width)),
    )
    .toBeCloseTo(1072, 0)
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(api.draft().pages[0]!.sections[0]!.layout).toMatchObject({ x: 0, y: 0, w: 24, h: 2 })
})

test('shared navigation supports spacing controls and drag height with undo, cancel and publication', async ({
  page,
}) => {
  const content = structuredClone(initial)
  content.pages[0]!.useSiteLayout = true
  content.branding = { logoId: 'logo', logoAlt: 'Company logo', footerText: '', footerLinks: [] }
  const api = await mockWebsite(page, false, false, content)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Create shared layout', exact: true }).click()
  await selectCanvasWidget(page, 'Navigation')
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  await expect(inspector.getByLabel('Selection scope', { exact: true })).toContainText(
    'Shared layout',
  )
  const nav = page.locator('.preview-frame .section-navigation')
  const frame = nav.locator('..')
  await expect(nav.getByText('Add text', { exact: true })).toHaveCount(0)
  await inspector.getByRole('tab', { name: 'Appearance', exact: true }).click()
  await inspector.getByLabel('Padding (px)', { exact: true }).fill('8')
  await inspector.getByLabel('Padding (px)', { exact: true }).press('Tab')
  await inspector.getByText('Individual spacing sides', { exact: true }).click()
  for (const [label, value] of [
    ['Padding top (px)', '4'],
    ['Padding bottom (px)', '4'],
    ['Margin left (px)', '12'],
    ['Margin bottom (px)', '10'],
  ]) {
    await inspector.getByLabel(label!, { exact: true }).fill(value!)
    await inspector.getByLabel(label!, { exact: true }).press('Tab')
  }
  await expect(nav).toHaveCSS('padding-top', '4px')
  await expect(nav).toHaveCSS('padding-right', '8px')
  await expect
    .poll(() => nav.evaluate((el) => parseFloat(getComputedStyle(el).marginLeft)))
    .toBeCloseTo(12, 1)
  await inspector.getByRole('tab', { name: 'Layout', exact: true }).click()
  await inspector.getByLabel('Height (px)', { exact: true }).fill('140')
  await inspector.getByLabel('Height (px)', { exact: true }).press('Tab')
  await expect
    .poll(() => frame.evaluate((el) => parseFloat((el as HTMLElement).style.height)))
    .toBe(140)
  const handle = page.getByRole('button', { name: 'Resize Navigation height', exact: true })
  const rect = (await handle.boundingBox())!
  const scale = await frame.evaluate(
    (el) => el.getBoundingClientRect().height / (el as HTMLElement).offsetHeight,
  )
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2)
  await page.mouse.down()
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2 - 76 * scale, {
    steps: 8,
  })
  await page.mouse.up()
  // Pointer coordinates round differently in scaled Firefox/WebKit canvases.
  await expect
    .poll(() => frame.evaluate((el) => Math.abs(parseFloat((el as HTMLElement).style.height) - 64)))
    .toBeLessThanOrEqual(1)
  const draggedHeight = await frame.evaluate((el) => parseFloat((el as HTMLElement).style.height))
  await expect
    .poll(() => nav.evaluate((el) => (el as HTMLElement).offsetHeight))
    .toBe(draggedHeight - 10)
  await expect
    .poll(() => nav.locator('.brand-logo').evaluate((el) => (el as HTMLElement).offsetHeight))
    .toBeLessThan(48)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect
    .poll(() => frame.evaluate((el) => parseFloat((el as HTMLElement).style.height)))
    .toBe(140)
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect
    .poll(() => frame.evaluate((el) => parseFloat((el as HTMLElement).style.height)))
    .toBe(draggedHeight)
  const next = (await handle.boundingBox())!
  await page.mouse.move(next.x + next.width / 2, next.y + next.height / 2)
  await page.mouse.down()
  await page.mouse.move(next.x + next.width / 2, next.y + next.height / 2 + 30, { steps: 4 })
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect
    .poll(() => frame.evaluate((el) => parseFloat((el as HTMLElement).style.height)))
    .toBe(draggedHeight)
  await page
    .getByRole('group', { name: 'Widget actions' })
    .getByRole('button', { name: 'Resize widget', exact: true })
    .press('ArrowDown')
  await expect
    .poll(() => frame.evaluate((el) => parseFloat((el as HTMLElement).style.height)))
    .toBe(draggedHeight + 1)
  await page.getByRole('button', { name: 'Mobile', exact: true }).click()
  await inspector.getByLabel('Height (px)', { exact: true }).fill('96')
  await inspector.getByLabel('Height (px)', { exact: true }).press('Tab')
  await expect
    .poll(() => frame.evaluate((el) => parseFloat((el as HTMLElement).style.height)))
    .toBe(96)
  await page.getByRole('button', { name: 'Desktop', exact: true }).click()
  await expect
    .poll(() => frame.evaluate((el) => parseFloat((el as HTMLElement).style.height)))
    .toBe(draggedHeight + 1)
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(api.draft().sharedLayout!.sections[0]!.sizing?.height).toBe(draggedHeight + 1)
  expect(api.draft().sharedLayout!.sections[0]!.devices?.mobile?.sizing).toEqual({ height: 96 })
  expect(api.draft().sharedLayout!.sections[0]!.appearance).toMatchObject({
    padding: 8,
    paddingTop: 4,
    paddingBottom: 4,
    marginLeft: 12,
    marginBottom: 10,
  })
  await page.reload()
  await page.getByRole('button', { name: 'Site layout', exact: true }).click()
  await expect
    .poll(() => frame.evaluate((el) => parseFloat((el as HTMLElement).style.height)))
    .toBe(draggedHeight + 1)
  await page.screenshot({ path: '.security-work/navbar-spacing.png' })
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.goto('/website')
  await expect
    .poll(() =>
      page.locator('.section-navigation').evaluate((el) => (el as HTMLElement).offsetHeight),
    )
    .toBe(draggedHeight - 9)
  await expect(page.locator('.section-navigation')).toHaveCSS('margin-left', '12px')
})

test('buttons and individual cards edit inline, keep their own destinations and survive publication', async ({
  page,
}) => {
  const content = structuredClone(initial)
  const button = {
    ...newSection('button'),
    id: 'button',
    linkLabel: 'Contact us',
    linkUrl: '/website',
  }
  const cards = {
    ...newSection('cards'),
    id: 'cards',
    title: 'Our work',
    items: [
      { ...newItem(), id: 'first', title: 'First project', text: 'Keep this description' },
      {
        ...newItem(),
        id: 'second',
        title: 'Second project',
        text: 'Change this description',
        linkLabel: 'Read more',
        linkUrl: '/website',
      },
    ],
  }
  content.pages[0]!.sections = [button, cards]
  const api = await mockWebsite(page, false, false, content)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const canvas = page.locator('.preview-frame')
  const toolbar = page.getByRole('group', { name: 'Text formatting' })
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  const label = page.getByRole('textbox', { name: 'Edit button label on page' })
  await canvas.getByText('Contact us', { exact: true }).dblclick()
  await expect(label).toBeFocused()
  await label.press(await shortcut(page, 'a'))
  await label.press('Backspace')
  await label.pressSequentially('Talk to us')
  await label.press(await shortcut(page, 'a'))
  await toolbar.getByRole('button', { name: 'Bold', exact: true }).click()
  await toolbar.getByRole('button', { name: 'Edit link destination', exact: true }).click()
  const standaloneUrl = inspector.locator('[data-item-id="button"] [data-link-url]')
  await expect(standaloneUrl).toBeFocused()
  await standaloneUrl.fill('mailto:office@example.com')
  await canvas.getByText('Second project', { exact: true }).dblclick()
  const heading = page.getByRole('textbox', { name: 'Edit heading on page' })
  await expect(heading).toBeFocused()
  await heading.press(await shortcut(page, 'a'))
  await heading.press('Backspace')
  await heading.pressSequentially('Featured project')
  await heading.press('Escape')
  await expect(page.getByRole('navigation', { name: 'Selection path' })).toContainText(
    'Featured project',
  )
  await expect(inspector.locator('[data-item-id="first"]')).toBeHidden()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(canvas.getByRole('heading', { name: 'Second project', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(canvas.getByRole('heading', { name: 'Featured project', exact: true })).toBeVisible()
  await canvas.getByText('Change this description', { exact: true }).dblclick()
  const body = page.getByRole('textbox', { name: 'Edit text on page' })
  await expect(body).toBeFocused()
  await body.press(await shortcut(page, 'a'))
  await body.press('Backspace')
  await body.pressSequentially('A new project description')
  await body.press('Escape')
  await canvas.getByText('Read more', { exact: true }).dblclick()
  await expect(label).toBeFocused()
  await label.press(await shortcut(page, 'a'))
  await label.press('Backspace')
  await expect(label).toBeFocused()
  await label.press(await shortcut(page, 'a'))
  await label.press('Backspace')
  await label.pressSequentially('View project')
  await label.press(await shortcut(page, 'a'))
  await toolbar.getByRole('button', { name: 'Italic', exact: true }).click()
  await toolbar.getByRole('button', { name: 'Edit link destination', exact: true }).click()
  const itemUrl = inspector.locator('[data-item-id="second"] [data-link-url]')
  await expect(itemUrl).toBeFocused()
  await itemUrl.fill('https://example.com/project')
  await page.screenshot({ path: '.security-work/individual-card-editor.png' })
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  const saved = api.draft().pages[0]!.sections
  expect(saved[0]!.linkUrl).toBe('mailto:office@example.com')
  expect(saved[1]!.title).toBe('Our work')
  expect(saved[1]!.items[0]).toEqual(cards.items[0])
  expect(saved[1]!.items[1]!.title).toBe('Featured project')
  expect(saved[1]!.items[1]!.text).toBe('A new project description')
  await page.reload()
  await expect(canvas.locator('[data-widget-id="button"] strong')).toHaveText('Talk to us')
  await expect(canvas.locator('[data-widget-id="cards"] em')).toHaveText('View project')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Preview', exact: true }).click()
  await canvas.getByText('View project', { exact: true }).dblclick()
  await expect(label).toBeFocused()
  await toolbar.getByRole('button', { name: 'Edit link destination', exact: true }).click()
  await expect(itemUrl).toBeFocused()
  await expect(itemUrl).toHaveValue('https://example.com/project')
  await expect(itemUrl).toBeInViewport({ ratio: 1 })
  await page.screenshot({ path: '.security-work/individual-card-editor-phone.png' })
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.goto('/website')
  await expect(page.getByRole('link', { name: 'Talk to us', exact: true })).toHaveAttribute(
    'href',
    'mailto:office@example.com',
  )
  await expect(page.getByRole('link', { name: 'View project', exact: true })).toHaveAttribute(
    'href',
    'https://example.com/project',
  )
  await expect(page.locator('[contenteditable], a a')).toHaveCount(0)
})

test('staff, testimonial and list text use the selected item in both editing modes', async ({
  page,
}) => {
  const content = structuredClone(initial)
  content.pages[0]!.sections = (['team', 'testimonials', 'list'] as const).map((type) => ({
    ...newSection(type),
    id: type,
    title: `${type} widget`,
    items: [
      { ...newItem(), id: 'shared-id', title: `${type} person`, text: `${type} description` },
    ],
  }))
  const api = await mockWebsite(page, false, false, content)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const canvas = page.locator('.preview-frame')
  const editor = page.getByRole('textbox', { name: 'Edit text on page' })
  for (const [index, type] of ['team', 'testimonials', 'list'].entries()) {
    await page
      .getByRole('button', { name: ['Design', 'Content', 'Content'][index], exact: true })
      .click()
    await canvas
      .getByText(`${type} description`, { exact: true })
      .click({ clickCount: [2, 1, 1][index] })
    await expect(editor).toBeFocused()
    await editor.press(await shortcut(page, 'a'))
    await editor.press('Backspace')
    await editor.pressSequentially(`Updated ${type}`)
    await editor.press('Escape')
  }
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  for (const section of api.draft().pages[0]!.sections) {
    expect(section.items[0]!.text).toBe(`Updated ${section.type}`)
    expect(section.title).toBe(`${section.type} widget`)
  }
})

test('navbar links edit inline including page, login and dropdown labels without changing destinations', async ({
  page,
}) => {
  const content = structuredClone(initial)
  const nav = { ...newSection('navigation'), id: 'nav' }
  nav.navigation!.showLogin = true
  nav.navigation!.links = [
    {
      id: 'home',
      label: 'Resources',
      url: '',
      children: [{ id: 'home', label: 'Contact office', url: 'mailto:office@example.com' }],
    },
  ]
  content.pages[0]!.sections.unshift(nav)
  const api = await mockWebsite(page, false, false, content)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const menu = page.locator('.preview-frame [data-widget-id="nav"] .page-navigation')
  const editor = page.getByRole('textbox', { name: 'Edit menu label on page' })
  const toolbar = page.getByRole('group', { name: 'Text formatting' })
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  await menu.getByText('Home', { exact: true }).dblclick()
  await expect(editor).toBeFocused()
  await editor.press(await shortcut(page, 'a'))
  await editor.press('Backspace')
  await editor.pressSequentially('Welcome')
  await editor.press(await shortcut(page, 'a'))
  await toolbar.getByRole('button', { name: 'Bold', exact: true }).click()
  await toolbar.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(menu.locator('strong')).toHaveText('Welcome')
  await menu.getByText('Employee Login', { exact: true }).dblclick()
  await expect(editor).toBeFocused()
  await editor.press(await shortcut(page, 'a'))
  await editor.press('Backspace')
  await editor.pressSequentially('Team login')
  await menu.getByText('Resources', { exact: true }).click()
  await expect(editor).toBeFocused()
  await expect(editor).toHaveText('Resources')
  await editor.press(await shortcut(page, 'a'))
  await editor.press('Backspace')
  await editor.pressSequentially('Company')
  await editor.press('Escape')
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  await menu.getByRole('button', { name: 'Open Company submenu' }).click()
  await expect(editor).toHaveCount(0)
  await menu.getByRole('button', { name: 'Close Company submenu' }).press('Escape')
  await expect(menu.getByRole('button', { name: 'Open Company submenu' })).toBeFocused()
  await menu.getByRole('button', { name: 'Open Company submenu' }).press('Enter')
  await menu.getByText('Contact office', { exact: true }).click()
  await expect(editor).toBeFocused()
  await expect(page.locator('[contenteditable]')).toHaveCount(1)
  await editor.press(await shortcut(page, 'a'))
  await editor.press('Backspace')
  await editor.pressSequentially('Talk to us')
  await editor.press(await shortcut(page, 'a'))
  await toolbar.getByRole('button', { name: 'Italic', exact: true }).click()
  await toolbar.getByRole('button', { name: 'Edit link destination', exact: true }).click()
  await expect(inspector.getByLabel('Dropdown label', { exact: true })).toBeFocused()
  await expect(inspector.getByLabel('Dropdown URL', { exact: true })).toHaveValue(
    'mailto:office@example.com',
  )
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await menu.getByRole('button', { name: 'Open Company submenu' }).click()
  await expect(menu.getByText('Contact office', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(menu.locator('em')).toHaveText('Talk to us')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(api.draft().pages[0]!.title).toBe('Home')
  expect(api.draft().pages[0]!.slug).toBe('home')
  expect(api.draft().pages[0]!.sections[0]!.navigation!.links[0]!.label).toBe('Company')
  await page.reload()
  await expect(menu.getByText('Welcome', { exact: true })).toBeVisible()
  await expect(menu.getByText('Team login', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.goto('/website')
  await expect(page.getByRole('link', { name: 'Welcome', exact: true })).toHaveAttribute(
    'href',
    '/website',
  )
  await expect(page.getByRole('link', { name: 'Team login', exact: true })).toHaveAttribute(
    'href',
    '/login',
  )
  await page.getByText('Company', { exact: true }).click()
  await expect(page.getByRole('link', { name: 'Talk to us', exact: true })).toHaveAttribute(
    'href',
    'mailto:office@example.com',
  )
  await expect(page.locator('a a, [contenteditable]')).toHaveCount(0)
})

test('navigation and footer share inline text, image and menu editing with other widgets', async ({
  page,
}) => {
  const content = structuredClone(initial)
  content.branding = { logoId: 'logo', logoAlt: 'Company logo', footerText: '', footerLinks: [] }
  const navigation = { ...newSection('navigation'), id: 'nav' }
  navigation.appearance = { headingSize: 32, fontFamily: 'serif' }
  navigation.navigation!.links = [
    { id: 'contact', label: 'Contact', url: 'mailto:office@example.com' },
  ]
  const footer = { ...newSection('footer'), id: 'footer', text: 'Original footer' }
  content.pages[0]!.sections = [navigation, content.pages[0]!.sections[0]!, footer]
  const api = await mockWebsite(page, false, false, content)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const canvas = page.locator('.preview-frame')
  const nav = canvas.locator('[data-widget-id="nav"]')
  await expect(nav.locator('.website-brand .widget-title')).toHaveCSS('font-size', '32px')
  const foot = canvas.locator('[data-widget-id="footer"]')
  const bar = page.getByRole('group', { name: 'Text formatting' })
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  await nav.locator('.website-brand .widget-title').click()
  const heading = page.getByRole('textbox', { name: 'Edit heading on page' })
  await expect(heading).toBeFocused()
  await heading.press(await shortcut(page, 'a'))
  await heading.press('Backspace')
  await heading.pressSequentially('Phase 2 Construction')
  await heading.press(await shortcut(page, 'a'))
  await bar.getByRole('button', { name: 'Bold', exact: true }).click()
  await bar.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(nav.locator('.website-brand strong')).toHaveText('Phase 2 Construction')
  await expect(foot.locator('.website-brand')).toHaveText('Phase 2')
  await nav.getByText('Contact', { exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Edit menu label on page' })).toBeFocused()
  await bar.getByRole('button', { name: 'Edit link destination', exact: true }).click()
  await expect(inspector.getByLabel('Menu label', { exact: true })).toBeFocused()
  await inspector.getByLabel('Menu label', { exact: true }).fill('Contact office')
  await expect(inspector.getByLabel('Menu label', { exact: true })).toHaveCSS(
    'background-color',
    'rgb(16, 35, 49)',
  )
  await nav.getByRole('button', { name: 'Edit image: Company logo', exact: true }).dblclick()
  const image = page.getByRole('region', { name: 'Image editor', exact: true })
  await image.getByLabel('Image description', { exact: true }).fill('Navigation logo')
  await image.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  await foot.getByText('Original footer', { exact: true }).click()
  const body = page.getByRole('textbox', { name: 'Edit text on page' })
  await expect(body).toBeFocused()
  await body.press(await shortcut(page, 'a'))
  await body.press('Backspace')
  await body.pressSequentially('Built on experience')
  await body.press(await shortcut(page, 'a'))
  await bar.getByRole('button', { name: 'Italic', exact: true }).click()
  await bar.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(foot.locator('em')).toHaveText('Built on experience')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(api.draft().branding?.logoAlt).toBe('Company logo')
  expect(api.draft().pages[0]!.sections[0]!.alt).toBe('Navigation logo')
  expect(api.draft().pages[0]!.sections[0]!.navigation?.brandText).toBe('Phase 2 Construction')
  await page.reload()
  await expect(nav.locator('.website-brand strong')).toHaveText('Phase 2 Construction')
  await expect(foot.locator('em')).toHaveText('Built on experience')
  await nav.locator('.website-brand .widget-title').click()
  await bar.getByRole('button', { name: 'Done', exact: true }).click()
  await inspector.getByRole('button', { name: 'Use website name', exact: true }).click()
  await expect(nav.locator('.website-brand')).toHaveText('Phase 2')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(nav.locator('.website-brand strong')).toHaveText('Phase 2 Construction')
  await page.screenshot({ path: '.security-work/navigation-editor-desktop.png' })
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.goto('/website')
  await expect(page.locator('header .website-brand strong')).toHaveText('Phase 2 Construction')
  await expect(page.locator('footer em')).toHaveText('Built on experience')
  await expect(page.locator('[contenteditable]')).toHaveCount(0)
  await expect(
    page.locator('header').getByRole('link', { name: 'Contact office' }),
  ).toHaveAttribute('href', 'mailto:office@example.com')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('header').getByRole('button', { name: 'Open navigation menu' }).click()
  await expect(page.locator('header').getByRole('link', { name: 'Contact office' })).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390)
  await page.screenshot({ path: '.security-work/navigation-public-phone.png' })
})

test('blank pages use movable optional navigation and footer widgets with dropdown menus', async ({
  page,
}) => {
  const content = structuredClone(initial)
  content.pages[0]!.sections = []
  const api = await mockWebsite(page, false, false, content)
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const preview = page.locator('.preview-scroll')
  await expect(preview.locator('header, footer')).toHaveCount(0)
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled()
  await openTool(page, 'Widgets')
  await page.getByRole('button', { name: 'Add Navigation widget', exact: true }).click()
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  await inspector.getByLabel('Include employee login').check()
  await inspector.getByRole('button', { name: 'Add menu link', exact: true }).click()
  await openInspectorFor(page, 'Menu label')
  await inspector.getByLabel('Menu label', { exact: true }).fill('Resources')
  await inspector.getByRole('button', { name: 'Add dropdown link', exact: true }).click()
  await openInspectorFor(page, 'Dropdown label')
  await inspector.getByLabel('Dropdown label', { exact: true }).fill('Contact office')
  await openInspectorFor(page, 'Dropdown URL')
  await inspector.getByLabel('Dropdown URL', { exact: true }).fill('mailto:office@example.com')
  await openInspectorFor(page, 'Widget y')
  await inspector.getByLabel('Widget y', { exact: true }).fill('2')
  await openInspectorFor(page, 'Widget y')
  await inspector.getByLabel('Widget y', { exact: true }).press('Tab')
  await openTool(page, 'Widgets')
  await page.getByRole('button', { name: 'Add Footer widget', exact: true }).click()
  await openInspectorFor(page, 'Text')
  await inspector.getByLabel('Text', { exact: true }).fill('Our company footer')
  await openInspectorFor(page, 'Hide widget')
  await inspector.getByLabel('Hide widget', { exact: true }).check()
  await expect(preview.locator('footer')).toHaveCount(0)
  await openInspectorFor(page, 'Hide widget')
  await inspector.getByLabel('Hide widget', { exact: true }).uncheck()
  await expect(preview.locator('footer')).toHaveCount(1)
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(api.draft().pages[0]!.chrome).toBe('widgets')
  expect(api.draft().pages[0]!.sections[0]!.layout!.y).toBe(2)
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.goto('/website')
  await expect(page.locator('header')).toHaveCount(1)
  await expect(page.locator('footer')).toHaveCount(1)
  await page.getByText('Resources', { exact: true }).click()
  await expect(page.getByRole('link', { name: 'Contact office', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Employee Login', exact: true })).toHaveAttribute(
    'href',
    '/login',
  )
})

test('formatted content, image effects and locks persist while revision restore stays private', async ({
  page,
}) => {
  const api = await mockWebsite(page, true)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await selectCanvasWidget(page, 'Welcome to Phase 2')
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  await openInspectorFor(page, 'Formatted text')
  await inspector.getByLabel('Formatted text', { exact: true }).check()
  const text = inspector.getByLabel('Text', { exact: true })
  await text.fill('Important')
  await text.selectText()
  await inspector.getByRole('button', { name: 'Bold', exact: true }).click()
  await expect(text).toHaveValue('**Important**')
  await text.fill(
    '**Important** and *emphasis*\n## Details\n- One\n- Two\n[Home](/website)\n<script>window.contentInjected = true</script>',
  )
  const hero = page.getByLabel('Select Welcome to Phase 2 widget', { exact: true })
  await expect(hero.locator('strong')).toHaveText('Important')
  await expect(hero.locator('li')).toHaveCount(2)
  await page.getByRole('button', { name: 'Choose image from library', exact: true }).click()
  await page.getByRole('button', { name: 'Use Project photo.webp', exact: true }).click()
  await openInspectorFor(page, 'Image description')
  await inspector.getByLabel('Image description', { exact: true }).fill('Project image')
  await inspector.getByText('Image crop and effects', { exact: true }).click()
  await openInspectorFor(page, 'Image caption')
  await inspector.getByLabel('Image caption', { exact: true }).fill('Completed work')
  await inspector.getByText('Image overlay and gradient', { exact: true }).click()
  for (const [label, value] of [
    ['Horizontal focal point', '25'],
    ['Vertical focal point', '75'],
    ['Crop zoom', '1.5'],
    ['Overlay opacity', '30'],
  ]) {
    await openInspectorFor(page, label!)
    await inspector.getByLabel(label!, { exact: true }).fill(value!)
  }
  await openInspectorFor(page, 'Lock position')
  const lock = inspector.getByLabel('Lock position, size and rotation', { exact: true })
  await lock.check()
  await expect(inspector.getByLabel('Widget x', { exact: true })).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Rotate Welcome to Phase 2', exact: true }),
  ).toHaveCount(0)
  await hero.focus()
  await page.keyboard.press('ArrowRight')
  await expect(inspector.getByLabel('Widget x', { exact: true })).toHaveValue('0')
  await lock.uncheck()
  await hero.focus()
  await page.keyboard.press('ArrowRight')
  await expect(inspector.getByLabel('Widget x', { exact: true })).toHaveValue('1')
  await lock.check()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(api.draft().pages[0]!.sections[0]).toMatchObject({
    locked: true,
    textFormat: 'markdown',
    imageSettings: {
      focusX: 25,
      focusY: 75,
      zoom: 1.5,
      caption: 'Completed work',
      overlayOpacity: 30,
    },
  })
  await openInspectorFor(page, 'Heading')
  await inspector.getByLabel('Heading', { exact: true }).fill('Newer draft title')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  await openTool(page, 'Publishing')
  await page.getByText('Change history', { exact: true }).click()
  await page.getByRole('button', { name: 'Restore draft version 1', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Saved version restored')
  expect(api.draft().pages[0]!.sections[0]!.title).toBe('Welcome to Phase 2')
  expect(api.published()!.pages[0]!.sections[0]!.textFormat).toBeUndefined()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.goto('/website')
  await expect(page.locator('strong')).toHaveText('Important')
  await expect(page.getByText('Completed work', { exact: true })).toBeVisible()
  const image = page.getByRole('img', { name: 'Project image', exact: true })
  await expect(image).toHaveCSS('object-position', '25% 75%')
  await expect(image).toHaveCSS('transform', 'matrix(1.5, 0, 0, 1.5, 0, 0)')
  await expect(page.locator('.media-overlay')).toHaveCSS('opacity', '0.3')
  expect(await page.evaluate(() => 'contentInjected' in window)).toBe(false)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(image).toBeVisible()
  expect((await image.boundingBox())!.height).toBeGreaterThan(20)
})

test('legacy header and footer become editable widgets and deleting them stays deleted', async ({
  page,
}) => {
  const content = structuredClone(initial)
  delete content.pages[0]!.chrome
  content.branding = { logoId: '', logoAlt: '', footerText: 'Legacy footer', footerLinks: [] }
  const api = await mockWebsite(page, true, false, content)
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await expect(page.locator('.preview-scroll header')).toHaveCount(1)
  await expect(page.locator('.preview-scroll footer')).toHaveCount(1)
  await selectCanvasWidget(page, 'Navigation')
  await page.getByRole('button', { name: 'Remove widget', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.locator('.preview-scroll header')).toHaveCount(0)
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  await openTool(page, 'Publishing')
  await page.getByRole('button', { name: 'Reload draft', exact: true }).click()
  await expect(page.locator('.preview-scroll header')).toHaveCount(0)
  expect(api.draft().pages[0]!.chrome).toBe('widgets')
  expect(api.draft().pages[0]!.sections.map((section) => section.type)).toEqual(['hero', 'footer'])
  expect(api.published()!.pages[0]!.chrome).toBeUndefined()
})

test('custom visual designs update linked placements and preserve local settings and detached copies', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await selectCanvasWidget(page, 'Welcome to Phase 2')
  await openTool(page, 'Widgets')
  await page.getByLabel('New custom widget name', { exact: true }).fill('Company card')
  await page.getByRole('button', { name: 'Create widget from selection', exact: true }).click()
  await openTool(page, 'Widgets')
  await page.getByRole('button', { name: 'Edit custom widget Company card', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Custom widget editor' })
  await editor.getByLabel('Expose property', { exact: true }).selectOption('title')
  await editor.getByRole('button', { name: 'Add editable setting', exact: true }).click()
  await editor.getByLabel('Setting key', { exact: true }).fill('heading')
  await editor.getByLabel('Setting label', { exact: true }).fill('Card heading')
  await editor.getByLabel('Setting default', { exact: true }).fill('Shared heading')
  await editor.getByRole('button', { name: 'Apply widget changes', exact: true }).click()
  await openTool(page, 'Widgets')
  await page.getByRole('button', { name: 'Add linked Company card', exact: true }).click()
  const settings = page.getByRole('article', { name: 'Selected custom widget settings' })
  await settings.getByLabel('Card heading', { exact: true }).fill('First placement')
  await openTool(page, 'Widgets')
  await page.getByRole('button', { name: 'Add linked Company card', exact: true }).click()
  await openTool(page, 'Widgets')
  await page.getByRole('button', { name: 'Add independent Company card', exact: true }).click()
  await openTool(page, 'Widgets')
  await page.getByRole('button', { name: 'Edit custom widget Company card', exact: true }).click()
  await editor.getByLabel('Setting default', { exact: true }).fill('Updated default')
  await editor.getByRole('button', { name: 'Apply widget changes', exact: true }).click()
  const preview = page.locator('.preview-scroll')
  await expect(preview.getByRole('heading', { name: 'First placement', exact: true })).toHaveCount(
    1,
  )
  await expect(preview.getByRole('heading', { name: 'Updated default', exact: true })).toHaveCount(
    1,
  )
  await expect(preview.getByRole('heading', { name: 'Shared heading', exact: true })).toHaveCount(1)
  await selectCanvasWidget(page, 'Company card')
  await page.getByRole('button', { name: 'Detach widget', exact: true }).click()
  await expect(
    settings.getByText('Independent copy. Changes apply only to this widget.', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  const widgets = api.draft().pages[0]!.sections.filter((section) => section.custom)
  expect(widgets[0]!.custom!.inline!.fields[0]!.defaultValue).toBe('First placement')
  expect(widgets[1]!.custom!.definitionId).toBe(api.draft().customWidgets![0]!.id)
  expect(widgets[2]!.custom!.inline!.fields[0]!.defaultValue).toBe('Shared heading')
  await openTool(page, 'Publishing')
  await page.getByRole('button', { name: 'Reload draft', exact: true }).click()
  await expect(preview.getByRole('heading', { name: 'First placement', exact: true })).toHaveCount(
    1,
  )
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  expect(api.published()!.customWidgets).toBeUndefined()
  await page.goto('/website')
  await expect(page.getByRole('heading', { name: 'Updated default', exact: true })).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'First placement', exact: true })).toHaveCount(1)
})

test('HTML CSS widgets preview privately, expose settings and publish in a sandbox', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page
    .getByRole('group', { name: 'Editor mode', exact: true })
    .getByRole('button', { name: 'Code', exact: true })
    .click()
  await openTool(page, 'Widgets')
  await page.getByRole('button', { name: 'Create HTML/CSS widget', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Custom widget editor' })
  await editor.getByLabel('Custom widget name', { exact: true }).fill('Announcement')
  await editor
    .getByLabel('Widget HTML', { exact: true })
    .fill('<script>window.injected = true</script>')
  await expect(
    editor.getByRole('button', { name: 'Apply widget changes', exact: true }),
  ).toBeDisabled()
  await editor
    .getByLabel('Widget HTML', { exact: true })
    .fill('<section class="card"><h2>{{message}}</h2></section>')
  await editor.getByRole('button', { name: 'Add editable setting', exact: true }).click()
  await editor.getByLabel('Setting key', { exact: true }).fill('message')
  await editor.getByLabel('Setting label', { exact: true }).fill('Announcement text')
  await editor.getByLabel('Setting default', { exact: true }).fill('Company news')
  await editor
    .getByLabel('Widget CSS', { exact: true })
    .fill('.card {padding:24px;color:#123456;background:#ffffff;}')
  await expect(
    editor.frameLocator('iframe').getByRole('heading', { name: 'Company news', exact: true }),
  ).toBeVisible()
  await editor.getByRole('button', { name: 'Apply widget changes', exact: true }).click()
  await openTool(page, 'Widgets')
  await page.getByRole('button', { name: 'Add linked Announcement', exact: true }).click()
  await page
    .getByRole('group', { name: 'Editor mode', exact: true })
    .getByRole('button', { name: 'Content', exact: true })
    .click()
  await expect(page.getByRole('button', { name: 'Edit shared widget', exact: true })).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Create HTML/CSS widget', exact: true }),
  ).toHaveCount(0)
  await page.getByLabel('Announcement text', { exact: true }).fill('<img src=x onerror=bad()>')
  const iframe = page.locator('.preview-scroll iframe')
  await expect(iframe).toHaveAttribute('sandbox', 'allow-top-navigation-by-user-activation')
  await expect(iframe.contentFrame().getByRole('heading')).toHaveText('<img src=x onerror=bad()>')
  await expect(iframe.contentFrame().locator('img')).toHaveCount(0)
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(api.published()).toBeNull()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.goto('/website')
  await expect(page.frameLocator('iframe[title="Announcement"]').getByRole('heading')).toHaveText(
    '<img src=x onerror=bad()>',
  )
  await expect(page.frameLocator('iframe[title="Announcement"]').locator('script')).toHaveCount(0)
  await expect(page.frameLocator('iframe[title="Announcement"]').locator('h2')).toHaveCSS(
    'color',
    'rgb(18, 52, 86)',
  )
  expect(await page.evaluate(() => 'injected' in window)).toBe(false)
})

test('admins configure private public-form routing and visitors submit without an account', async ({
  page,
}) => {
  const content = structuredClone(initial)
  content.pages[0]!.layout = { mobile: 'flow', tablet: 'flow' }
  const api = await mockWebsite(page, false, false, content)
  const requests: {
    submissionId: string
    formId: string
    values: Record<string, string>
    website: string
  }[] = []
  await page.route('**/submitWebsiteForm', async (route) => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers })
      return
    }
    requests.push(route.request().postDataJSON().data)
    if (requests.length === 1)
      await route.fulfill({
        status: 503,
        headers,
        json: { error: { status: 'UNAVAILABLE', message: 'Please try again.' } },
      })
    else await route.fulfill({ headers, json: { result: { received: true } } })
  })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await openTool(page, 'Widgets')
  await page.getByText('Public forms', { exact: true }).click()
  await page.getByRole('button', { name: 'Add contact form', exact: true }).click()
  const settings = page.getByRole('region', { name: 'Form settings' })
  await settings.getByLabel('Form name', { exact: true }).fill('Project inquiry')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled()
  await settings.getByLabel('To recipients', { exact: true }).fill('office@example.test')
  await settings.getByLabel('CC recipients', { exact: true }).fill('manager@example.test')
  await settings.getByLabel('Email subject', { exact: true }).fill('New project inquiry')
  await settings
    .getByLabel('Confirmation message', { exact: true })
    .fill('We received your inquiry.')
  await expect(
    page.locator('.preview-scroll').getByRole('button', { name: 'Send message', exact: true }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(api.draft().forms![0]!.delivery).toEqual({
    to: ['office@example.test'],
    cc: ['manager@example.test'],
    subject: 'New project inquiry',
  })
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  expect(api.published()!.forms![0]!.delivery).toBeUndefined()
  await page.goto('/website')
  await page.setViewportSize({ width: 390, height: 844 })
  const form = page.getByRole('form', { name: 'Project inquiry' })
  await form.getByLabel('Name *', { exact: true }).fill('Test visitor')
  await form.getByLabel('Email *', { exact: true }).fill('visitor@example.test')
  await form.getByLabel('Message *', { exact: true }).fill('Please contact me about a project.')
  await form.getByRole('button', { name: 'Send message', exact: true }).click()
  await expect(form.getByRole('alert')).toContainText('Please try again')
  await form.getByRole('button', { name: 'Send message', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('We received your inquiry.')
  expect(requests).toHaveLength(2)
  expect(requests[0]!.submissionId).toBe(requests[1]!.submissionId)
  expect(requests[0]!.values).toEqual({
    name: 'Test visitor',
    email: 'visitor@example.test',
    message: 'Please contact me about a project.',
  })
  expect(JSON.stringify(requests)).not.toContain('office@example.test')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})

test('admins can review stored inquiries and retry failed notifications', async ({ page }) => {
  await mockWebsite(page)
  const actions: string[] = []
  await page.route('**/websiteFormAdmin', async (route) => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers })
      return
    }
    const data = route.request().postDataJSON().data
    actions.push(data.action)
    await route.fulfill({
      headers,
      json: {
        result:
          data.action === 'retry'
            ? { emailStatus: 'sent' }
            : {
                submissions: [
                  {
                    id: 'saved-inquiry',
                    formName: 'Contact us',
                    createdAt: 1,
                    answers: [{ label: 'Message', value: '<script>bad()</script>' }],
                    emailStatus: 'failed',
                    attempts: 1,
                    attemptStartedAt: null,
                  },
                ],
                nextCursor: null,
              },
      },
    })
  })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await openTool(page, 'Widgets')
  await page.getByText('Public forms', { exact: true }).click()
  await page.getByRole('button', { name: 'View form submissions', exact: true }).click()
  const inbox = page.getByRole('dialog', { name: 'Website form submissions' })
  await inbox.locator('summary').click()
  await expect(inbox.getByText('<script>bad()</script>', { exact: true })).toBeVisible()
  await expect(inbox.locator('script')).toHaveCount(0)
  await inbox.getByRole('button', { name: 'Retry notification email', exact: true }).click()
  await page.locator('.builder-confirm[open]').getByRole('button').first().click()
  expect(actions).toEqual(['list'])
  await inbox.getByRole('button', { name: 'Retry notification email', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(inbox.locator('summary')).toContainText('Email sent')
  expect(actions).toEqual(['list', 'retry'])
  await inbox.getByRole('button', { name: 'Close submissions', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'View form submissions', exact: true }),
  ).toBeFocused()
})

test('interactive widgets can be added, edited, published and used on mobile', async ({ page }) => {
  const api = await mockWebsite(page)
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  for (const type of ['accordion', 'tabs', 'downloads', 'video']) {
    await openTool(page, 'Widgets')
    await page
      .getByRole('button', {
        name: `Add ${sectionLabels[type as SectionType]} widget`,
        exact: true,
      })
      .click()
    await openInspectorFor(page, 'Heading')
    await inspector.getByLabel('Heading', { exact: true }).fill('Example ' + type)
    if (type === 'video') {
      await openInspectorFor(page, 'Video link')
      await inspector.getByLabel('Video link', { exact: true }).fill('https://youtu.be/abcdefghijk')
      await expect(
        page.getByRole('button', { name: 'Video playback is available on the public page' }),
      ).toBeDisabled()
    } else {
      for (let index = 0; index < 2; index++) {
        await inspector.getByRole('button', { name: '+ Add item', exact: true }).click()
        await inspector.getByText(`Item ${index + 1}`, { exact: true }).click()
        const fields = inspector.locator('.item-editor').nth(index)
        await fields.getByLabel('Heading', { exact: true }).fill(`${type} item ${index + 1}`)
        await fields.getByLabel('Text', { exact: true }).fill(`${type} content ${index + 1}`)
        if (type === 'downloads') {
          await fields
            .getByLabel('Download label', { exact: true })
            .fill('Get document ' + (index + 1))
          await fields
            .getByLabel('Document link', { exact: true })
            .fill(`https://example.com/document-${index + 1}.pdf`)
        }
      }
      if (type === 'tabs') {
        await inspector.getByRole('button', { name: 'Move item 2 up' }).click()
      }
    }
  }
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(api.draft().pages[0]!.sections.find((s) => s.type === 'tabs')!.items[0]!.title).toBe(
    'tabs item 2',
  )
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Example video', exact: true })).toBeVisible()
  let videoRequests = 0
  await page.route('https://www.youtube-nocookie.com/**', async (route) => {
    videoRequests++
    await route.fulfill({ contentType: 'text/html', body: '<p>Video player fixture</p>' })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/website')
  await page.getByText('accordion item 1', { exact: true }).click()
  await expect(page.getByText('accordion content 1', { exact: true })).toBeVisible()
  await expect(page.getByText('accordion content 2', { exact: true })).toBeHidden()
  const firstTab = page.getByRole('tab', { name: 'tabs item 2' })
  await firstTab.focus()
  await firstTab.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'tabs item 1' })).toBeFocused()
  await expect(page.getByRole('tabpanel', { name: 'tabs item 1' })).toContainText('tabs content 1')
  await page.keyboard.press('Home')
  await expect(firstTab).toBeFocused()
  await expect(page.getByRole('tabpanel', { name: 'tabs item 2' })).toBeVisible()
  const download = page.getByRole('link', { name: /^Get document 1/ })
  await expect(download).toHaveAttribute('href', 'https://example.com/document-1.pdf')
  await expect(download).toHaveAttribute('rel', 'noopener noreferrer')
  expect(videoRequests).toBe(0)
  await page.getByRole('button', { name: 'Load video', exact: true }).click()
  await expect(
    page.frameLocator('iframe[title="Example video"]').getByText('Video player fixture'),
  ).toBeVisible()
  expect(videoRequests).toBe(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('component library filters, edits and publishes basic, company and data widgets', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  const library = page.locator('.widget-library')
  await openTool(page, 'Widgets')
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: '.security-work/gui-widget-library.png' })
  await page.getByLabel('Widget category', { exact: true }).selectOption('Data')
  await expect(library.getByRole('button', { name: 'Add Chart widget', exact: true })).toBeVisible()
  await expect(library.getByRole('button', { name: 'Add Button widget', exact: true })).toHaveCount(
    0,
  )
  await openTool(page, 'Widgets')
  await page.getByLabel('Find widgets', { exact: true }).fill('not-a-widget')
  await expect(library.getByText('No matching widgets.')).toBeVisible()
  await openTool(page, 'Widgets')
  await page.getByLabel('Widget category', { exact: true }).selectOption('All')
  await openTool(page, 'Widgets')
  await page.getByLabel('Find widgets', { exact: true }).fill('Form')
  await expect(library.getByRole('button', { name: 'Add Form widget', exact: true })).toBeVisible()
  const widgets = [
    ['button', 'Button'],
    ['icon', 'Icon'],
    ['divider', 'Divider'],
    ['spacer', 'Spacer'],
    ['list', 'List / checklist'],
    ['badge', 'Badge'],
    ['alert', 'Notice / alert'],
    ['team', 'Team profiles'],
    ['testimonials', 'Testimonials'],
    ['statistics', 'Statistics'],
    ['logos', 'Logo strip'],
    ['chart', 'Chart'],
    ['timeline', 'Timeline'],
    ['progress', 'Progress bars'],
  ]
  for (const [type, label] of widgets) {
    await openTool(page, 'Widgets')
    await page.getByLabel('Find widgets', { exact: true }).fill(label!)
    await library.getByRole('button', { name: `Add ${label} widget`, exact: true }).click()
    await openInspectorFor(page, 'Heading')
    await inspector.getByLabel('Heading', { exact: true }).fill('Example ' + type)
    if (type === 'button') {
      await openInspectorFor(page, 'Button label')
      await inspector.getByLabel('Button label', { exact: true }).fill('Learn about Phase 2')
      await openInspectorFor(page, 'Button link')
      await inspector.getByLabel('Button link', { exact: true }).fill('/website')
      await openInspectorFor(page, 'Variant')
      await inspector.getByLabel('Variant', { exact: true }).selectOption('outline')
    }
    if (type === 'icon') await inspector.getByLabel('Icon', { exact: true }).selectOption('shield')
    if (type === 'list') {
      await openInspectorFor(page, 'List style')
      await inspector.getByLabel('List style', { exact: true }).selectOption('check')
    }
    if (type === 'chart') {
      await openInspectorFor(page, 'Chart type')
      await inspector.getByLabel('Chart type', { exact: true }).selectOption('donut')
    }
    if (
      [
        'list',
        'team',
        'testimonials',
        'statistics',
        'logos',
        'chart',
        'timeline',
        'progress',
      ].includes(type!)
    ) {
      if (type === 'team') await inspector.getByLabel('Columns', { exact: true }).selectOption('1')
      await inspector.getByRole('button', { name: '+ Add item', exact: true }).click()
      await inspector.getByText('Item 1', { exact: true }).click()
      const row = inspector.locator('.item-editor').first()
      await row.getByLabel('Heading', { exact: true }).fill(type + ' entry')
      if (!['chart', 'progress'].includes(type!))
        await row
          .getByLabel('Text', { exact: true })
          .fill(type === 'testimonials' ? 'A reliable project team.' : 'Company information.')
      if (['chart', 'statistics'].includes(type!))
        await row.getByLabel('Value', { exact: true }).fill('42')
      if (type === 'progress') await row.getByLabel('Percentage', { exact: true }).fill('75')
      if (type === 'team')
        await row.getByLabel('Role / title', { exact: true }).fill('Project Manager')
      if (type === 'logos') {
        await row.getByLabel('Upload image', { exact: true }).setInputFiles('e2e/fixtures/site.png')
        await row
          .getByLabel('Image description', { exact: true })
          .fill('Company certification logo')
      }
    }
  }
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(api.draft().pages[0]!.sections.find((s) => s.type === 'team')!.items[0]!.subtitle).toBe(
    'Project Manager',
  )
  expect(
    api.draft().pages[0]!.sections.find((s) => s.type === 'chart')!.blockOptions?.chartType,
  ).toBe('donut')
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.goto('/website')
  await expect(
    page.getByRole('link', { name: 'Learn about Phase 2', exact: true }),
  ).toHaveAttribute('href', '/website')
  await expect(page.getByText('Project Manager', { exact: true })).toBeVisible()
  await expect(page.getByText('A reliable project team.', { exact: true })).toBeVisible()
  await page.locator('.section-logos').scrollIntoViewIfNeeded()
  await expect(
    page.getByRole('img', { name: 'Company certification logo', exact: true }),
  ).toBeVisible()
  await expect(
    page.locator('.section-chart').getByText('View chart data', { exact: true }),
  ).toBeVisible()
  await page.locator('.section-chart').getByText('View chart data', { exact: true }).click()
  await expect(
    page.locator('.section-chart').getByRole('cell', { name: '42', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '75')
  await expect(page.locator('.section-spacer')).toHaveText('')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true)
  await expect(page.locator('.section-chart').getByRole('table')).toBeVisible()
})

test('compact cards and graphs edit as individual components and keep data accessible', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  for (const type of [
    'card',
    'profile-card',
    'metric',
    'progress-ring',
    'sparkline',
    'data-table',
    'chart',
  ]) {
    await openTool(page, 'Widgets')
    await page
      .getByRole('button', {
        name: `Add ${sectionLabels[type as SectionType]} widget`,
        exact: true,
      })
      .click()
    await openInspectorFor(page, 'Heading')
    await inspector.getByLabel('Heading', { exact: true }).fill('Compact ' + type)
    if (type === 'card') {
      await openInspectorFor(page, 'Text')
      await inspector.getByLabel('Text', { exact: true }).fill('One independent card.')
      await openInspectorFor(page, 'Button label')
      await inspector.getByLabel('Button label', { exact: true }).fill('View details')
      await openInspectorFor(page, 'Button link')
      await inspector.getByLabel('Button link', { exact: true }).fill('/website')
    }
    if (type === 'profile-card') {
      await openInspectorFor(page, 'Role / title')
      await inspector.getByLabel('Role / title', { exact: true }).fill('Field manager')
    }
    if (type === 'metric') await inspector.getByLabel('Value', { exact: true }).fill('0')
    if (type === 'progress-ring') {
      await openInspectorFor(page, 'Percentage')
      await inspector.getByLabel('Percentage', { exact: true }).fill('75')
    }
    if (type === 'chart') {
      await openInspectorFor(page, 'Chart type')
      await inspector.getByLabel('Chart type', { exact: true }).selectOption('area')
      await expect(inspector.getByLabel('Always show chart data')).not.toBeChecked()
    }
    if (['sparkline', 'data-table', 'chart'].includes(type)) {
      for (let index = 0; index < 2; index++) {
        await inspector.getByRole('button', { name: '+ Add item', exact: true }).click()
        await inspector.getByText(`Item ${index + 1}`, { exact: true }).click()
        const fields = inspector.locator('.item-editor').nth(index)
        await fields.getByLabel('Heading', { exact: true }).fill('Point ' + (index + 1))
        await fields.getByLabel('Value', { exact: true }).fill(index ? '20' : '-5')
        if (type === 'data-table')
          await fields.getByLabel('Text', { exact: true }).fill('Row details')
      }
    }
  }
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  const metric = api.draft().pages[0]!.sections.find((section) => section.type === 'metric')!
  expect(metric.value).toBe(0)
  expect(metric.layout).toMatchObject({ w: 6, h: 5 })
  expect(metric.appearance).toMatchObject({ padding: 12, headingSize: 18 })
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Compact metric', exact: true })).toBeVisible()
  await page.goto('/website')
  await expect(page.getByRole('link', { name: 'View details', exact: true })).toHaveAttribute(
    'href',
    '/website',
  )
  await expect(page.getByText('Field manager', { exact: true })).toBeVisible()
  await expect(page.locator('.metric-value')).toHaveText('0')
  await expect(page.getByRole('progressbar', { name: 'Compact progress-ring' })).toHaveAttribute(
    'aria-valuenow',
    '75',
  )
  const spark = page.locator('.section-sparkline')
  await expect(spark.getByRole('table')).toBeHidden()
  await spark.getByText('View data', { exact: true }).click()
  await expect(spark.getByRole('cell', { name: '-5', exact: true })).toBeVisible()
  const graph = page.locator('.section-chart')
  await expect(graph.locator('polygon')).toBeVisible()
  await expect(graph.getByRole('table')).toBeHidden()
  await graph.getByText('View chart data', { exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(graph.getByRole('cell', { name: '20', exact: true })).toBeVisible()
  await expect(page.locator('.section-data-table').getByRole('table')).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true)
})

test('editor modes preserve one draft and prevent layout edits outside Design', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const modes = page.getByRole('group', { name: 'Editor mode', exact: true })
  const inspector = page.getByRole('complementary', { name: 'Content editor' })
  await expect(modes.getByRole('button', { name: 'Content', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await openTool(page, 'Pages')
  await expect(page.getByRole('button', { name: '+ Page', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add Card widget', exact: true })).toHaveCount(0)
  await selectCanvasWidget(page, 'Welcome to Phase 2')
  await openInspectorFor(page, 'Heading')
  await inspector.getByLabel('Heading', { exact: true }).fill('Owner update')
  await expect(page.locator('.grid-resize, .grid-rotate, .drag-widget')).toHaveCount(0)
  const widget = page.locator('.preview-frame [data-widget-id="hero"]')
  const position = await widget.getAttribute('style')
  await widget.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Control+d')
  await page.keyboard.press('Delete')
  await widget.click({ button: 'right' })
  await expect(page.getByRole('menu', { name: 'Widget actions' })).toHaveCount(0)
  await expect(page.locator('.preview-frame .widget-frame')).toHaveCount(1)
  await expect(widget).toHaveAttribute('style', position!)
  await modes.getByRole('button', { name: 'Design', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Rotate Owner update', exact: true })).toBeVisible()
  await openInspectorFor(page, 'Widget w')
  await inspector.getByLabel('Widget w', { exact: true }).fill('18')
  await page.setViewportSize({ width: 1400, height: 950 })
  await expect(inspector.getByLabel('Widget w', { exact: true })).toHaveValue('18')
  await inspector.getByLabel('Widget w', { exact: true }).press('Tab')
  await expect(inspector.getByLabel('Widget w', { exact: true })).toHaveValue('18')
  await modes.getByRole('button', { name: 'Code', exact: true }).click()
  await expect(page.locator('.grid-resize, .grid-rotate, .drag-widget')).toHaveCount(0)
  await openInspectorFor(page, 'CSS class')
  await inspector.getByLabel('CSS class', { exact: true }).fill('custom-owner')
  const css = '.custom-owner .widget-title { color: #123456; }'
  await inspector.getByRole('textbox', { name: 'Page CSS', exact: true }).fill(css)
  await expect(widget.locator('.widget-title')).toHaveCSS('color', 'rgb(18, 52, 86)')
  await modes.getByRole('button', { name: 'Content', exact: true }).click()
  await expect(inspector.getByLabel('Heading', { exact: true })).toHaveValue('Owner update')
  await openInspectorFor(page, 'Heading')
  await inspector.getByLabel('Heading', { exact: true }).fill('Final heading')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(inspector.getByLabel('Heading', { exact: true })).toHaveValue('Owner update')
  await expect(widget.locator('.widget-title')).toHaveCSS('color', 'rgb(18, 52, 86)')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(api.draft().pages[0]!.css).toBe(css)
  expect(api.draft().pages[0]!.sections[0]!.layout!.w).toBe(18)
  expect(api.draft().pages[0]!.sections[0]!.title).toBe('Owner update')
  expect(api.published()).toBeNull()
  await modes.getByRole('button', { name: 'Code', exact: true }).click()
  await page.reload()
  await expect(modes.getByRole('button', { name: 'Code', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(inspector.getByRole('textbox', { name: 'Page CSS', exact: true })).toHaveValue(css)
})

test('editor modes and site settings remain usable on a phone without changing the draft', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await expect(page.getByLabel('Page title', { exact: true })).toBeVisible()
  const initialState = await page.locator('.builder-header .subtle').innerText()
  const modes = page.getByRole('group', { name: 'Editor mode', exact: true })
  await page.getByRole('button', { name: 'Site settings', exact: true }).click()
  await expect(page.getByLabel('Website name', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enable shared design', exact: true })).toHaveCount(
    0,
  )
  await modes.getByRole('button', { name: 'Design', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Enable shared design', exact: true }),
  ).toBeVisible()
  await modes.getByRole('button', { name: 'Code', exact: true }).click()
  await page.getByRole('button', { name: 'Pages & widgets', exact: true }).click()
  await page.getByRole('button', { name: 'Page settings', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Page CSS', exact: true })).toBeVisible()
  await modes.getByRole('button', { name: 'Content', exact: true }).click()
  await expect(page.getByLabel('Page title', { exact: true })).toBeVisible()
  await expect(page.locator('.builder-header .subtle')).toHaveText(initialState)
  expect(api.actions).not.toContain('save')
  expect(api.actions).not.toContain('publish')
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
  await page.screenshot({ path: '.security-work/editor-content-mobile.png' })
})

test('shared site layout wraps pages and HTML preserves editable widgets', async ({ page }) => {
  const api = await mockWebsite(page)
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const modes = page.getByRole('group', { name: 'Editor mode', exact: true })
  await openTool(page, 'Pages')
  await page.getByRole('button', { name: 'Create shared layout', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Site layout', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  // Shared layout editing keeps the actual page in its content slot.
  await expect(page.locator('.preview-frame .section-hero')).toBeVisible()
  await modes.getByRole('button', { name: 'Code', exact: true }).click()
  const html = page.getByRole('textbox', { name: 'Site layout HTML', exact: true })
  const source = await html.inputValue()
  await html.fill('<div class="custom-shared">' + source + '</div>')
  await page
    .getByRole('textbox', { name: 'Site CSS', exact: true })
    .fill('.widget-title { color: #123456; }')
  await modes.getByRole('button', { name: 'Design', exact: true }).click()
  await openTool(page, 'Widgets')
  await page.getByRole('button', { name: 'Add Text widget', exact: true }).click()
  await modes.getByRole('button', { name: 'Code', exact: true }).click()
  expect((await html.inputValue()).match(/<website-widget/g)).toHaveLength(3)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  expect((await html.inputValue()).match(/<website-widget/g)).toHaveLength(2)
  await page.getByRole('button', { name: 'Current page', exact: true }).click()
  await modes.getByRole('button', { name: 'Design', exact: true }).click()
  await page.getByRole('button', { name: 'Page settings', exact: true }).click()
  await page.getByLabel('Page site layout', { exact: true }).selectOption('default')
  await expect(page.locator('.preview-frame .section-navigation')).toHaveCount(1)
  await expect(page.locator('.preview-frame .section-footer')).toHaveCount(1)
  await expect(page.locator('.preview-frame .section-hero')).toHaveCount(1)
  await selectCanvasWidget(page, 'Welcome to Phase 2')
  await page.getByLabel('Heading', { exact: true }).fill('Content inside layout')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  expect(api.draft().sharedLayout?.html).toContain('custom-shared')
  expect(api.draft().pages[0]!.useSiteLayout).toBe(true)
  await page.getByRole('button', { name: 'Page settings', exact: true }).click()
  await page.getByLabel('Page site layout', { exact: true }).selectOption('none')
  await expect(page.locator('.preview-frame .section-navigation')).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.locator('.preview-frame .section-navigation')).toHaveCount(1)
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.locator('.builder-confirm[open] [data-confirm-action]').click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await page.goto('/website')
  await expect(page.getByRole('heading', { name: 'Content inside layout', exact: true })).toHaveCSS(
    'color',
    'rgb(18, 52, 86)',
  )
  await expect(page.locator('.section-navigation')).toHaveCount(1)
})

test('site and page scripts run in isolation and restart on page navigation', async ({ page }) => {
  const content = structuredClone(initial)
  content.js =
    "window.siteSequence = ['site']; try { parent.document.body.dataset.compromised = 'yes' } catch { window.parentBlocked = true }; try { localStorage.setItem('leak', 'yes') } catch { window.storageBlocked = true }"
  content.pages[0]!.js =
    "window.siteSequence.push('page'); document.querySelector('.widget-title').textContent = window.siteSequence.join(' then ') + (window.parentBlocked && window.storageBlocked ? ' isolated' : ' UNSAFE');"
  let networkRequests = 0
  await page.route('https://blocked.example.test/**', async (route) => {
    networkRequests++
    await route.abort()
  })
  content.js +=
    "; fetch('https://blocked.example.test/test').catch(() => { document.body.dataset.networkBlocked = 'yes' })"
  const second = structuredClone(content.pages[0]!)
  second.id = 'second'
  second.slug = 'second'
  second.title = 'Second'
  second.js =
    "document.querySelector('.widget-title').textContent = typeof window.homeMarker === 'undefined' ? 'Fresh page' : 'Leaked timer state'"
  content.pages[0]!.sections[0]!.linkLabel = 'Next page'
  content.pages[0]!.sections[0]!.linkUrl = '/website/second'
  content.pages[0]!.js += '; window.homeMarker = true'
  content.pages.push(second)
  const api = await mockWebsite(page, true, false, content)
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page
    .getByRole('group', { name: 'Editor mode', exact: true })
    .getByRole('button', { name: 'Code', exact: true })
    .click()
  await page.getByRole('button', { name: 'Run code preview', exact: true }).click()
  const runtime = page.frameLocator('iframe[title="Website code preview"]')
  await expect(
    runtime.getByRole('heading', { name: 'site then page isolated', exact: true }),
  ).toBeVisible()
  expect(await page.evaluate(() => document.body.dataset.compromised)).toBeUndefined()
  await expect(page.locator('iframe[title="Website code preview"]')).toHaveAttribute(
    'sandbox',
    'allow-scripts allow-forms allow-top-navigation-by-user-activation',
  )
  await page.getByRole('button', { name: 'Stop code preview', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Welcome to Phase 2', exact: true })).toBeVisible()
  await page.goto('/website')
  await expect(
    runtime.getByRole('heading', { name: 'site then page isolated', exact: true }),
  ).toBeVisible()
  await expect(runtime.locator('body')).toHaveAttribute('data-network-blocked', 'yes')
  expect(networkRequests).toBe(0)
  await runtime.getByRole('link', { name: 'Next page', exact: true }).click()
  await expect(runtime.getByRole('heading', { name: 'Fresh page', exact: true })).toBeVisible()
  expect(api.published()?.js).toContain('siteSequence')
})

test('script runtime keeps public forms working and blocks preview submissions', async ({
  page,
}) => {
  const { newWebsiteForm } = createRequire(import.meta.url)('../functions/websiteForms.js')
  const content = structuredClone(initial)
  content.js = "document.body.dataset.siteScript = 'ready'"
  const form = newWebsiteForm('contact')
  form.delivery.to = ['private-routing@example.test']
  content.forms = [form]
  content.pages[0]!.layout = { desktop: 'flow', tablet: 'flow', mobile: 'flow' }
  content.pages[0]!.sections.push({
    ...structuredClone(initial.pages[0]!.sections[0]!),
    id: 'form',
    type: 'form',
    formId: 'contact',
    title: 'Contact',
  })
  const requests: Record<string, unknown>[] = []
  await page.route('**/submitWebsiteForm', async (route) => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers })
      return
    }
    requests.push(route.request().postDataJSON().data)
    await route.fulfill({ headers, json: { result: { received: true } } })
  })
  await mockWebsite(page, true, false, content)
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page
    .getByRole('group', { name: 'Editor mode', exact: true })
    .getByRole('button', { name: 'Code', exact: true })
    .click()
  await page.getByRole('button', { name: 'Run code preview', exact: true }).click()
  const runtime = page.frameLocator('iframe[title="Website code preview"]')
  await expect(runtime.getByRole('button', { name: 'Send message', exact: true })).toBeDisabled()
  expect(requests).toHaveLength(0)
  await page.goto('/website')
  const fields = runtime.getByRole('form')
  await fields.getByLabel('Name *', { exact: true }).fill('Website visitor')
  await fields.getByLabel('Email *', { exact: true }).fill('visitor@example.test')
  await fields.getByLabel('Message *', { exact: true }).fill('A sandboxed inquiry')
  await fields.getByRole('button', { name: 'Send message', exact: true }).click()
  await expect(runtime.getByRole('status')).toHaveText(form.successMessage)
  expect(requests).toHaveLength(1)
  expect(requests[0]!.values).toEqual({
    name: 'Website visitor',
    email: 'visitor@example.test',
    message: 'A sandboxed inquiry',
  })
  expect(JSON.stringify(requests)).not.toContain('private-routing')
})

test('builder panel widths support pointer and keyboard resizing, cancellation and local persistence', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await page.setViewportSize({ width: 1440, height: 950 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const left = page.getByRole('separator', { name: 'Resize structure panel' })
  const right = page.getByRole('separator', { name: 'Resize editor panel' })
  await expect(left).toHaveAttribute('aria-valuenow', '248')
  const box = (await left.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + 180)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + 180, { steps: 8 })
  await page.mouse.up()
  await expect(left).toHaveAttribute('aria-valuenow', '308')
  await right.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(right).toHaveAttribute('aria-valuenow', '310')
  const moved = (await left.boundingBox())!
  await page.mouse.move(moved.x + 3, moved.y + 180)
  await page.mouse.down()
  await page.mouse.move(moved.x + 53, moved.y + 180, { steps: 4 })
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(left).toHaveAttribute('aria-valuenow', '308')
  await page.reload()
  await expect(left).toHaveAttribute('aria-valuenow', '308')
  await expect(right).toHaveAttribute('aria-valuenow', '310')
  await page.setViewportSize({ width: 1024, height: 768 })
  await expect
    .poll(() => page.locator('.preview-pane').evaluate((el) => el.clientWidth))
    .toBeGreaterThanOrEqual(158)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.setViewportSize({ width: 1440, height: 950 })
  await expect(left).toHaveAttribute('aria-valuenow', '308')
  await left.focus()
  await page.keyboard.press('Enter')
  await expect(left).toHaveAttribute('aria-valuenow', '248')
  await right.dblclick()
  await expect(right).toHaveAttribute('aria-valuenow', '300')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(left).toBeHidden()
  await expect(right).toBeHidden()
  expect(api.actions).not.toContain('save')
  expect(api.actions).not.toContain('publish')
})

test('builder confirmations trap focus, cancel safely and preserve nested widget edits', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft saved')
  const publish = page.getByRole('button', { name: 'Publish', exact: true })
  await publish.click()
  const confirmation = page.getByRole('dialog', { name: 'Publish website?', exact: true })
  await expect(confirmation.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(
    confirmation.getByRole('button', { name: 'Publish website', exact: true }),
  ).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(confirmation).toBeHidden()
  await expect(publish).toBeFocused()
  expect(api.actions).not.toContain('publish')
  await publish.click()
  await confirmation.getByRole('button', { name: 'Publish website', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Website published')
  await openTool(page, 'Publishing')
  await page.getByRole('button', { name: 'Take website offline', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Take website offline?', exact: true })
    .getByRole('button', { name: 'Cancel', exact: true })
    .click()
  expect(api.published()).not.toBeNull()
  await page.getByRole('button', { name: 'Take website offline', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Take website offline?', exact: true })
    .getByRole('button', { name: 'Take offline', exact: true })
    .click()
  await expect.poll(() => api.published()).toBeNull()
  await page
    .getByRole('group', { name: 'Editor mode', exact: true })
    .getByRole('button', { name: 'Code', exact: true })
    .click()
  await openTool(page, 'Widgets')
  await page.getByRole('button', { name: 'Create HTML/CSS widget', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Custom widget editor', exact: true })
  await editor.getByLabel('Custom widget name', { exact: true }).fill('Keep my widget')
  await editor.getByRole('button', { name: 'Cancel widget edits', exact: true }).click()
  const discard = page.getByRole('dialog', { name: 'Discard widget edits?', exact: true })
  await expect(discard.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(discard).toBeHidden()
  await expect(editor.getByLabel('Custom widget name', { exact: true })).toHaveValue(
    'Keep my widget',
  )
  await expect(
    editor.getByRole('button', { name: 'Cancel widget edits', exact: true }),
  ).toBeFocused()
  await editor.getByRole('button', { name: 'Cancel widget edits', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await discard.screenshot({ path: '.security-work/builder-confirm-mobile.png' })
  expect(await discard.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  await discard.getByRole('button', { name: 'Discard edits', exact: true }).click()
  await expect(editor).toBeHidden()
})

test('editing guide supports keyboard and phone use without changing the draft or intercepting text', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  await page.setViewportSize({ width: 1440, height: 950 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const help = page.getByRole('button', { name: 'Editing guide', exact: true })
  const guide = page.getByRole('dialog', { name: 'Editing guide', exact: true })
  await expect(page.getByLabel('Page title', { exact: true })).toBeVisible()
  const status = await page.locator('.builder-header .subtle').innerText()
  await help.click()
  await expect(guide.getByRole('button', { name: 'Close guide', exact: true })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(guide.getByRole('button', { name: 'Done', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(guide.getByRole('button', { name: 'Close guide', exact: true })).toBeFocused()
  await expect(guide.getByRole('heading', { name: 'Widget shortcuts', exact: true })).toBeVisible()
  const modifier = await page.evaluate(() =>
    /Mac|iPhone|iPad/.test(navigator.platform) ? 'Cmd' : 'Ctrl',
  )
  await expect(guide.locator('kbd').filter({ hasText: modifier + ' + D' })).toHaveCount(1)
  await guide.screenshot({ path: '.security-work/builder-guide-desktop.png' })
  await page.keyboard.press('Escape')
  await expect(guide).toBeHidden()
  await expect(help).toBeFocused()
  await page.keyboard.press('?')
  await expect(guide).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(help).toBeFocused()
  await expect(page.locator('.builder-header .subtle')).toHaveText(status)
  expect(api.actions).not.toContain('save')
  expect(api.actions).not.toContain('publish')
  await page.getByRole('button', { name: 'Site settings', exact: true }).click()
  const field = page.getByLabel('Website name', { exact: true })
  await field.fill('Question')
  await field.press('End')
  await field.press('?')
  await expect(field).toHaveValue('Question?')
  await expect(guide).toBeHidden()
  await page.setViewportSize({ width: 390, height: 844 })
  await help.click()
  await expect(guide).toBeVisible()
  expect(await guide.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const body = guide.locator('.help-body')
  await body.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  await expect(guide.getByRole('button', { name: 'Done', exact: true })).toBeInViewport()
  await guide.screenshot({ path: '.security-work/builder-guide-mobile.png' })
  await guide.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(help).toBeFocused()
  await expect(field).toHaveValue('Question?')
})
