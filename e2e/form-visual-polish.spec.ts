import { expect, test } from './helpers/test.js'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
import { setupFormServer } from './helpers/formFixture.js'
import { withWebsiteDefaults } from '../src/features/website/types.js'

function contrast(a: string, b: string) {
  const luminance = (value: string) => {
    const rgb = value
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map(Number)
      .map((v) => {
        const c = v / 255
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      })
    return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722
  }
  const x = luminance(a),
    y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

for (const width of [1440, 820, 390]) {
  test(
    'polished Forms controls, icons, focus and readable file selector at ' + width + 'px',
    async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 })
      await gotoPhase2App(page, '/admin/forms', createJobsFixture())
      await page.getByRole('button', { name: 'New form', exact: true }).click()
      await page.getByRole('button', { name: 'Add photo', exact: true }).click()
      const file = page.locator('.canvas-field-preview input[type=file]')
      await expect(file).toBeDisabled()
      const style = await file.evaluate((el) => {
        const button = getComputedStyle(el, '::file-selector-button')
        return {
          color: button.color,
          background: button.backgroundColor,
          opacity: getComputedStyle(el).opacity,
        }
      })
      expect(contrast(style.color, style.background)).toBeGreaterThanOrEqual(4.5)
      expect(style.opacity).toBe('1')
      await expect(
        page.getByRole('button', { name: 'Undo', exact: true }).locator('.pi-undo'),
      ).toHaveCount(1)
      await expect(
        page.getByRole('button', { name: 'Redo', exact: true }).locator('.pi-refresh'),
      ).toHaveCount(1)
      const devices = page.getByRole('group', { name: 'Preview device', exact: true })
      for (const [name, icon] of [
        ['Desktop', 'pi-desktop'],
        ['Tablet', 'pi-tablet'],
        ['Phone', 'pi-mobile'],
      ]) {
        const button = devices.getByRole('button', { name, exact: true })
        await expect(button.locator('.' + icon)).toHaveCount(1)
        await button.click()
        await expect(button).toHaveAttribute('aria-pressed', 'true')
      }
      const fit = page.getByRole('button', { name: 'Fit', exact: true })
      await expect(fit).toHaveAttribute('aria-pressed', 'true')
      await fit.focus()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Shift+Tab')
      await expect(fit).toBeFocused()
      const focus = await fit.evaluate((el) => {
        const style = getComputedStyle(el)
        return { width: parseFloat(style.outlineWidth), style: style.outlineStyle }
      })
      expect(focus.width).toBeGreaterThanOrEqual(2)
      expect(focus.style).not.toBe('none')
      await expect(page.getByRole('button', { name: 'Redo', exact: true })).toBeDisabled()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true)
      expect((await page.locator('.settings-tabs').boundingBox())!.height).toBeLessThan(65)
      await page.screenshot({ path: testInfo.outputPath('polished-form-' + width + '.png') })
    },
  )
}

test('compact server navigation selects its target, scopes actions and retains unsaved-discard safeguards', async ({
  page,
}) => {
  await setupFormServer(page)
  const title = (index: number) =>
    'Audit ' +
    index.toString().padStart(2, '0') +
    ' — committee review for a long descriptive form title'
  const templates = Array.from({ length: 30 }, (_, index) => ({
    id: 'library-' + index,
    revision: 1,
    latestVersion: 1,
    used: true,
    archived: false,
    draft: {
      title: title(index),
      description: '',
      recipients: [],
      fields: [{ id: 'notes', kind: 'textarea', label: 'Notes', required: false, options: [] }],
    },
  }))
  await page.route('**/formTemplates', async (route) => {
    expect(route.request().postDataJSON().data.action).toBe('list')
    await route.fulfill({ json: { result: { templates } } })
  })
  await gotoPhase2App(page, '/admin/forms', createJobsFixture())
  const library = page.getByLabel('Server form library', { exact: true })
  await expect(library.locator('article')).toHaveCount(30)
  await library.getByRole('button', { name: title(0), exact: true }).click()
  await expect(page.getByRole('button', { name: 'Library', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(
    library.getByRole('button', { name: 'Duplicate server form', exact: true }),
  ).toHaveCount(1)
  await expect(
    library.getByRole('button', { name: 'Remove or archive server form', exact: true }),
  ).toHaveCount(1)
  expect((await library.locator('article').nth(1).boundingBox())!.height).toBeLessThan(85)
  expect(
    await library
      .getByRole('button', { name: title(1), exact: true })
      .locator('span')
      .evaluate((el) => getComputedStyle(el).textOverflow),
  ).toBe('ellipsis')
  await page
    .getByRole('navigation', { name: 'Form settings tabs' })
    .getByRole('button', { name: 'Form', exact: true })
    .click()
  await page.getByLabel('Form title', { exact: true }).fill('Unsaved library work')
  await library.getByRole('button', { name: title(1), exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByLabel('Form title', { exact: true })).toHaveValue('Unsaved library work')
  await expect(library.getByRole('button', { name: title(0), exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await library.getByRole('button', { name: title(1), exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Discard edits', exact: true }).click()
  await expect(library.getByRole('button', { name: title(1), exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByLabel('Form title', { exact: true })).toHaveValue(title(1))
})

test('reusing unchanged builder styles matches reference controls without changing Website Builder rendering', async ({
  page,
}) => {
  const draft = withWebsiteDefaults({
    name: 'Phase 2',
    accent: '#174878',
    contactEmail: '',
    pages: [
      {
        id: 'home',
        title: 'Home',
        slug: 'home',
        description: '',
        inNavigation: true,
        sections: [],
      },
    ],
  })
  await page.route('**/websiteBuilder', async (route) => {
    const action = route.request().postDataJSON().data.action
    expect(action).toBe('load')
    await route.fulfill({
      json: { result: { draft, version: 1, publishedAt: null, hasPrevious: false, savedAt: 1 } },
    })
  })
  await gotoPhase2App(page, '/admin/website', createJobsFixture())
  const metrics = async () =>
    page.getByRole('button', { name: 'Save draft', exact: true }).evaluate((el) => {
      const style = getComputedStyle(el)
      return {
        color: style.color,
        background: style.backgroundColor,
        border: style.borderColor,
        radius: style.borderRadius,
        font: style.fontFamily,
        size: style.fontSize,
      }
    })
  const before = await metrics()
  await page.getByRole('link', { name: 'Form Builder', exact: true }).click()
  await page.getByRole('button', { name: 'New form', exact: true }).click()
  const form = await page
    .getByRole('button', { name: 'Save local draft', exact: true })
    .evaluate((el) => {
      const style = getComputedStyle(el)
      return {
        color: style.color,
        background: style.backgroundColor,
        border: style.borderColor,
        radius: style.borderRadius,
        font: style.fontFamily,
        size: style.fontSize,
      }
    })
  expect(form).toEqual(before)
  await page.getByRole('button', { name: 'Save local draft', exact: true }).click()
  await page.getByRole('link', { name: 'Website Builder', exact: true }).click()
  expect(await metrics()).toEqual(before)
  await expect(page.getByRole('button', { name: 'Content', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Design', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Design', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Code', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Code', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})
