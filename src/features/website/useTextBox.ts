import { computed, inject, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import type { TextBox } from '../../../functions/src/websiteTextBox'
import { sameText, textBoxEditingKey, textBoxValueKey, type ElementTarget } from './textBox'
import { alignMove, rotationAssist, type AlignmentGuide, type AlignmentRect } from './alignment'
import { normalizeRotation, pointerRotation } from './transform'
import type { ResizeDirection } from './grid'
import { elementViewportTransform, resizeTextBox } from './textBoxGeometry'
import { KEYBOARD_GEOMETRY_PRECISION } from './keyboardGeometry'

type Action = 'move' | 'rotate' | ResizeDirection
const clamp = (n: number, min = -4000, max = 4000) =>
  Math.round(Math.max(min, Math.min(max, n)) * 100) / 100
export function useTextBox(root: Ref<HTMLElement | undefined>, target: Ref<ElementTarget>) {
  const editor = inject(textBoxEditingKey, undefined)
  const read = inject(textBoxValueKey, undefined)
  const draft = ref<TextBox>()
  const guides = ref<AlignmentGuide[]>([])
  const rotationSnapped = ref(false)
  const rotationPreview = computed(() => draft.value?.rotation)
  const enabled = computed(() => !!editor?.enabled(target.value))
  const selected = computed(() => enabled.value && sameText(editor?.selected.value, target.value))
  const value = computed(() => draft.value || read?.(target.value))
  const style = computed(() =>
    value.value
      ? {
          position: 'relative' as const,
          width: value.value.width === undefined ? undefined : `${value.value.width}px`,
          height: value.value.height === undefined ? undefined : `${value.value.height}px`,
          maxWidth: 'none',
          boxSizing: 'border-box' as const,
          padding: value.value.padding === undefined ? undefined : `${value.value.padding}px`,
          transform: `translate(${value.value.x || 0}px, ${value.value.y || 0}px) rotate(${value.value.rotation || 0}deg)`,
          transformOrigin: 'center',
        }
      : undefined,
  )
  let gesture:
    | {
        pointer: number
        action: Action
        x: number
        y: number
        scale: number
        parentAngle: number
        width: number
        height: number
        centerX: number
        centerY: number
        angle: number
        origin: TextBox
        changed: boolean
        capture: HTMLElement
        rect: AlignmentRect
        targets: AlignmentRect[]
        rotationAssist: ReturnType<typeof rotationAssist>
      }
    | undefined
  let swallowClick = false
  function select() {
    if (enabled.value) editor?.select(target.value)
  }
  function start(event: PointerEvent, action: Action = 'move') {
    if (
      !enabled.value ||
      event.button !== 0 ||
      !event.isPrimary ||
      (event.shiftKey && action === 'move')
    )
      return
    const element = root.value
    if (!element) return
    event.preventDefault()
    event.stopPropagation()
    cancel()
    select()
    element.focus({ preventScroll: true })
    const rect = element.getBoundingClientRect()
    const { scale, angle: parentAngle } = elementViewportTransform(element)
    if (!Number.isFinite(scale) || scale <= 0) return
    const owner = element.closest<HTMLElement>('.widget-frame')
    const targets = [...(owner?.querySelectorAll<HTMLElement>('[data-alignable]') || [])]
      .filter((peer) => peer !== element && !element.contains(peer) && !peer.contains(element))
      .map((peer) => peer.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0)
    if (owner) targets.push(owner.getBoundingClientRect())
    element.setPointerCapture(event.pointerId)
    gesture = {
      pointer: event.pointerId,
      action,
      x: event.clientX,
      y: event.clientY,
      scale,
      parentAngle,
      width: element.offsetWidth,
      height: element.offsetHeight,
      centerX: rect.x + rect.width / 2,
      centerY: rect.y + rect.height / 2,
      angle: Math.atan2(
        event.clientY - rect.y - rect.height / 2,
        event.clientX - rect.x - rect.width / 2,
      ),
      origin: { ...read?.(target.value) },
      changed: false,
      capture: element,
      rect,
      targets,
      rotationAssist: rotationAssist(read?.(target.value)?.rotation || 0, event.timeStamp),
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    window.addEventListener('keydown', escape, true)
    window.addEventListener('resize', cancel)
    window.addEventListener('scroll', cancel, true)
  }
  function move(event: PointerEvent) {
    const g = gesture
    if (!g || event.pointerId !== g.pointer) return
    if (!enabled.value) {
      cancel()
      return
    }
    if (!g.changed && Math.hypot(event.clientX - g.x, event.clientY - g.y) < 4) return
    event.preventDefault()
    g.changed = true
    const rawX = (event.clientX - g.x) / g.scale,
      rawY = (event.clientY - g.y) / g.scale
    const dx = Math.cos(g.parentAngle) * rawX + Math.sin(g.parentAngle) * rawY
    const dy = -Math.sin(g.parentAngle) * rawX + Math.cos(g.parentAngle) * rawY
    const next = { ...g.origin }
    if (g.action === 'move') {
      const alignment = alignMove(
        {
          ...g.rect,
          left: g.rect.left + event.clientX - g.x,
          top: g.rect.top + event.clientY - g.y,
          width: g.rect.width,
          height: g.rect.height,
        },
        event.altKey ? [] : g.targets,
      )
      guides.value = alignment.guides
      next.x = clamp(
        (g.origin.x || 0) +
          dx +
          (Math.cos(g.parentAngle) * alignment.x + Math.sin(g.parentAngle) * alignment.y) / g.scale,
      )
      next.y = clamp(
        (g.origin.y || 0) +
          dy +
          (-Math.sin(g.parentAngle) * alignment.x + Math.cos(g.parentAngle) * alignment.y) /
            g.scale,
      )
    } else if (g.action === 'rotate') {
      const raw = pointerRotation(
        g.origin.rotation || 0,
        g.angle,
        Math.atan2(event.clientY - g.centerY, event.clientX - g.centerX),
        false,
      )
      const result = g.rotationAssist.update(raw, event.timeStamp, event.shiftKey, event.altKey)
      next.rotation = result.angle
      rotationSnapped.value = result.snapped
    } else {
      Object.assign(next, resizeTextBox(g.origin, g.width, g.height, dx, dy, g.action,
        (g.origin.lockAspect ?? target.value.field === 'image') !== event.shiftKey))
    }
    draft.value = next
  }
  function cancel() {
    if (gesture?.changed) swallowClick = true
    if (gesture?.capture.hasPointerCapture(gesture.pointer))
      gesture.capture.releasePointerCapture(gesture.pointer)
    gesture = undefined
    draft.value = undefined
    guides.value = []
    rotationSnapped.value = false
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', finish)
    window.removeEventListener('pointercancel', cancel)
    window.removeEventListener('blur', cancel)
    window.removeEventListener('keydown', escape, true)
    window.removeEventListener('resize', cancel)
    window.removeEventListener('scroll', cancel, true)
  }
  function finish(event: PointerEvent) {
    if (event.pointerId !== gesture?.pointer) return
    move(event)
    const next = draft.value
    cancel()
    if (next && enabled.value) editor?.save(target.value, next)
  }
  function escape(event: KeyboardEvent) {
    if (event.key !== 'Escape' || event.isComposing) return
    event.preventDefault()
    event.stopImmediatePropagation()
    cancel()
  }
  function acceptsKey(event: KeyboardEvent) {
    const element = event.target instanceof HTMLElement ? event.target : undefined
    return !gesture && !event.defaultPrevented && !event.isComposing && !event.ctrlKey &&
      !event.metaKey && !event.altKey &&
      !element?.closest('input,textarea,select,[contenteditable],[role="dialog"],[role="menu"]')
  }
  function key(event: KeyboardEvent, action: Action = 'move') {
    if (!selected.value || !acceptsKey(event) || !root.value) return
    if (['Delete', 'Backspace'].includes(event.key)) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (event.key === 'Escape') {
      event.stopPropagation()
      editor!.selected.value = undefined
      return
    }
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[
      event.key
    ]
    if (!delta && !(action === 'rotate' && event.key === 'Home')) return
    event.preventDefault()
    event.stopPropagation()
    let next = { ...read?.(target.value) }
    if (action === 'rotate')
      next.rotation =
        event.key === 'Home'
          ? 0
          : normalizeRotation(
              (next.rotation || 0) + (delta![0]! || -delta![1]!) * (event.shiftKey ? 15 : 1),
            )
    else {
      const { scale, angle } = elementViewportTransform(root.value)
      if (!Number.isFinite(scale) || scale <= 0) return
      const step = event.shiftKey ? 1 / scale : 1
      const dx = (Math.cos(angle) * delta![0]! + Math.sin(angle) * delta![1]!) * step
      const dy = (-Math.sin(angle) * delta![0]! + Math.cos(angle) * delta![1]!) * step
      const precise = (value: number) => Number(Math.max(-4000, Math.min(4000, value)).toFixed(KEYBOARD_GEOMETRY_PRECISION))
      if (action === 'move') {
        if (dx) next.x = precise((next.x || 0) + dx)
        if (dy) next.y = precise((next.y || 0) + dy)
      } else {
        const width = next.width ?? root.value.offsetWidth
        const height = next.height ?? root.value.offsetHeight
        next = resizeTextBox(next, width, height, dx, dy, action,
          next.lockAspect ?? target.value.field === 'image', KEYBOARD_GEOMETRY_PRECISION)
        if ((next.width ?? width) === width && (next.height ?? height) === height) return
      }
    }
    editor?.save(target.value, next)
  }
  function outside(event: PointerEvent) {
    if (
      !selected.value ||
      root.value?.contains(event.target as Node) ||
      (event.target as HTMLElement).closest(
        '.inline-text-toolbar, [data-element-inspector], [data-selection-inspector], .layers-panel',
      )
    )
      return
    editor!.selected.value = undefined
  }
  onMounted(() => document.addEventListener('pointerdown', outside, true))
  watch(
    [root, enabled, target],
    ([element, canEdit, current], _, cleanup) => {
      if (element && canEdit && editor) cleanup(editor.register(current, element))
    },
    { flush: 'post' },
  )
  watch(
    () => editor?.device.value,
    () => cancel(),
  )
  onBeforeUnmount(() => {
    cancel()
    document.removeEventListener('pointerdown', outside, true)
  })
  return {
    enabled,
    selected,
    style,
    guides,
    rotationPreview,
    rotationSnapped,
    select,
    start,
    key,
    acceptsKey,
    consumeClick() {
      const result = swallowClick
      swallowClick = false
      return result
    },
  }
}
