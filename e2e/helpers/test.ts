import { expect, test as base, type Page } from '@playwright/test'

const RESIZE_OBSERVER_LOOP_ERROR = 'ResizeObserver loop completed with undelivered notifications.'

async function installBrowserErrorGuards(page: Page) {
  await page.addInitScript((resizeObserverLoopError) => {
    window.addEventListener('error', (event) => {
      if (event.message === resizeObserverLoopError) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    })
  }, RESIZE_OBSERVER_LOOP_ERROR)
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await installBrowserErrorGuards(page)
    await use(page)
  },
})

export { expect }
export type { Page }
