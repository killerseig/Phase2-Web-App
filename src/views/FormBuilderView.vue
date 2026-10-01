<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { formApi, isFormServerEnabled, type ServerFormTemplate } from '@/services/forms'
import AppShell from '@/layouts/AppShell.vue'
import { useAuthStore } from '@/stores/auth'
import BuilderConfirmDialog from '@/components/builder/BuilderConfirmDialog.vue'
import BuilderSelectionContext from '@/components/builder/BuilderSelectionContext.vue'
import FormDefinitionPreview from '@/components/forms/FormDefinitionPreview.vue'
import {
  clone,
  committeeAudit,
  definitionErrors,
  duplicateTemplate,
  emptyLibrary,
  fieldKinds,
  keepVersion,
  moveField,
  newField,
  newTemplate,
  removeOrArchive,
  type FormFieldKind,
  type FormTemplate,
} from '@/features/forms/model'
import { readLibrary, saveLibrary } from '@/features/forms/localLibrary'
const auth = useAuthStore()
const serverEnabled = isFormServerEnabled(),
  serverTemplates = ref<ServerFormTemplate[]>([]),
  serverBusy = ref(false)
async function loadServer() {
  if (!serverEnabled || !uid.value) return
  const owner = uid.value
  try {
    const result = await formApi<{ templates: ServerFormTemplate[] }>('formTemplates', {
      action: 'list',
    })
    if (uid.value === owner) serverTemplates.value = result.templates
  } catch (caught) {
    error.value = (caught as Error).message
  }
}
async function saveServer(): Promise<ServerFormTemplate | undefined> {
  if (!draft.value) return
  const owner = uid.value
  serverBusy.value = true
  try {
    const existing = serverTemplates.value.find((item) => item.id === draft.value!.id)
    const result = await formApi<ServerFormTemplate>('formTemplates', {
      action: 'save',
      id: draft.value.id,
      revision: existing?.revision || 0,
      definition: draft.value,
    })
    if (uid.value !== owner) return
    await loadServer()
    message.value = 'Draft saved to the local server.'
    error.value = ''
    return result
  } catch (caught) {
    error.value = (caught as Error).message
  } finally {
    serverBusy.value = false
  }
}
async function issueServer() {
  if (serverBusy.value) return
  const saved = await saveServer()
  if (!saved) return
  serverBusy.value = true
  try {
    await formApi('formTemplates', { action: 'issue', id: saved.id, revision: saved.revision })
    await loadServer()
    message.value = 'Immutable local server version issued.'
    error.value = ''
  } catch (caught) {
    error.value = (caught as Error).message
  } finally {
    serverBusy.value = false
  }
}
async function removeServer(template: ServerFormTemplate) {
  const owner = uid.value
  if (
    !(await confirmation.value?.ask({
      title: 'Remove or archive server template?',
      message: 'Issued or used templates are archived and their records remain available.',
      confirmLabel: 'Remove or archive',
    })) ||
    uid.value !== owner
  )
    return
  serverBusy.value = true
  try {
    await formApi('formTemplates', {
      action: 'remove',
      id: template.id,
      revision: template.revision,
    })
    await loadServer()
  } catch (caught) {
    error.value = (caught as Error).message
  } finally {
    serverBusy.value = false
  }
}
async function selectServer(template: ServerFormTemplate) {
  await select({
    ...clone(template.draft),
    id: template.id,
    archived: template.archived,
    versions: [],
  })
}
const library = ref(emptyLibrary()),
  draft = ref<FormTemplate>(),
  message = ref(''),
  error = ref(''),
  blocked = ref(false),
  preview = ref(false),
  dirty = ref(false),
  dragging = ref('')
const confirmation = ref<InstanceType<typeof BuilderConfirmDialog>>()
const uid = computed(() => auth.currentUser?.uid || '')
const recipientText = computed({
  get: () => draft.value?.recipients.join(', ') || '',
  set: (value) => {
    if (draft.value) {
      draft.value.recipients = value
        .split(/[,\n]/)
        .map((email) => email.trim())
        .filter(Boolean)
      dirty.value = true
    }
  },
})
watch(
  uid,
  () => {
    draft.value = undefined
    library.value = emptyLibrary()
    message.value = ''
    error.value = ''
    dirty.value = false
    blocked.value = false
    if (!uid.value) return
    try {
      library.value = readLibrary(localStorage, uid.value)
    } catch (caught) {
      blocked.value = true
      error.value = (caught as Error).message
    }
  },
  { immediate: true },
)
watch(
  uid,
  () => {
    serverTemplates.value = []
    void loadServer()
  },
  { immediate: true },
)
function persist(next = library.value) {
  try {
    library.value = saveLibrary(localStorage, uid.value, next)
    error.value = ''
    message.value = 'Saved on this device.'
    return true
  } catch (caught) {
    error.value = (caught as Error).message
    return false
  }
}
async function select(template: FormTemplate) {
  const owner = uid.value
  if (
    dirty.value &&
    !(await confirmation.value?.ask({
      title: 'Discard unsaved form edits?',
      message: 'Your last saved form stays in the library.',
      confirmLabel: 'Discard edits',
    }))
  )
    return
  if (uid.value !== owner) return
  draft.value = clone(template)
  dirty.value = false
  preview.value = false
  message.value = ''
  error.value = ''
}
async function create(audit = false) {
  const owner = uid.value
  if (blocked.value) return
  if (
    dirty.value &&
    !(await confirmation.value?.ask({
      title: 'Discard unsaved form edits?',
      message: 'Create a new local form without saving these edits.',
      confirmLabel: 'Discard edits',
    }))
  )
    return
  if (uid.value !== owner) return
  draft.value = audit ? committeeAudit() : newTemplate()
  dirty.value = true
  preview.value = false
}
function save(version = false) {
  if (!draft.value || blocked.value || !uid.value) return
  let saved: FormTemplate
  try {
    saved = version ? keepVersion(draft.value) : clone(draft.value)
  } catch (caught) {
    error.value = (caught as Error).message
    return
  }
  const next = clone(library.value)
  const index = next.templates.findIndex((template) => template.id === saved.id)
  if (index < 0) next.templates.push(saved)
  else next.templates[index] = saved
  if (persist(next)) {
    draft.value = clone(saved)
    dirty.value = false
  }
}
async function remove(template: FormTemplate) {
  const owner = uid.value
  const archive = template.versions.length > 0
  if (
    !(await confirmation.value?.ask({
      title: archive ? 'Archive this form?' : 'Delete this unused form?',
      message: archive
        ? 'Retained versions stay intact. This form leaves the active library.'
        : 'This removes the local draft. Cancel keeps it.',
      confirmLabel: archive ? 'Archive form' : 'Delete form',
      destructive: !archive,
    }))
  )
    return
  if (uid.value !== owner) return
  if (persist(removeOrArchive(library.value, template.id)) && draft.value?.id === template.id) {
    draft.value = undefined
    dirty.value = false
  }
}
function duplicate(template: FormTemplate) {
  if (dirty.value) {
    error.value = 'Save or discard your current edits before duplicating.'
    return
  }
  draft.value = duplicateTemplate(template)
  dirty.value = true
  preview.value = false
}
function add(kind: FormFieldKind) {
  if (!draft.value) return
  draft.value.fields.push(newField(kind))
  dirty.value = true
}
function reorder(id: string, index: number) {
  if (!draft.value) return
  moveField(draft.value, id, index)
  dirty.value = true
  dragging.value = ''
}
function removeField(index: number) {
  draft.value?.fields.splice(index, 1)
  dirty.value = true
}
function beginDrag(event: DragEvent, id: string) {
  dragging.value = id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id)
  }
}
function drop(event: DragEvent, index: number) {
  const id = dragging.value || event.dataTransfer?.getData('text/plain')
  if (id) reorder(id, index)
}
const errors = computed(() => (draft.value ? definitionErrors(draft.value) : []))
</script>
<template>
  <AppShell>
    <section class="form-builder">
      <header>
        <div>
          <h1>Form Builder</h1>
          <p>
            Development preview · local drafts on this device. No production submissions or email.
          </p>
        </div>
        <button :disabled="blocked" @click="create()">New form</button
        ><button :disabled="blocked" @click="create(true)">Committee audit starter</button>
      </header>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="message" role="status">{{ message }}</p>
      <div class="builder-layout">
        <aside aria-label="Form library">
          <h2>Form library</h2>
          <p v-if="!library.templates.length">
            Create a form to begin. Opening this page creates nothing.
          </p>
          <article v-for="template in library.templates" :key="template.id">
            <button @click="select(template)">{{ template.title }}</button
            ><span v-if="template.archived">Archived</span
            ><small>{{ template.versions.length }} retained versions</small
            ><button :disabled="template.archived || blocked" @click="duplicate(template)">
              Duplicate</button
            ><button :disabled="template.archived || blocked" @click="remove(template)">
              {{ template.versions.length ? 'Archive' : 'Delete' }}
            </button>
          </article>
          <section v-if="serverEnabled" aria-label="Server form library">
            <h2>Local server forms</h2>
            <button :disabled="serverBusy" @click="loadServer">Refresh server library</button>
            <article v-for="template in serverTemplates" :key="template.id">
              <button @click="selectServer(template)">{{ template.draft.title }}</button
              ><span
                >{{ template.archived ? 'Archived' : 'Active' }} · issued version
                {{ template.latestVersion }}</span
              ><RouterLink v-if="template.latestVersion" :to="'/forms/' + template.id"
                >Open authenticated form</RouterLink
              ><button :disabled="serverBusy || template.archived" @click="removeServer(template)">
                Remove or archive server form
              </button>
            </article>
          </section>
        </aside>
        <section v-if="draft" aria-label="Form editor">
          <BuilderSelectionContext kind="Form" :scope="draft.title" />
          <div v-if="serverEnabled" class="toolbar">
            <button :disabled="serverBusy || draft.archived" @click="saveServer">
              Save to local server</button
            ><button :disabled="serverBusy || draft.archived" @click="issueServer">
              Issue local server version
            </button>
          </div>
          <div class="toolbar">
            <button :disabled="blocked || draft.archived" @click="save()">Save local draft</button
            ><button :disabled="blocked || draft.archived" @click="save(true)">
              Keep local version</button
            ><button @click="preview = !preview">
              {{ preview ? 'Edit fields' : 'Full-page preview' }}</button
            ><span>{{ dirty ? 'Unsaved edits' : 'Saved draft' }}</span>
          </div>
          <FormDefinitionPreview v-if="preview" :definition="draft" />
          <fieldset v-else :disabled="blocked || draft.archived" @input="dirty = true">
            <label>Form title<input v-model="draft.title" maxlength="160" /></label
            ><label>Description<textarea v-model="draft.description" /></label
            ><label
              >Recipients<input
                v-model="recipientText"
                placeholder="name@example.com, another@example.com"
            /></label>
            <p>Recipients are configuration only in this local preview; no email is sent.</p>
            <div class="toolbar">
              <button v-for="kind in fieldKinds" :key="kind" @click="add(kind)">
                Add {{ kind }}
              </button>
            </div>
            <article
              v-for="(field, index) in draft.fields"
              :key="field.id"
              class="field-row"
              :aria-label="'Field ' + (index + 1)"
              @dragover.prevent
              @drop.prevent="drop($event, index)"
            >
              <button
                draggable="true"
                :aria-label="'Drag ' + field.label"
                @dragstart="beginDrag($event, field.id)"
                @dragend="dragging = ''"
                @keydown.esc="dragging = ''"
              >
                &#8942;&#8942;</button
              ><label>Field label<input v-model="field.label" maxlength="160" /></label
              ><label
                >Type<select v-model="field.kind">
                  <option v-for="kind in fieldKinds" :key="kind">{{ kind }}</option>
                </select></label
              ><label><input v-model="field.required" type="checkbox" /> Required</label
              ><label v-if="field.kind === 'choice'"
                >Options<textarea
                  :value="field.options.join('\n')"
                  @input="field.options = ($event.target as HTMLTextAreaElement).value.split('\n')"
                />
              </label>
              <div class="toolbar">
                <button
                  :disabled="index === 0"
                  :aria-label="'Move ' + field.label + ' up'"
                  @click="reorder(field.id, index - 1)"
                >
                  ↑</button
                ><button
                  :disabled="index === draft.fields.length - 1"
                  :aria-label="'Move ' + field.label + ' down'"
                  @click="reorder(field.id, index + 1)"
                >
                  ↓</button
                ><button :aria-label="'Remove ' + field.label" @click="removeField(index)">
                  Remove
                </button>
              </div>
            </article>
            <ul v-if="errors.length">
              <li v-for="item in errors" :key="item">{{ item }}</li>
            </ul>
          </fieldset>
        </section>
        <section v-else>
          <h2>Choose a form or create your first draft</h2>
          <p>
            Reusable form definitions stay separate from existing daily logs, shop orders and
            timecards.
          </p>
        </section>
      </div>
      <BuilderConfirmDialog ref="confirmation" />
    </section>
  </AppShell>
</template>
<style scoped>
.form-builder {
  padding: 1rem;
  max-width: 100rem;
  margin: auto;
}
header,
.toolbar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}
header > div {
  flex: 1;
  min-width: 16rem;
}
header p,
small {
  color: var(--muted);
}
.builder-layout {
  display: grid;
  grid-template-columns: minmax(13rem, 19rem) minmax(0, 1fr);
  gap: 1rem;
  margin-top: 1rem;
}
aside,
fieldset {
  border: 1px solid var(--border);
  border-radius: 0.7rem;
  padding: 1rem;
  min-width: 0;
}
article {
  padding: 0.8rem 0;
  border-bottom: 1px solid var(--border);
}
aside article {
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
}
aside article > button:first-child,
aside small {
  width: 100%;
  text-align: left;
}
label {
  display: grid;
  gap: 0.3rem;
  margin: 0.6rem 0;
}
input:not([type='checkbox']),
textarea,
select {
  padding: 0.55rem;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 0.35rem;
  width: 100%;
  min-width: 0;
}
button {
  padding: 0.5rem 0.7rem;
  cursor: pointer;
  border: 1px solid var(--border);
  border-radius: 0.4rem;
  background: var(--surface);
  color: var(--text);
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
.field-row {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr) 8rem;
  gap: 0.5rem;
  align-items: center;
}
.field-row > label:nth-last-of-type(1),
.field-row > .toolbar {
  grid-column: 2/-1;
}
fieldset {
  margin-top: 1rem;
}
p[role='alert'] {
  color: var(--danger, #c43);
}
@media (max-width: 760px) {
  .builder-layout {
    grid-template-columns: 1fr;
  }
  .field-row {
    grid-template-columns: 2rem minmax(0, 1fr);
  }
  .field-row > label {
    grid-column: 2/-1;
  }
}
</style>
