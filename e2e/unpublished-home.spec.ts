import { expect, test, type Page } from './helpers/test.js'
import {
  createJobDashboardFixture,
  createJobsFixture,
  gotoPhase2App,
} from './helpers/phase2AppFixture.js'
import { newSection, type WebsiteSite } from '../src/features/website/types.js'

const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }
const published: WebsiteSite = {
  name: 'Phase 2',
  accent: '#174878',
  pages: [
    {
      id: 'home',
      slug: 'home',
      title: 'Home',
      description: 'Published home description',
      inNavigation: true,
      sections: [{ ...newSection('hero'), id: 'home-hero', title: 'Published company home' }],
    },
    {
      id: 'company',
      slug: 'company',
      title: 'Company',
      description: 'Published company description',
      inNavigation: true,
      sections: [{ ...newSection('hero'), id: 'company-hero', title: 'Published company details' }],
    },
  ],
}
async function mockPublished(page: Page, site: WebsiteSite | null, failFirst = false) {
  let calls = 0
  await page.route('**/getPublishedWebsite', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers })
      return
    }
    calls++
    if (failFirst && calls === 1) {
      await route.fulfill({
        status: 503,
        headers,
        json: { error: { status: 'UNAVAILABLE', message: 'Synthetic outage' } },
      })
      return
    }
    await route.fulfill({ headers, json: { result: { site } } })
  })
  return () => calls
}
async function expectLogin(page: Page) {
  await expect(page).toHaveURL(/\/login$/)
  await expect(
    page.getByRole('heading', { name: 'Phase 2 Web Application', exact: true }),
  ).toBeVisible()
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible()
  await expect(page.getByText('Our website is coming soon', { exact: true })).toHaveCount(0)
}

for (const { path, width } of [
  { path: '/', width: 390 },
  { path: '/website', width: 1440 },
  { path: '/website/home', width: 1440 },
]) {
  test(`unpublished ${path} redirects signed-out visitors to employee login`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const calls = await mockPublished(page, null)
    await page.goto(path)
    await expectLogin(page)
    expect(calls()).toBe(1)
    await page.reload()
    await expectLogin(page)
    expect(calls()).toBe(1)
  })

  test(`published ${path} still renders the public home`, async ({ page }) => {
    await mockPublished(page, published)
    await page.goto(path)
    await expect(page).toHaveURL(new RegExp(path === '/' ? '/$' : path + '$'))
    await expect(
      page.getByRole('heading', { name: 'Published company home', exact: true }),
    ).toBeVisible()
    await expect(page).toHaveTitle('Home | Phase 2')
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      'Published home description',
    )
  })
}

test('unpublished redirect replaces history and preserves forgot-password navigation', async ({
  page,
}) => {
  const calls = await mockPublished(page, null)
  await page.goto('/forgot-password?email=field%40example.com')
  await expect(page.getByRole('heading', { name: 'Reset Password', exact: true })).toBeVisible()
  await page.goto('/')
  await expectLogin(page)
  await page.goBack()
  await expect(page).toHaveURL(/\/forgot-password\?email=field%40example.com$/)
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('field@example.com')
  await page.goForward()
  await expectLogin(page)
  expect(calls()).toBe(1)
  await page.getByLabel('Email', { exact: true }).fill('person@example.com')
  await page.getByRole('link', { name: 'Forgot Password?', exact: true }).click()
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === '/forgot-password' && url.searchParams.get('email') === 'person@example.com',
  )
})

test('direct login does not load or redirect through the public website', async ({ page }) => {
  const calls = await mockPublished(page, published)
  await page.goto('/login')
  await expectLogin(page)
  expect(calls()).toBe(0)
})

test('public load errors stay retryable rather than being treated as unpublished', async ({
  page,
}) => {
  const calls = await mockPublished(page, null, true)
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText(
    'The website could not be loaded. Please try again.',
  )
  await expect(page).toHaveURL(/\/$/)
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expectLogin(page)
  expect(calls()).toBe(2)
})

test('published page navigation, missing pages and Employee Login retain their behavior', async ({
  page,
}) => {
  await mockPublished(page, published)
  await page.goto('/')
  await page
    .getByRole('navigation', { name: 'Website navigation', exact: true })
    .getByRole('link', { name: 'Company', exact: true })
    .click()
  await expect(page).toHaveURL(/\/website\/company$/)
  await expect(
    page.getByRole('heading', { name: 'Published company details', exact: true }),
  ).toBeVisible()
  await page.goBack()
  await expect(
    page.getByRole('heading', { name: 'Published company home', exact: true }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Employee Login', exact: true }).click()
  await expectLogin(page)
  await page.goBack()
  await expect(
    page.getByRole('heading', { name: 'Published company home', exact: true }),
  ).toBeVisible()
  await page.goto('/website/not-a-published-page')
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/website\/not-a-published-page$/)
  await page.getByRole('link', { name: 'Back to home', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Published company home', exact: true }),
  ).toBeVisible()
})

for (const [role, fixture] of [
  ['Foreman', createJobDashboardFixture()],
  ['Admin', createJobsFixture()],
] as const) {
  test(`an authenticated ${role} retains the existing login-to-Jobs redirect`, async ({ page }) => {
    await mockPublished(page, null)
    await gotoPhase2App(page, '/', fixture)
    await expect(page).toHaveURL(/\/jobs$/)
    await expect(page.getByTestId('jobs-search')).toBeVisible()
  })
}
