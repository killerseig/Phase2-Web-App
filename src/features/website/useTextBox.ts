import { computed, inject, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import type { TextBox } from '../../../functions/src/websiteTextBox'
import { sameText, textBoxEditingKey, textBoxValueKey, type ElementTarget } from './textBox'
import { alignMove, rotationAssist, type AlignmentGuide, type AlignmentRect } from './alignment'
import { normalizeRotation, pointerRotation } from './transform'
import type { ResizeDirection } from './grid'

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
        lastX: number
        lastY: number
        lastTime: number
        fast: boolean
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
    const preview = element.closest<HTMLElement>('.preview-frame')
    let scale = preview ? preview.getBoundingClientRect().width / preview.offsetWidth : 1
    const owner = element.closest<HTMLElement>('.widget-frame')
    const targets = [...(owner?.querySelectorAll<HTMLElement>('[data-alignable]') || [])]
      .filter((peer) => peer !== element && !element.contains(peer) && !peer.contains(element))
      .map((peer) => peer.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0)
    if (owner) targets.push(owner.getBoundingClientRect())
    let parentAngle = 0
    for (
      let parent = element.parentElement;
      parent && parent !== preview;
      parent = parent.parentElement
    ) {
      const transform = getComputedStyle(parent).transform
      if (transform !== 'none') {
        const matrix = new DOMMatrixReadOnly(transform)
        parentAngle += Math.atan2(matrix.b, matrix.a)
        scale *= Math.hypot(matrix.a, matrix.b)
      }
    }
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
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      fast: false,
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
    const distance = Math.hypot(event.clientX - g.lastX, event.clientY - g.lastY)
    if (distance > 0.01) {
      g.fast = (distance * 1000) / Math.max(8, event.timeStamp - g.lastTime) >= 100
      g.lastX = event.clientX
      g.lastY = event.clientY
      g.lastTime = event.timeStamp
    }
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
        g.fast,
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
      const angle = ((g.origin.rotation || 0) * Math.PI) / 180,
        c = Math.cos(angle),
        s = Math.sin(angle)
      const horizontal = g.action.includes('left') ? -1 : g.action.includes('right') ? 1 : 0
      const vertical = g.action.includes('top') ? -1 : g.action.includes('bottom') ? 1 : 0
      let width = horizontal ? clamp(g.width + horizontal * (c * dx + s * dy), 24) : g.width
      let height = vertical ? clamp(g.height + vertical * (-s * dx + c * dy), 24) : g.height
      if (
        horizontal &&
        vertical &&
        (g.origin.lockAspect ?? target.value.field === 'image') !== event.shiftKey
      ) {
        const ratio = g.width / Math.max(1, g.height)
        const factor =
          Math.abs(width / g.width - 1) >= Math.abs(height / g.height - 1)
            ? width / g.width
            : height / g.height
        width = clamp(
          g.width *
            Math.max(
              24 / g.width,
              24 / g.height,
              Math.min(factor, 4000 / g.width, 4000 / g.height),
            ),
          24,
        )
        height = clamp(width / ratio, 24)
      }
      const shiftX = (horizontal * (width - g.width)) / 2,
        shiftY = (vertical * (height - g.height)) / 2
      next.width = width
      next.height = height
      next.x = clamp((g.origin.x || 0) + c * shiftX - s * shiftY - (width - g.width) / 2)
      next.y = clamp((g.origin.y || 0) + s * shiftX + c * shiftY - (height - g.height) / 2)
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
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopImmediatePropagation()
    cancel()
  }
  function key(event: KeyboardEvent, action: Action = 'move') {
    if (!selected.value) return
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
    const next = { ...read?.(target.value) },
      step = event.shiftKey ? 10 : 1
    if (action === 'rotate')
      next.rotation =
        event.key === 'Home'
          ? 0
          : normalizeRotation(
              (next.rotation || 0) + (delta![0]! || -delta![1]!) * (event.shiftKey ? 15 : 1),
            )
    else if (action === 'move') {
      next.x = clamp((next.x || 0) + delta![0]! * step)
      next.y = clamp((next.y || 0) + delta![1]! * step)
    } else {
      const width = next.width ?? root.value!.offsetWidth
      const height = next.height ?? root.value!.offsetHeight
      const corner =
        (action.includes('left') || action.includes('right')) &&
        (action.includes('top') || action.includes('bottom'))
      if (corner && (next.lockAspect ?? target.value.field === 'image')) {
        const factor = delta![0]
          ? (width + delta![0]! * step) / width
          : (height + delta![1]! * step) / height
        const bounded = Math.max(
          24 / width,
          24 / height,
          Math.min(factor, 4000 / width, 4000 / height),
        )
        next.width = clamp(width * bounded, 24)
        next.height = clamp(height * bounded, 24)
      } else {
        next.width = clamp(width + delta![0]! * step, 24)
        next.height = clamp(height + delta![1]! * step, 24)
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
    consumeClick() {
      const result = swallowClick
      swallowClick = false
      return result
    },
  }
}
