import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { expect, test, type Page } from './helpers/test'
import type { TestInfo } from '@playwright/test'
import {
  createJobsFixture,
  gotoPhase2App,
  openLibraryFiles,
  selectLibraryFile,
} from './helpers/phase2AppFixture'
import { mockDashboard } from './helpers/dashboardFixture'
import { setupFormServer } from './helpers/formFixture'
import { routeWebsiteBuilderFixture } from './helpers/websiteCallableFixture'
import { phase2Site } from '../src/features/website/phase2Site'
import type { FormDefinition } from '../functions/src/formModel'

const { validateWebsite, publishedWebsite } = createRequire(import.meta.url)(
  '../functions/lib/websiteModel.js',
) as typeof import('../functions/src/websiteModel')
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
const devices = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 1000 },
]
const definition: FormDefinition = {
  title: 'Site inspection',
  description: 'Check the work area and record follow-up details.',
  recipients: [],
  fields: [
    { id: 'job', kind: 'text', label: 'Job name', required: true, options: [] },
    { id: 'notes', kind: 'textarea', label: 'Follow-up notes', required: false, options: [] },
  ],
}

test.beforeEach(async ({ page }) => {
  // Later fixture routes supply every service response. Never fall through to
  // the saved preview's loopback bridge or a real provider.
  await page.route('**/*', (route) =>
    new URL(route.request().url()).origin === 'http://127.0.0.1:5196'
      ? route.continue()
      : route.abort('blockedbyclient'),
  )
  await mockDashboard(page)
})

async function references(page: Page) {
  await page.route('**/sdsWorkspace', (route) =>
    route.fulfill({
      headers,
      json: {
        result: {
          sheets: [],
          folders: [],
          after: '',
          scanned: 0,
          version: 1,
          binder: { version: 0, selections: [] },
        },
      },
    }),
  )
}
async function contained(page: Page, selector = '.app-shell__content') {
  const result = await page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return {
        left: rect.left,
        right: rect.right,
        width: innerWidth,
        content: element.clientWidth,
        scroll: element.scrollWidth,
      }
    })
  expect(result.left).toBeGreaterThanOrEqual(-1)
  expect(result.right).toBeLessThanOrEqual(result.width + 1)
  expect(result.scroll).toBeLessThanOrEqual(result.content + 1)
}
async function screenshot(page: Page, name: string, info: TestInfo) {
  await page.screenshot({ path: info.outputPath(name + '.png') })
}

async function publicContentReady(page: Page) {
  const content = page.locator('.public-website')
  for (const image of await content.locator('img').all()) {
    await image.scrollIntoViewIfNeeded()
    await expect
      .poll(() =>
        image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0),
      )
      .toBe(true)
  }
  await content.evaluate(async (root) => {
    const fonts = new Set(
      Array.from(root.querySelectorAll('*'), (element) => {
        const style = getComputedStyle(element)
        return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      }),
    )
    await Promise.all([...fonts].map((font) => document.fonts.load(font)))
    await document.fonts.ready
  })
  await page.evaluate(() => window.scrollTo(0, 0))
}

for (const device of devices)
  test.describe(device.name, () => {
    test.use({
      viewport: { width: device.width, height: device.height },
      hasTouch: device.name !== 'desktop',
    })

    test('Forms directory, response and completed record retain readable controls and recovery', async ({
      page,
    }, info) => {
      await references(page)
      const server = await setupFormServer(page, {
        definition,
        initialPath: '/reports',
        lostSave: true,
      })
      await expect(
        page.getByRole('region', { name: 'Forms workspace', exact: true }),
      ).toHaveAttribute('aria-busy', 'false')
      const search = page.getByRole('searchbox', { name: 'Search forms' })
      await search.fill('not present')
      await expect(
        page.getByText('No published forms match your search and access.', { exact: false }),
      ).toBeVisible()
      await search.fill('')
      await contained(page)
      await screenshot(page, 'forms-directory', info)
      await page.getByRole('link', { name: definition.title, exact: true }).click()
      await expect(page.getByRole('button', { name: 'Start draft', exact: true })).toBeVisible()
      await expect(page.getByRole('region', { name: 'Form content', exact: true })).toHaveAttribute(
        'aria-busy',
        'false',
      )
      await contained(page)
      await screenshot(page, 'form-start', info)
      await page.getByRole('button', { name: 'Start draft', exact: true }).click()
      await page.getByLabel('Job name', { exact: false }).fill('Synthetic project')
      await page
        .getByLabel('Follow-up notes', { exact: false })
        .fill('Keep this work after a failed save.')
      await page.getByRole('button', { name: 'Save progress', exact: true }).click()
      await expect(page.getByRole('alert')).toBeVisible()
      await expect(page.getByLabel('Follow-up notes', { exact: false })).toHaveValue(
        'Keep this work after a failed save.',
      )
      await page.getByRole('button', { name: 'Save progress', exact: true }).click()
      await expect.poll(() => server.saveRequests.length).toBeGreaterThan(1)
      await expect(page.getByRole('alert')).toHaveCount(0)
      await contained(page)
      await screenshot(page, 'form-response', info)

      await page.route('**/formSubmissionViewer', (route) =>
        route.fulfill({
          headers,
          json: {
            result: {
              id: 'review-completed',
              templateVersion: 1,
              submittedAt: 1793000000000,
              requireLogin: true,
              definition: { ...definition, version: 1, createdAt: '' },
              answers: {
                job: 'Synthetic project',
                notes: 'A completed report with preserved answers.',
              },
            },
          },
        }),
      )
      await page.goto('/form-submissions/review-completed')
      await expect(page.getByRole('heading', { name: definition.title, exact: true })).toBeVisible()
      await expect(
        page.getByText('A completed report with preserved answers.', { exact: true }),
      ).toBeVisible()
      await expect(page.getByRole('region', { name: 'Form content', exact: true })).toHaveAttribute(
        'aria-busy',
        'false',
      )
      await contained(page)
      await screenshot(page, 'completed-record', info)
      expect(server.submitted).toBe(0)
    })

    test('Form editor keeps canvas primary and secondary settings reachable', async ({
      page,
    }, info) => {
      await references(page)
      await gotoPhase2App(page, '/admin/forms', createJobsFixture())
      await page.getByRole('button', { name: 'New form', exact: true }).click()
      const panels = page.getByRole('navigation', { name: 'Builder panels' })
      if (device.width <= 900)
        await panels.getByRole('button', { name: 'Editor', exact: true }).click()
      await page.getByRole('button', { name: 'Add fields', exact: true }).click()
      await page.getByRole('button', { name: 'Add text', exact: true }).click()
      await page.getByLabel('Selected field label', { exact: true }).fill('Project')
      if (device.width <= 900)
        await panels.getByRole('button', { name: 'Canvas', exact: true }).click()
      await expect(page.getByRole('article', { name: 'Field 1', exact: true })).toContainText(
        'Project',
      )
      await contained(page)
      await screenshot(page, 'form-editor', info)
      await page.getByRole('article', { name: 'Field 1', exact: true }).focus()
      await page.keyboard.press('Enter')
      await expect(page.getByLabel('Selected field label', { exact: true })).toHaveValue('Project')
      await contained(page)
      await screenshot(page, 'form-inspector', info)
    })

    for (const route of ['/company-library', '/safety/sds'])
      test(`${route} keeps the viewer primary and file actions accessible`, async ({
        page,
      }, info) => {
        await mockDashboard(page)
        const sheet = {
          id: 'review-plan',
          name: 'Site safety plan',
          folderId: '',
          revisionId: 'r1',
          extension: 'pdf',
          archived: false,
        }
        let failed = false
        await page.route('**/sds-file?*', (route) =>
          route.fulfill({ path: 'e2e/fixtures/sds-preview.pdf', contentType: 'application/pdf' }),
        )
        await page.route('**/sdsWorkspace', async (route) => {
          if (route.request().method() === 'OPTIONS') return route.fulfill({ headers, status: 204 })
          const data = route.request().postDataJSON().data
          if (data.action === 'openSheet' && !failed) {
            failed = true
            return route.fulfill({
              headers,
              status: 503,
              json: {
                error: {
                  status: 'UNAVAILABLE',
                  message: 'Synthetic preview temporarily unavailable.',
                },
              },
            })
          }
          const result =
            data.action === 'openSheet'
              ? {
                  url: 'https://example.invalid/document?ticket=review-plan',
                  extension: 'pdf',
                  revisionId: 'r1',
                }
              : {
                  version: 1,
                  folders: [],
                  sheets: data.search === 'Phase2 intranet content' ? [] : [sheet],
                  after: '',
                  scanned: 1,
                  binder: { version: 0, selections: [] },
                }
          await route.fulfill({ headers, json: { result } })
        })
        await gotoPhase2App(page, route, createJobsFixture())
        await selectLibraryFile(page, sheet.name)
        await expect(page.getByRole('alert')).toContainText(
          'The document service could not be reached.',
        )
        await page.getByRole('button', { name: 'Retry preview', exact: true }).click()
        await expect(page.getByRole('img', { name: 'PDF page 1 of 2', exact: true })).toBeVisible({
          timeout: 15000,
        })
        await expect(
          page.getByRole('region', { name: 'Document preview', exact: true }),
        ).toHaveAttribute('aria-busy', 'false')
        const availableWidth = await page.locator('.app-shell__content').evaluate((element) => {
          const style = getComputedStyle(element)
          return (
            element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
          )
        })
        expect(
          await page.getByTestId('sds-module').evaluate((element) => element.clientWidth),
        ).toBeGreaterThanOrEqual(availableWidth - 2)
        if (device.width <= 820) {
          await expect(page.getByRole('button', { name: 'Open files', exact: true })).toBeVisible()
          expect(
            await page
              .getByRole('region', { name: 'File viewer', exact: true })
              .evaluate((element) => element.clientWidth / element.parentElement!.clientWidth),
          ).toBeGreaterThan(0.95)
        }
        await contained(page)
        await screenshot(page, 'document-viewer', info)
        await openLibraryFiles(page)
        await page.getByRole('button', { name: 'Root folder actions', exact: true }).click()
        await expect(
          page.getByRole('menuitem', { name: 'Upload document here', exact: true }),
        ).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(page.getByRole('menu')).toHaveCount(0)
        await screenshot(page, 'document-files', info)
      })
  })

const images: Record<string, { path: string; contentType: string }> = {
  logo: { path: 'src/assets/images/phase2-logo.png', contentType: 'image/png' },
  interior: { path: 'src/assets/images/construction-placeholder.webp', contentType: 'image/webp' },
  architecture: { path: 'src/assets/images/site/architecture.jpg', contentType: 'image/jpeg' },
  finished: { path: 'src/assets/images/site/finished-interior.jpg', contentType: 'image/jpeg' },
  planning: { path: 'src/assets/images/site/planning.jpg', contentType: 'image/jpeg' },
}
for (const device of devices)
  test(`${device.name}: all public site pages remain readable with working navigation`, async ({
    page,
  }, info) => {
    test.setTimeout(90000)
    await page.setViewportSize(device)
    const site = validateWebsite(
      phase2Site({
        logo: 'logo',
        interior: 'interior',
        architecture: 'architecture',
        finished: 'finished',
        planning: 'planning',
      }),
    )
    for (const form of site.forms || []) form.delivery.to = ['review@example.invalid']
    await page.route('**/getPublishedWebsite*', (route) =>
      route.fulfill({ headers, json: { result: { site: publishedWebsite(site) } } }),
    )
    await page.route('**/website-image?*', (route) =>
      route.fulfill(images[new URL(route.request().url()).searchParams.get('id')!]!),
    )
    for (const sitePage of site.pages) {
      await gotoPhase2App(
        page,
        sitePage.slug === 'home' ? '/' : '/' + sitePage.slug,
        createJobsFixture(),
      )
      await expect(page.locator('.public-website')).toBeVisible()
      await expect(page.locator('.public-website h1').first()).toBeVisible()
      await publicContentReady(page)
      await contained(page, '.public-website')
      const navigation = page.locator('.public-website .section-navigation').first()
      await expect(navigation).toBeVisible()
      if (device.width <= 900) {
        await navigation.getByRole('button', { name: /menu/i }).click()
        await expect(
          navigation.getByRole('link', { name: 'Employee login', exact: true }),
        ).toBeVisible()
        await navigation.getByRole('button', { name: /menu/i }).click()
      }
      await screenshot(page, 'public-' + sitePage.slug, info)
      const sectionBounds = await page
        .locator('.public-website .website-section')
        .evaluateAll((elements) =>
          elements
            .filter((element) => element.getClientRects().length)
            .map((element) => {
              const bounds = element.getBoundingClientRect()
              return { left: bounds.left, right: bounds.right, viewport: innerWidth }
            }),
        )
      expect(sectionBounds.length).toBeGreaterThan(0)
      for (const bounds of sectionBounds) {
        expect(bounds.left).toBeGreaterThanOrEqual(-1)
        expect(bounds.right).toBeLessThanOrEqual(bounds.viewport + 1)
      }
      const footer = page.locator('.public-website .section-footer').last()
      await footer.scrollIntoViewIfNeeded()
      await expect(footer).toBeVisible()
      await page.screenshot({
        path: info.outputPath('public-full-' + sitePage.slug + '.png'),
        fullPage: true,
      })
    }
  })

for (const device of devices)
  test(`${device.name}: Website Builder preserves compact controls and editable canvas`, async ({
    page,
  }, info) => {
    await page.setViewportSize(device)
    const draft = validateWebsite(
      phase2Site({
        logo: 'logo',
        interior: 'interior',
        architecture: 'architecture',
        finished: 'finished',
        planning: 'planning',
      }),
    )
    await routeWebsiteBuilderFixture(page, (data) => {
      if (data.action === 'getImage') {
        const image = images[data.id]!
        return {
          base64: readFileSync(image.path).toString('base64'),
          contentType: image.contentType,
        }
      }
      if (data.action === 'listRevisions') return { revisions: [], activity: [] }
      if (data.action === 'save') return { version: 2 }
      return { draft, version: 1, publishedAt: null, hasPrevious: false }
    })
    await gotoPhase2App(page, '/admin/website', createJobsFixture())
    await expect(page.getByRole('button', { name: 'Design', exact: true })).toBeEnabled({
      timeout: 15000,
    })
    for (const mode of ['Content', 'Design', 'Code']) {
      await page.getByRole('button', { name: mode, exact: true }).click()
      await contained(page)
      await screenshot(page, 'website-' + mode.toLowerCase(), info)
      const canvasTab = page
        .getByRole('navigation', { name: 'Builder panels' })
        .getByRole('button', { name: 'Canvas', exact: true })
      if (await canvasTab.isVisible()) await canvasTab.click()
      await expect(page.getByLabel('Website grid workspace', { exact: true })).toBeVisible()
      await contained(page)
      await screenshot(page, 'website-' + mode.toLowerCase() + '-canvas', info)
    }
    await page.getByRole('button', { name: 'Content', exact: true }).click()
    await page.getByRole('button', { name: 'Site settings', exact: true }).click()
    await expect(page.getByLabel('Website name', { exact: true })).toBeVisible()
    await contained(page)
    await screenshot(page, 'website-settings', info)
  })
