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

async function mockWebsite(page: Page) {
  let draft: WebsiteSite = validateWebsite(phase2Site({ logo: 'logo', interior: 'photo' }))
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
    review.forms!.forEach((form) => {
      form.delivery!.to = ['careers@example.com']
    })
    await route.fulfill({ headers, json: { result: { site: publishedWebsite(review) } } })
  })
  await page.route('**/website-image?*', (route) =>
    route.fulfill({ path: imagePath, contentType: 'image/png' }),
  )
  return { actions, draft: () => draft }
}

test('public navbar and footer Employee login open the existing application login screen', async ({
  page,
}) => {
  const api = await mockWebsite(page)
  for (const region of ['Website navigation', 'Footer navigation']) {
    await page.goto('/website')
    const login = page
      .getByRole('navigation', { name: region, exact: true })
      .getByRole('link', { name: 'Employee login', exact: true })
    await expect(login).toHaveAttribute('href', '/login')
    await login.click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(
      page.getByRole('heading', { name: 'Phase 2 Web Application', exact: true }),
    ).toBeVisible()
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Forgot Password?', exact: true })).toBeVisible()
  }
  expect(api.actions).not.toContain('save')
  expect(api.actions).not.toContain('publish')
})

for (const activation of [
  {
    label: 'navbar click',
    region: 'Website navigation',
    activate: async (page: Page) =>
      page
        .locator('.preview-frame')
        .getByRole('navigation', { name: 'Website navigation', exact: true })
        .getByRole('link', { name: 'Employee login', exact: true })
        .click(),
  },
  {
    label: 'footer Enter',
    region: 'Footer navigation',
    activate: async (page: Page) =>
      page
        .locator('.preview-frame')
        .getByRole('navigation', { name: 'Footer navigation', exact: true })
        .getByRole('link', { name: 'Employee login', exact: true })
        .press('Enter'),
  },
]) {
  test(`builder Employee login ${activation.label} opens Jobs for signed-in admins and preserves draft recovery`, async ({
    page,
  }) => {
    const api = await mockWebsite(page)
    await page.setViewportSize({ width: 1600, height: 1000 })
    await gotoPhase2App(page, '/admin/website', createJobsFixture())
    await page.getByRole('button', { name: 'Design', exact: true }).click()
    const canvas = page.locator('.preview-frame')
    await expect(canvas.getByRole('heading', { level: 1 })).toBeVisible()
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })
      window.dispatchEvent(new Event('offline'))
    })
    await canvas.getByRole('heading', { level: 1 }).click()
    const title = `Retained after ${activation.label}`
    await page
      .getByRole('region', { name: 'Selected element editor' })
      .getByLabel('Heading', { exact: true })
      .fill(title)
    await expect(page.locator('.builder-title')).toContainText('Saved in browser')
    const login = canvas
      .getByRole('navigation', { name: activation.region, exact: true })
      .getByRole('link', { name: 'Employee login', exact: true })
    await expect(login).toHaveAttribute('href', '/login')
    await activation.activate(page)
    await expect(page).toHaveURL(/\/jobs$/)
    await expect(page.getByTestId('jobs-search')).toBeVisible()
    expect(
      api.draft().pages[0]!.sections.find((section) => section.type === 'hero')!.title,
    ).not.toBe(title)
    await page.getByRole('link', { name: 'Website Builder', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/website$/)
    await page.getByRole('button', { name: 'Recover edits', exact: true }).click()
    await expect(page.locator('.preview-frame').getByRole('heading', { level: 1 })).toHaveText(
      title,
    )
    expect(api.actions).not.toContain('publish')
  })
}

for (const mode of ['Content', 'Design']) {
  test(`builder Employee login labels remain editable with double-click and F2 in ${mode}`, async ({
    page,
  }) => {
    await mockWebsite(page)
    await page.setViewportSize({ width: 1600, height: 1000 })
    await gotoPhase2App(page, '/admin/website', createJobsFixture())
    await page.getByRole('button', { name: mode, exact: true }).click()
    const canvas = page.locator('.preview-frame')
    const editor = page.getByRole('textbox', { name: 'Edit menu label on page', exact: true })
    for (const region of ['Website navigation', 'Footer navigation']) {
      const nav = canvas.getByRole('navigation', { name: region, exact: true })
      await nav.getByRole('link', { name: 'Employee login', exact: true }).dblclick()
      await expect(editor).toBeFocused()
      await editor.press('ControlOrMeta+a')
      await editor.pressSequentially('Team portal')
      await editor.press('Enter')
      const renamed = nav.getByRole('link', { name: 'Team portal', exact: true })
      await expect(renamed).toHaveAttribute('href', '/login')
      await expect(page).toHaveURL(/\/admin\/website$/)
      await renamed.press('F2')
      await expect(editor).toBeFocused()
      await expect(editor).toHaveText('Team portal')
      await editor.press('ControlOrMeta+a')
      await editor.pressSequentially('Employee login')
      await editor.press('Enter')
      await expect(nav.getByRole('link', { name: 'Employee login', exact: true })).toHaveAttribute(
        'href',
        '/login',
      )
      await expect(page).toHaveURL(/\/admin\/website$/)
    }
    await expect(canvas.getByRole('heading', { level: 1 })).toHaveText(
      'Good work starts with good people.',
    )
  })
}
