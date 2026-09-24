import { onScopeDispose, ref, shallowRef, type Ref } from 'vue'

export interface WidgetDrop {
  beforeId: string | null
  overId: string | null
  edge: 'before' | 'after'
  surface: string
}

// Geometry and pointer handling are shared; each editor owns its data and persistence.
export function useWidgetDrag<T>(options: {
  root: Ref<HTMLElement | undefined>
  disabled: () => boolean
  drop: (payload: T, target: WidgetDrop) => void
}) {
  const payload = shallowRef<T>()
  const dragging = ref(false)
  const target = ref<WidgetDrop>()
  const point = ref({ x: 0, y: 0 })
  const label = ref('')
  let startPoint = { x: 0, y: 0 }
  let pointerId: number | undefined
  let frame = 0
  let suppressClick = false
  let clickTimer: ReturnType<typeof setTimeout> | undefined

  function findSurface() {
    const element = document.elementFromPoint(point.value.x, point.value.y)
    const surface = element?.closest<HTMLElement>('[data-widget-surface]')
    return surface && options.root.value?.contains(surface) ? surface : undefined
  }
  function locate() {
    const surface = findSurface()
    if (!surface) {
      target.value = undefined
      return
    }
    const entries = [...surface.querySelectorAll<HTMLElement>('[data-widget-id]')].filter(
      (element) => element.getBoundingClientRect().height > 0,
    )
    const bounds = surface.getBoundingClientRect()
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
        beforeId: null,
        overId: null,
        edge: 'after',
        surface: surface.dataset.widgetSurface!,
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
      beforeId: before ? nearest.dataset.widgetId! : next?.dataset.widgetId || null,
      overId: nearest.dataset.widgetId!,
      edge: before ? 'before' : 'after',
      surface: surface.dataset.widgetSurface!,
    }
  }
  function tick() {
    if (!dragging.value) return
    if (options.disabled()) {
      cancel()
      return
    }
    const scroller = findSurface()?.closest<HTMLElement>('[data-widget-scroll]')
    if (scroller) {
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
    pointerId = undefined
    payload.value = undefined
    dragging.value = false
    target.value = undefined
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
  function start(event: PointerEvent, value: T, text: string) {
    if (options.disabled() || event.button !== 0 || !event.isPrimary) return
    stop()
    suppressClick = false
    payload.value = value
    label.value = text
    pointerId = event.pointerId
    startPoint = point.value = { x: event.clientX, y: event.clientY }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('keydown', keydown)
    window.addEventListener('blur', cancel)
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
