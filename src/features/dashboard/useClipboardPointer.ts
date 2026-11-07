import { onMounted, onScopeDispose, watch, type Ref } from 'vue'
import type { ClipboardAnchor } from './widgetClipboard'

/** A hover is a temporary editing aid, never a saved layout coordinate. */
export function useClipboardPointer(options: {
  viewport: Ref<HTMLElement | undefined>
  enabled: () => boolean
  context: () => unknown
}) {
  let pointer: { x: number; y: number; surface: HTMLElement; geometry: string } | undefined
  const clear = (): undefined => {
    pointer = undefined
  }
  const excluded =
    '[data-selection-control],button,input,textarea,select,a,[contenteditable],[role="tab"],[role="menu"],[role="dialog"]'
  function locate(x: number, y: number) {
    const view = options.viewport.value,
      hit = document.elementFromPoint(x, y)
    const surface = hit?.closest<HTMLElement>('[data-widget-surface]')
    if (!view || !surface || !view.contains(surface) || hit?.closest(excluded)) return
    const rect = surface.getBoundingClientRect(),
      viewport = view.getBoundingClientRect()
    if (
      !surface.isConnected ||
      !rect.width ||
      !rect.height ||
      !surface.clientWidth ||
      x < viewport.left ||
      x >= viewport.right ||
      y < viewport.top ||
      y >= viewport.bottom ||
      x < rect.left ||
      x >= rect.right ||
      y < rect.top ||
      y >= rect.bottom
    )
      return
    const scale = rect.width / surface.offsetWidth
    if (!Number.isFinite(scale) || scale <= 0) return
    const localX = (x - rect.left) / scale - surface.clientLeft
    const localY = (y - rect.top) / scale - surface.clientTop
    if (localX < 0 || localX >= surface.clientWidth || localY < 0 || localY >= surface.clientHeight)
      return
    // Ancestor pan, zoom and scroll are in the rendered rectangle. Only this
    // surface's own native scroll and border need explicit compensation.
    const point: ClipboardAnchor = {
      x: ((localX + surface.scrollLeft) / surface.clientWidth) * 24,
      y: (localY + surface.scrollTop) / 32,
      parentId:
        surface.dataset.widgetSurface === 'shared-dashboard' ? '' : surface.dataset.widgetSurface!,
      region: surface.dataset.region || '0',
    }
    const geometry = JSON.stringify([
      rect.left,
      rect.top,
      rect.width,
      surface.clientWidth,
      surface.scrollLeft,
      surface.scrollTop,
      viewport.left,
      viewport.top,
      viewport.width,
      viewport.height,
    ])
    return { surface, geometry, point }
  }
  function move(event: PointerEvent) {
    if (!options.enabled() || !event.isPrimary || event.buttons || event.pointerType === 'touch')
      return clear()
    const target = locate(event.clientX, event.clientY)
    pointer = target
      ? { x: event.clientX, y: event.clientY, surface: target.surface, geometry: target.geometry }
      : undefined
  }
  function resolve() {
    if (!pointer || !options.enabled()) return
    const target = locate(pointer.x, pointer.y)
    if (!target || target.surface !== pointer.surface || target.geometry !== pointer.geometry)
      return clear()
    return target.point
  }
  function key(event: KeyboardEvent) {
    if (event.key === 'Escape' || (event.target as HTMLElement).closest('[role="tablist"]')) clear()
  }
  // Scroll events can arrive after a new pointermove has already captured the
  // scrolled geometry. Reject old geometry without discarding that fresh hover.
  const scroll = () => {
    resolve()
  }
  const stop = watch(
    options.viewport,
    (view, _, cleanup) => {
      clear()
      if (!view) return
      view.addEventListener('pointermove', move)
      view.addEventListener('pointerleave', clear)
      view.addEventListener('pointerdown', clear, true)
      view.addEventListener('keydown', key, true)
      // Inactive tabs remain mounted. Switching away and back must not revive a hover.
      const observer = new MutationObserver((records) => {
        const hidden = (style: string | null) =>
          /(?:^|;)\s*display\s*:\s*none\s*(?:;|$)/i.test(style || '')
        if (
          records.some((r) => {
            const element = r.target as Element
            return (
              (r.attributeName === 'aria-selected' && element.matches('[role="tab"]')) ||
              (element.matches('[role="tabpanel"]') &&
                (r.attributeName === 'hidden' ||
                  (r.attributeName === 'style' &&
                    hidden(r.oldValue) !== hidden(element.getAttribute('style')))))
            )
          })
        )
          clear()
      })
      observer.observe(view, {
        subtree: true,
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ['aria-selected', 'hidden', 'style'],
      })
      cleanup(() => {
        observer.disconnect()
        view.removeEventListener('pointermove', move)
        view.removeEventListener('pointerleave', clear)
        view.removeEventListener('pointerdown', clear, true)
        view.removeEventListener('keydown', key, true)
      })
    },
    { flush: 'post' },
  )
  watch([options.context, options.enabled], clear, { flush: 'sync' })
  onMounted(() => {
    window.addEventListener('blur', clear)
    window.addEventListener('resize', clear)
    window.addEventListener('pointercancel', clear)
    window.addEventListener('scroll', scroll, true)
    document.addEventListener('visibilitychange', clear)
  })
  onScopeDispose(() => {
    clear()
    stop()
    window.removeEventListener('blur', clear)
    window.removeEventListener('resize', clear)
    window.removeEventListener('pointercancel', clear)
    window.removeEventListener('scroll', scroll, true)
    document.removeEventListener('visibilitychange', clear)
  })
  return { resolve, clear }
}
