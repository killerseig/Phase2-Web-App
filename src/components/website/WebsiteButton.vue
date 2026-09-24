<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { useTextBox } from '@/features/website/useTextBox'
import WebsiteSelectionHandles from './WebsiteSelectionHandles.vue'
import WebsiteAlignmentGuides from './WebsiteAlignmentGuides.vue'
import { inlineEditingKey } from '@/features/website/inlineEditing'
import type { WebsiteItem } from '@/features/website/types'
import WebsiteInlineText from './WebsiteInlineText.vue'
import WebsiteRichText from './WebsiteRichText.vue'
const props = defineProps<{
  item: WebsiteItem
  sectionId: string
  preview?: boolean
  fallback?: string
  hideEmpty?: boolean
}>()
const editing = inject(inlineEditingKey, undefined)
const key = computed(() => (props.item.id === props.sectionId ? undefined : props.item.id))
const root = ref<HTMLElement>()
const box = useTextBox(
  root,
  computed(() => ({ id: props.sectionId, key: key.value, field: 'button' as const })),
)
const editable = computed(
  () =>
    props.preview && editing?.enabled({ id: props.sectionId, field: 'linkLabel', key: key.value }),
)
const active = computed(
  () =>
    editing?.active.value?.id === props.sectionId &&
    editing.active.value.field === 'linkLabel' &&
    editing.active.value.key === key.value,
)
const label = computed(() =>
  active.value
    ? props.item.linkLabel
    : props.item.linkLabel || props.fallback || (editable.value ? 'Add button text' : ''),
)
function edit(event: MouseEvent | KeyboardEvent) {
  if (!editable.value || event.shiftKey) return
  event.preventDefault()
  event.stopPropagation()
  editing?.begin({ id: props.sectionId, field: 'linkLabel', key: key.value })
}
function pointer(event: PointerEvent) {
  if (!box.enabled.value || active.value) return
  event.stopPropagation()
  if (event.shiftKey)
    editing?.select({ id: props.sectionId, field: 'linkLabel', key: key.value }, event)
  else box.start(event)
}
function click(event: MouseEvent) {
  if (props.preview) event.preventDefault()
  if (box.consumeClick()) {
    event.stopPropagation()
    return
  }
  if (box.enabled.value && !active.value) {
    event.stopPropagation()
    if (!event.shiftKey) box.select()
  }
}
</script>
<template>
  <component
    v-if="!hideEmpty || active || (item.linkLabel && (item.linkUrl || preview))"
    :is="editable ? 'div' : 'a'"
    :href="editable ? undefined : item.linkUrl"
    ref="root"
    class="editable-button"
    :class="{
      'element-selected': box.selected.value && !active,
      'element-design': box.enabled.value && !active,
    }"
    :style="box.style.value"
    :data-alignable="box.enabled.value ? 'button' : undefined"
    :tabindex="box.enabled.value && !active ? 0 : undefined"
    :title="box.enabled.value && !active ? 'Drag to move button · Double-click to edit' : undefined"
    @pointerdown="pointer"
    @click="click"
    @dblclick="edit"
    @keydown="!active && box.key($event)"
    @keydown.enter="!active && edit($event)"
  >
    <WebsiteInlineText
      v-if="editable && (!box.enabled.value || active)"
      :id="sectionId"
      field="linkLabel"
      :target-key="key"
      tag="div"
      :text="label"
      :rich="item.linkRichText"
      :preview="preview"
    />
    <WebsiteRichText
      v-else-if="item.linkRichText"
      :value="item.linkRichText"
      heading
      :fallback="label"
      :preview="preview"
    />
    <template v-else>{{ label }}</template>
    <WebsiteSelectionHandles
      v-if="box.selected.value && !active"
      label="button"
      :rotation="box.rotationPreview.value"
      :snapped="box.rotationSnapped.value"
      @drag="box.start"
      @key="box.key"
    />
    <WebsiteAlignmentGuides :guides="box.guides.value" />
  </component>
</template>
<style scoped>
.editable-button {
  position: relative;
  cursor: pointer;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  overflow-wrap: anywhere;
}
.element-design {
  cursor: move;
  touch-action: none;
  user-select: none;
}
.element-selected {
  outline: 2px solid #168bd4;
  outline-offset: 0;
}
.editable-button:where(:not(.website-cta):not(.block-button)) {
  text-decoration: underline;
}
.editable-button :deep(.inline-menu) {
  margin: 0;
  font: inherit;
}
</style>
