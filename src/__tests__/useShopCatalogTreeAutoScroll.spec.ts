import { afterEach, describe, expect, it, vi } from 'vitest'

import { useShopCatalogTreeAutoScroll } from '@/features/shopCatalog/useShopCatalogTreeAutoScroll'

type MockScrollContainer = HTMLElement & {
  clientHeight: number
  scrollHeight: number
  scrollTop: number
}

function installAnimationFrameMocks() {
  const callbacks: FrameRequestCallback[] = []
  let nextFrameId = 0
  const requestAnimationFrame = vi
    .spyOn(window, 'requestAnimationFrame')
    .mockImplementation((callback: FrameRequestCallback) => {
      callbacks.push(callback)
      nextFrameId += 1
      return nextFrameId
    })
  const cancelAnimationFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)

  function runNextFrame(timestamp = 0) {
    const callback = callbacks.shift()
    if (!callback) {
      throw new Error('Expected an animation frame callback to be queued.')
    }
    callback(timestamp)
  }

  return {
    callbacks,
    cancelAnimationFrame,
    requestAnimationFrame,
    runNextFrame,
  }
}

function makeScrollContainer(options: {
  clientHeight?: number
  height?: number
  scrollHeight?: number
  scrollTop?: number
  top?: number
} = {}): MockScrollContainer {
  const top = options.top ?? 100
  const height = options.height ?? 200

  return {
    clientHeight: options.clientHeight ?? height,
    getBoundingClientRect: () =>
      ({
        bottom: top + height,
        height,
        left: 0,
        right: 200,
        top,
        width: 200,
        x: 0,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect,
    scrollHeight: options.scrollHeight ?? 500,
    scrollTop: options.scrollTop ?? 0,
  } as MockScrollContainer
}

describe('useShopCatalogTreeAutoScroll', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('scrolls down when dragging near the bottom threshold', () => {
    const { requestAnimationFrame, runNextFrame } = installAnimationFrameMocks()
    const list = makeScrollContainer({ scrollTop: 20 })
    const autoScroll = useShopCatalogTreeAutoScroll({
      getIsDragging: () => true,
      getScrollContainer: () => list,
    })

    autoScroll.updateTreeListAutoScroll(295)

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)

    runNextFrame()

    expect(list.scrollTop).toBeGreaterThan(20)
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2)
  })

  it('scrolls up and stops after reaching the top edge', () => {
    const { cancelAnimationFrame, requestAnimationFrame, runNextFrame } = installAnimationFrameMocks()
    const list = makeScrollContainer({ scrollTop: 10 })
    const autoScroll = useShopCatalogTreeAutoScroll({
      getIsDragging: () => true,
      getScrollContainer: () => list,
    })

    autoScroll.updateTreeListAutoScroll(105)
    runNextFrame()

    expect(list.scrollTop).toBe(0)
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2)

    runNextFrame()

    expect(cancelAnimationFrame).toHaveBeenCalledWith(2)
  })

  it('cancels an active frame when the pointer returns to the safe middle zone', () => {
    const { cancelAnimationFrame, requestAnimationFrame } = installAnimationFrameMocks()
    const list = makeScrollContainer({ scrollTop: 20 })
    const autoScroll = useShopCatalogTreeAutoScroll({
      getIsDragging: () => true,
      getScrollContainer: () => list,
    })

    autoScroll.updateTreeListAutoScroll(295)
    autoScroll.updateTreeListAutoScroll(200)

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1)
  })

  it('does not schedule scrolling when the user is not dragging', () => {
    const { requestAnimationFrame } = installAnimationFrameMocks()
    const list = makeScrollContainer({ scrollTop: 20 })
    const autoScroll = useShopCatalogTreeAutoScroll({
      getIsDragging: () => false,
      getScrollContainer: () => list,
    })

    autoScroll.updateTreeListAutoScroll(295)

    expect(requestAnimationFrame).not.toHaveBeenCalled()
    expect(list.scrollTop).toBe(20)
  })

  it('stops without changing scroll position when the list cannot scroll', () => {
    const { cancelAnimationFrame, runNextFrame } = installAnimationFrameMocks()
    const list = makeScrollContainer({ clientHeight: 200, scrollHeight: 200, scrollTop: 0 })
    const autoScroll = useShopCatalogTreeAutoScroll({
      getIsDragging: () => true,
      getScrollContainer: () => list,
    })

    autoScroll.updateTreeListAutoScroll(295)
    runNextFrame()

    expect(list.scrollTop).toBe(0)
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1)
  })
})
