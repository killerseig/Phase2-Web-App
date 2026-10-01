import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { expect, test, type Page } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { phase2Site } from '../src/features/website/phase2Site.js'
import type { WebsiteSite } from '../src/features/website/types.js'

const { validateWebsite } = createRequire(import.meta.url)('../functions/websiteModel.js')
const image = readFileSync('src/assets/images/phase2-logo.png').toString('base64')
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }

async function sharedDraftApi(page: Page) {
  let draft: WebsiteSite = validateWebsite(phase2Site({ logo: 'logo', interior: 'photo' }))
  let version = 1
  let loadCount = 0
  let pendingLoad: Promise<void> | undefined
  let releaseLoad: (() => void) | undefined
  let heldLoad = false
  const saves: number[] = []

  await page.route('**/websiteBuilder', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers })
      return
    }
    const data = route.request().postDataJSON().data
    let result: unknown = { version }
    if (data.action === 'load') {
      loadCount++
      // Capture the response before the hold, like a read already in transit.
      result = {
        draft: structuredClone(draft),
        version,
        publishedAt: null,
        hasPrevious: false,
        savedAt: Date.now(),
      }
      if (pendingLoad) {
        const wait = pendingLoad
        pendingLoad = undefined
        heldLoad = true
        await wait
        heldLoad = false
      }
    }
    if (data.action === 'save') {
      saves.push(data.version)
      if (data.version !== version) {
        await route.fulfill({
          status: 409,
          headers,
          json: {
            error: {
              status: 'ABORTED',
              message: 'Another admin changed the website. Reload and review before saving.',
            },
          },
        })
        return
      }
      draft = validateWebsite(data.site)
      result = { version: ++version }
    }
    if (data.action === 'getImage') result = { base64: image, contentType: 'image/png' }
    if (data.action === 'listRevisions') result = { revisions: [], activity: [] }
    await route.fulfill({ headers, json: { result } })
  })

  return {
    heading: (slug: string) =>
      draft.pages.find((entry) => entry.slug === slug)!.sections.find((s) => s.type === 'hero')!
        .title,
    changeHeading: (slug: string, title: string) => {
      draft = structuredClone(draft)
      draft.pages
        .find((entry) => entry.slug === slug)!
        .sections.find((s) => s.type === 'hero')!.title = title
      version++
    },
    holdNextLoad: () => {
      pendingLoad = new Promise<void>((resolve) => {
        releaseLoad = resolve
      })
    },
    releaseLoad: () => releaseLoad?.(),
    held: () => heldLoad,
    loads: () => loadCount,
    version: () => version,
    saves,
  }
}

async function openSavedEditor(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Design', exact: true }).click()
  await expect(page.locator('.preview-frame').getByRole('heading', { level: 1 })).toBeVisible()
  // Persist any normal grid defaults so the fixture begins with a clean editor.
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.locator('.builder-title')).toContainText('Draft saved')
  await page.evaluate(() => {
    document.body.dataset.sharedDraftTestSession = 'same-editor'
  })
}

async function returnToEditor(page: Page, event: 'focus' | 'visibilitychange') {
  await page.evaluate((eventName) => {
    if (eventName === 'focus') window.dispatchEvent(new Event('focus'))
    else document.dispatchEvent(new Event('visibilitychange'))
  }, event)
}

async function editHero(page: Page, title: string) {
  await page.locator('.preview-frame').getByRole('heading', { level: 1 }).click()
  const field = page
    .getByRole('region', { name: 'Selected element editor' })
    .getByLabel('Heading', { exact: true })
  await field.fill(title)
  return field
}

test('an untouched initial editor refreshes the shared draft despite materialized layout defaults', async ({
  page,
}) => {
  const api = await sharedDraftApi(page)
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  await page.getByRole('button', { name: 'Design', exact: true }).click()
  const hero = page.locator('.preview-frame').getByRole('heading', { level: 1 })
  await expect(hero).toHaveText(api.heading('home').replace(/\s+/g, ' '))
  expect(api.saves).toHaveLength(0)
  api.changeHeading('home', 'Shared content updates without a preliminary save')

  await returnToEditor(page, 'focus')

  await expect(hero).toHaveText('Shared content updates without a preliminary save')
  await expect(page.getByRole('button', { name: 'Load latest draft', exact: true })).toHaveCount(0)
  expect(api.saves).toHaveLength(0)
})

for (const event of ['focus', 'visibilitychange'] as const) {
  test(`shared draft refreshes on ${event} without reloading or leaving the current page`, async ({
    page,
  }) => {
    const api = await sharedDraftApi(page)
    await openSavedEditor(page)
    await page.getByRole('button', { name: 'Company /company', exact: true }).click()
    const hero = page.locator('.preview-frame').getByRole('heading', { level: 1 })
    await expect(hero).toHaveText(api.heading('company').replace(/\s+/g, ' '))
    const loads = api.loads()
    const saves = api.saves.length
    api.changeHeading('company', 'Company updated by another admin')

    await returnToEditor(page, event)

    await expect.poll(api.loads).toBeGreaterThan(loads)
    await expect(hero).toHaveText('Company updated by another admin')
    await expect(page.locator('.builder-title')).toContainText('Draft saved')
    await expect(page.getByRole('button', { name: 'Load latest draft', exact: true })).toHaveCount(
      0,
    )
    await expect(page.locator('body')).toHaveAttribute(
      'data-shared-draft-test-session',
      'same-editor',
    )
    await expect(page).toHaveURL(/\/admin\/website$/)
    expect(api.saves).toHaveLength(saves)
  })
}

test('shared draft updates preserve local edits until the user confirms loading and retain recovery', async ({
  page,
}) => {
  const api = await sharedDraftApi(page)
  await openSavedEditor(page)
  const field = await editHero(page, 'Keep my unsaved headline')
  api.changeHeading('home', 'Headline saved by another admin')

  await returnToEditor(page, 'focus')

  await expect(page.getByText('A newer shared draft is available', { exact: false })).toBeVisible()
  await expect(field).toHaveValue('Keep my unsaved headline')
  expect(api.heading('home')).toBe('Headline saved by another admin')
  const loadLatest = page.getByRole('button', { name: 'Load latest draft', exact: true })
  await loadLatest.click()
  const confirmation = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true })
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(page.locator('.preview-frame').getByRole('heading', { level: 1 })).toHaveText(
    'Keep my unsaved headline',
  )
  await loadLatest.click()
  await confirmation.getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expect(page.locator('.preview-frame').getByRole('heading', { level: 1 })).toHaveText(
    'Headline saved by another admin',
  )
  await expect(page.getByRole('button', { name: 'Recover edits', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Recover edits', exact: true }).click()
  await expect(page.locator('.preview-frame').getByRole('heading', { level: 1 })).toHaveText(
    'Keep my unsaved headline',
  )
  expect(api.heading('home')).toBe('Headline saved by another admin')
})

test('a delayed shared draft response cannot overwrite edits made while it is loading', async ({
  page,
}) => {
  const api = await sharedDraftApi(page)
  await openSavedEditor(page)
  api.changeHeading('home', 'Remote headline already on the way')
  api.holdNextLoad()
  await returnToEditor(page, 'focus')
  await expect.poll(api.held).toBe(true)
  try {
    const field = await editHero(page, 'Typed while the shared draft was loading')
    api.releaseLoad()
    await expect(
      page.getByText('A newer shared draft is available', { exact: false }),
    ).toBeVisible()
    await expect(field).toHaveValue('Typed while the shared draft was loading')
    await expect(page.getByRole('button', { name: 'Load latest draft', exact: true })).toBeVisible()
    expect(api.heading('home')).toBe('Remote headline already on the way')
  } finally {
    api.releaseLoad()
  }
})
