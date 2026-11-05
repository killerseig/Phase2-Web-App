import { expect, type Page } from './test'

interface LoadingObservation { frames: number; maxVisible: number; done: boolean; timedOut: boolean }
export async function observeLoadingFade(page: Page, selector: string) {
  await page.evaluate(selector => {
    const root = document.querySelector(selector)!
    const state: LoadingObservation = { frames: 0, maxVisible: 0, done: false, timedOut: false }
    ;(window as unknown as { loadingObservation: LoadingObservation }).loadingObservation = state
    const sample = () => {
      state.frames++
      const visible = [...root.querySelectorAll('.app-loading-indicator__wheel')].filter(wheel => {
        if (!wheel.getClientRects().length) return false
        for (let node: Element | null = wheel; node; node = node.parentElement) {
          const style = getComputedStyle(node)
          if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < .01) return false
        }
        return true
      }).length
      state.maxVisible = Math.max(state.maxVisible, visible)
      const active = root.classList.contains('is-covered') || !!root.querySelector(':scope > .app-loading-overlay')
      if (active && state.frames < 180) requestAnimationFrame(sample)
      else { state.done = true; state.timedOut = active }
    }
    requestAnimationFrame(sample)
  }, selector)
}
export async function expectSingleLoadingFade(page: Page) {
  await expect.poll(async () => page.evaluate(() => (window as unknown as { loadingObservation: LoadingObservation }).loadingObservation.done)).toBe(true)
  const result = await page.evaluate(() => (window as unknown as { loadingObservation: LoadingObservation }).loadingObservation)
  expect(result.timedOut).toBe(false)
  expect(result.frames).toBeGreaterThan(1)
  expect(result.maxVisible).toBe(1)
}
