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
  })
}
