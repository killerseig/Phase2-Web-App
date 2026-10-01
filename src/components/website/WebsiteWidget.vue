<script setup lang="ts">
import WebsiteCompactWidget from './WebsiteCompactWidget.vue'
import WebsiteBlocks from './WebsiteBlocks.vue'
import { blockTypes, compactTypes } from '../../../functions/src/websiteBlocks'
import WebsiteInteractive from './WebsiteInteractive.vue'
import WebsitePublicForm from './WebsitePublicForm.vue'
import WebsiteCustomWidget from './WebsiteCustomWidget.vue'
import WebsiteMedia from './WebsiteMedia.vue'
import WebsiteButton from './WebsiteButton.vue'
import WebsiteInlineText from './WebsiteInlineText.vue'
import WebsiteNavigation from './WebsiteNavigation.vue'
import { computed, provide, ref } from 'vue'
import { useWebsiteMotion } from '@/features/website/motion'
import { imageOwnerKey } from '@/features/website/imageEditing'
import { textBoxValueKey, textBoxEditingKey } from '@/features/website/textBox'
import { inject } from 'vue'
import { layoutLocked } from '@/features/website/containers'
import type { WebsiteSection, WebsiteSite } from '@/features/website/types'
import { appearanceStyle, rotationStyle } from '@/features/website/appearance'
import { containerStyle, sizingStyle, websiteDeviceKey } from '@/features/website/responsive'
import {
  geometryStyle,
  resizeDirections,
  type WidgetAction,
  type GridDraft,
} from '@/features/website/grid'
const props = defineProps<{
  site?: WebsiteSite
  pageId?: string
  section: WebsiteSection
  sections: WebsiteSection[]
  gridMode?: boolean
  flow?: boolean
  geometryEditable?: boolean
  preview?: boolean
  designTools?: boolean
  privateImages?: boolean
  selectedId?: string
  selectedIds?: string[]
  gridDraft?: GridDraft
  locked?: boolean
}>()
const emit = defineEmits<{
  select: [id: string, event?: MouseEvent]
  'widget-menu': [event: MouseEvent, id: string]
  'drag-widget': [event: PointerEvent, id: string, action: WidgetAction]
  'geometry-key': [event: KeyboardEvent, id: string]
}>()
const motionRoot = ref<HTMLElement>()
useWebsiteMotion(
  motionRoot,
  () => props.section.appearance?.motion,
  () => !!props.preview,
)
const heightOverride = computed(() =>
  props.gridDraft?.id === props.section.id && props.gridDraft.heightOnly
    ? props.gridDraft.layout.h * 32
    : props.section.sizing?.height,
)
const fixed = computed(() => layoutLocked(props.sections, props.section.id))
const device = inject(websiteDeviceKey, undefined)
const automaticColumns = computed(() =>
  props.flow &&
  device?.value === 'tablet' &&
  !props.section.devices?.tablet?.container &&
  props.section.container?.direction !== 'column'
    ? Math.min(
        2,
        Math.max(1, props.sections.filter((child) => child.parentId === props.section.id).length),
      )
    : undefined,
)
const textEditing = inject(textBoxEditingKey, undefined)
const selectingText = computed(() => textEditing?.selected.value?.id === props.section.id)
provide(textBoxValueKey, (target) => {
  const item = target.key
    ? props.section.items.find((item) => item.id === target.key)
    : props.section
  return target.field === 'title' ||
    target.field === 'text' ||
    target.field === 'image' ||
    target.field === 'button'
    ? item?.textBoxes?.[target.field]
    : undefined
})
provide(
  imageOwnerKey,
  computed(() => ({ sectionId: props.section.id, preview: !!props.preview })),
)
function layoutFor(id: string) {
  return (
    props.gridDraft?.layouts?.[id] ||
    (props.gridDraft?.id === id ? props.gridDraft.layout : props.section.layout!)
  )
}
function contextMenu(event: MouseEvent, id: string) {
  if (!props.preview || props.designTools === false) return
  event.preventDefault()
  event.stopPropagation()
  emit('widget-menu', event, id)
}
function geometryKey(event: KeyboardEvent) {
  if (
    props.preview &&
    props.designTools !== false &&
    (event.target as HTMLElement).closest('.widget-frame') === event.currentTarget
  )
    emit('geometry-key', event, props.section.id)
}
</script>
<template>
  <div
    class="widget-frame"
    :class="{
      'grid-widget': gridMode && !section.parentId,
      'contained-widget': !!section.parentId,
      'flow-widget': flow,
      'fixed-height': (flow || !!section.parentId) && heightOverride !== undefined,
      'grid-selected':
        preview &&
        !selectingText &&
        (selectedIds?.includes(section.id) || selectedId === section.id),
    }"
    :style="{
      ...(gridMode && !section.parentId
        ? geometryStyle(layoutFor(section.id))
        : { '--widget-span': section.span || 12, zIndex: section.layout?.z }),
      ...rotationStyle({
        ...section.appearance,
        rotation:
          gridDraft?.id === section.id && gridDraft.rotation !== undefined
            ? gridDraft.rotation
            : section.appearance?.rotation,
      }),
      ...(section.parentId
        ? {
            ...sizingStyle(section.sizing),
            height: heightOverride !== undefined ? heightOverride + 'px' : undefined,
          }
        : flow
          ? {
              height: heightOverride !== undefined ? heightOverride + 'px' : undefined,
              minHeight: section.sizing?.minHeight ? section.sizing.minHeight + 'px' : undefined,
            }
          : {}),
    }"
    :data-widget-id="preview ? section.id : undefined"
    :tabindex="preview ? 0 : undefined"
    :aria-label="preview ? `Select ${section.title || 'section'} widget` : undefined"
    @keydown="geometryKey"
    @pointerdown.stop="
      preview && designTools !== false && !locked && emit('drag-widget', $event, section.id, 'move')
    "
    @dragstart.prevent
    @contextmenu="contextMenu($event, section.id)"
  >
    <button
      v-if="
        preview &&
        designTools !== false &&
        !fixed &&
        !selectingText &&
        selectedId === section.id &&
        (selectedIds?.length || 0) <= 1
      "
      type="button"
      class="grid-rotate"
      :aria-label="`Rotate ${section.title || 'section'}`"
      title="Drag to rotate. Hold Shift for 15° steps. Arrow keys rotate; Home resets."
      :disabled="locked"
      @pointerdown.stop.prevent="emit('drag-widget', $event, section.id, 'rotate')"
      @click.stop
      @dragstart.prevent
    >
      <i class="pi pi-refresh" aria-hidden="true" />
    </button>
    <span
      v-if="preview && gridDraft?.id === section.id && gridDraft.rotation !== undefined"
      class="widget-rotation-reading"
      role="status"
    >
      {{ gridDraft.rotation }}°{{ gridDraft.rotationSnapped ? ' · snapped' : '' }}
    </span>
    <button
      v-for="direction in preview &&
      designTools !== false &&
      selectedId === section.id &&
      !section.parentId &&
      geometryEditable !== false &&
      !fixed &&
      !selectingText &&
      (selectedIds?.length || 0) <= 1
        ? resizeDirections
        : []"
      :key="direction"
      class="grid-resize"
      :class="`resize-${direction}`"
      :aria-label="`Resize ${section.title || 'section'} from ${direction}`"
      :disabled="locked"
      @pointerdown.stop="emit('drag-widget', $event, section.id, direction)"
      @click.stop
      @dragstart.prevent
    />
    <button
      v-if="
        preview &&
        designTools !== false &&
        selectedId === section.id &&
        (flow || section.parentId) &&
        !fixed &&
        !selectingText &&
        (selectedIds?.length || 0) <= 1 &&
        section.type !== 'page-content'
      "
      class="grid-resize resize-bottom"
      :disabled="locked"
      data-height-resize
      :aria-label="`Resize ${section.title || 'section'} height`"
      title="Drag to change height. Arrow keys adjust height."
      @pointerdown.stop="emit('drag-widget', $event, section.id, 'height')"
      @keydown="emit('geometry-key', $event, section.id)"
      @click.stop
    />
    <section
      ref="motionRoot"
      :style="{
        ...appearanceStyle(section.appearance),
        opacity:
          section.appearance?.opacity === undefined ? undefined : section.appearance.opacity / 100,
      }"
      :class="[
        'website-section',
        `section-${section.type}`,
        'widget',
        section.styleClass,
        { selected: preview && !selectingText && selectedId === section.id },
      ]"
      @click.stop="preview && emit('select', section.id, $event)"
    >
      <div
        v-if="section.type === 'container'"
        class="container-children container-items"
        :style="containerStyle(section.container, flow, automaticColumns)"
      >
        <WebsiteWidget
          v-for="child in sections.filter((entry) => entry.parentId === section.id)"
          :key="child.id"
          :section="child"
          :sections="sections"
          :site="site"
          :page-id="pageId"
          :grid-mode="gridMode"
          :flow="flow"
          :geometry-editable="geometryEditable"
          :preview="preview"
          :private-images="privateImages"
          :selected-id="selectedId"
          :selected-ids="selectedIds"
          :grid-draft="gridDraft"
          :locked="locked"
          :design-tools="designTools"
          @select="(id, event) => emit('select', id, event)"
          @widget-menu="(event, id) => emit('widget-menu', event, id)"
          @drag-widget="(event, id, action) => emit('drag-widget', event, id, action)"
          @geometry-key="(event, id) => emit('geometry-key', event, id)"
        />
        <p
          v-if="preview && !sections.some((entry) => entry.parentId === section.id)"
          class="empty-container"
        >
          Add widgets, then choose this container in their Layout settings.
        </p>
      </div>
      <WebsiteCompactWidget
        v-else-if="compactTypes.includes(section.type as (typeof compactTypes)[number])"
        :section="section"
        :preview="preview || privateImages"
      />
      <WebsiteBlocks
        v-else-if="blockTypes.includes(section.type as (typeof blockTypes)[number])"
        :section="section"
        :preview="preview || privateImages"
      />
      <WebsiteInteractive
        v-else-if="['accordion', 'tabs', 'video', 'downloads'].includes(section.type)"
        :section="section"
        :preview="preview || privateImages"
      />
      <WebsitePublicForm
        v-else-if="section.type === 'form'"
        :form="site?.forms?.find((form) => form.id === section.formId)"
        :preview="preview || privateImages"
      />
      <WebsiteCustomWidget
        v-else-if="section.type === 'custom'"
        :section="section"
        :site="site"
        :page-id="pageId"
        :preview="preview || privateImages"
      />
      <WebsiteNavigation
        v-else-if="section.type === 'navigation' || section.type === 'footer'"
        :section="section"
        :site="site"
        :page-id="pageId"
        :preview="preview || privateImages"
      />
      <template v-else>
        <div v-if="section.imageId" class="section-image widget-image">
          <WebsiteMedia
            :item="section"
            :preview="preview || privateImages"
            :priority="
              section.type === 'hero' &&
              sections.find((entry) => entry.type === 'hero' && !entry.hidden)?.id === section.id
            "
          />
        </div>
        <div v-if="section.type !== 'image'" class="section-copy">
          <WebsiteInlineText
            :id="section.id"
            field="title"
            :tag="section.type === 'hero' ? 'h1' : 'h2'"
            :text="section.title"
            :rich="section.titleRichText"
            :preview="preview"
          />
          <WebsiteInlineText
            :id="section.id"
            field="text"
            :text="section.text"
            :rich="section.textRichText"
            :format="section.textFormat"
            :preview="preview"
          />
          <WebsiteButton
            hide-empty
            class="website-cta widget-button"
            :item="section"
            :section-id="section.id"
            :preview="preview"
          />
        </div>
        <div v-if="['gallery', 'cards'].includes(section.type)" class="website-cards">
          <article v-for="item in section.items" :key="item.id">
            <div v-if="item.imageId" class="card-image widget-image">
              <WebsiteMedia :item="item" :preview="preview || privateImages" />
            </div>
            <div class="card-copy">
              <WebsiteInlineText
                :id="section.id"
                :target-key="item.id"
                field="title"
                tag="h3"
                :text="item.title"
                :rich="item.titleRichText"
                :preview="preview"
              />
              <WebsiteInlineText
                :id="section.id"
                :target-key="item.id"
                field="text"
                :text="item.text"
                :rich="item.textRichText"
                :format="item.textFormat"
                :preview="preview"
              />
              <WebsiteButton
                class="widget-button"
                hide-empty
                :item="item"
                :section-id="section.id"
                :preview="preview"
              />
            </div>
          </article>
        </div>
      </template>
    </section>
  </div>
</template>
<style scoped>
.widget-frame.grid-widget {
  position: absolute;
  box-sizing: border-box;
}
.grid-widget[tabindex] {
  touch-action: none;
  user-select: none;
}
.grid-widget .website-section {
  min-height: 0;
  overflow: auto;
  background-color: #fff;
  padding: 1.8rem 1rem 1rem;
}
.widget-frame:has(.text-box-selected, .element-selected) > .website-section {
  overflow: visible;
}
.widget-frame :deep(.widget-image:has(.element-selected, .element-box-positioned)),
.widget-frame :deep(.section-image:has(.element-selected, .element-box-positioned)),
.widget-frame :deep(.card-image:has(.element-selected, .element-box-positioned)) {
  overflow: visible;
}
.grid-widget .section-hero,
.grid-widget .section-contact {
  background-color: #eaf0f5;
}
.grid-widget.grid-selected {
  outline: 2px solid #168bd4;
}
.grid-widget:focus-visible {
  outline: 2px solid #168bd4;
}
.grid-resize {
  border-radius: 50%;
  position: absolute;
  z-index: 10;
  width: 10px;
  height: 10px;
  padding: 0;
  background: #fff;
  border: 1px solid #168bd4;
  touch-action: none;
}
.grid-rotate {
  position: absolute;
  bottom: calc(100% + 18px);
  left: calc(50% - 14px);
  z-index: 12;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid #168bd4;
  border-radius: 50%;
  color: #174878;
  background: #fff;
  cursor: grab;
  touch-action: none;
}
.grid-rotate::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  height: 18px;
  width: 1px;
  background: #168bd4;
  pointer-events: none;
}
.widget-rotation-reading {
  position: absolute;
  bottom: calc(100% + 18px);
  left: calc(50% + 20px);
  z-index: 15;
  padding: 3px 6px;
  border-radius: 4px;
  font: 12px/1.4 system-ui;
  background: #174878;
  color: white;
  white-space: nowrap;
  pointer-events: none;
}
.grid-rotate:focus-visible {
  outline: 2px solid #168bd4;
  outline-offset: 3px;
}
.contained-widget > .grid-rotate {
  top: 4px;
  bottom: auto;
}
.contained-widget > .grid-rotate::after {
  display: none;
}
.resize-top-left {
  top: -5px;
  left: -5px;
  cursor: nwse-resize;
}
.resize-top {
  top: -5px;
  left: calc(50% - 5px);
  cursor: ns-resize;
}
.resize-top-right {
  top: -5px;
  right: -5px;
  cursor: nesw-resize;
}
.resize-right {
  right: -5px;
  top: calc(50% - 5px);
  cursor: ew-resize;
}
.resize-bottom-right {
  bottom: -5px;
  right: -5px;
  cursor: nwse-resize;
}
.resize-bottom {
  bottom: -5px;
  left: calc(50% - 5px);
  cursor: ns-resize;
}
.resize-bottom-left {
  bottom: -5px;
  left: -5px;
  cursor: nesw-resize;
}
.resize-left {
  left: -5px;
  top: calc(50% - 5px);
  cursor: ew-resize;
}

.website-section {
  min-height: 0;
  overflow: auto;
  background-color: #fff;
  padding: 1.8rem 1rem 1rem;
}
.grid-widget .section-hero,
.grid-widget .section-contact {
  background-color: #eaf0f5;
}
.grid-widget.grid-selected {
  outline: 2px solid #168bd4;
}
.grid-widget:focus-visible {
  outline: 2px solid #168bd4;
}
.grid-resize {
  border-radius: 50%;
  position: absolute;
  z-index: 10;
  width: 10px;
  height: 10px;
  padding: 0;
  background: #fff;
  border: 1px solid #168bd4;
  touch-action: none;
}
.resize-top-left {
  top: -5px;
  left: -5px;
  cursor: nwse-resize;
}
.resize-top {
  top: -5px;
  left: calc(50% - 5px);
  cursor: ns-resize;
}
.resize-top-right {
  top: -5px;
  right: -5px;
  cursor: nesw-resize;
}
.resize-right {
  right: -5px;
  top: calc(50% - 5px);
  cursor: ew-resize;
}
.resize-bottom-right {
  bottom: -5px;
  right: -5px;
  cursor: nwse-resize;
}
.resize-bottom {
  bottom: -5px;
  left: calc(50% - 5px);
  cursor: ns-resize;
}
.resize-bottom-left {
  bottom: -5px;
  left: -5px;
  cursor: nesw-resize;
}
.resize-left {
  left: -5px;
  top: calc(50% - 5px);
  cursor: ew-resize;
}
.grid-drop-preview {
  position: absolute;
  pointer-events: none;
  background: #168bd433;
  border: 2px dashed #168bd4;
  box-sizing: border-box;
  z-index: 10001 !important;
}
.website-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1.4rem 5%;
  border-bottom: 1px solid #e4e8ec;
}
.website-brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font-size: 1.8rem;
  font-weight: 800;
  text-decoration: none;
}
.brand-logo {
  width: 64px;
  height: 64px;
  flex: 0 0 64px;
  overflow: hidden;
}
.footer-text {
  margin: 0.75rem 0 0;
  font-size: 0.9rem;
  max-width: 55ch;
}
footer nav a {
  color: #fff;
}
a,
:where(.editable-button) {
  color: var(--website-accent);
}
nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  font-size: 0.9rem;
}
nav a {
  text-decoration: none;
}
nav a[aria-current] {
  text-decoration: underline;
  text-underline-offset: 6px;
}
.website-section {
  padding: 3rem 6%;
  position: relative;
  border: 2px solid transparent;
  box-sizing: border-box;
  height: calc(100% - var(--widget-margin-top, 0px) - var(--widget-margin-bottom, 0px));
  width: calc(100% - var(--widget-margin-left, 0px) - var(--widget-margin-right, 0px));
}
.widget-frame {
  grid-column: span var(--widget-span, 12);
  min-width: 0;
  position: relative;
  container-type: inline-size;
}
.widget-frame.drop-before::before,
.widget-frame.drop-after::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 4px;
  background: #168bd4;
  z-index: 3;
  pointer-events: none;
}
.widget-frame.drop-before::before {
  top: 0;
}
.widget-frame.drop-after::after {
  bottom: 0;
}
.is-dragging {
  outline: 2px dashed #168bd4;
  outline-offset: -2px;
}
.canvas-empty {
  grid-column: 1 / -1;
}
.website-section.selected {
  border-color: #168bd4;
}
h1,
h2,
h3 {
  color: inherit;
  line-height: 1.13;
  margin: 0 0 1rem;
  overflow-wrap: anywhere;
}
h1 {
  font-size: clamp(2rem, 5cqw, 4rem);
  max-width: 18ch;
}
h2 {
  font-size: clamp(1.5rem, 3cqw, 2.5rem);
}
h3 {
  font-size: 1.2rem;
}
p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.65;
  margin: 0 0 1.25rem;
}
.section-hero {
  background: #eaf0f5;
  min-height: 330px;
  display: flex;
  align-items: center;
  gap: 2rem;
}
.section-hero .section-copy {
  order: -1;
  flex: 1;
}
.section-image {
  min-width: 0;
  flex: 1;
  height: 290px;
  border-radius: 4px;
  overflow: hidden;
}
.section-image + .section-copy {
  flex: 1;
}
.section-image:only-child {
  width: 100%;
}
.section-image {
  margin-bottom: 1rem;
}
.section-image-text {
  display: flex;
  gap: 2rem;
  align-items: center;
}
.section-text .section-copy {
  max-width: 800px;
  margin: auto;
}
.website-cta {
  display: inline-block;
  border: 2px solid var(--website-accent);
  padding: 0.75rem 1.2rem;
  font-weight: 700;
  text-decoration: none;
  background: #fff;
}
.website-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}
.website-cards article {
  border: 1px solid #dce3e9;
}
.card-image {
  height: 190px;
}
.card-copy {
  padding: 1rem;
}
.section-contact {
  background: #eaf0f5;
  text-align: center;
}

a {
  color: var(--website-accent);
}
h1,
h2 {
  font-size: var(--heading-size, revert);
}
h1 {
  font-size: var(--heading-size, clamp(2rem, 5cqw, 4rem));
}
h2 {
  font-size: var(--heading-size, clamp(1.5rem, 3cqw, 2.5rem));
}
.section-image :deep(img),
.card-image :deep(img) {
  object-fit: var(--image-fit, cover);
}
.website-section.section-container {
  display: flex;
  overflow: auto;
}
.container-children {
  display: flex;
  min-width: 0;
  width: 100%;
  min-height: 100%;
  align-items: stretch;
}
.contained-widget {
  flex: 1 1 0;
  min-width: 0;
  min-height: 100px;
}
.contained-widget > .website-section {
  padding: 1.8rem 1rem 1rem;
  min-height: 100%;
  height: 100%;
  overflow: auto;
  background-color: #fff;
}
.contained-widget.grid-selected {
  outline: 2px solid #168bd4;
}
.empty-container {
  align-self: center;
  color: #52687a;
  padding: 1rem;
}
.website-section.section-image {
  display: block;
  margin: 0;
  height: 100%;
}
.section-image > .section-image {
  height: 100%;
  width: 100%;
  margin: 0;
}
@container (max-width: 1023px) {
  .website-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@container (max-width: 767px) {
  .widget-frame {
    grid-column: 1 / -1;
  }
  .section-hero,
  .section-image-text {
    flex-direction: column;
    align-items: stretch;
  }
  .section-image {
    flex: none;
    height: 220px;
  }
  .website-cards {
    grid-template-columns: 1fr;
  }
  .website-section {
    padding: 2rem 5%;
  }
}
.flow-widget {
  flex: 0 0 auto;
  min-height: 0;
}
.flow-widget > .website-section {
  height: auto;
  min-height: 0;
  overflow: visible;
}
.flow-widget > .website-section > .container-children {
  min-height: 0;
}
.flow-widget.contained-widget {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.flow-widget.contained-widget > .website-section {
  flex: 1;
}
.flow-widget.contained-widget > .section-card {
  display: flex;
}
.flow-widget .section-image {
  height: auto;
}
.flow-widget .section-image :deep(img) {
  height: auto;
}
.widget-frame:has(> .section-navigation .mobile-menu-open),
.widget-frame:has(> .section-navigation details[open]),
.widget-frame:has(> .section-footer details[open]) {
  z-index: 10001 !important;
}
.website-section.section-navigation,
.website-section.section-footer {
  padding: 16px;
  overflow: visible;
}
.fixed-height > .website-section {
  height: calc(100% - var(--widget-margin-top, 0px) - var(--widget-margin-bottom, 0px));
  min-height: 0;
}
.grid-widget > .section-navigation,
.fixed-height > .section-navigation {
  container-type: size;
}
/* Sized navigation keeps its chosen height while the phone menu opens below it. */
.grid-widget > .section-navigation :deep(.mobile-navigation > .navigation-panel),
.fixed-height > .section-navigation :deep(.mobile-navigation > .navigation-panel) {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  box-sizing: border-box;
  padding: 12px;
  background: var(--navigation-menu-background, #fff);
  border: 1px solid color-mix(in srgb, currentColor 15%, transparent);
  border-radius: 8px;
  box-shadow: 0 12px 28px #172c4026;
}
.grid-resize[data-height-resize] {
  bottom: 0;
}
</style>
