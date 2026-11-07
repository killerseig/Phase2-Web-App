import { expect, test, type Page } from './helpers/test.js'
import type { Locator } from '@playwright/test'
import { createJobsFixture, gotoPhase2App } from './helpers/phase2AppFixture.js'
async function panel(page: Page, name: 'Forms' | 'Canvas' | 'Editor') {
  if ((page.viewportSize()?.width || 1280) <= 900)
    await page.getByRole('navigation', { name: 'Builder panels' }).getByRole('button', { name, exact: true }).click()
}
async function openFields(page: Page) {
  await panel(page, 'Editor')
  const toggle = page.getByRole('button', { name: 'Add fields', exact: true })
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click()
  await expect(page.getByRole('region', { name: 'Field palette', exact: true })).toBeVisible()
}
async function selectField(page: Page, index: number) {
  await panel(page, 'Canvas')
  const field = page.getByRole('article', { name: 'Field ' + index, exact: true })
  await field.focus()
  await expect(field).toBeFocused()
  await page.keyboard.press('Enter')
}
async function drag(
  page: Page,
  source: Locator,
  target: Locator,
  edge: 'before' | 'after' = 'before',
) {
  await target.scrollIntoViewIfNeeded()
  await source.scrollIntoViewIfNeeded()
  const to = (await target.boundingBox())!,
    from = (await source.boundingBox())!
  await page.mouse.move(from.x + 8, from.y + 8)
  await page.mouse.down()
  await page.mouse.move(to.x + 20, to.y + (edge === 'before' ? 8 : to.height - 8), { steps: 12 })
  await expect(page.locator('.form-drag-ghost')).toBeVisible()
  await page.mouse.up()
}

test('palette inserts into empty/between canvas rows; inspector and structural undo/redo preserve selection', async ({
  page,
}) => {
  await gotoPhase2App(page, '/admin/forms', createJobsFixture())
  await page.getByRole('button', { name: 'New form', exact: true }).click()
  await openFields(page)
  await drag(
    page,
    page.getByRole('button', { name: 'Add text', exact: true }),
    page.getByLabel('Form canvas'),
  )
  await expect(page.locator('.form-canvas .form-field > label')).toHaveCount(1)
  await page.getByLabel('Selected field label', { exact: true }).fill('First')
  await openFields(page)
  await page.getByRole('button', { name: 'Add number', exact: true }).click()
  await page.getByLabel('Selected field label', { exact: true }).fill('Last')
  await openFields(page)
  await drag(
    page,
    page.getByRole('button', { name: 'Add radio', exact: true }),
    page.getByRole('article', { name: 'Field 2', exact: true }),
  )
  await page.getByLabel('Selected field label', { exact: true }).fill('Middle')
  await page.getByLabel('Selected field required', { exact: true }).check()
  await page.getByLabel('Selected field options', { exact: true }).fill('One\nTwo')
  expect(
    await page
      .locator('.form-canvas .form-field > label')
      .evaluateAll((elements) =>
        elements.map((el) => (el.textContent || '').replace(/\s+\*$/, '').trim()),
      ),
  ).toEqual(['First', 'Middle', 'Last'])
  await page.getByRole('button', { name: 'Delete selected Middle', exact: true }).click()
  await expect(page.locator('.form-canvas .form-field > label')).toHaveCount(2)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByLabel('Selected field label', { exact: true })).toHaveValue('Middle')
  await expect(page.getByLabel('Selected field required', { exact: true })).toBeChecked()
  await expect(page.getByLabel('Selected field options', { exact: true })).toHaveValue('One\nTwo')
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(page.locator('.form-canvas .form-field > label')).toHaveCount(2)
})

test('keyboard add/order/undo stays accessible and saved schema retains existing properties', async ({
  page,
}) => {
  await gotoPhase2App(page, '/admin/forms', createJobsFixture())
  await page.getByRole('button', { name: 'New form', exact: true }).click()
  await page.getByRole('button', { name: 'Add fields', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'Field palette', exact: true })).toBeVisible()
  const add = page.getByRole('button', { name: 'Add number', exact: true })
  await add.focus()
  await expect(add).toBeFocused()
  await page.keyboard.press('Enter')
  await page.getByLabel('Selected field label', { exact: true }).fill('Count')
  await page.getByLabel('Minimum number', { exact: true }).fill('0')
  await page.getByLabel('Whole numbers only', { exact: true }).check()
  await page.getByLabel('Selected field hint', { exact: true }).fill('Whole personnel count')
  await openFields(page)
  await page.getByRole('button', { name: 'Add text', exact: true }).click()
  await page.getByLabel('Selected field label', { exact: true }).fill('Job')
  await page.getByRole('button', { name: 'Move Job up', exact: true }).click()
  await expect(page.locator('.form-canvas .form-field > label').first()).toContainText('Job')
  await page.getByRole('article', { name: 'Field 1', exact: true }).focus()
  await page.keyboard.press('Control+z')
  await expect(page.locator('.form-canvas .form-field > label').first()).toContainText('Count')
  await page.keyboard.press('Control+Shift+z')
  await expect(page.locator('.form-canvas .form-field > label').first()).toContainText('Job')
  await page.getByRole('button', { name: 'Save local draft', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Untitled form', exact: true }).click()
  await selectField(page, 2)
  await expect(page.getByLabel('Selected field hint', { exact: true })).toHaveValue(
    'Whole personnel count',
  )
  await expect(page.getByLabel('Whole numbers only', { exact: true })).toBeChecked()
})

test('escape cancels palette insertion and releasing outside adds nothing', async ({ page }) => {
  await gotoPhase2App(page, '/admin/forms', createJobsFixture())
  await page.getByRole('button', { name: 'New form', exact: true }).click()
  await openFields(page)
  const source = (await page.getByRole('button', { name: 'Add text', exact: true }).boundingBox())!
  const target = (await page.getByLabel('Form canvas').boundingBox())!
  await page.mouse.move(source.x + 8, source.y + 8)
  await page.mouse.down()
  await page.mouse.move(target.x + 10, target.y + 20, { steps: 8 })
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(page.locator('.form-canvas .form-field > label')).toHaveCount(0)
  await page.mouse.move(source.x + 8, source.y + 8)
  await page.mouse.down()
  await page.mouse.move(3, 3, { steps: 8 })
  await page.mouse.up()
  await expect(page.locator('.form-canvas .form-field > label')).toHaveCount(0)
})

test.describe('touch authoring', () => {
  test.use({ hasTouch: true, viewport: { width: 1280, height: 900 } })

  // Raw CDP drag diagnostics omitted Chromium's next compatibility click, even
  // within one input session. Keep drag and phone tap/swipe checks in fresh contexts.
  test('touch handle inserts a field between visible editor panes', async ({
    page,
  }) => {
    await gotoPhase2App(page, '/admin/forms', createJobsFixture())
    await page.getByRole('button', { name: 'New form', exact: true }).click()
    await openFields(page)
    await page.getByLabel('Form editor').scrollIntoViewIfNeeded()
    const source = page.getByRole('button', { name: 'Add text', exact: true })
    await page.getByLabel('Form canvas').scrollIntoViewIfNeeded()
    await page.waitForFunction(
      () =>
        document.querySelector('.canvas-document')!.getBoundingClientRect().width <=
        document.querySelector('.viewport-scroll')!.clientWidth,
    )
    const from = (await source.boundingBox())!,
      to = (await page.getByLabel('Form canvas').boundingBox())!
    expect(from.y).toBeGreaterThan(0)
    expect(to.y + 20).toBeLessThan(900)
    const session = await page.context().newCDPSession(page)
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: from.x + 10, y: from.y + 10 }],
    })
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: to.x + 20, y: Math.min(to.y + 20, 850) }],
    })
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(page.locator('.form-canvas .form-field > label')).toHaveCount(1)
    await expect(page.locator('.form-drag-ghost')).toHaveCount(0)
    expect(
      await page.getByLabel('Form canvas').evaluate((el) => getComputedStyle(el).touchAction),
    ).toBe('auto')
    expect(await source.evaluate((el) => getComputedStyle(el).touchAction)).toBe('none')
    await session.detach()
  })

  test('phone palette taps add one field each while canvas swipes retain native scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 })
    await gotoPhase2App(page, '/admin/forms', createJobsFixture())
    await page.getByRole('button', { name: 'New form', exact: true }).click()
    await expect.poll(() => page.locator('.app-shell__sidebar').evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(0)
    const source = page.getByRole('button', { name: 'Add text', exact: true })
    for (let index = 0; index < 7; index++) {
      await expect(page.locator('.form-canvas .form-field > label')).toHaveCount(index)
      await openFields(page)
      await expect(source).toBeEnabled()
      await source.tap()
      await expect(page.locator('.form-canvas .form-field > label')).toHaveCount(index + 1)
      await expect(page.getByRole('button', { name: 'Add fields', exact: true })).toHaveAttribute('aria-expanded', 'false')
    }
    await panel(page, 'Canvas')
    await page.getByRole('group', { name: 'Preview device', exact: true }).getByRole('button', { name: 'Phone', exact: true }).click()
    const canvas = page.locator('.viewport-scroll')
    await canvas.evaluate((el) => {
      el.scrollTop = 0
      el.scrollIntoView({ block: 'center' })
    })
    await expect.poll(() => canvas.evaluate(el => el.scrollHeight - el.clientHeight)).toBeGreaterThan(0)
    const bounds = (await canvas.boundingBox())!
    const x = bounds.x + bounds.width - 12,
      y = Math.min(bounds.y + bounds.height - 30, 850)
    expect(await page.getByLabel('Form canvas').evaluate(el => getComputedStyle(el).touchAction)).toBe('auto')
    const session = await page.context().newCDPSession(page)
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    for (let step = 1; step <= 6; step++) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y - step * 25 }],
      })
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect.poll(() => canvas.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
    await expect(page.locator('.form-canvas .form-field > label')).toHaveCount(7)
    await expect(page.locator('.form-drag-ghost')).toHaveCount(0)
    await session.detach()
  })
})

test('conditional inspector preserves references through deletion undo and template reload', async ({
  page,
}) => {
  await gotoPhase2App(page, '/admin/forms', createJobsFixture())
  await page.getByRole('button', { name: 'New form', exact: true }).click()
  await openFields(page)
  await page.getByRole('button', { name: 'Add choice', exact: true }).click()
  await page.getByLabel('Selected field label', { exact: true }).fill('Rating')
  await page.getByLabel('Selected field options', { exact: true }).fill('Good\nNeeds work')
  const sourceId = await page
    .getByRole('article', { name: 'Field 1', exact: true })
    .getAttribute('data-widget-id')
  await openFields(page)
  await page.getByRole('button', { name: 'Add textarea', exact: true }).click()
  await page.getByLabel('Selected field label', { exact: true }).fill('Explanation')
  await page.getByLabel('Required note source', { exact: true }).selectOption(sourceId!)
  await page.getByLabel('Required note values', { exact: true }).selectOption('Needs work')
  await selectField(page, 1)
  await page.getByLabel('Selected field type', { exact: true }).selectOption('number')
  await expect(page.getByRole('alert')).toContainText('required-note conditions')
  await expect(page.getByLabel('Selected field type', { exact: true })).toHaveValue('choice')
  await page.getByRole('button', { name: 'Delete selected Rating', exact: true }).click()
  await expect(page.getByLabel('Required note source', { exact: true })).toHaveValue('')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await selectField(page, 2)
  await expect(page.getByLabel('Required note source', { exact: true })).toHaveValue(sourceId!)
  await page.getByRole('button', { name: 'Keep local version', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Untitled form', exact: true }).click()
  await selectField(page, 2)
  await expect(page.getByLabel('Required note source', { exact: true })).toHaveValue(sourceId!)
  await expect(page.getByLabel('Required note values', { exact: true })).toHaveValues([
    'Needs work',
  ])
})

test('familiar shell keeps draft and preview answers while switching device widths', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  await gotoPhase2App(page, '/admin/forms', createJobsFixture())
  await page.getByRole('button', { name: 'New form', exact: true }).click()
  await page.getByLabel('Form title', { exact: true }).fill('Shell review')
  await openFields(page)
  await page.getByRole('button', { name: 'Add email', exact: true }).click()
  await page.getByLabel('Selected field label', { exact: true }).fill('Contact email')
  const devices = page.getByRole('group', { name: 'Preview device', exact: true })
  await devices.getByRole('button', { name: 'Phone', exact: true }).click()
  expect(
    await page.locator('.canvas-document').evaluate((el) => el.getBoundingClientRect().width),
  ).toBeLessThanOrEqual(391)
  await devices.getByRole('button', { name: 'Tablet', exact: true }).click()
  await devices.getByRole('button', { name: 'Desktop', exact: true }).click()
  await expect(page.getByLabel('Selected field label', { exact: true })).toHaveValue('Contact email')
  const modes = page.getByRole('navigation', { name: 'Builder modes' })
  await modes.getByRole('button', { name: 'Preview', exact: true }).click()
  await page.getByLabel('Contact email', { exact: false }).fill('review@example.com')
  for (const width of [390, 820, 1600]) {
    await page.setViewportSize({ width, height: 1000 })
    await expect(page.getByLabel('Contact email', { exact: false })).toHaveValue('review@example.com')
    expect(await page.getByRole('region', { name: 'Full-page form preview' }).evaluate(el => el.getBoundingClientRect().width)).toBeLessThanOrEqual(width)
  }
  await modes.getByRole('button', { name: 'Edit', exact: true }).click()
  const settings = page.getByRole('tablist', { name: 'Form settings' })
  await settings.getByRole('tab', { name: 'Form', exact: true }).click()
  await expect(page.getByLabel('Form title', { exact: true })).toHaveValue('Shell review')
  await settings.getByRole('tab', { name: 'Field', exact: true }).click()
  await expect(page.getByLabel('Selected field label', { exact: true })).toHaveValue(
    'Contact email',
  )
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Save local draft', exact: true }).click()
  await expect(page.locator('.form-builder-header small')).toHaveText('Draft saved · Local preview')
})
