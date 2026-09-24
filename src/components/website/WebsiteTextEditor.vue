<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { safeWebsiteLink } from '../../../functions/src/websiteContent'
const props = defineProps<{ text: string; format?: 'markdown' }>()
const emit = defineEmits<{ update: [text: string, format?: 'markdown'] }>()
const input = ref<HTMLTextAreaElement>()
const link = ref('')
const linking = ref(false)
const error = ref('')
let selection = { start: 0, end: 0 }
function remember() {
  selection = { start: input.value?.selectionStart || 0, end: input.value?.selectionEnd || 0 }
}
async function apply(kind: string) {
  const { start, end } = selection
  const selected = props.text.slice(start, end) || 'Text'
  let replacement =
    kind === 'bold'
      ? `**${selected}**`
      : kind === 'italic'
        ? `*${selected}*`
        : selected
            .split('\n')
            .map(
              (line, index) =>
                `${kind === 'heading' ? '## ' : kind === 'bullets' ? '- ' : index + 1 + '. '}${line}`,
            )
            .join('\n')
  if (kind === 'link') {
    if (!safeWebsiteLink(link.value.trim())) {
      error.value = 'Use an HTTPS, email, telephone or website page link.'
      return
    }
    replacement = `[${selected}](${link.value.trim()})`
    linking.value = false
    error.value = ''
  }
  // Block formats begin on a new line when inserted in the middle of a paragraph.
  if (['heading', 'bullets', 'numbers'].includes(kind)) {
    if (start && props.text[start - 1] !== '\n') replacement = '\n' + replacement
    if (end < props.text.length && props.text[end] !== '\n') replacement += '\n'
  }
  const next = props.text.slice(0, start) + replacement + props.text.slice(end)
  if (next.length > 8000) {
    error.value = 'Text is limited to 8,000 characters.'
    return
  }
  emit('update', next, 'markdown')
  await nextTick()
  input.value?.focus()
  input.value?.setSelectionRange(start, start + replacement.length)
}
</script>
<template>
  <label class="format-choice"
    ><input
      type="checkbox"
      :checked="format === 'markdown'"
      @change="
        emit('update', text, ($event.target as HTMLInputElement).checked ? 'markdown' : undefined)
      "
    />
    Formatted text</label
  >
  <div v-if="format === 'markdown'" class="text-tools" role="toolbar" aria-label="Text formatting">
    <button
      v-for="[kind, label] in [
        ['bold', 'Bold'],
        ['italic', 'Italic'],
        ['heading', 'Heading'],
        ['bullets', 'Bullet list'],
        ['numbers', 'Numbered list'],
      ]"
      :key="kind"
      type="button"
      @pointerdown.prevent="remember"
      @click="apply(kind!)"
    >
      {{ label }}
    </button>
    <button type="button" @pointerdown.prevent="remember" @click="linking = !linking">
      Text link
    </button>
  </div>
  <div v-if="linking">
    <label>Text link URL<input v-model="link" placeholder="https:// or /website/contact" /></label
    ><button type="button" @click="apply('link')">Apply text link</button>
  </div>
  <label
    >Text<textarea
      ref="input"
      :value="text"
      rows="5"
      maxlength="8000"
      @select="remember"
      @keyup="remember"
      @input="emit('update', ($event.target as HTMLTextAreaElement).value, format)"
    />
  </label>
  <small v-if="format"
    >Select text and use the toolbar. Formatting markers appear here; the page previews the
    result.</small
  >
  <p v-if="error" role="alert">{{ error }}</p>
</template>
<style scoped>
label {
  display: grid;
  gap: 0.3rem;
  font-size: 0.8rem;
}
textarea,
input {
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
  color: var(--text);
  background: var(--field);
  border: 1px solid var(--border);
  padding: 0.5rem;
  font: inherit;
}
.format-choice {
  display: flex;
  align-items: center;
}
.format-choice input {
  width: auto;
}
.text-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
button {
  padding: 0.3rem;
  font-size: 0.75rem;
}
small {
  font-size: 0.75rem;
}
</style>
