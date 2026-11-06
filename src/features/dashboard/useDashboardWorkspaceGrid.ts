import { onScopeDispose, watch, type Ref } from 'vue'

const backgroundProperties = [
  'background-image',
  'background-size',
  'background-position',
  'background-origin',
  'background-clip',
  'background-attachment',
  'background-repeat',
] as const
type Background = Partial<Record<(typeof backgroundProperties)[number], string>>

/** Extends the authored grid into the workspace without changing saved geometry. */
export function useDashboardWorkspaceGrid(options: {
  viewport: Ref<HTMLElement | undefined>
  content: Ref<HTMLElement | undefined>
  active: () => boolean
  spacing: () => { x: number; y: number; majorEvery?: number } | undefined
  dependency: () => unknown
}) {
  let painted: HTMLElement | undefined
  let observer: ResizeObserver | undefined
  let observed: HTMLElement[] = []
  let listening: HTMLElement | undefined
  let frame = 0
  let disposed = false

  // Paint only the viewport background, without re-rendering the entire editor.
  // An animation-frame render can otherwise overwrite a pending number input
  // before its change/blur event commits it to the draft.
  function paint(viewport?: HTMLElement, background: Background = {}) {
    if (painted && painted !== viewport)
      backgroundProperties.forEach((property) => painted!.style.removeProperty(property))
    painted = viewport
    if (!viewport) return
    for (const property of backgroundProperties) {
      const value = background[property]
      if (value === undefined) viewport.style.removeProperty(property)
      else if (viewport.style.getPropertyValue(property) !== value)
        viewport.style.setProperty(property, value)
    }
  }

  function connect(root?: HTMLElement) {
    const viewport = options.viewport.value
    if (listening !== viewport) {
      listening?.removeEventListener('scroll', schedule)
      listening = viewport
      listening?.addEventListener('scroll', schedule, { passive: true })
    }
    const elements = [...new Set([viewport, options.content.value, root])].filter(
      (element): element is HTMLElement => !!element,
    )
    if (
      elements.length === observed.length &&
      elements.every((element, i) => element === observed[i])
    )
      return
    observer?.disconnect()
    observed = elements
    if (typeof ResizeObserver !== 'undefined') {
      observer ??= new ResizeObserver(schedule)
      observed.forEach((element) => observer!.observe(element))
    }
  }

  function measure() {
    frame = 0
    if (disposed) return
    const viewport = options.viewport.value
    const root = options.content.value?.querySelector<HTMLElement>(
      '[data-widget-surface="shared-dashboard"]',
    )
    connect(root || undefined)
    if (!options.active() || !viewport || !root || !root.offsetWidth) {
      paint(viewport)
      return
    }
    const bounds = root.getBoundingClientRect()
    const workspace = viewport.getBoundingClientRect()
    const scale = bounds.width / root.offsetWidth
    const spacing = options.spacing()
    const x = Number.isFinite(spacing?.x) && spacing!.x > 0 ? spacing!.x : 1
    const y = Number.isFinite(spacing?.y) && spacing!.y > 0 ? spacing!.y : 1
    const major =
      Number.isInteger(spacing?.majorEvery) && spacing!.majorEvery! > 0 ? spacing!.majorEvery! : 4
    const periodX = (bounds.width / 24) * x
    const periodY = 32 * scale * y
    if (
      ![scale, periodX, periodY, periodX * major, periodY * major].every(
        (n) => Number.isFinite(n) && n > 0,
      )
    ) {
      paint(viewport)
      return
    }
    // Backgrounds use the viewport padding box; the root rect already includes
    // native scrolling, canvas translation, centering and editor magnification.
    const originX = bounds.left - workspace.left - viewport.clientLeft
    const originY = bounds.top - workspace.top - viewport.clientTop
    const center = 2 * scale
    paint(viewport, {
      'background-image':
        `radial-gradient(circle at ${center}px ${center}px, rgb(104 240 255 / 0.85) ${1.8 * scale}px, transparent ${1.8 * scale}px), ` +
        `radial-gradient(circle at ${center}px ${center}px, rgb(104 199 239 / 0.55) ${1.25 * scale}px, transparent ${1.25 * scale}px)`,
      'background-size': `${periodX * major}px ${periodY * major}px, ${periodX}px ${periodY}px`,
      'background-position': `${originX - center}px ${originY - center}px`,
      'background-origin': 'padding-box',
      'background-clip': 'padding-box',
      'background-attachment': 'scroll',
      'background-repeat': 'repeat',
    })
  }

  function schedule() {
    if (!disposed && !frame && typeof requestAnimationFrame !== 'undefined')
      frame = requestAnimationFrame(measure)
  }
  watch(
    [options.viewport, options.content, options.active, options.spacing, options.dependency],
    schedule,
    { deep: true, flush: 'post', immediate: true },
  )
  onScopeDispose(() => {
    disposed = true
    observer?.disconnect()
    listening?.removeEventListener('scroll', schedule)
    if (frame) cancelAnimationFrame(frame)
    paint()
  })
}
