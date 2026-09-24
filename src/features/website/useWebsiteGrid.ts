import { onScopeDispose, ref, type Ref } from 'vue'
import { translateSelection, intersectingWidgets, type GeometryMap } from './selection'
import { pointerRotation, resizeRotated } from './transform'
import { alignMove, rotationAssist, type AlignmentGuide } from './alignment'
import {
  changeGeometry,
  gridStep,
  snap,
  type GridSettings,
  type WidgetGeometry,
  type GridDraft,
  type WidgetAction,
} from './grid'

export function useWebsiteGrid(options: {
  surface: () => HTMLElement | undefined
  scroller: Ref<HTMLElement | undefined>
  disabled: () => boolean
  settings: () => GridSettings
  commit: (
    id: string,
    layout: WidgetGeometry,
    type?: string,
    layouts?: GeometryMap,
    rotation?: number,
    heightOnly?: boolean,
  ) => void
  rotation?: (id: string) => number
  group?: () => GeometryMap
  widgets?: () => GeometryMap
  resize?: (id: string, layout: WidgetGeometry) => GeometryMap | undefined
  select?: (ids: string[]) => void
}) {
  const draft = ref<GridDraft>()
  const marquee = ref<WidgetGeometry>()
  const dragging = ref(false)
  const hand = ref(false)
  const guides = ref<AlignmentGuide[]>([])
  let space = false
  let frame = 0
  let suppress = false
  let suppressTimer: ReturnType<typeof setTimeout> | undefined
  let interaction:
    | {
        pointer: number
        action: 'new' | 'place' | 'pan' | 'marquee' | WidgetAction
        rotation: number
        assistedRotation: number
        rotationSnapped: boolean
        rotationAssist: ReturnType<typeof rotationAssist>
        angle: number
        element?: HTMLElement
        capture?: HTMLElement
        consumeClick: boolean
        stepped: boolean
        group: GeometryMap
        additive: boolean
        id: string
        type?: string
        origin: WidgetGeometry
        start: { x: number; y: number }
        client: { x: number; y: number }
        last: { x: number; y: number }
        scroll: { x: number; y: number }
      }
    | undefined
  function position(x: number, y: number) {
    const surface = options.surface()
    if (!surface) return { x: 0, y: 0 }
    const rect = surface.getBoundingClientRect()
    const scale = rect.width / surface.offsetWidth || 1
    return { x: (x - rect.left) / (45 * scale), y: (y - rect.top) / (32 * scale) }
  }
  function overCanvas() {
    if (!interaction) return false
    const bounds = options.scroller.value?.getBoundingClientRect()
    const { x, y } = interaction.last
    return Boolean(
      bounds && x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom,
    )
  }
  function update() {
    if (!interaction || !dragging.value || interaction.action === 'pan') return
    const p = position(interaction.last.x, interaction.last.y)
    const settings = options.settings()
    if (interaction.action === 'rotate') {
      const rect = interaction.element?.getBoundingClientRect()
      if (!rect) return
      draft.value = overCanvas()
        ? {
            id: interaction.id,
            layout: interaction.origin,
            rotation: interaction.assistedRotation,
            rotationSnapped: interaction.rotationSnapped,
          }
        : undefined
      return
    }
    if (interaction.action === 'marquee') {
      const x = Math.max(0, p.x)
      const y = Math.max(0, p.y)
      marquee.value = {
        x: Math.min(x, interaction.start.x),
        y: Math.min(y, interaction.start.y),
        w: Math.abs(x - interaction.start.x),
        h: Math.abs(y - interaction.start.y),
        z: 0,
      }
      return
    }
    const layout =
      interaction.action === 'new' || interaction.action === 'place'
        ? {
            ...interaction.origin,
            x: Math.max(
              0,
              Math.min(1000 - interaction.origin.w, snap(p.x, gridStep(settings, 'x'))),
            ),
            y: Math.max(
              0,
              Math.min(10000 - interaction.origin.h, snap(p.y, gridStep(settings, 'y'))),
            ),
          }
        : interaction.action === 'height'
          ? {
              ...interaction.origin,
              h:
                Math.max(
                  32,
                  Math.min(
                    2000,
                    Math.round((interaction.origin.h + p.y - interaction.start.y) * 32),
                  ),
                ) / 32,
            }
          : interaction.action === 'move'
            ? changeGeometry(
                interaction.origin,
                p.x - interaction.start.x,
                p.y - interaction.start.y,
                interaction.action,
                settings,
              )
            : resizeRotated(
                interaction.origin,
                p.x - interaction.start.x,
                p.y - interaction.start.y,
                interaction.action,
                settings,
                interaction.rotation,
              )
    guides.value = []
    if (interaction.action === 'move' && Object.keys(interaction.group).length <= 1) {
      const surface = options.surface()
      const bounds = surface?.getBoundingClientRect()
      if (surface && bounds) {
        const scale = bounds.width / surface.offsetWidth || 1
        const targets = Object.entries(options.widgets?.() || {})
          .filter(([id]) => id !== interaction!.id)
          .map(([, item]) => ({
            left: bounds.left + item.x * 45 * scale,
            top: bounds.top + item.y * 32 * scale,
            width: item.w * 45 * scale,
            height: item.h * 32 * scale,
          }))
        targets.push({
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
        })
        const aligned = alignMove(
          {
            left: bounds.left + layout.x * 45 * scale,
            top: bounds.top + layout.y * 32 * scale,
            width: layout.w * 45 * scale,
            height: layout.h * 32 * scale,
          },
          targets,
          false,
        )
        // The existing page grid remains authoritative for whole-widget movement.
        guides.value = aligned.guides
      }
    }
    const layouts =
      (interaction.action === 'move' || interaction.action === 'place') &&
      Object.keys(interaction.group).length > 1
        ? translateSelection(
            interaction.group,
            layout.x - interaction.origin.x,
            layout.y - interaction.origin.y,
          )
        : interaction.action !== 'new' &&
            interaction.action !== 'place' &&
            interaction.action !== 'move' &&
            interaction.action !== 'height'
          ? options.resize?.(interaction.id, layout)
          : undefined
    draft.value = overCanvas()
      ? {
          id: interaction.id,
          type: interaction.type,
          heightOnly: interaction.action === 'height',
          layout: layouts?.[interaction.id] || layout,
          layouts,
        }
      : undefined
  }
  function tick() {
    if (!interaction || !dragging.value) return
    if (options.disabled()) {
      cancel()
      return
    }
    const scroller = options.scroller.value
    if (scroller && overCanvas() && interaction.action !== 'pan') {
      const r = scroller.getBoundingClientRect(),
        p = interaction.last
      scroller.scrollLeft += p.x < r.left + 30 ? -10 : p.x > r.right - 30 ? 10 : 0
      scroller.scrollTop += p.y < r.top + 30 ? -10 : p.y > r.bottom - 30 ? 10 : 0
      update()
    }
    frame = requestAnimationFrame(tick)
  }
  function move(event: PointerEvent) {
    if (!interaction || event.pointerId !== interaction.pointer) return
    interaction.last = { x: event.clientX, y: event.clientY }
    interaction.stepped = event.shiftKey
    if (interaction.action === 'rotate') {
      const rect = interaction.element?.getBoundingClientRect()
      if (rect) {
        const angle = Math.atan2(
          event.clientY - rect.top - rect.height / 2,
          event.clientX - rect.left - rect.width / 2,
        )
        const raw = pointerRotation(interaction.rotation, interaction.angle, angle, false)
        const result = interaction.rotationAssist.update(
          raw,
          event.timeStamp,
          event.shiftKey,
          event.altKey,
        )
        interaction.assistedRotation = result.angle
        interaction.rotationSnapped = result.snapped
      }
    }
    if (
      !dragging.value &&
      Math.hypot(event.clientX - interaction.client.x, event.clientY - interaction.client.y) >= 6
    ) {
      dragging.value = true
      frame = requestAnimationFrame(tick)
    }
    if (!dragging.value) return
    event.preventDefault()
    if (interaction.action === 'pan') {
      const scroller = options.scroller.value
      if (scroller) {
        scroller.scrollLeft = interaction.scroll.x - (event.clientX - interaction.client.x)
        scroller.scrollTop = interaction.scroll.y - (event.clientY - interaction.client.y)
      }
    } else update()
  }
  function stop() {
    cancelAnimationFrame(frame)
    // A toolbar may disappear on pointerdown when text editing finishes.
    // Consume the entire button gesture, even if it never becomes a drag.
    if (dragging.value || interaction?.consumeClick) {
      suppress = true
      clearTimeout(suppressTimer)
      suppressTimer = setTimeout(() => {
        suppress = false
      }, 0)
    }
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', finish)
    window.removeEventListener('pointercancel', cancel)
    window.removeEventListener('blur', cancel)
    if (interaction?.capture?.hasPointerCapture(interaction.pointer)) {
      interaction.capture.releasePointerCapture(interaction.pointer)
    }
    interaction = undefined
    marquee.value = undefined
    draft.value = undefined
    guides.value = []
    dragging.value = false
  }
  function finish(event: PointerEvent) {
    if (event.pointerId !== interaction?.pointer) return
    move(event)
    if (interaction.action === 'marquee') {
      const ids =
        marquee.value && overCanvas()
          ? intersectingWidgets(options.widgets?.() || {}, marquee.value)
          : []
      const result = interaction.additive
        ? [...new Set([...Object.keys(interaction.group), ...ids])]
        : ids
      const apply = !options.disabled() && (overCanvas() || !dragging.value)
      stop()
      if (apply) options.select?.(result)
      return
    }
    const value = draft.value
    const changed =
      interaction.action === 'new' ||
      (value?.rotation !== undefined && value.rotation !== interaction.rotation) ||
      JSON.stringify(value?.layout) !== JSON.stringify(interaction.origin)
    const commit = dragging.value && changed && !options.disabled() && value
    stop()
    if (commit)
      options.commit(
        commit.id,
        commit.layout,
        commit.type,
        commit.layouts,
        commit.rotation,
        commit.heightOnly,
      )
  }
  function cancel() {
    space = false
    stop()
  }
  function start(
    event: PointerEvent,
    id: string,
    layout: WidgetGeometry,
    action: 'new' | 'place' | 'marquee' | WidgetAction = 'move',
    type?: string,
  ) {
    if (options.disabled() || !event.isPrimary || (event.button !== 0 && event.button !== 1)) return
    stop()
    suppress = false
    const pan = action !== 'new' && (hand.value || space || event.button === 1)
    const client = { x: event.clientX, y: event.clientY }
    const element =
      (event.target as HTMLElement).closest<HTMLElement>('.widget-frame') ||
      Array.from(options.surface()?.querySelectorAll<HTMLElement>('[data-widget-id]') || []).find(
        (entry) => entry.dataset.widgetId === id,
      )
    const rect = element?.getBoundingClientRect()
    const consumeClick = Boolean((event.target as HTMLElement).closest('[data-transform]'))
    // Capture on the stable workspace, not the inline toolbar that unmounts.
    // Mouse/touch release must not land on another widget underneath it.
    const capture = consumeClick ? options.scroller.value : undefined
    capture?.setPointerCapture(event.pointerId)
    interaction = {
      pointer: event.pointerId,
      id,
      type,
      origin: { ...layout },
      rotation: options.rotation?.(id) || 0,
      assistedRotation: options.rotation?.(id) || 0,
      rotationSnapped: false,
      rotationAssist: rotationAssist(options.rotation?.(id) || 0, event.timeStamp),
      angle: rect
        ? Math.atan2(client.y - rect.top - rect.height / 2, client.x - rect.left - rect.width / 2)
        : 0,
      element,
      capture,
      consumeClick,
      stepped: event.shiftKey,
      group: Object.fromEntries(
        Object.entries(options.group?.() || {}).map(([key, value]) => [key, { ...value }]),
      ),
      additive: event.shiftKey,
      action: pan ? 'pan' : action,
      client,
      last: client,
      start: position(client.x, client.y),
      scroll: {
        x: options.scroller.value?.scrollLeft || 0,
        y: options.scroller.value?.scrollTop || 0,
      },
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
  }
  function background(event: PointerEvent) {
    if (hand.value || space || event.button === 1) {
      start(event, '', { x: 0, y: 0, w: 1, h: 1, z: 0 })
      event.preventDefault()
      event.stopPropagation()
    }
  }
  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') cancel()
    if (
      event.code === 'Space' &&
      !(
        event.target instanceof HTMLElement &&
        event.target.closest('input,textarea,select,button,[contenteditable]')
      )
    ) {
      space = true
      event.preventDefault()
    }
  }
  function keyup(event: KeyboardEvent) {
    if (event.code === 'Space') space = false
  }
  window.addEventListener('keydown', keydown)
  window.addEventListener('keyup', keyup)
  onScopeDispose(() => {
    stop()
    clearTimeout(suppressTimer)
    window.removeEventListener('keydown', keydown)
    window.removeEventListener('keyup', keyup)
  })
  return {
    draft,
    guides,
    dragging,
    hand,
    start,
    cancel,
    background,
    marquee,
    startMarquee(event: PointerEvent) {
      if (event.button !== 0 || hand.value || space) return
      start(event, '', { x: 0, y: 0, w: 1, h: 1, z: 0 }, 'marquee')
      event.preventDefault()
    },
    guardClick(event: MouseEvent) {
      if (suppress) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    },
  }
}
