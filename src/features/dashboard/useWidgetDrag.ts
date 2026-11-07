import { onScopeDispose, ref, shallowRef, type Ref } from 'vue'
import { surfaceGeometry } from './surfaceGeometry'

export interface WidgetDrop {
  beforeId: string | null
  overId: string | null
  edge: 'before' | 'after'
  surface: string
  region?: string
  position?: { x: number; y: number }
}

// Geometry and pointer handling are shared; each editor owns its data and persistence.
export function useWidgetDrag<T>(options: {
  root: Ref<HTMLElement | undefined>
  disabled: () => boolean
  freePosition?: boolean
  lockToOriginSurface?: boolean | ((payload: T) => boolean)
  boundary?: Ref<HTMLElement | undefined>
  sourceControls?: { area: Ref<HTMLElement | undefined>; boundary: Ref<HTMLElement | undefined> }
  ignoreTarget?: (element: Element) => boolean
  acceptTarget?: (element: Element, surface: HTMLElement) => boolean
  retainOriginUnderOverlay?: boolean
  drop: (payload: T, target: WidgetDrop) => void
}) {
  const payload = shallowRef<T>()
  const dragging = ref(false)
  const target = ref<WidgetDrop>()
  const point = ref({ x: 0, y: 0 })
  const label = ref('')
  let startPoint = { x: 0, y: 0 }
  let grab = { x: 0, y: 0 }
  let pointerId: number | undefined
  let frame = 0
  let suppressClick = false
  let clickTimer: ReturnType<typeof setTimeout> | undefined
  let originSurface: HTMLElement | undefined
  let originScale = 1
  let fromSourceControls = false

  function originLocked() {
    if (fromSourceControls) return true
    return typeof options.lockToOriginSurface === 'function'
      ? payload.value !== undefined && options.lockToOriginSurface(payload.value)
      : options.lockToOriginSurface
  }

  function findSurface() {
    // Toolbar drags adjust the selection relative to its own surface. Their
    // remote pointer must not accidentally choose a different parent. Direct
    // widget drags keep normal canvas hit-testing and container reassignment.
    const boundaryRef = fromSourceControls ? options.sourceControls?.boundary : options.boundary
    const boundary = boundaryRef?.value
    if (boundaryRef) {
      const rect = boundary?.getBoundingClientRect()
      if (
        !rect ||
        point.value.x < rect.left ||
        point.value.x >= rect.right ||
        point.value.y < rect.top ||
        point.value.y >= rect.bottom
      )
        return
    }
    if (
      originLocked() &&
      originSurface?.isConnected &&
      originSurface.getBoundingClientRect().width > 0
    )
      return originSurface
    const element = options.ignoreTarget
      ? document
          .elementsFromPoint(point.value.x, point.value.y)
          .find((el) => !options.ignoreTarget!(el))
      : document.elementFromPoint(point.value.x, point.value.y)
    const surface = element?.closest<HTMLElement>('[data-widget-surface]')
    if (
      !element ||
      !surface ||
      !options.root.value?.contains(surface) ||
      (boundary && !boundary.contains(surface))
    )
      return
    if (options.acceptTarget && !options.acceptTarget(element, surface)) return
    // Selection grips can sit above a sibling that covers a nested canvas.
    // Moving through that overlay must not silently pull the selection out.
    if (
      options.retainOriginUnderOverlay &&
      originSurface?.isConnected &&
      surface !== originSurface &&
      surface.contains(originSurface) &&
      insideVisibleClient(originSurface)
    )
      return originSurface
    return surface
  }
  function insideVisibleClient(surface: HTMLElement) {
    let current: HTMLElement | null = surface
    while (current) {
      const style = getComputedStyle(current),
        rect = current.getBoundingClientRect()
      const scaleX = rect.width / current.offsetWidth || 1,
        scaleY = rect.height / current.offsetHeight || 1
      const x = (point.value.x - rect.left) / scaleX - current.clientLeft
      const y = (point.value.y - rect.top) / scaleY - current.clientTop
      if (
        (current === surface || style.overflowX !== 'visible') &&
        (x < 0 || x >= current.clientWidth)
      )
        return false
      if (
        (current === surface || style.overflowY !== 'visible') &&
        (y < 0 || y >= current.clientHeight)
      )
        return false
      if (current === options.boundary?.value) break
      current = current.parentElement
    }
    return true
  }
  function locate() {
    const surface = findSurface()
    if (!surface) {
      target.value = undefined
      return
    }
    const entries = [...surface.querySelectorAll<HTMLElement>('[data-widget-id]')].filter(
      (element) =>
        element.getBoundingClientRect().height > 0 &&
        element.closest('[data-widget-surface]') === surface,
    )
    const bounds = surface.getBoundingClientRect()
    const geometry = options.boundary ? surfaceGeometry(surface) : undefined
    const scale = geometry?.scale || bounds.width / surface.offsetWidth || 1
    if (options.boundary && (!surface.clientWidth || !bounds.height || !bounds.width)) {
      target.value = undefined
      return
    }
    const localX = (point.value.x - bounds.left) / scale - (geometry?.left ?? surface.clientLeft)
    const localY = (point.value.y - bounds.top) / scale - (geometry?.top ?? surface.clientTop)
    if (
      options.boundary &&
      !originLocked() &&
      (localX < 0 || localX >= surface.clientWidth || localY < 0 || localY >= surface.clientHeight)
    ) {
      target.value = undefined
      return
    }
    const position = options.freePosition
      ? {
          x: options.boundary
            ? localX + surface.scrollLeft - (grab.x * originScale) / scale
            : (point.value.x - bounds.left) / scale - grab.x,
          y: options.boundary
            ? localY + surface.scrollTop - (grab.y * originScale) / scale
            : (point.value.y - bounds.top) / scale - grab.y,
        }
      : undefined
    const nearest = entries.reduce<HTMLElement | undefined>((best, element) => {
      function distance(entry: HTMLElement) {
        const rect = entry.getBoundingClientRect()
        return Math.hypot(
          Math.max(rect.left - point.value.x, 0, point.value.x - rect.right),
          Math.max(rect.top - point.value.y, 0, point.value.y - rect.bottom),
        )
      }
      return !best || distance(element) < distance(best) ? element : best
    }, undefined)
    if (!nearest) {
      target.value = {
        position,
        beforeId: null,
        overId: null,
        edge: 'after',
        surface: surface.dataset.widgetSurface!,
        region: surface.dataset.region,
      }
      return
    }
    const rect = nearest.getBoundingClientRect()
    const y = (point.value.y - rect.top) / rect.height
    const before =
      rect.width < bounds.width * 0.9 && y > 0.25 && y < 0.75
        ? point.value.x < rect.left + rect.width / 2
        : y < 0.5
    const next = entries[entries.indexOf(nearest) + 1]
    target.value = {
      position,
      beforeId: before ? nearest.dataset.widgetId! : next?.dataset.widgetId || null,
      overId: nearest.dataset.widgetId!,
      edge: before ? 'before' : 'after',
      surface: surface.dataset.widgetSurface!,
      region: surface.dataset.region,
    }
  }
  function tick() {
    if (!dragging.value) return
    if (options.disabled()) {
      cancel()
      return
    }
    const surface = findSurface()
    const scroller = surface?.closest<HTMLElement>('[data-widget-scroll]')
    if (surface && options.boundary?.value) {
      const boundary = options.boundary.value.getBoundingClientRect()
      let current: HTMLElement | null = surface,
        movedX = false,
        movedY = false
      while (current) {
        const rect = current.getBoundingClientRect(),
          style = getComputedStyle(current)
        const left = Math.max(rect.left, boundary.left),
          right = Math.min(rect.right, boundary.right)
        const top = Math.max(rect.top, boundary.top),
          bottom = Math.min(rect.bottom, boundary.bottom)
        if (
          right > left &&
          bottom > top &&
          point.value.x >= left &&
          point.value.x < right &&
          point.value.y >= top &&
          point.value.y < bottom
        ) {
          const speed = (value: number, start: number, end: number) =>
            value < start + Math.min(45, (end - start) / 4)
              ? -12
              : value > end - Math.min(45, (end - start) / 4)
                ? 12
                : 0
          if (!movedX && /auto|scroll/.test(style.overflowX)) {
            const before = current.scrollLeft
            current.scrollLeft += speed(point.value.x, left, right)
            movedX = current.scrollLeft !== before
          }
          if (!movedY && /auto|scroll/.test(style.overflowY)) {
            const before = current.scrollTop
            current.scrollTop += speed(point.value.y, top, bottom)
            movedY = current.scrollTop !== before
          }
        }
        if (current === options.boundary.value) break
        current = current.parentElement
      }
    } else if (scroller) {
      const rect = scroller.getBoundingClientRect()
      const edge = 45
      const speed =
        point.value.y < rect.top + edge ? -12 : point.value.y > rect.bottom - edge ? 12 : 0
      if (speed) scroller.scrollTop += speed
    }
    locate()
    frame = requestAnimationFrame(tick)
  }
  function move(event: PointerEvent) {
    if (event.pointerId !== pointerId) return
    point.value = { x: event.clientX, y: event.clientY }
    if (
      !dragging.value &&
      Math.hypot(point.value.x - startPoint.x, point.value.y - startPoint.y) >= 6
    ) {
      dragging.value = true
      frame = requestAnimationFrame(tick)
    }
    if (dragging.value) {
      event.preventDefault()
      locate()
    }
  }
  function stop() {
    cancelAnimationFrame(frame)
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', finish)
    window.removeEventListener('pointercancel', cancel)
    window.removeEventListener('keydown', keydown)
    window.removeEventListener('blur', cancel)
    window.removeEventListener('resize', cancel)
    pointerId = undefined
    payload.value = undefined
    dragging.value = false
    target.value = undefined
    originSurface = undefined
  }
  function blockClick() {
    suppressClick = true
    clearTimeout(clickTimer)
    clickTimer = setTimeout(() => {
      suppressClick = false
    }, 0)
  }
  function cancel() {
    if (dragging.value) blockClick()
    stop()
  }
  function finish(event: PointerEvent) {
    if (event.pointerId !== pointerId) return
    point.value = { x: event.clientX, y: event.clientY }
    locate()
    const data = payload.value
    const destination = target.value
    const commit = dragging.value && data !== undefined && destination && !options.disabled()
    if (dragging.value) blockClick()
    stop()
    if (commit) options.drop(data!, destination!)
  }
  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
    }
  }
  function start(
    event: PointerEvent,
    value: T,
    text: string,
    anchor?: { surface: HTMLElement; origin: { x: number; y: number } },
  ) {
    if (options.disabled() || event.button !== 0 || !event.isPrimary) return
    stop()
    suppressClick = false
    payload.value = value
    label.value = text
    const widget = (event.currentTarget as HTMLElement)?.closest<HTMLElement>('[data-widget-id]')
    const surface = anchor?.surface || widget?.closest<HTMLElement>('[data-widget-surface]')
    originSurface = surface || undefined
    fromSourceControls = !!options.sourceControls?.area.value?.contains(event.currentTarget as Node)
    const rect = widget?.getBoundingClientRect()
    const geometry = surface && options.boundary ? surfaceGeometry(surface) : undefined
    const scale =
      geometry?.scale || (surface ? surface.getBoundingClientRect().width / surface.offsetWidth : 1)
    originScale = scale || 1
    const surfaceRect = surface?.getBoundingClientRect()
    grab =
      anchor && surfaceRect
        ? {
            x:
              (event.clientX - surfaceRect.left) / scale -
              anchor.origin.x +
              (options.boundary ? -anchor.surface.clientLeft + anchor.surface.scrollLeft : 0),
            y:
              (event.clientY - surfaceRect.top) / scale -
              anchor.origin.y +
              (options.boundary ? -anchor.surface.clientTop + anchor.surface.scrollTop : 0),
          }
        : rect
          ? { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale }
          : { x: 0, y: 0 }
    pointerId = event.pointerId
    startPoint = point.value = { x: event.clientX, y: event.clientY }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('keydown', keydown)
    window.addEventListener('blur', cancel)
    if (options.boundary) window.addEventListener('resize', cancel)
  }
  function guardClick(event: MouseEvent) {
    if (suppressClick) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }
  onScopeDispose(() => {
    stop()
    clearTimeout(clickTimer)
  })
  return { payload, dragging, target, point, label, start, cancel, guardClick }
}
