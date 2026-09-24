<script setup lang="ts">
import WebsiteBlockFields from './WebsiteBlockFields.vue'
import { blockCollections } from '../../../functions/src/websiteBlocks'
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import WebsiteCustomWidget from './WebsiteCustomWidget.vue'
import WebsiteItemFields from './WebsiteItemFields.vue'
import WebsiteAppearanceFields from './WebsiteAppearanceFields.vue'
import WebsiteNavigationFields from './WebsiteNavigationFields.vue'
import WebsiteLayoutFields from './WebsiteLayoutFields.vue'
import type {
  CustomWidgetDefinition,
  CustomWidgetField,
} from '../../../functions/src/websiteCustom'
import { validateCustomCode, customBindingError } from '../../../functions/src/websiteCustom'
import {
  newItem,
  newSection,
  sectionLabels,
  type WebsiteSite,
  type WebsiteItem,
  type SectionType,
  type WebsiteSection,
} from '@/features/website/types'
import { nextGeometry } from '@/features/website/grid'
import { canContain, descendants } from '@/features/website/containers'
defineProps<{ site: WebsiteSite }>()
const emit = defineEmits<{ save: [definition: CustomWidgetDefinition] }>()
const dialog = ref<HTMLDialogElement>(),
  draft = ref<CustomWidgetDefinition>(),
  selected = ref(''),
  uploading = ref(false)
let original = '',
  opener: HTMLElement | null = null
const sourceType = ref<SectionType>('text'),
  fieldProperty = ref<CustomWidgetField['property']>('text')
const builtins = Object.entries(sectionLabels).filter(
  ([type]) => !['custom', 'form', 'page-content'].includes(type),
)
const child = computed(() => draft.value?.sections.find((section) => section.id === selected.value))
const issue = computed(() => {
  if (!draft.value) return ''
  if (!draft.value.name.trim()) return 'Give this widget a name.'
  if (draft.value.kind === 'visual' && !draft.value.sections.length)
    return 'Add at least one widget.'
  try {
    if (draft.value.kind === 'code') validateCustomCode(draft.value.html, draft.value.css)
  } catch (reason) {
    return reason instanceof Error ? reason.message : 'Invalid code.'
  }
  if (
    draft.value.fields.some(
      (field) => !field.label.trim() || !/^[a-z][a-z0-9_]{0,39}$/.test(field.key),
    )
  )
    return 'Give each setting a label and a lowercase key.'
  if (new Set(draft.value.fields.map((field) => field.key)).size !== draft.value.fields.length)
    return 'Setting keys must be unique.'
  if (
    draft.value.fields.some(
      (field) => field.type === 'color' && !/^#[0-9a-f]{6}$/i.test(field.defaultValue),
    )
  )
    return 'Color defaults use six-digit hex colors.'
  if (
    draft.value.sections.some(
      (section) =>
        section.layout &&
        (section.layout.x < 0 ||
          section.layout.y < 0 ||
          section.layout.w < 1 ||
          section.layout.h < 1 ||
          section.layout.x + section.layout.w > 1000 ||
          section.layout.y + section.layout.h > 10000),
    )
  )
    return 'Keep geometry within the page bounds.'
  return draft.value.kind === 'code' ? customBindingError(draft.value) : ''
})
const previewSection = computed(() => ({
  ...newSection('custom'),
  title: draft.value?.name || 'Custom widget',
  custom: { inline: draft.value!, values: {} },
}))
async function open(value: CustomWidgetDefinition) {
  opener = document.activeElement as HTMLElement
  draft.value = JSON.parse(JSON.stringify(value))
  original = JSON.stringify(draft.value)
  selected.value = value.sections[0]?.id || ''
  await nextTick()
  dialog.value?.showModal()
}
function close(discard = false) {
  if (uploading.value) return
  if (
    !discard &&
    JSON.stringify(draft.value) !== original &&
    !window.confirm('Discard your custom widget edits?')
  )
    return
  dialog.value?.close()
  draft.value = undefined
  opener?.focus({ preventScroll: true })
}
function save() {
  if (!draft.value || issue.value || uploading.value) return
  emit('save', JSON.parse(JSON.stringify(draft.value)))
  close(true)
}
function addSource() {
  if (!draft.value || draft.value.sections.length >= 30) return
  const section = {
    ...newSection(sourceType.value),
    layout: nextGeometry(draft.value.sections, sourceType.value),
  }
  draft.value.sections.push(section)
  selected.value = section.id
}
function removeSource() {
  if (!draft.value || !child.value) return
  const ids = new Set(
    descendants(draft.value.sections, [child.value.id]).map((section) => section.id),
  )
  draft.value.sections = draft.value.sections.filter((section) => !ids.has(section.id))
  draft.value.fields = draft.value.fields.filter((field) => !ids.has(field.sectionId || ''))
  selected.value = draft.value.sections[0]?.id || ''
}
function updateSource(value: WebsiteItem) {
  if (!child.value || !draft.value) return
  Object.assign(child.value, value)
  for (const field of draft.value.fields.filter((field) => field.sectionId === child.value!.id)) {
    if (field.property && field.property in value)
      field.defaultValue = String(value[field.property as keyof WebsiteItem] || '')
  }
}
function addField() {
  if (!draft.value || draft.value.fields.length >= 20) return
  const property = fieldProperty.value!
  if (
    draft.value.kind === 'visual' &&
    (!child.value ||
      draft.value.fields.some(
        (field) => field.sectionId === child.value!.id && field.property === property,
      ))
  )
    return
  let count = 1
  while (draft.value.fields.some((field) => field.key === 'setting_' + count)) count++
  const visual = draft.value.kind === 'visual'
  const type =
    visual && ['background', 'color'].includes(property)
      ? 'color'
      : visual && property === 'imageId'
        ? 'image'
        : 'text'
  const value = visual
    ? type === 'color'
      ? child.value?.appearance?.[property as 'background' | 'color'] || '#174878'
      : String(child.value?.[property as keyof WebsiteSection] || '')
    : ''
  draft.value.fields.push({
    key: 'setting_' + count,
    label: visual ? (child.value?.title || 'Widget') + ' ' + property : 'Text setting',
    type,
    defaultValue: value,
    ...(visual ? { sectionId: child.value!.id, property } : {}),
  })
}
defineExpose({ open })
onBeforeUnmount(() => dialog.value?.close())
</script>
<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      aria-label="Custom widget editor"
      @cancel.prevent="close()"
      @keydown.esc.prevent.stop="close()"
      @keydown.stop
    >
      <template v-if="draft">
        <header>
          <h2>{{ draft.kind === 'code' ? 'HTML/CSS widget' : 'Visual custom widget' }}</h2>
          <button @click="close()">Cancel widget edits</button
          ><button :disabled="!!issue || uploading" @click="save">Apply widget changes</button>
        </header>
        <p>Changes update linked placements in this draft. Save draft and publish when ready.</p>
        <div class="custom-editor-columns">
          <section class="custom-source" aria-label="Widget source">
            <label>Custom widget name<input v-model="draft.name" maxlength="80" /></label>
            <template v-if="draft.kind === 'code'">
              <label
                >Widget HTML<textarea
                  v-model="draft.html"
                  rows="12"
                  maxlength="20000"
                  spellcheck="false"
                />
              </label>
              <label
                >Widget CSS<textarea
                  v-model="draft.css"
                  rows="10"
                  maxlength="12000"
                  spellcheck="false"
                />
              </label>
              <p>
                Static HTML and CSS only. Use text settings between tags with
                <code v-pre>{{ setting_key }}</code
                >; color settings also work in CSS. JavaScript, forms, embeds and external resources
                are not supported.
              </p>
            </template>
            <template v-else>
              <label
                >Source widget<select aria-label="Source widget" v-model="selected">
                  <option v-for="entry in draft.sections" :key="entry.id" :value="entry.id">
                    {{ entry.title || sectionLabels[entry.type] }}
                  </option>
                </select></label
              >
              <label
                >New source type<select aria-label="New source type" v-model="sourceType">
                  <option v-for="[type, label] in builtins" :key="type" :value="type">
                    {{ label }}
                  </option>
                </select></label
              >
              <button :disabled="draft.sections.length >= 30" @click="addSource">
                Add source widget
              </button>
              <template v-if="child">
                <label
                  >Source container<select aria-label="Source container" v-model="child.parentId">
                    <option :value="undefined">Widget canvas</option>
                    <option
                      v-for="parent in draft.sections.filter(
                        (entry) =>
                          entry.type === 'container' &&
                          canContain(draft!.sections, child!.id, entry.id),
                      )"
                      :key="parent.id"
                      :value="parent.id"
                    >
                      {{ parent.title }}
                    </option>
                  </select></label
                >
                <label><input v-model="child.hidden" type="checkbox" /> Hide source widget</label>
                <div v-if="child.layout" class="geometry">
                  <label v-for="key in ['x', 'y', 'w', 'h', 'z'] as const" :key="key"
                    >{{ key
                    }}<input
                      v-model.number="child.layout[key]"
                      type="number"
                      :min="key === 'w' || key === 'h' ? 1 : 0"
                      max="10000"
                  /></label>
                </div>
                <WebsiteNavigationFields
                  v-if="child.navigation"
                  :value="child.navigation"
                  :footer="child.type === 'footer'"
                  @update="child.navigation = $event"
                />
                <WebsiteBlockFields
                  :kind="child.type"
                  :value="child.blockOptions"
                  @update="child.blockOptions = $event"
                />
                <WebsiteItemFields
                  :key="child.id"
                  :item="child"
                  :kind="child.type"
                  :content-only="
                    ['accordion', 'tabs', 'downloads', ...blockCollections].includes(child.type)
                  "
                  :image-only="child.type === 'image'"
                  :menu-only="child.type === 'navigation' || child.type === 'footer'"
                  @update="updateSource"
                  @uploading="uploading = $event"
                />
                <details>
                  <summary>Source appearance</summary>
                  <WebsiteAppearanceFields
                    :value="child.appearance"
                    @update="child.appearance = $event"
                  />
                </details>
                <WebsiteLayoutFields
                  v-if="child.type === 'container' || child.parentId"
                  :container="child.container"
                  :sizing="child.sizing"
                  :is-container="child.type === 'container'"
                  :contained="!!child.parentId"
                  @container="child.container = $event"
                  @sizing="child.sizing = $event"
                />
                <button
                  v-if="
                    [
                      'cards',
                      'gallery',
                      'accordion',
                      'tabs',
                      'downloads',
                      ...blockCollections,
                    ].includes(child.type)
                  "
                  :disabled="child.items.length >= 12"
                  @click="child.items.push(newItem())"
                >
                  Add source item
                </button>
                <details v-if="child.items.length">
                  <summary>Source items</summary>
                  <WebsiteItemFields
                    v-for="(item, index) in child.items"
                    :key="item.id"
                    :item="item"
                    collection-item
                    :kind="child.type"
                    @update="child!.items[index] = $event"
                    @uploading="uploading = $event"
                  />
                </details>
                <button @click="removeSource">Remove source widget</button>
              </template>
            </template>
            <h3>Settings for each placement</h3>
            <p>Placements inherit defaults until someone changes their setting.</p>
            <label v-if="draft.kind === 'visual'"
              >Expose property<select aria-label="Expose property" v-model="fieldProperty">
                <option
                  v-for="property in [
                    'title',
                    'text',
                    'alt',
                    'linkLabel',
                    'linkUrl',
                    'imageId',
                    'background',
                    'color',
                  ]"
                  :key="property"
                  :value="property"
                >
                  {{ property }}
                </option>
              </select></label
            >
            <button
              :disabled="draft.fields.length >= 20 || (draft.kind === 'visual' && !child)"
              @click="addField"
            >
              Add editable setting
            </button>
            <fieldset v-for="(field, index) in draft.fields" :key="index">
              <legend>Setting {{ index + 1 }}</legend>
              <label>Setting key<input v-model="field.key" maxlength="40" /></label
              ><label>Setting label<input v-model="field.label" maxlength="80" /></label>
              <label v-if="draft.kind === 'code'"
                >Setting type<select
                  v-model="field.type"
                  @change="field.defaultValue = field.type === 'color' ? '#174878' : ''"
                >
                  <option value="text">Text</option>
                  <option value="color">Color</option>
                </select></label
              >
              <label v-if="field.type !== 'image'"
                >Setting default<textarea
                  v-if="field.type === 'text'"
                  v-model="field.defaultValue"
                  maxlength="8000"
                  rows="2" /><input v-else v-model="field.defaultValue" type="color"
              /></label>
              <p v-else>
                Default comes from the source image. Expose its alt description separately.
              </p>
              <button @click="draft.fields.splice(index, 1)">Remove editable setting</button>
            </fieldset>
          </section>
          <section class="custom-preview" aria-label="Custom widget live preview">
            <h3>Live preview</h3>
            <p v-if="issue" role="alert">{{ issue }}</p>
            <WebsiteCustomWidget v-else :section="previewSection" :site="site" preview />
          </section>
        </div>
      </template>
    </dialog>
  </Teleport>
</template>
<style scoped>
dialog {
  width: min(1400px, 96vw);
  height: 90dvh;
  padding: 1rem;
  box-sizing: border-box;
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
  gap: 1rem;
  flex-wrap: wrap;
}
header h2 {
  flex: 1;
  margin: 0;
}
.custom-editor-columns {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(0, 1.4fr);
  gap: 1rem;
  height: calc(100% - 110px);
}
.custom-source,
.custom-preview {
  overflow: auto;
  min-height: 0;
}
.custom-preview {
  background: #fff;
  color: #172c40;
  padding: 0.5rem;
}
.custom-preview :deep(.custom-widget-content) {
  height: calc(100% - 60px);
}
label {
  display: grid;
  gap: 0.3rem;
  margin: 0.6rem 0;
}
input,
textarea,
select {
  box-sizing: border-box;
  max-width: 100%;
  width: 100%;
  padding: 0.4rem;
  font: inherit;
  background: var(--field);
  color: var(--text);
  border: 1px solid var(--border);
}
input[type='checkbox'] {
  width: auto;
}
textarea {
  font-family: monospace;
}
button {
  padding: 0.4rem;
  margin: 0.2rem;
  font: inherit;
  font-size: 0.8rem;
}
p,
label {
  font-size: 0.8rem;
}
.geometry {
  display: flex;
  gap: 0.4rem;
}
.geometry label {
  min-width: 0;
}
fieldset {
  min-width: 0;
}
@media (max-width: 800px) {
  .custom-editor-columns {
    grid-template-columns: 1fr;
    height: auto;
  }
  .custom-preview {
    height: 350px;
  }
  .custom-source {
    overflow: visible;
  }
}
</style>
