import { expect, test } from './helpers/test'
import { createDailyLogsFixture, gotoPhase2App } from './helpers/phase2AppFixture'
function sampleImage(width: number, height: number, label: string) {
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '"><rect width="100%" height="100%" fill="#315c77"/><rect x="12" y="12" width="' + (width - 24) + '" height="' + (height - 24) + '" fill="none" stroke="#e9a47d" stroke-width="24"/><circle cx="' + width / 2 + '" cy="' + height / 2 + '" r="300" fill="#83bfdd"/><text x="40" y="100" fill="white" font-size="64">Synthetic ' + label + '</text></svg>')
}
for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'phone', width: 390, height: 844 }, { name: 'short-screen', width: 844, height: 390 }]) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('gallery matches shared styling and fully contains enlarged portrait and landscape images', async ({ page }) => {
      const fixture = createDailyLogsFixture()
      fixture.publicDailyLogGalleries = { 'style-gallery': { jobName: 'Synthetic gallery project', jobCode: 'TEST', logDate: '2026-11-05', sequenceNumber: 1, foremanName: 'Synthetic foreman', submittedAt: '2026-11-05T12:00:00Z', attachments: [
        { name: 'portrait.svg', type: 'photo', url: sampleImage(1600, 3200, 'portrait'), description: 'A portrait photo with its complete border visible.' },
        { name: 'landscape.svg', type: 'photo', url: sampleImage(3200, 1600, 'landscape'), description: 'A landscape photo with a longer caption. '.repeat(12) },
      ] } }
      await gotoPhase2App(page, '/daily-log-gallery/style-gallery', fixture)
      await expect(page.getByRole('heading', { name: 'Synthetic gallery project (#TEST)' })).toBeVisible()
      await expect(page.locator('.app-shell')).toHaveCount(0)
      await expect(page.getByRole('img', { name: 'Phase 2', exact: true })).toBeVisible()
      await page.screenshot({ path: 'evidence/daily-gallery-' + viewport.name + '.png', fullPage: true })
      await page.getByRole('button', { name: 'View portrait.svg' }).click()
      const viewer = page.getByRole('dialog')
      await expect(viewer).toBeVisible()
      await expect(viewer.getByRole('region', { name: 'Full-size photo', exact: true })).toHaveAttribute('aria-busy', 'false')
      await expect(viewer.getByRole('button', { name: 'Close photo viewer' })).toHaveClass(/app-icon-button/)
      for (const [name, width] of [['portrait.svg', 1600], ['landscape.svg', 3200]] as const) {
        const image = viewer.getByRole('img', { name, exact: true })
        await expect(image).toHaveJSProperty('naturalWidth', width)
        await expect(image).toHaveCSS('object-fit', 'contain')
        const bounds = await image.boundingBox(), stage = await viewer.locator('.daily-log-gallery__lightbox-stage').boundingBox()
        expect(bounds).not.toBeNull(); expect(stage).not.toBeNull()
        expect(bounds!.x).toBeGreaterThanOrEqual(stage!.x - 1); expect(bounds!.y).toBeGreaterThanOrEqual(stage!.y - 1)
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(stage!.x + stage!.width + 1)
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(stage!.y + stage!.height + 1)
        expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.y).toBeGreaterThanOrEqual(0)
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width)
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height)
        await page.screenshot({ path: 'evidence/daily-gallery-' + viewport.name + '-' + name + '.png', fullPage: true })
        await page.keyboard.press('ArrowRight')
      }
      await page.keyboard.press('Escape'); await expect(viewer).toBeHidden()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    })

    test('QC deep links open originals with zoom, pan, reset and low-resolution disclosure', async ({ page }) => {
      const fixture = createDailyLogsFixture()
      const original = sampleImage(1600, 2400, 'original'), thumbnail = sampleImage(120, 180, 'thumbnail')
      fixture.publicDailyLogGalleries = { 'zoom-gallery': { jobName: 'Synthetic QC project', jobCode: 'QC', logDate: '2026-11-03', sequenceNumber: 1, foremanName: 'Synthetic foreman', submittedAt: '2026-11-03T12:00:00Z', attachments: [
        { name: 'qc-original.svg', type: 'qc', url: original, thumbnailUrl: thumbnail, description: 'QC original' },
        { name: 'small-source.svg', type: 'qc', url: sampleImage(240, 320, 'small source'), description: 'Low resolution source' },
      ] } }
      await gotoPhase2App(page, '/daily-log-gallery/zoom-gallery#gallery-qc-1', fixture)
      const viewer = page.getByRole('dialog'), scroll = viewer.locator('.daily-log-gallery__image-scroll')
      await expect(viewer).toBeVisible()
      await expect(viewer.getByRole('region', { name: 'Full-size photo', exact: true })).toHaveAttribute('aria-busy', 'false')
      await expect(viewer.getByRole('img', { name: 'qc-original.svg', exact: true })).toHaveJSProperty('naturalWidth', 1600)
      await expect(page.locator('.daily-log-gallery__photo-button img').first()).toHaveJSProperty('naturalWidth', 120)
      await expect(viewer.getByRole('link', { name: 'Open original', exact: true })).toHaveAttribute('href', original)
      await expect(viewer.getByRole('button', { name: 'Zoom out', exact: true })).toBeDisabled()
      await viewer.getByRole('button', { name: 'Zoom in', exact: true }).click()
      await viewer.getByRole('button', { name: 'Zoom in', exact: true }).click()
      await expect(viewer.getByLabel('150% of fitted view')).toBeVisible()
      const before = await scroll.evaluate(el => ({ left: el.scrollLeft, top: el.scrollTop, width: el.scrollWidth, client: el.clientWidth }))
      expect(before.width).toBeGreaterThan(before.client)
      await scroll.focus()
      await scroll.press('ArrowDown')
      await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(before.top)
      await expect(viewer.getByText('QC Photos: 1 of 2')).toBeVisible()
      await viewer.getByRole('button', { name: 'Fit photo', exact: true }).click()
      await expect(viewer.getByLabel('100% of fitted view')).toBeVisible()
      await viewer.getByRole('button', { name: 'Zoom photo in', exact: true }).click()
      await expect(viewer.getByLabel('200% of fitted view')).toBeVisible()
        const bounds = await scroll.boundingBox(), start = await scroll.evaluate(el => ({ left: el.scrollLeft, top: el.scrollTop }))
        await page.mouse.move(bounds!.x + bounds!.width * .6, bounds!.y + bounds!.height * .5)
        await page.mouse.down(); await page.mouse.move(bounds!.x + bounds!.width * .6 - 55, bounds!.y + bounds!.height * .5 - 35, { steps: 5 }); await page.mouse.up()
        const end = await scroll.evaluate(el => ({ left: el.scrollLeft, top: el.scrollTop }))
        expect(end.left !== start.left || end.top !== start.top).toBe(true)
        await expect(viewer.getByLabel('200% of fitted view')).toBeVisible()
      await page.screenshot({ path: 'evidence/qc-zoom-' + viewport.name + '.png', fullPage: true })
      await viewer.getByRole('button', { name: 'Next photo', exact: true }).click()
      await expect(viewer.getByLabel('100% of fitted view')).toBeVisible()
      await expect(viewer.getByText('This file has limited detail;', { exact: false })).toBeVisible()
      await page.keyboard.press('Escape'); await expect(viewer).toBeHidden()
      await expect(page.getByRole('button', { name: 'View small-source.svg' })).toBeFocused()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    })
  })
}
