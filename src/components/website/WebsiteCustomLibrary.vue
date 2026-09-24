<script setup lang="ts">
import { computed, ref } from 'vue'
import WebsiteCustomEditor from './WebsiteCustomEditor.vue'
import WebsiteImagePicker from './WebsiteImagePicker.vue'
import { customDefinition, type CustomWidgetDefinition } from '../../../functions/src/websiteCustom'
import { customUsages } from '@/features/website/customWidgets'
import type { WebsiteSite, WebsiteSection } from '@/features/website/types'
const props = defineProps<{
  mode?: 'content' | 'design' | 'code'
  inline?: boolean
  site: WebsiteSite
  selected?: WebsiteSection
  disabled: boolean
  canCapture: boolean
  remaining: number
}>()
const emit = defineEmits<{
  capture: [name: string]
  insert: [definition: CustomWidgetDefinition, linked: boolean]
  update: [definition: CustomWidgetDefinition]
  remove: [id: string]
  detach: []
  value: [key: string, value: string | undefined]
  independent: [definition: CustomWidgetDefinition]
  uploading: [busy: boolean]
}>()
const editor = ref<InstanceType<typeof WebsiteCustomEditor>>(),
  name = ref(''),
  independent = ref(false)
const active = computed(() => customDefinition(props.selected?.custom, props.site.customWidgets))
function edit(definition: CustomWidgetDefinition, own = false) {
  if (props.mode === 'content' || (definition.kind === 'code' && props.mode === 'design')) return
  independent.value = own
  void editor.value?.open(definition)
}
function createCode() {
  edit({
    id: crypto.randomUUID(),
    name: name.value.trim() || 'Custom HTML widget',
    kind: 'code',
    sections: [],
    fields: [],
    html: '<section class="card"><h2>Your heading</h2><p>Your content</p></section>',
    css: '.card { padding: 24px; background: #eaf0f5; border-radius: 12px; color: #174878; }',
  })
}
function save(definition: CustomWidgetDefinition) {
  if (independent.value) emit('independent', definition)
  else emit('update', definition)
}
function capture() {
  emit('capture', name.value.trim() || 'Custom widget')
}
</script>
<template>
  <component
    :is="inline ? 'section' : 'details'"
    class="custom-library"
    :class="{ 'custom-library--inline': inline }"
    open
  >
    <summary v-if="!inline">Custom widgets ({{ site.customWidgets?.length || 0 }})</summary>
    <template v-if="mode !== 'content'">
      <p>
        {{
          mode === 'code'
            ? 'Create and edit custom HTML/CSS widgets.'
            : 'Create reusable widgets from your selection.'
        }}
      </p>
      <label
        >New custom widget name<input v-model="name" maxlength="80" :disabled="disabled"
      /></label>
      <button
        v-if="mode !== 'code'"
        :disabled="disabled || !canCapture || (site.customWidgets?.length || 0) >= 20"
        @click="capture"
      >
        Create widget from selection
      </button>
      <button
        v-if="mode !== 'design'"
        :disabled="disabled || (site.customWidgets?.length || 0) >= 20"
        @click="createCode"
      >
        Create HTML/CSS widget
      </button>
    </template>
    <p v-if="mode === 'content' && !active">
      Select a custom widget to edit the content its author has made available.
    </p>
    <article v-if="active && selected?.custom" aria-label="Selected custom widget settings">
      <strong>{{ active.name }}</strong>
      <p>
        {{
          selected.custom.definitionId
            ? 'Shared design. These content changes apply only to this placement.'
            : 'Independent copy. Changes apply only to this widget.'
        }}
      </p>
      <p v-if="!active.fields.length && mode === 'content'">
        This widget has no editable content fields. Its design can be changed in Design or Code
        mode.
      </p>
      <template v-for="field in active.fields" :key="field.key">
        <WebsiteImagePicker
          v-if="field.type === 'image'"
          :image-id="selected.custom.values[field.key] ?? field.defaultValue"
          alt=""
          @update="emit('value', field.key, $event.imageId)"
          @uploading="emit('uploading', $event)"
        />
        <label v-else
          >{{ field.label
          }}<textarea
            v-if="field.type === 'text'"
            :value="selected.custom.values[field.key] ?? field.defaultValue"
            maxlength="8000"
            rows="2"
            @input="emit('value', field.key, ($event.target as HTMLTextAreaElement).value)" /><input
            v-else
            type="color"
            :value="selected.custom.values[field.key] ?? field.defaultValue"
            @input="emit('value', field.key, ($event.target as HTMLInputElement).value)"
        /></label>
        <button
          v-if="Object.hasOwn(selected.custom.values, field.key)"
          :aria-label="`Reset ${field.label} to default`"
          @click="emit('value', field.key, undefined)"
        >
          Use default
        </button>
      </template>
      <button
        v-if="mode !== 'content' && (mode !== 'design' || active.kind === 'visual')"
        @click="edit(active, !!selected.custom.inline)"
      >
        {{ selected.custom.inline ? 'Edit independent widget' : 'Edit shared widget' }}
      </button>
      <button v-if="mode === 'design' && selected.custom.definitionId" @click="emit('detach')">
        Detach widget
      </button>
    </article>
    <template v-if="mode !== 'content'">
      <article
        v-for="entry in site.customWidgets || []"
        :key="entry.id"
        :aria-label="`Custom widget ${entry.name}`"
      >
        <strong>{{ entry.name }}</strong
        ><small
          >{{ entry.kind === 'visual' ? 'Visual' : 'HTML/CSS' }} -
          {{ customUsages(site, entry.id).length }} linked placements</small
        >
        <button
          :disabled="disabled || remaining < 1"
          :aria-label="`Add linked ${entry.name}`"
          @click="emit('insert', entry, true)"
        >
          Add linked
        </button>
        <button
          :disabled="disabled || remaining < 1"
          :aria-label="`Add independent ${entry.name}`"
          @click="emit('insert', entry, false)"
        >
          Add copy
        </button>
        <button
          :disabled="disabled"
          v-if="mode !== 'design' || entry.kind === 'visual'"
          :aria-label="`Edit custom widget ${entry.name}`"
          @click="edit(entry)"
        >
          Edit source
        </button>
        <button
          :disabled="disabled || !!customUsages(site, entry.id).length"
          :aria-label="`Remove custom widget ${entry.name}`"
          @click="emit('remove', entry.id)"
        >
          Remove
        </button>
        <small v-if="customUsages(site, entry.id).length"
          >Detach or remove placements before deleting this design.</small
        >
      </article>
    </template>
    <WebsiteCustomEditor ref="editor" :site="site" @save="save" />
  </component>
</template>
<style scoped>
.custom-library {
  border-block: 1px solid var(--border);
  margin: 0.7rem 0;
  padding: 0.6rem 0;
}
.custom-library--inline {
  border: 0;
  margin: 0;
  padding: 0;
}
.custom-library--inline > article {
  border: 0;
  padding: 0;
  margin: 0;
}
.custom-library--inline button {
  color: var(--text);
  background: var(--field);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  min-height: 36px;
}
.custom-library--inline button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
summary {
  font-weight: 600;
  cursor: pointer;
}
p,
label,
small {
  font-size: 0.8rem;
}
label,
small {
  display: block;
  margin: 0.4rem 0;
}
input,
textarea {
  width: 100%;
  box-sizing: border-box;
  font: inherit;
  color: var(--text);
  background: var(--field);
  border: 1px solid var(--border);
  padding: 0.4rem;
}
article {
  border: 1px solid var(--border);
  padding: 0.5rem;
  margin: 0.6rem 0;
}
button {
  font: inherit;
  font-size: 0.75rem;
  padding: 0.35rem;
  margin: 0.15rem;
}
small {
  color: var(--muted);
}
</style>
