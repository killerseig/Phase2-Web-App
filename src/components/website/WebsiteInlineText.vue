<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  inject,
  onBeforeUnmount,
  ref,
  watch,
  nextTick,
  type CSSProperties,
} from 'vue'
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

const loadInlineEditor = () => import('./WebsiteInlineEditor.vue')
const InlineEditor = defineAsyncComponent(loadInlineEditor)
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
const titleBlocks = computed(() => props.field === 'title')
const blockTitle = computed(
  () =>
    titleBlocks.value &&
    !!props.rich &&
    (props.rich.content?.length !== 1 ||
      props.rich.content[0]?.type !== 'paragraph' ||
      props.rich.content[0]?.content?.some((node) => node.type !== 'text')),
)
// Keep the host stable throughout editing: changing block structure must not remount Tiptap.
const titleTag = computed(() => ((active.value && titleBlocks.value) || blockTitle.value ? 'div' : props.tag || 'h2'))
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
const editorReady = ref(false)
const editorTypography = ref<CSSProperties>({})
const editorHostTypography = ref<CSSProperties>({})
watch(active, () => {
  editorReady.value = false
})
const box = useTextBox(root, target)
const hint = computed(() =>
  box.enabled.value ? 'Drag to move text · Double-click to edit' : 'Click to edit text',
)
function begin() {
  if (!enabled.value) return
  const display =
    props.field === 'text'
      ? root.value?.querySelector('.widget-text, .website-rich-text')
      : root.value
  if (display) {
    const style = getComputedStyle(display)
    editorTypography.value = {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      fontStyle: style.fontStyle,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      wordSpacing: style.wordSpacing,
      textAlign: style.textAlign as CSSProperties['textAlign'],
      maxWidth: style.maxWidth,
      ...(!props.rich && props.format !== 'markdown' && props.field === 'text'
        ? { margin: style.margin }
        : {}),
    }
  }
  if (titleBlocks.value && root.value) {
    const style = getComputedStyle(root.value)
    editorHostTypography.value = { ...editorTypography.value, margin: style.margin, padding: style.padding }
  }
  editing?.begin(target.value)
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
  else void loadInlineEditor().catch(() => undefined)
}, { immediate: true })
onBeforeUnmount(() => finish())
</script>
<template>
  <component
    v-if="!enabled && field !== 'text'"
    :is="titleTag"
    class="widget-title"
    :class="{ 'title-blocks': blockTitle }"
    :data-title-tag="tag || 'h2'"
    :style="box.style.value"
    >{{ rich ? '' : text
    }}<WebsiteRichText
      v-if="rich"
      :value="rich"
      :heading="!blockTitle"
      :title-blocks="titleBlocks"
      :preview="preview"
      :fallback="text"
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
    :is="field !== 'text' ? titleTag : 'div'"
    ref="root"
    :class="[
      shortLabel ? 'inline-menu' : field !== 'text' ? 'widget-title' : 'inline-body',
      { 'inline-available': enabled, 'inline-active': active },
      { 'title-blocks': blockTitle },
      {
        'text-box-design': box.enabled.value && !active,
        'text-box-selected': box.selected.value && !active,
      },
    ]"
    :style="{ ...box.style.value, ...(active && titleBlocks ? editorHostTypography : {}) }"
    :data-title-tag="tag || 'h2'"
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
      :pending="!editorReady"
      :text-style="editorTypography"
      :text="text"
      :format="format"
      :rich="rich"
      :heading="field !== 'text'"
      :title-blocks="titleBlocks"
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
      @ready="editorReady = true"
    />
    <span v-show="!active || !editorReady" class="inline-display">
      <WebsiteRichText
        v-if="rich"
        :value="rich"
        :heading="field !== 'text' && !blockTitle"
        :title-blocks="titleBlocks"
        :preview="preview"
        :fallback="text"
      />
      <template v-else-if="field !== 'text'">{{ text || (enabled ? 'Add heading' : '') }}</template>
      <WebsiteText v-else-if="text" :text="text" :format="format" :preview="preview" />
      <span v-else class="inline-placeholder">Add text</span>
    </span>
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
.inline-display {
  display: contents;
}
.title-blocks {
  font-family: var(--widget-font, var(--site-heading-font, inherit));
  font-size: var(--heading-size, clamp(1.5rem, 3cqw, 2.5rem));
  font-weight: 700;
  line-height: 1.15;
}
.title-blocks[data-title-tag='h1'] {
  font-size: var(--heading-size, clamp(2rem, 5cqw, 4rem));
}
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
