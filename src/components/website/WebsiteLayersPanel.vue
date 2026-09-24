<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { layerRows, layerSiblings } from '@/features/website/layers'
import { sectionLabels, type WebsiteSection } from '@/features/website/types'
import { sameText, type ElementTarget } from '@/features/website/textBox'

const props = defineProps<{
  sections: WebsiteSection[]
  selectedIds: string[]
  disabled?: boolean
  elements?: ElementTarget[]
  selectedElement?: ElementTarget
}>()
const emit = defineEmits<{
  select: [id: string, event: MouseEvent]
  reveal: [id: string]
  reorder: [sourceId: string, targetId: string, placement: 'before' | 'after']
  'select-element': [target: ElementTarget]
  'reveal-element': [target: ElementTarget]
}>()
const expanded = ref<string[]>([])
function sectionElements(id: string) {
  return (props.elements || [])
    .filter((entry) => entry.id === id)
    .filter((entry, index, list) => list.findIndex((other) => sameText(entry, other)) === index)
}
function elementLabel(target: ElementTarget) {
  const section = props.sections.find((entry) => entry.id === target.id)
  const item = target.key ? section?.items.find((entry) => entry.id === target.key) : undefined
  const label =
    { title: 'Heading', text: 'Text', image: 'Image', button: 'Button' }[
      target.field as 'title' | 'text' | 'image' | 'button'
    ] || target.field
  return item ? `${item.title || `Item ${section!.items.indexOf(item) + 1}`} · ${label}` : label
}
function toggle(id: string) {
  expanded.value = expanded.value.includes(id)
    ? expanded.value.filter((entry) => entry !== id)
    : [...expanded.value, id]
}
watch(
  () => props.selectedElement,
  (target) => {
    if (target && !expanded.value.includes(target.id))
      expanded.value = [...expanded.value, target.id]
  },
)
const rows = computed(() => layerRows(props.sections))
const list = ref<HTMLElement>()
const dragging = ref('')
const drop = ref<{ id: string; placement: 'before' | 'after' }>()
const status = ref('')
let pointer:
  | { id: number; source: string; x: number; y: number; startX: number; startY: number }
  | undefined
let frame = 0
let captured: HTMLElement | undefined
let suppressClick = false
let clickTimer: ReturnType<typeof setTimeout> | undefined
function siblings(id: string) {
  return layerSiblings(
    props.sections,
    props.sections.find((section) => section.id === id)?.parentId,
  )
}
function canMove(id: string, direction: -1 | 1) {
  const group = siblings(id)
  return Boolean(group[group.findIndex((section) => section.id === id) + direction])
}
function move(id: string, direction: -1 | 1) {
  if (props.disabled) return
  const group = siblings(id)
  const target = group[group.findIndex((section) => section.id === id) + direction]
  if (!target) return
  emit('reorder', id, target.id, direction === -1 ? 'before' : 'after')
  status.value = `Layer moved ${direction === -1 ? 'forward' : 'backward'}.`
}
function select(id: string, event: MouseEvent) {
  if (!props.disabled && !suppressClick) emit('select', id, event)
}
function updateDrop() {
  if (!pointer || !list.value) return
  const bounds = list.value.getBoundingClientRect()
  const over =
    pointer.x >= bounds.left &&
    pointer.x <= bounds.right &&
    pointer.y >= bounds.top &&
    pointer.y <= bounds.bottom
  const element = over
    ? document.elementFromPoint(pointer.x, pointer.y)?.closest<HTMLElement>('[data-layer-id]')
    : undefined
  const source = props.sections.find((section) => section.id === pointer!.source)
  const target = props.sections.find((section) => section.id === element?.dataset.layerId)
  if (
    !element ||
    !target ||
    !source ||
    source.id === target.id ||
    (source.parentId || '') !== (target.parentId || '')
  ) {
    drop.value = undefined
    return
  }
  const rect = element.getBoundingClientRect()
  drop.value = {
    id: target.id,
    placement: pointer.y < rect.top + rect.height / 2 ? 'before' : 'after',
  }
}
function scroll() {
  if (!pointer) return
  if (dragging.value && list.value) {
    const bounds = list.value.getBoundingClientRect()
    if (
      pointer.x >= bounds.left &&
      pointer.x <= bounds.right &&
      pointer.y >= bounds.top &&
      pointer.y <= bounds.bottom
    ) {
      const distance = pointer.y < bounds.top + 32 ? -9 : pointer.y > bounds.bottom - 32 ? 9 : 0
      if (distance) {
        list.value.scrollTop += distance
        updateDrop()
      }
    }
  }
  frame = requestAnimationFrame(scroll)
}
function start(event: PointerEvent, id: string) {
  if (props.disabled || event.button !== 0 || pointer) return
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).focus({ preventScroll: true })
  pointer = {
    id: event.pointerId,
    source: id,
    x: event.clientX,
    y: event.clientY,
    startX: event.clientX,
    startY: event.clientY,
  }
  captured = event.currentTarget as HTMLElement
  captured.setPointerCapture(event.pointerId)
  captured.addEventListener('lostpointercapture', cancel)
  window.addEventListener('pointermove', motion, { passive: false })
  window.addEventListener('pointerup', finish)
  window.addEventListener('pointercancel', cancel)
  window.addEventListener('keydown', key, true)
  window.addEventListener('blur', cancel)
  frame = requestAnimationFrame(scroll)
}
function motion(event: PointerEvent) {
  if (!pointer || event.pointerId !== pointer.id) return
  event.preventDefault()
  pointer.x = event.clientX
  pointer.y = event.clientY
  if (Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) > 4)
    dragging.value = pointer.source
  if (dragging.value) updateDrop()
}
function cleanup() {
  if (dragging.value) {
    suppressClick = true
    clearTimeout(clickTimer)
    clickTimer = setTimeout(() => {
      suppressClick = false
    }, 0)
  }
  captured?.removeEventListener('lostpointercapture', cancel)
  if (pointer && captured?.hasPointerCapture(pointer.id)) captured.releasePointerCapture(pointer.id)
  captured = undefined
  pointer = undefined
  dragging.value = ''
  drop.value = undefined
  cancelAnimationFrame(frame)
  window.removeEventListener('pointermove', motion)
  window.removeEventListener('pointerup', finish)
  window.removeEventListener('pointercancel', cancel)
  window.removeEventListener('keydown', key, true)
  window.removeEventListener('blur', cancel)
}
function finish(event: PointerEvent) {
  if (!pointer || event.pointerId !== pointer.id) return
  pointer.x = event.clientX
  pointer.y = event.clientY
  updateDrop()
  const source = dragging.value,
    target = drop.value
  cleanup()
  if (!props.disabled && source && target) {
    emit('reorder', source, target.id, target.placement)
    status.value = 'Layer order updated.'
  }
}
function cancel() {
  cleanup()
}
function key(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  cancel()
  status.value = 'Layer move cancelled.'
}
watch(
  () => props.disabled,
  (value) => {
    if (value) cancel()
  },
)
watch(
  () => props.sections,
  () => cancel(),
  { deep: true },
)
onBeforeUnmount(() => {
  cleanup()
  clearTimeout(clickTimer)
})
</script>
<template>
  <section class="layers-panel" aria-label="Page layers">
    <p class="layer-help">
      Front at top. Drag to reorder within a container. Double-click to find an object. Use Pages →
      On this page to change content order.
    </p>
    <ol ref="list" class="layers-list" aria-label="Layers from front to back">
      <li
        v-for="{ section, depth, inheritedHidden } in rows"
        :key="section.id"
        :data-layer-id="section.id"
        :style="{ '--layer-depth': Math.min(depth, 5) }"
        :class="{
          'is-selected': selectedIds.includes(section.id),
          'is-dragging': dragging === section.id,
          'drop-before': drop?.id === section.id && drop.placement === 'before',
          'drop-after': drop?.id === section.id && drop.placement === 'after',
        }"
        @keydown.alt.up.prevent.stop="!selectedElement && move(section.id, -1)"
        @keydown.alt.down.prevent.stop="!selectedElement && move(section.id, 1)"
      >
        <button
          v-if="sectionElements(section.id).length"
          class="layer-expand"
          :aria-label="`Show elements in ${section.title || sectionLabels[section.type]}`"
          :aria-expanded="expanded.includes(section.id)"
          @click="toggle(section.id)"
        >
          <i
            :class="expanded.includes(section.id) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
            aria-hidden="true"
          />
        </button>
        <button
          class="layer-grip"
          :aria-label="`Drag ${section.title || sectionLabels[section.type]} layer`"
          :disabled="disabled"
          title="Drag to change layer order; Alt + arrow keys also move layers"
          @pointerdown.stop="start($event, section.id)"
          @dragstart.prevent
          @click="select(section.id, $event)"
        >
          <i class="pi pi-bars" aria-hidden="true" />
        </button>
        <button
          class="layer-name"
          :disabled="disabled"
          :aria-label="`Select layer ${section.title || sectionLabels[section.type]}`"
          :aria-pressed="selectedIds.includes(section.id)"
          title="Double-click or press Enter to find this object"
          @click="select(section.id, $event)"
          @dblclick="!disabled && emit('reveal', section.id)"
          @keydown.enter.prevent.stop="!disabled && emit('reveal', section.id)"
        >
          <span>{{ section.title || sectionLabels[section.type] }}</span>
          <small
            >{{ sectionLabels[section.type] }} · {{ section.layout?.z ?? 0
            }}{{ section.hidden || inheritedHidden ? ' · Hidden' : '' }}</small
          >
        </button>
        <div class="layer-order">
          <button
            :aria-label="`Raise ${section.title || sectionLabels[section.type]} layer`"
            :disabled="disabled || !canMove(section.id, -1)"
            @click="move(section.id, -1)"
          >
            ↑
          </button>
          <button
            :aria-label="`Lower ${section.title || sectionLabels[section.type]} layer`"
            :disabled="disabled || !canMove(section.id, 1)"
            @click="move(section.id, 1)"
          >
            ↓
          </button>
        </div>
        <div
          v-if="expanded.includes(section.id)"
          class="element-layers"
          role="group"
          :aria-label="`Elements in ${section.title || sectionLabels[section.type]}`"
        >
          <button
            v-for="entry in sectionElements(section.id)"
            :key="`${entry.key || ''}:${entry.field}`"
            :disabled="disabled"
            :aria-label="`Select element ${elementLabel(entry)}`"
            :aria-pressed="sameText(selectedElement, entry)"
            @click.stop="emit('select-element', entry)"
            @dblclick.stop="emit('reveal-element', entry)"
            @keydown.enter.prevent.stop="emit('reveal-element', entry)"
          >
            {{ elementLabel(entry) }}
          </button>
        </div>
      </li>
    </ol>
    <p v-if="!rows.length" class="layer-help">Add a widget to start building this page.</p>
    <p class="sr-only" aria-live="polite">{{ status }}</p>
  </section>
</template>
<style scoped>
.layer-help {
  font-size: 0.75rem;
  color: var(--muted);
  line-height: 1.4;
  margin: 0.5rem 0;
}
.layers-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 50vh;
  overflow: auto;
  overscroll-behavior: contain;
}
li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem;
  padding: 0.2rem 0.2rem 0.2rem calc(0.2rem + var(--layer-depth) * 0.65rem);
  border: 1px solid var(--border);
  border-radius: 4px;
  margin: 0.2rem 0;
  position: relative;
}
li.is-selected {
  background: var(--surface-2);
  border-color: var(--accent);
}
li.is-dragging {
  opacity: 0.5;
}
li.drop-before {
  box-shadow: inset 0 3px var(--accent);
}
li.drop-after {
  box-shadow: inset 0 -3px var(--accent);
}
button {
  padding: 0.25rem;
  border: 0;
  background: transparent;
  color: inherit;
}
.layer-grip {
  touch-action: none;
  cursor: grab;
  flex: none;
}
.layer-name {
  flex: 1;
  min-width: 0;
  text-align: left;
}
.layer-name span,
.layer-name small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.layer-name small {
  font-size: 0.7rem;
  color: var(--muted);
}
.layer-order {
  display: flex;
  flex-direction: column;
  flex: none;
}
.element-layers {
  flex-basis: 100%;
  display: grid;
  padding-left: 1.5rem;
  gap: 0.15rem;
}
.element-layers button {
  text-align: left;
  font-size: 0.75rem;
  border-radius: 3px;
}
.element-layers button[aria-pressed='true'] {
  background: var(--surface-2);
  outline: 1px solid var(--accent);
}
.layer-expand {
  font-size: 0.65rem;
}
.layer-order button {
  font-size: 0.7rem;
  line-height: 1;
  padding: 0.2rem 0.3rem;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
