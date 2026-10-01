<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'
import type { WebsiteItem } from '@/features/website/types'
import type { ElementField } from '@/features/website/elementLayout'
import type { RichTextNode } from '../../../functions/src/websiteRichText'
import WebsiteImagePicker from './WebsiteImagePicker.vue'
import WebsiteImageControls from './WebsiteImageControls.vue'
const Editor = defineAsyncComponent(() => import('./WebsiteInlineEditor.vue'))
const props = defineProps<{ item: WebsiteItem; field: ElementField; disabled?: boolean }>()
const emit = defineEmits<{
  update: [value: Partial<WebsiteItem>]
  uploading: [value: boolean]
  crop: []
  format: []
}>()
const formatting = ref(false)
function formatText() {
  emit('format')
  formatting.value = true
}
const textField = () =>
  props.field === 'button' ? 'linkLabel' : props.field === 'title' ? 'title' : 'text'
const richField = () =>
  props.field === 'button'
    ? 'linkRichText'
    : props.field === 'title'
      ? 'titleRichText'
      : 'textRichText'
function update(text: string, format?: 'markdown', rich?: RichTextNode) {
  emit('update', {
    [textField()]: text,
    [richField()]: rich,
    ...(props.field === 'text' ? { textFormat: format } : {}),
  })
}
</script>
<template>
  <fieldset
    :disabled="disabled"
    class="element-content"
    :data-item-id="item.id"
    aria-label="Selected element content"
  >
    <template v-if="field === 'image'">
      <WebsiteImagePicker
        :image-id="item.imageId"
        :alt="item.alt"
        @update="emit('update', $event)"
        @uploading="emit('uploading', $event)"
      />
      <button v-if="item.imageId" type="button" @click="emit('crop')">Crop and focal point</button>
      <details v-if="item.imageId">
        <summary>Image appearance</summary>
        <WebsiteImageControls
          :value="item.imageSettings"
          @update="emit('update', { imageSettings: $event })"
        />
      </details>
    </template>
    <template v-else>
      <Editor
        v-if="formatting"
        :text="item[textField()]"
        :rich="item[richField()]"
        :format="field === 'text' ? item.textFormat : undefined"
        :heading="field !== 'text'"
        :allow-links="field !== 'button'"
        :max-length="field === 'button' ? 80 : field === 'title' ? 160 : 10000"
        :label="`Format selected ${field === 'title' ? 'heading' : field}`"
        @update="update"
        @done="formatting = false"
      />
      <template v-else>
        <label
          >{{ field === 'button' ? 'Button label' : field === 'title' ? 'Heading' : 'Text' }}
          <textarea
            v-if="field === 'text'"
            :value="item.text"
            rows="4"
            maxlength="10000"
            :readonly="!!item.textRichText"
            @input="update(($event.target as HTMLTextAreaElement).value, item.textFormat)"
          />
          <input
            v-else
            :value="item[textField()]"
            :maxlength="field === 'button' ? 80 : 160"
            :readonly="!!item[richField()]"
            @input="update(($event.target as HTMLInputElement).value)"
          />
        </label>
        <button type="button" @click="formatText">
          Format {{ field === 'title' ? 'heading' : field === 'button' ? 'button label' : 'text' }}
        </button>
      </template>
      <label v-if="field === 'button'"
        >Button link
        <input
          :value="item.linkUrl"
          maxlength="1000"
          placeholder="https:// or /website/contact"
          data-link-url
          @input="emit('update', { linkUrl: ($event.target as HTMLInputElement).value })"
        />
      </label>
    </template>
  </fieldset>
</template>
<style scoped>
.element-content {
  border: 0;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.65rem;
  min-width: 0;
}
label {
  display: grid;
  gap: 0.3rem;
  font-size: 0.8rem;
}
input,
textarea {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
button {
  justify-self: start;
}
summary {
  cursor: pointer;
  font-size: 0.8rem;
}
</style>
