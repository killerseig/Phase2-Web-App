interface UseShopCatalogTreeAutoScrollOptions {
  getScrollContainer: () => HTMLElement | null
  getIsDragging: () => boolean
  minThresholdPx?: number
  maxThresholdPx?: number
  thresholdRatio?: number
  minVelocityPx?: number
  maxVelocityPx?: number
}

const DEFAULT_MIN_THRESHOLD_PX = 48
const DEFAULT_MAX_THRESHOLD_PX = 96
const DEFAULT_THRESHOLD_RATIO = 0.2
const DEFAULT_MIN_VELOCITY_PX = 4
const DEFAULT_MAX_VELOCITY_PX = 18

export function useShopCatalogTreeAutoScroll(options: UseShopCatalogTreeAutoScrollOptions) {
  let frame: number | null = null
  let velocity = 0

  function stopTreeListAutoScroll() {
    velocity = 0
    if (frame !== null) {
      window.cancelAnimationFrame(frame)
      frame = null
    }
  }

  function stepTreeListAutoScroll() {
    const list = options.getScrollContainer()
    if (!list || !options.getIsDragging() || velocity === 0) {
      stopTreeListAutoScroll()
      return
    }

    const maxScrollTop = list.scrollHeight - list.clientHeight
    if (maxScrollTop <= 0) {
      stopTreeListAutoScroll()
      return
    }

    const nextScrollTop = Math.max(0, Math.min(maxScrollTop, list.scrollTop + velocity))
    if (nextScrollTop === list.scrollTop) {
      stopTreeListAutoScroll()
      return
    }

    list.scrollTop = nextScrollTop
    frame = window.requestAnimationFrame(stepTreeListAutoScroll)
  }

  function startTreeListAutoScroll() {
    if (frame !== null || velocity === 0) return
    frame = window.requestAnimationFrame(stepTreeListAutoScroll)
  }

  function updateTreeListAutoScroll(clientY: number) {
    const list = options.getScrollContainer()
    if (!list || !options.getIsDragging()) {
      stopTreeListAutoScroll()
      return
    }

    const rect = list.getBoundingClientRect()
    if (rect.height <= 0) {
      stopTreeListAutoScroll()
      return
    }

    const threshold = Math.min(
      options.maxThresholdPx ?? DEFAULT_MAX_THRESHOLD_PX,
      Math.max(
        options.minThresholdPx ?? DEFAULT_MIN_THRESHOLD_PX,
        rect.height * (options.thresholdRatio ?? DEFAULT_THRESHOLD_RATIO),
      ),
    )
    const distanceFromTop = clientY - rect.top
    const distanceFromBottom = rect.bottom - clientY

    let nextVelocity = 0
    if (distanceFromTop < threshold) {
      const intensity = (threshold - Math.max(distanceFromTop, 0)) / threshold
      nextVelocity = -Math.max(
        options.minVelocityPx ?? DEFAULT_MIN_VELOCITY_PX,
        Math.round((options.maxVelocityPx ?? DEFAULT_MAX_VELOCITY_PX) * intensity),
      )
    } else if (distanceFromBottom < threshold) {
      const intensity = (threshold - Math.max(distanceFromBottom, 0)) / threshold
      nextVelocity = Math.max(
        options.minVelocityPx ?? DEFAULT_MIN_VELOCITY_PX,
        Math.round((options.maxVelocityPx ?? DEFAULT_MAX_VELOCITY_PX) * intensity),
      )
    }

    if (nextVelocity === 0) {
      stopTreeListAutoScroll()
      return
    }

    velocity = nextVelocity
    startTreeListAutoScroll()
  }

  return {
    stopTreeListAutoScroll,
    updateTreeListAutoScroll,
  }
}
