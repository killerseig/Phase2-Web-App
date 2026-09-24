<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import WebsiteSavedSectionPreview from './WebsiteSavedSectionPreview.vue'
import type { SavedWebsiteSection, WebsiteSite } from '@/features/website/types'
const props = defineProps<{
  entries: SavedWebsiteSection[]
  selectionCount: number
  suggestedName: string
  remaining: number
  disabled: boolean
  accent: string
  site?: WebsiteSite
}>()
const emit = defineEmits<{
  save: [name: string]
  insert: [id: string]
  rename: [id: string, name: string]
  remove: [id: string]
}>()
const name = ref('')
const previewId = ref('')
const preview = computed(() => props.entries.find((entry) => entry.id === previewId.value))
const dialog = ref<HTMLDialogElement>()
let opener: HTMLElement | undefined
function save() {
  if (props.disabled || !props.selectionCount || props.entries.length >= 20) return
  emit('save', name.value.trim() || props.suggestedName || 'Saved section')
  name.value = ''
}
function rename(id: string, event: Event) {
  const input = event.target as HTMLInputElement
  if (props.disabled) return
  if (!input.value.trim() || !input.validity.valid) {
    input.value = props.entries.find((entry) => entry.id === id)?.name || ''
    return
  }
  emit('rename', id, input.value.trim())
}
async function show(id: string, event: MouseEvent) {
  opener = event.currentTarget as HTMLElement
  previewId.value = id
  await nextTick()
  dialog.value?.showModal()
}
function close() {
  dialog.value?.close()
  previewId.value = ''
  opener?.focus({ preventScroll: true })
}
function insert(id: string) {
  if (props.disabled) return
  close()
  emit('insert', id)
}
watch(preview, (value) => {
  if (!value) dialog.value?.close()
})
onBeforeUnmount(() => dialog.value?.close())
</script>
<template>
  <details class="saved-sections">
    <summary>Saved sections ({{ entries.length }})</summary>
    <p>
      Select widgets or a container, then save a reusable copy. Save draft to keep library changes.
    </p>
    <label
      >Saved section name<input
        v-model="name"
        maxlength="80"
        :placeholder="suggestedName || 'e.g. Project introduction'"
        :disabled="disabled"
        @keydown.enter.prevent.stop="save"
    /></label>
    <button :disabled="disabled || !selectionCount || entries.length >= 20" @click="save">
      Save selection to library
    </button>
    <small v-if="entries.length >= 20">Library limit reached: 20 saved sections.</small>
    <p v-if="!entries.length">Your saved sections will appear here.</p>
    <article v-for="entry in entries" :key="entry.id" :aria-label="`Saved section ${entry.name}`">
      <input
        :aria-label="`Rename saved section ${entry.name}`"
        :value="entry.name"
        maxlength="80"
        required
        :disabled="disabled"
        @change="rename(entry.id, $event)"
      />
      <small>{{ entry.sections.length }} widget{{ entry.sections.length === 1 ? '' : 's' }}</small>
      <div class="saved-actions">
        <button
          :disabled="disabled || entry.sections.length > remaining"
          :aria-label="`Insert saved section ${entry.name}`"
          @click="emit('insert', entry.id)"
        >
          Insert
        </button>
        <button
          :disabled="disabled"
          :aria-label="`Preview saved section ${entry.name}`"
          @click="show(entry.id, $event)"
        >
          Preview
        </button>
        <button
          :disabled="disabled"
          :aria-label="`Remove saved section ${entry.name}`"
          @click="emit('remove', entry.id)"
        >
          Remove
        </button>
      </div>
      <small v-if="entry.sections.length > remaining"
        >Not enough room on this page (30 widgets maximum).</small
      >
    </article>
    <small
      >Copies include content, images and widget settings. Page CSS stays with its page. Library
      changes do not update previously inserted copies.</small
    >
    <Teleport to="body">
      <dialog
        ref="dialog"
        aria-label="Saved section preview"
        @cancel.prevent="close"
        @keydown.esc.prevent.stop="close"
      >
        <template v-if="preview">
          <header>
            <h2>{{ preview.name }}</h2>
            <button autofocus @click="close">Close preview</button>
          </header>
          <p>Desktop preview. Hidden widgets are shown here. Page CSS is not included.</p>
          <WebsiteSavedSectionPreview
            :key="preview.id"
            :entry="preview"
            :site="site"
            :accent="accent"
          />
          <button
            :disabled="disabled || preview.sections.length > remaining"
            @click="insert(preview.id)"
          >
            Insert on current page
          </button>
        </template>
      </dialog>
    </Teleport>
  </details>
</template>
<style scoped>
.saved-sections {
  margin: 0.8rem 0;
  border-block: 1px solid var(--border);
  padding: 0.65rem 0;
}
summary {
  font-weight: 600;
  cursor: pointer;
}
label {
  display: grid;
  gap: 0.35rem;
}
input {
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  padding: 0.45rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  background: var(--field);
  font: inherit;
}
p,
small,
label {
  font-size: 0.8rem;
  line-height: 1.5;
}
small {
  display: block;
  color: var(--muted);
}
article {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.4rem;
  margin: 0.6rem 0;
}
button {
  padding: 0.35rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  background: var(--field);
  font-family: inherit;
  cursor: pointer;
  font-size: 0.75rem;
  margin: 0.3rem 0;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
.saved-actions {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
}
dialog {
  box-sizing: border-box;
  width: min(760px, 90vw);
  max-height: 90dvh;
  overflow: auto;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-panel, #142d3c);
  color: var(--text, #fff);
}
dialog::backdrop {
  background: #0009;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
h2 {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
