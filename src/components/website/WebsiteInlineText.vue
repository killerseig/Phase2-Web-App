<script setup lang="ts">
import { computed, defineAsyncComponent, inject, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import {
  inlineEditingKey,
  navigationEditingKey,
  itemEditingKey,
  type InlineTarget,
} from '@/features/website/inlineEditing'
import WebsiteText from './WebsiteText.vue'
import WebsiteRichText from './WebsiteRichText.vue'
import { useTextBox } from '@/features/website/useTextBox'
import WebsiteSelectionHandles from './WebsiteSelectionHandles.vue'
import WebsiteAlignmentGuides from './WebsiteAlignmentGuides.vue'
import type { RichTextNode } from '../../../functions/src/websiteRichText'

const InlineEditor = defineAsyncComponent(() => import('./WebsiteInlineEditor.vue'))
const props = defineProps<{
  id: string
  field: InlineTarget['field']
  targetKey?: string
  text: string
  rich?: RichTextNode
  format?: 'markdown'
  tag?: string
  preview?: boolean
}>()
const editing = inject(inlineEditingKey, undefined)
const editMenu = inject(navigationEditingKey, undefined)
const editItem = inject(itemEditingKey, undefined)
const shortLabel = computed(() => props.field === 'menu' || props.field === 'linkLabel')
const target = computed<InlineTarget>(() => ({
  id: props.id,
  field: props.field,
  key: props.targetKey,
}))
const enabled = computed(() => Boolean(props.preview && editing?.enabled(target.value)))
const active = computed(
  () =>
    enabled.value &&
    editing?.active.value?.id === props.id &&
    editing.active.value.field === props.field &&
    editing.active.value.key === props.targetKey,
)
const root = ref<HTMLElement>()
const box = useTextBox(root, target)
const hint = computed(() =>
  box.enabled.value ? 'Drag to move text · Double-click to edit' : 'Click to edit text',
)
function begin() {
  if (enabled.value) editing?.begin(target.value)
}
let selectedOnPointerDown = false
function pointerDown(event: PointerEvent) {
  selectedOnPointerDown = false
  if (!enabled.value) return
  event.stopPropagation()
  if (event.button === 0 && editing?.design() && event.shiftKey && !active.value) {
    // Closing another inline editor can reveal its floating toolbar under
    // this pointer. Select now rather than relying on the later click target.
    event.preventDefault()
    selectedOnPointerDown = true
    editing.select(target.value, event)
  } else if (!active.value && box.enabled.value) {
    box.start(event)
  }
}
function click(event: MouseEvent) {
  if (!enabled.value || active.value) return
  event.preventDefault()
  event.stopPropagation()
  if (box.consumeClick()) return
  if (selectedOnPointerDown) {
    selectedOnPointerDown = false
    return
  }
  if (editing?.design() && event.shiftKey) editing.select(target.value, event)
  else if (box.enabled.value) box.select()
  else begin()
}
function textKey(event: KeyboardEvent) {
  if (active.value) return
  box.key(event)
  if (box.selected.value && ['Delete', 'Backspace'].includes(event.key)) {
    event.preventDefault()
    event.stopPropagation()
  }
  if (enabled.value && event.key === 'Enter') {
    event.preventDefault()
    event.stopPropagation()
    begin()
  }
}
function finish(focus = false) {
  editing?.end(target.value)
  if (focus) void nextTick(() => root.value?.focus({ preventScroll: true }))
}
watch(enabled, (value) => {
  if (!value) finish()
})
onBeforeUnmount(() => finish())
</script>
<template>
  <component
    v-if="!enabled && field !== 'text'"
    :is="tag || 'h2'"
    class="widget-title"
    :style="box.style.value"
    >{{ rich ? '' : text
    }}<WebsiteRichText v-if="rich" :value="rich" heading :preview="preview" :fallback="text"
  /></component>
  <WebsiteText
    v-else-if="!enabled && (text || rich)"
    :text="text"
    :rich="rich"
    :format="format"
    :preview="preview"
    :style="box.style.value"
  />
  <component
    v-else-if="enabled"
    :is="field !== 'text' ? tag || 'h2' : 'div'"
    ref="root"
    :class="[
      shortLabel ? 'inline-menu' : field !== 'text' ? 'widget-title' : 'inline-body',
      { 'inline-available': enabled, 'inline-active': active },
      {
        'text-box-design': box.enabled.value && !active,
        'text-box-selected': box.selected.value && !active,
      },
    ]"
    :style="box.style.value"
    :aria-label="field === 'title' && !active ? text : undefined"
    :data-text-field="field"
    :data-alignable="enabled ? 'text' : undefined"
    :tabindex="enabled && !active ? 0 : undefined"
    :title="enabled && !active ? hint : undefined"
    @pointerdown="pointerDown"
    @click="click"
    @dblclick="enabled && !$event.shiftKey && ($event.stopPropagation(), begin())"
    @keydown="textKey"
  >
    <InlineEditor
      v-if="active"
      :text="text"
      :format="format"
      :rich="rich"
      :heading="field !== 'text'"
      :allow-links="!shortLabel"
      :max-length="shortLabel ? 80 : undefined"
      :label="
        field === 'menu'
          ? 'Edit menu label on page'
          : field === 'linkLabel'
            ? 'Edit button label on page'
            : undefined
      "
      :link-settings="shortLabel"
      @link-settings="field === 'menu' ? editMenu?.(id, targetKey || '') : editItem?.(target)"
      @update="(text, format, rich) => editing?.update(target, text, format, rich)"
      @done="finish"
    />
    <WebsiteRichText
      v-else-if="rich"
      :value="rich"
      :heading="field !== 'text'"
      :preview="preview"
      :fallback="text"
    />
    <template v-else-if="field !== 'text'">{{ text || (enabled ? 'Add heading' : '') }}</template>
    <WebsiteText v-else-if="text" :text="text" :format="format" :preview="preview" />
    <span v-else class="inline-placeholder">Add text</span>
    <WebsiteSelectionHandles
      v-if="box.selected.value && !active"
      label="text"
      :rotation="box.rotationPreview.value"
      :snapped="box.rotationSnapped.value"
      @drag="box.start"
      @key="box.key"
    />
    <WebsiteAlignmentGuides :guides="box.guides.value" />
  </component>
</template>
<style scoped>
.inline-available {
  cursor: text;
  touch-action: auto;
}
.text-box-design {
  position: relative;
  cursor: move;
  touch-action: none;
  user-select: none;
}
.text-box-selected {
  outline: 2px solid #168bd4;
  outline-offset: 0;
}
.inline-available:hover,
.inline-available:focus-visible {
  outline: 1px dashed #168bd4;
  outline-offset: 3px;
}
.text-box-selected:hover,
.text-box-selected:focus-visible {
  outline: 2px solid #168bd4;
  outline-offset: 0;
}
.inline-active {
  outline: 2px solid #168bd4;
  outline-offset: 3px;
  user-select: text;
  touch-action: auto;
}
.inline-placeholder {
  opacity: 0.6;
  font-size: 1rem;
}
.inline-body {
  line-height: 1.65;
}
.inline-body :deep(p.widget-text) {
  margin: 0 0 1.25rem;
  overflow-wrap: anywhere;
}
</style>
