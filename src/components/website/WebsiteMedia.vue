<script setup lang="ts">
import WebsiteImage from './WebsiteImage.vue'
import WebsiteImageOverlay from './WebsiteImageOverlay.vue'
import type { WebsiteItem } from '@/features/website/types'
import { computed, inject, ref } from 'vue'
import { useTextBox } from '@/features/website/useTextBox'
import WebsiteSelectionHandles from './WebsiteSelectionHandles.vue'
import WebsiteAlignmentGuides from './WebsiteAlignmentGuides.vue'
import { imageEditingKey, imageOwnerKey } from '@/features/website/imageEditing'

const props = defineProps<{
  item: WebsiteItem
  preview?: boolean
  priority?: boolean
  contain?: boolean
}>()
const editing = inject(imageEditingKey, undefined)
const owner = inject(imageOwnerKey, undefined)
const target = computed(() => ({ sectionId: owner?.value.sectionId || '', itemId: props.item.id }))
const root = ref<HTMLElement>()
const boxTarget = computed(() => ({
  id: target.value.sectionId,
  field: 'image' as const,
  key: props.item.id === target.value.sectionId ? undefined : props.item.id,
}))
const box = useTextBox(root, boxTarget)
const editable = computed(
  () => !!(owner?.value.preview && props.preview && editing?.enabled(target.value)),
)
function edit(event: MouseEvent | KeyboardEvent) {
  if (!editable.value || event.shiftKey) return
  event.preventDefault()
  event.stopPropagation()
  const element = event.currentTarget as HTMLElement
  const image = element.querySelector('img')
  editing?.begin(
    target.value,
    element.clientWidth / Math.max(1, element.clientHeight),
    !!image && getComputedStyle(image).objectFit === 'contain',
  )
}
function click(event: MouseEvent) {
  if (box.consumeClick()) {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  if (box.enabled.value && !event.shiftKey) {
    event.preventDefault()
    event.stopPropagation()
    box.select()
  } else edit(event)
}
</script>
<template>
  <figure
    ref="root"
    class="website-media"
    :style="box.style.value"
    :class="{
      'element-selected': box.selected.value,
      'element-box-positioned': !!box.style.value,
      'element-design': box.enabled.value,
    }"
    :data-alignable="box.enabled.value ? 'image' : undefined"
    :tabindex="box.enabled.value ? 0 : undefined"
    @keydown="box.key($event)"
    @pointerdown="box.enabled.value && box.start($event)"
    @click="box.enabled.value && click($event)"
    @dblclick="edit"
  >
    <div
      class="media-crop"
      :class="{ 'editable-image': editable }"
      :role="editable ? 'button' : undefined"
      :tabindex="editable ? 0 : undefined"
      :aria-label="editable ? `Edit image: ${item.alt || item.title || 'Photo'}` : undefined"
      :title="
        box.enabled.value
          ? 'Drag to move image · Double-click to edit'
          : editable
            ? 'Click to edit image'
            : undefined
      "
      @pointerdown="!box.enabled.value && editable && $event.stopPropagation()"
      @click="click"
      @dblclick="edit"
      @keydown.enter="edit"
      @keydown.space="edit"
    >
      <WebsiteImage
        :id="item.imageId"
        :alt="item.alt"
        :preview="preview"
        :priority="priority"
        :contain="contain"
        :settings="item.imageSettings"
      />
      <WebsiteImageOverlay :settings="item.imageSettings" />
    </div>
    <figcaption v-if="item.imageSettings?.caption">{{ item.imageSettings.caption }}</figcaption>
    <WebsiteSelectionHandles
      v-if="box.selected.value"
      label="image"
      :rotation="box.rotationPreview.value"
      :snapped="box.rotationSnapped.value"
      @drag="box.start"
      @key="box.key"
    />
    <WebsiteAlignmentGuides :guides="box.guides.value" />
  </figure>
</template>
<style scoped>
.website-media {
  position: relative;
  margin: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
}
.element-design {
  touch-action: none;
  user-select: none;
}
.element-design .media-crop {
  cursor: move;
}
.element-selected {
  outline: 2px solid #168bd4;
  outline-offset: 0;
}
.media-crop {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}
.media-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.editable-image {
  cursor: pointer;
}
.editable-image:hover,
.editable-image:focus-visible {
  outline: 2px solid #168bd4;
  outline-offset: -2px;
}
figcaption {
  padding: 0.3rem 0.5rem;
  font-size: 0.8rem;
  line-height: 1.3;
}
</style>
