<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'
import type { RichTextNode } from '../../../functions/src/websiteRichText'
const Editor = defineAsyncComponent(() => import('./WebsiteInlineEditor.vue'))
defineProps<{
  text: string
  rich?: RichTextNode
  format?: 'markdown'
  heading?: boolean
  label?: string
}>()
const emit = defineEmits<{ update: [text: string, format?: 'markdown', rich?: RichTextNode] }>()
const editing = ref(false)
</script>
<template>
  <div class="rich-field">
    <template v-if="!editing">
      <label v-if="heading">{{ label || 'Heading' }}<input :value="text" readonly /></label>
      <label v-else>{{ label || 'Text' }}<textarea :value="text" rows="4" readonly /></label>
      <button type="button" @click="editing = true">
        Edit formatted {{ heading ? 'heading' : 'text' }}
      </button>
    </template>
    <Editor
      v-else
      :text="text"
      :rich="rich"
      :format="format"
      :heading="!!heading"
      @update="(text, format, rich) => emit('update', text, format, rich)"
      @done="editing = false"
    />
  </div>
</template>
<style scoped>
.rich-field {
  display: grid;
  gap: 0.4rem;
}
label {
  display: grid;
  gap: 0.3rem;
  font-size: 0.8rem;
}
input,
textarea {
  width: 100%;
  box-sizing: border-box;
  color: var(--text);
  background: var(--field);
  border: 1px solid var(--border);
  padding: 0.5rem;
  font: inherit;
}
button {
  justify-self: start;
  font: inherit;
  padding: 0.4rem 0.6rem;
  color: var(--text);
  background: var(--field);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
}
</style>
