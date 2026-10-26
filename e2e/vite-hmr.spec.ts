import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from './helpers/test.js'
import { mockDashboard } from './helpers/dashboardFixture.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { setupFormServer } from './helpers/formFixture.js'
import { withWebsiteDefaults } from '../src/features/website/types.js'

function restoreUnchangedFile(path: string, expected: string, original: string) {
  if (readFileSync(path, 'utf8') === expected) writeFileSync(path, original)
}

async function trackPreviewListeners(page: Page) {
  await page.evaluate(async () => {
    const clientPath = '/@vite/client'
    const client = await import(clientPath)
    type ListenerMethod = (this: unknown, event: string, callback: unknown) => unknown
    const prototype = Object.getPrototypeOf(
      client.createHotContext('/phase2-hmr-listener-check'),
    ) as { on: ListenerMethod; off: ListenerMethod }
    const on = prototype.on,
      off = prototype.off,
      counts = { on: 0, off: 0 }
    Reflect.set(window, '__phase2PreviewListeners', counts)
    prototype.on = function (event, callback) {
      if (event === 'vite:afterUpdate') counts.on++
      return on.call(this, event, callback)
    }
    prototype.off = function (event, callback) {
      if (event === 'vite:afterUpdate') counts.off++
      return off.call(this, event, callback)
    }
  })
}

test('npm run dev updates templates and CSS without discarding an unsaved dashboard edit', async ({
  page,
}) => {
  const view = fileURLToPath(new URL('../src/views/SharedDashboardView.vue', import.meta.url))
  const styles = fileURLToPath(new URL('../src/styles/shared-dashboards.css', import.meta.url))
  const source = readFileSync(view, 'utf8'),
    css = readFileSync(styles, 'utf8')
  const changedSource = source.replace('Find a widget<input', 'Find a widget (HMR check)<input')
  expect(changedSource).not.toBe(source)
  expect(changedSource.split('</script>')[0]).toBe(source.split('</script>')[0])
  const changedCss = css + '\n.shared-dashboard { --hmr-verification: ready; }\n'
  const updates: string[] = []
  const messages: string[] = []
  page.on('console', (event) => {
    if (/vite|hmr/i.test(event.text())) messages.push(event.text())
  })
  page.on('websocket', (socket) => {
    socket.on('framereceived', (event) => {
      updates.push(String(event.payload))
    })
  })
  const api = await mockDashboard(page)
  api.layouts.set('role-admin', {
    version: 1,
    widgets: [{ id: 'text', type: 'text', title: 'Original', text: '', span: 12 }],
  })
  await gotoPhase2App(page, '/dashboards/role', createJobsFixture())
  const servedModule = await page.request.get('/src/views/SharedDashboardView.vue')
  expect(await servedModule.text()).toContain(view.replaceAll('\\', '/'))
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByLabel('Title', { exact: true }).fill('Unsaved HMR draft')
  await page.evaluate(() => {
    Object.assign(window, { __phase2HmrMarker: 'same-document' })
  })
  try {
    writeFileSync(view, changedSource)
    await expect(page.getByLabel('Find a widget (HMR check)', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Unsaved HMR draft')
    writeFileSync(styles, changedCss)
    await expect
      .poll(() =>
        page
          .locator('.shared-dashboard')
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue('--hmr-verification').trim(),
          ),
      )
      .toBe('ready')
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Unsaved HMR draft')
    expect(await page.evaluate(() => Reflect.get(window, '__phase2HmrMarker'))).toBe(
      'same-document',
    )
    expect(
      updates.some(
        (update) => update.includes('SharedDashboardView.vue') && update.includes('update'),
      ),
    ).toBe(true)
    expect(
      updates.some(
        (update) => update.includes('shared-dashboards.css') && update.includes('update'),
      ),
    ).toBe(true)
    expect(updates.some((update) => update.includes('full-reload'))).toBe(false)
    // Verify consecutive individual saves as well as the first update. The Vue
    // plugin can remount a component when multiple different files change in
    // one batch; do not promise state retention for that upstream behavior.
    writeFileSync(styles, css)
    await expect
      .poll(() =>
        page
          .locator('.shared-dashboard')
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue('--hmr-verification').trim(),
          ),
      )
      .toBe('')
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Unsaved HMR draft')
    writeFileSync(view, source)
    await expect(page.getByLabel('Find a widget', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Unsaved HMR draft')
  } finally {
    // Do not overwrite a concurrent human edit made while this test was running.
    restoreUnchangedFile(view, changedSource, source)
    restoreUnchangedFile(styles, changedCss, css)
    await test.info().attach('hmr-transport', {
      body: JSON.stringify({ updates, messages }),
      contentType: 'application/json',
    })
  }
})

test('Form Builder and its real preview receive template and style updates without losing draft content', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  const builder = fileURLToPath(new URL('../src/views/FormBuilderView.vue', import.meta.url))
  const preview = fileURLToPath(
    new URL('../src/components/forms/FormDefinitionPreview.vue', import.meta.url),
  )
  const source = readFileSync(builder, 'utf8'),
    content = readFileSync(preview, 'utf8')
  const changedBuilder = source.replace('Form title<input', 'Form title (HMR check)<input')
  const changedPreview = content.replace(
    'Full-page form preview',
    'Full-page form preview HMR check',
  )
  const styledPreview = changedPreview.replace(
    '</style>',
    '.form-preview { --form-hmr-verification: ready; }\n</style>',
  )
  const updates: string[] = []
  page.on('websocket', (socket) =>
    socket.on('framereceived', (event) => updates.push(String(event.payload))),
  )
  const context = await setupFormServer(page, { initialPath: '/admin/forms' })
  await page.getByRole('button', { name: context.definition.title, exact: true }).click()
  const tabs = page.getByRole('tablist', { name: 'Form settings' })
  await tabs.getByRole('tab', { selected: true }).focus()
  await page.keyboard.press('Home')
  await expect(tabs.getByRole('tab', { name: 'Form', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.getByLabel('Form title', { exact: true }).fill('Unsaved form HMR draft')
  try {
    writeFileSync(builder, changedBuilder)
    await expect(page.getByLabel('Form title (HMR check)', { exact: true })).toHaveValue(
      'Unsaved form HMR draft',
    )
    writeFileSync(builder, source)
    await expect(page.getByLabel('Form title', { exact: true })).toHaveValue(
      'Unsaved form HMR draft',
    )
    await page
      .getByRole('navigation', { name: 'Builder modes' })
      .getByRole('button', { name: 'Preview', exact: true })
      .click()
    const answer = page.locator('.form-preview textarea').first()
    await answer.fill('Unsaved preview answer')
    writeFileSync(preview, changedPreview)
    await expect(
      page.getByRole('region', { name: 'Full-page form preview HMR check', exact: true }),
    ).toBeVisible()
    await expect(answer).toHaveValue('Unsaved preview answer')
    writeFileSync(preview, styledPreview)
    await expect
      .poll(() =>
        page
          .locator('.form-preview')
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue('--form-hmr-verification').trim(),
          ),
      )
      .toBe('ready')
    await expect(answer).toHaveValue('Unsaved preview answer')
    await expect(
      page.getByRole('heading', { name: 'Unsaved form HMR draft', exact: true }),
    ).toBeVisible()
    writeFileSync(preview, changedPreview)
    await expect
      .poll(() =>
        page
          .locator('.form-preview')
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue('--form-hmr-verification').trim(),
          ),
      )
      .toBe('')
    writeFileSync(preview, content)
    await expect(
      page.getByRole('region', { name: 'Full-page form preview', exact: true }),
    ).toBeVisible()
    await expect(answer).toHaveValue('Unsaved preview answer')
  } finally {
    await test.info().attach('form-hmr-styles', {
      body: JSON.stringify({
        updates,
        styles: await page
          .locator('style')
          .evaluateAll((elements) =>
            elements
              .filter(
                (element) =>
                  element.dataset.viteDevId?.includes('FormDefinitionPreview.vue') ||
                  element.textContent?.includes('--form-hmr-verification'),
              )
              .map((element) => ({ id: element.dataset.viteDevId, text: element.textContent })),
          ),
      }),
      contentType: 'application/json',
    })
    restoreUnchangedFile(builder, changedBuilder, source)
    restoreUnchangedFile(preview, styledPreview, content)
    restoreUnchangedFile(preview, changedPreview, content)
  }
})

test('website editor, isolated code preview and public Vite entry receive source updates', async ({
  page,
  context,
}) => {
  const canvas = fileURLToPath(
    new URL('../src/components/website/WebsiteCanvas.vue', import.meta.url),
  )
  const source = readFileSync(canvas, 'utf8')
  const changed = source.replace(
    'class="website-canvas"',
    'class="website-canvas" data-hmr-check="updated"',
  )
  const changedAgain = changed.replace('data-hmr-check="updated"', 'data-hmr-check="updated-again"')
  const site = withWebsiteDefaults({
    name: 'Synthetic HMR website',
    accent: '#174878',
    pages: [
      {
        id: 'home',
        slug: 'home',
        title: 'Home',
        description: '',
        inNavigation: true,
        sections: [
          {
            id: 'hero',
            type: 'hero',
            title: 'Synthetic HMR heading',
            text: 'Local fixture only',
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
  })
  const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
  await page.route('**/websiteBuilder', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const action = route.request().postDataJSON().data.action
    if (action === 'save')
      return route.fulfill({
        status: 409,
        headers,
        json: {
          error: { status: 'ABORTED', message: 'Synthetic save held for HMR verification.' },
        },
      })
    await route.fulfill({
      headers,
      json: {
        result: { draft: structuredClone(site), version: 1, publishedAt: null, hasPrevious: false },
      },
    })
  })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Site settings', exact: true }).click()
  await page.getByLabel('Website name', { exact: true }).fill('Unsaved website HMR draft')
  const publicPage = await context.newPage()
  const messages: string[] = []
  page.on('console', (event) => {
    if (/vite|Content Security Policy|connect-src/i.test(event.text())) messages.push(event.text())
  })
  try {
    writeFileSync(canvas, changed)
    await expect(
      page.locator('.preview-frame .website-canvas[data-hmr-check="updated"]'),
    ).toBeVisible()
    await expect(page.getByLabel('Website name', { exact: true })).toHaveValue(
      'Unsaved website HMR draft',
    )
    await trackPreviewListeners(page)
    await page.getByRole('button', { name: 'Code', exact: true }).click()
    await page.getByRole('button', { name: 'Run code preview', exact: true }).click()
    const frame = page.frameLocator('iframe[title="Website code preview"]')
    await expect(
      frame.getByRole('heading', { name: 'Synthetic HMR heading', exact: true }),
    ).toBeVisible()
    const runtime = await page.request.get('/website-runtime.html')
    expect(runtime.headers()['content-security-policy']).toContain("connect-src 'none'")
    await expect(page.locator('iframe[title="Website code preview"]')).toHaveAttribute(
      'sandbox',
      'allow-scripts allow-forms allow-top-navigation-by-user-activation',
    )
    await publicPage.route('**/getPublishedWebsite*', (route) =>
      route.request().method() === 'OPTIONS'
        ? route.fulfill({ status: 204, headers })
        : route.fulfill({ headers, json: { result: { site } } }),
    )
    await publicPage.addInitScript(() => {
      if (location.pathname === '/public-site.html') history.replaceState(null, '', '/')
    })
    const publicModule = publicPage.waitForRequest((request) =>
      request.url().includes('/src/publicMain.ts'),
    )
    await publicPage.goto('/public-site.html')
    await publicModule
    await expect(publicPage.locator('.website-canvas[data-hmr-check="updated"]')).toBeVisible()
    writeFileSync(canvas, changedAgain)
    await expect(
      publicPage.locator('.website-canvas[data-hmr-check="updated-again"]'),
    ).toBeVisible()
    await expect(frame.locator('.website-canvas[data-hmr-check="updated-again"]')).toBeVisible()
    await expect(page.getByLabel('Website name', { exact: true })).toHaveValue(
      'Unsaved website HMR draft',
    )
    expect(await page.evaluate(() => Reflect.get(window, '__phase2PreviewListeners'))).toEqual({
      on: 1,
      off: 0,
    })
    await page.getByRole('button', { name: 'Stop code preview', exact: true }).click()
    expect(await page.evaluate(() => Reflect.get(window, '__phase2PreviewListeners'))).toEqual({
      on: 1,
      off: 1,
    })
    await page.getByRole('button', { name: 'Run code preview', exact: true }).click()
    await expect(frame.locator('.website-canvas[data-hmr-check="updated-again"]')).toBeVisible()
    expect(await page.evaluate(() => Reflect.get(window, '__phase2PreviewListeners'))).toEqual({
      on: 2,
      off: 1,
    })
    await page.getByRole('button', { name: 'Stop code preview', exact: true }).click()
    expect(await page.evaluate(() => Reflect.get(window, '__phase2PreviewListeners'))).toEqual({
      on: 2,
      off: 2,
    })
  } finally {
    restoreUnchangedFile(canvas, changedAgain, source)
    restoreUnchangedFile(canvas, changed, source)
    await publicPage.close()
    await test
      .info()
      .attach('website-hmr-console', {
        body: JSON.stringify(messages),
        contentType: 'application/json',
      })
  }
})
