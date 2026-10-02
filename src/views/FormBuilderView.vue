<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, RouterLink } from 'vue-router'
import { formApi, isFormServerEnabled, type ServerFormTemplate } from '@/services/forms'
import AppShell from '@/layouts/AppShell.vue'
import { useAuthStore } from '@/stores/auth'
import BuilderConfirmDialog from '@/components/builder/BuilderConfirmDialog.vue'
import BuilderSelectionContext from '@/components/builder/BuilderSelectionContext.vue'
import FormCanvasViewport from '@/components/forms/FormCanvasViewport.vue'
import FormOutputSettings from '@/components/forms/FormOutputSettings.vue'
import FormDefinitionPreview from '@/components/forms/FormDefinitionPreview.vue'
import {
  clone,
  committeeAudit,
  definitionErrors,
  duplicateTemplate,
  emptyLibrary,
  fieldKinds,
  optionFieldKinds,
  keepVersion,
  moveField,
  newField,
  newTemplate,
  removeOrArchive,
  type FormFieldKind,
  type FormField,
  type FormTemplate,
} from '@/features/forms/model'
import { useFormAuthoring } from '@/features/forms/useFormAuthoring'
import { useWidgetDrag, type WidgetDrop } from '@/features/dashboard/useWidgetDrag'
import { readLibrary, saveLibrary } from '@/features/forms/localLibrary'
const fieldGroups: { label: string; kinds: FormFieldKind[] }[] = [
  {
    label: 'Basic fields',
    kinds: ['text', 'textarea', 'email', 'phone', 'time', 'date', 'number'],
  },
  { label: 'Choices', kinds: ['choice', 'checkbox', 'radio', 'multiselect'] },
  { label: 'Photos', kinds: ['photo'] },
]
const sidebarTab = ref<'library' | 'fields'>('library')
const settingsTab = ref<'form' | 'field' | 'output'>('field')
const previewDevice = ref<'desktop' | 'tablet' | 'phone'>('desktop')
const previewWidth = computed(() =>
  previewDevice.value === 'phone' ? 390 : previewDevice.value === 'tablet' ? 820 : 1080,
)
const auth = useAuthStore()
const serverEnabled = isFormServerEnabled(),
  serverTemplates = ref<ServerFormTemplate[]>([]),
  serverBusy = ref(false)
const serverAvailable = ref(false)
const legacyImportId = ref(''),
  legacyError = ref('')
async function loadServer() {
  if (!serverEnabled || !uid.value) return
  const owner = uid.value
  try {
    const result = await formApi<{ templates: ServerFormTemplate[] }>('formTemplates', {
      action: 'list',
    })
    if (uid.value === owner) {
      serverTemplates.value = result.templates
      serverAvailable.value = true
    }
  } catch (caught) {
    if (uid.value === owner) {
      serverAvailable.value = false
      error.value = (caught as Error).message
    }
  }
}
async function saveServer(): Promise<ServerFormTemplate | undefined> {
  if (!draft.value || serverBusy.value || !serverAvailable.value) return
  const owner = uid.value,
    submitted = JSON.stringify(draft.value)
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
    if (JSON.stringify(draft.value) === submitted) authoring.saved()
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
    if (uid.value === owner && draft.value?.id === template.id) {
      draft.value = undefined
      authoring.reset()
    }
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
  dirty = ref(false)
const confirmation = ref<InstanceType<typeof BuilderConfirmDialog>>()
const authoring = useFormAuthoring(draft, dirty)
const { selection, canUndo, canRedo } = authoring
const selectedField = computed(() =>
  draft.value?.fields.find((field) => field.id === selection.value),
)
const builderRoot = ref<HTMLElement>()
const creationLocked = computed(
  () => blocked.value || serverBusy.value || (serverEnabled && !serverAvailable.value),
)
const authoringLocked = computed(
  () =>
    blocked.value ||
    serverBusy.value ||
    !!draft.value?.archived ||
    (serverEnabled && !serverAvailable.value),
)
type FieldDrag = { kind: 'new'; type: FormFieldKind } | { kind: 'move'; id: string }
const pointerDrag = useWidgetDrag<FieldDrag>({
  root: builderRoot,
  disabled: () => authoringLocked.value || preview.value || !draft.value,
  drop: dropField,
})
const {
  dragging: pointerDragging,
  target: pointerTarget,
  point: pointerPoint,
  label: pointerLabel,
} = pointerDrag
function startFieldDrag(event: PointerEvent, id: string, label: string) {
  authoring.select(id)
  pointerDrag.start(event, { kind: 'move', id }, label)
}
function dropField(payload: FieldDrag, target: WidgetDrop) {
  if (!draft.value || authoringLocked.value) return
  const at = target.beforeId
    ? draft.value.fields.findIndex((field) => field.id === target.beforeId)
    : draft.value.fields.length
  if (at < 0) return
  if (payload.kind === 'new') add(payload.type, at)
  else {
    const from = draft.value.fields.findIndex((field) => field.id === payload.id)
    if (from < 0) return
    reorder(payload.id, Math.max(0, at > from ? at - 1 : at))
    selection.value = payload.id
  }
}
function editorKeys(event: KeyboardEvent) {
  if ((event.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]'))
    return
  if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
    event.preventDefault()
    if (authoringLocked.value) return
    if (event.key.toLowerCase() === 'y' || event.shiftKey) authoring.redo()
    else authoring.undo()
  }
}
async function duplicateServer(template: ServerFormTemplate) {
  if (serverBusy.value || !serverAvailable.value || template.archived) return
  if (dirty.value) {
    error.value = 'Save or discard current edits before duplicating.'
    return
  }
  const owner = uid.value
  const key = 'form-copy-request:v1:' + owner + ':' + template.id + ':' + template.revision
  const targetId = localStorage.getItem(key) || crypto.randomUUID()
  localStorage.setItem(key, targetId)
  serverBusy.value = true
  try {
    const result = await formApi<ServerFormTemplate>('formTemplates', {
      action: 'duplicate',
      id: template.id,
      revision: template.revision,
      targetId,
    })
    if (uid.value !== owner) return
    localStorage.removeItem(key)
    await loadServer()
    await selectServer(result)
    message.value = 'Independent server copy created. Original versions and records are unchanged.'
  } catch (caught) {
    if (uid.value === owner) error.value = (caught as Error).message
  } finally {
    if (uid.value === owner) serverBusy.value = false
  }
}

async function importDeviceDraft() {
  if (!serverAvailable.value || serverBusy.value || dirty.value) return
  const source = library.value.templates.find(
    (item) => item.id === legacyImportId.value && !item.archived,
  )
  if (!source) return
  draft.value = duplicateTemplate(source)
  authoring.reset(true)
  await saveServer()
}
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
    legacyError.value = ''
    authoring.reset()
    pointerDrag.cancel()
    if (!uid.value) return
    try {
      library.value = readLibrary(localStorage, uid.value)
    } catch (caught) {
      blocked.value = !serverEnabled
      if (serverEnabled)
        legacyError.value =
          'Device cache could not be read; it is preserved. The server library remains separate.'
      else error.value = (caught as Error).message
    }
  },
  { immediate: true },
)
watch(
  uid,
  () => {
    serverTemplates.value = []
    serverAvailable.value = false
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
  pointerDrag.cancel()
  draft.value = clone(template)
  authoring.reset()
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
  pointerDrag.cancel()
  draft.value = audit ? committeeAudit() : newTemplate()
  authoring.reset(true)
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
    authoring.saved()
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
  authoring.reset(true)
  dirty.value = true
  preview.value = false
}
function add(kind: FormFieldKind, at = draft.value?.fields.length || 0) {
  if (!draft.value || authoringLocked.value || draft.value.fields.length >= 60) return
  const field = newField(kind)
  draft.value.fields.splice(at, 0, field)
  selection.value = field.id
  dirty.value = true
  void nextTick(() =>
    builderRoot.value?.querySelector<HTMLElement>('[data-widget-id="' + field.id + '"]')?.focus(),
  )
}
function reorder(id: string, index: number) {
  if (!draft.value || authoringLocked.value) return
  if (draft.value.fields.findIndex((field) => field.id === id) === index) return
  moveField(draft.value, id, index)
  dirty.value = true
}
function changeFieldKind(field: FormField, kind: FormFieldKind) {
  if (
    draft.value?.fields.some((item) => item.requiredWhen?.fieldId === field.id) &&
    !['choice', 'radio'].includes(kind)
  ) {
    error.value =
      'This field is used by required-note conditions. Keep a single select or radio type.'
    return
  }
  field.kind = kind
  if (kind !== 'number') {
    delete field.minimum
    delete field.integer
  }
  if (!['text', 'textarea'].includes(kind)) delete field.requiredWhen
  if (!optionFieldKinds.includes(kind)) field.options = []
  else if (field.options.length < 2) field.options = ['Yes', 'No']
}
function changeCondition(field: FormField, id: string) {
  const source = draft.value?.fields.find((item) => item.id === id)
  if (!source) delete field.requiredWhen
  else field.requiredWhen = { fieldId: source.id, values: [source.options[0]!] }
}
function removeField(index: number) {
  if (!draft.value || authoringLocked.value) return
  if (index < 0 || index >= draft.value.fields.length) return
  const [removed] = draft.value.fields.splice(index, 1)
  for (const field of draft.value.fields)
    if (field.requiredWhen?.fieldId === removed?.id) delete field.requiredWhen
  if (removed?.id === selection.value)
    selection.value = draft.value.fields[index]?.id || draft.value.fields[index - 1]?.id || ''
  dirty.value = true
}
const errors = computed(() => (draft.value ? definitionErrors(draft.value) : []))
async function leaveEditor() {
  if (serverBusy.value) return false
  if (!dirty.value) return true
  const owner = uid.value
  const discard = await confirmation.value?.ask({
    title: 'Leave unsaved form edits?',
    message:
      'Your last saved template remains in the library. Save this draft before leaving to keep these edits.',
    confirmLabel: 'Leave without saving',
  })
  return !!discard && uid.value === owner && !serverBusy.value
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value || serverBusy.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onBeforeRouteLeave(leaveEditor)
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
watch(
  () => draft.value?.id,
  (id) => {
    if (id) {
      sidebarTab.value = 'fields'
      settingsTab.value = 'form'
    }
  },
)
watch(
  () => selectedField.value?.id,
  (id) => {
    settingsTab.value = id ? 'field' : 'form'
  },
)
</script>
<template>
  <AppShell v-slot="{ openNavigation, mobileNavOpen }" contained compact>
    <section
      ref="builderRoot"
      class="form-builder builder-controls"
      @click.capture="pointerDrag.guardClick"
      @keydown="editorKeys"
    >
      <header class="form-builder-header">
        <button
          class="mobile-navigation"
          aria-label="Open navigation"
          :aria-expanded="mobileNavOpen"
          @click="openNavigation"
        >
          <i class="pi pi-bars" aria-hidden="true" />
        </button>
        <div>
          <h1>Form Builder</h1>
          <small>{{ dirty ? 'Unsaved edits' : 'Draft saved' }} · Local preview</small>
        </div>
        <nav aria-label="Builder modes">
          <button
            :aria-pressed="!preview && settingsTab !== 'output'"
            @click="((preview = false), (settingsTab = selection ? 'field' : 'form'))"
          >
            Edit</button
          ><button
            :aria-pressed="preview && settingsTab !== 'output'"
            @click="((preview = true), (settingsTab = 'form'))"
          >
            Preview</button
          ><button
            aria-label="Output / issues"
            title="Output and issues"
            :aria-pressed="settingsTab === 'output'"
            @click="settingsTab = 'output'"
          >
            Output / review
          </button>
        </nav>
        <div class="header-actions">
          <button
            class="history-action"
            aria-label="Undo"
            title="Undo draft edit"
            :disabled="authoringLocked || !canUndo"
            @click="authoring.undo"
          >
            <i class="pi pi-undo" aria-hidden="true" /></button
          ><button
            class="history-action"
            aria-label="Redo"
            title="Redo draft edit"
            :disabled="authoringLocked || !canRedo"
            @click="authoring.redo"
          >
            <i class="pi pi-refresh" aria-hidden="true" />
          </button>
          <div v-if="serverEnabled" class="toolbar">
            <button
              :disabled="authoringLocked"
              @click="saveServer"
              aria-label="Save to local server"
            >
              Save draft</button
            ><button
              class="primary"
              :disabled="serverBusy || !draft || draft.archived"
              @click="issueServer"
            >
              Issue local server version
            </button>
          </div>
          <div class="toolbar">
            <button
              v-if="!serverEnabled"
              :disabled="blocked || !draft || draft.archived"
              @click="save()"
            >
              Save local draft</button
            ><button
              v-if="!serverEnabled"
              :disabled="blocked || !draft || draft.archived"
              @click="save(true)"
            >
              Keep local version</button
            ><button @click="preview = !preview">
              <i :class="['pi', preview ? 'pi-pencil' : 'pi-eye']" aria-hidden="true" />
              {{ preview ? 'Edit fields' : 'Full-page preview' }}</button
            ><span>{{ dirty ? 'Unsaved edits' : 'Saved draft' }}</span>
          </div>
        </div>
      </header>
      <details class="local-status">
        <summary>Development preview · no production submissions or email</summary>
        <p aria-live="polite">
          {{
            serverEnabled
              ? serverAvailable
                ? 'Source of truth: local emulator server. Device-only drafts are separate and are not listed here.'
                : 'Emulator backend unavailable. Server edits are blocked; no fallback device records are mixed into this library.'
              : 'Device-only draft mode. Start the Forms emulator profile for the shared server library; these drafts are not server records.'
          }}
        </p>
      </details>
      <p v-if="legacyError" role="alert">{{ legacyError }}</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="message" role="status">{{ message }}</p>
      <div class="builder-layout">
        <aside class="builder-sidebar" aria-label="Form library">
          <div class="library-creation">
            <button :disabled="creationLocked" @click="create()">
              <i class="pi pi-plus" aria-hidden="true" />New form</button
            ><button :disabled="creationLocked" @click="create(true)">
              <i class="pi pi-file-edit" aria-hidden="true" />Committee audit starter
            </button>
          </div>
          <nav class="sidebar-tabs" aria-label="Form palette">
            <button :aria-pressed="sidebarTab === 'library'" @click="sidebarTab = 'library'">
              <i class="pi pi-file" aria-hidden="true" /> Library</button
            ><button :aria-pressed="sidebarTab === 'fields'" @click="sidebarTab = 'fields'">
              <i class="pi pi-th-large" aria-hidden="true" /> Fields
            </button>
          </nav>
          <div v-show="sidebarTab === 'library'" class="library-list">
            <p v-if="!serverEnabled && !library.templates.length">
              Create a form to begin. Opening this page creates nothing.
            </p>
            <article
              class="form-library-row"
              :class="{ selected: draft?.id === template.id }"
              v-for="template in serverEnabled ? [] : library.templates"
              :key="template.id"
            >
              <button
                class="library-target"
                :aria-label="template.title"
                :aria-pressed="draft?.id === template.id"
                @click="select(template).then(() => (sidebarTab = 'library'))"
              >
                <i class="pi pi-file" aria-hidden="true" /><span>{{ template.title }}</span></button
              ><span v-if="template.archived" class="library-meta">Archived</span
              ><small class="library-meta">{{ template.versions.length }} retained versions</small
              ><button
                class="library-action"
                v-if="draft?.id === template.id"
                :disabled="template.archived || blocked"
                @click="duplicate(template)"
              >
                <i class="pi pi-copy" aria-hidden="true" /> Duplicate</button
              ><button
                class="library-action"
                v-if="draft?.id === template.id"
                :disabled="template.archived || blocked"
                @click="remove(template)"
              >
                <i
                  :class="['pi', template.versions.length ? 'pi-inbox' : 'pi-trash']"
                  aria-hidden="true"
                />
                {{ template.versions.length ? 'Archive' : 'Delete' }}
              </button>
            </article>
            <section v-if="serverEnabled" aria-label="Server form library">
              <div class="library-utilities">
                <h3>Forms</h3>
                <button
                  class="library-refresh"
                  aria-label="Refresh server library"
                  title="Refresh server library"
                  :disabled="serverBusy"
                  @click="loadServer"
                >
                  <i class="pi pi-refresh" aria-hidden="true" />
                </button>
              </div>
              <details v-if="library.templates.length">
                <summary>Import an existing device draft</summary>
                <p>
                  Creates a new server draft. Device versions stay on this device and are not merged
                  with server history.
                </p>
                <label
                  >Device draft to import<select
                    v-model="legacyImportId"
                    aria-label="Device draft to import"
                  >
                    <option value="">Choose a device draft</option>
                    <option
                      v-for="item in library.templates.filter((item) => !item.archived)"
                      :key="item.id"
                      :value="item.id"
                    >
                      {{ item.title }}
                    </option>
                  </select></label
                ><button
                  :disabled="!legacyImportId || !serverAvailable || serverBusy || dirty"
                  @click="importDeviceDraft"
                >
                  Import as new server draft
                </button>
              </details>

              <article
                class="form-library-row"
                :class="{ selected: draft?.id === template.id }"
                v-for="template in serverTemplates"
                :key="template.id"
              >
                <button
                  class="library-target"
                  :aria-label="template.draft.title"
                  :aria-pressed="draft?.id === template.id"
                  :disabled="serverBusy"
                  @click="selectServer(template).then(() => (sidebarTab = 'library'))"
                >
                  <i class="pi pi-file" aria-hidden="true" />
                  <span>{{ template.draft.title }}</span></button
                ><span class="library-meta">{{
                  template.archived
                    ? 'Archived'
                    : template.latestVersion
                      ? 'Issued version ' + template.latestVersion
                      : 'Draft'
                }}</span
                ><RouterLink
                  v-if="draft?.id === template.id && template.latestVersion"
                  :to="'/forms/' + template.id"
                  class="library-open"
                  aria-label="Open authenticated form"
                  ><i class="pi pi-external-link" aria-hidden="true" />Open form</RouterLink
                ><button
                  v-if="draft?.id === template.id"
                  :disabled="serverBusy || !serverAvailable || template.archived || dirty"
                  class="library-action"
                  aria-label="Duplicate server form"
                  @click="duplicateServer(template)"
                >
                  <i class="pi pi-copy" aria-hidden="true" />Duplicate</button
                ><button
                  v-if="draft?.id === template.id"
                  :disabled="serverBusy || !serverAvailable || template.archived"
                  class="library-action"
                  aria-label="Remove or archive server form"
                  @click="removeServer(template)"
                >
                  <i class="pi pi-inbox" aria-hidden="true" />{{
                    template.latestVersion || template.used ? 'Archive' : 'Delete'
                  }}
                </button>
              </article>
            </section>
          </div>
          <section
            v-if="draft && !preview"
            v-show="sidebarTab === 'fields'"
            class="field-palette"
            aria-label="Field palette"
          >
            <h2>Fields</h2>
            <section v-for="group in fieldGroups" :key="group.label">
              <h3>{{ group.label }}</h3>
              <div class="palette-options">
                <button
                  v-for="kind in group.kinds"
                  :key="kind"
                  class="form-grip"
                  :disabled="authoringLocked || draft.fields.length >= 60"
                  @pointerdown="pointerDrag.start($event, { kind: 'new', type: kind }, kind)"
                  @dragstart.prevent
                  @click="add(kind)"
                  :aria-label="'Add ' + kind"
                >
                  <i
                    :class="[
                      'pi',
                      {
                        text: 'pi-align-left',
                        textarea: 'pi-align-justify',
                        email: 'pi-envelope',
                        phone: 'pi-phone',
                        time: 'pi-clock',
                        date: 'pi-calendar',
                        number: 'pi-hashtag',
                        choice: 'pi-list',
                        checkbox: 'pi-check-square',
                        radio: 'pi-circle',
                        multiselect: 'pi-check-circle',
                        photo: 'pi-image',
                      }[kind],
                    ]"
                    aria-hidden="true"
                  />
                  {{
                    kind === 'choice'
                      ? 'Single select'
                      : kind === 'textarea'
                        ? 'Long text'
                        : kind === 'multiselect'
                          ? 'Multi select'
                          : kind[0]!.toUpperCase() + kind.slice(1)
                  }}
                </button>
              </div>
            </section>
          </section>
        </aside>
        <section v-if="draft" aria-label="Form editor">
          <BuilderSelectionContext kind="Form" :scope="draft.title" />
          <div class="authoring-panels">
            <FormCanvasViewport :device="previewDevice"
              ><template #devices>
                <div class="toolbar device-controls" role="group" aria-label="Preview device">
                  <button
                    v-for="device in ['desktop', 'tablet', 'phone'] as const"
                    :key="device"
                    :aria-pressed="previewDevice === device"
                    :aria-label="device[0]!.toUpperCase() + device.slice(1)"
                    :title="device[0]!.toUpperCase() + device.slice(1)"
                    @click="previewDevice = device"
                  >
                    <i
                      :class="[
                        'pi',
                        device === 'desktop'
                          ? 'pi-desktop'
                          : device === 'tablet'
                            ? 'pi-tablet'
                            : 'pi-mobile',
                      ]"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </template>
              <div
                v-if="preview"
                class="form-preview-frame"
                data-builder-preview
                :style="{ maxWidth: previewWidth + 'px' }"
              >
                <FormDefinitionPreview :definition="draft" />
              </div>
              <fieldset
                v-else
                class="canvas-panel"
                :disabled="authoringLocked"
                @input="dirty = true"
              >
                <h2 class="canvas-title">{{ draft.title }}</h2>
                <p class="canvas-description">{{ draft.description }}</p>
                <div
                  class="form-canvas field-control-canvas"
                  data-widget-surface="form"
                  aria-label="Form canvas"
                >
                  <p v-if="!draft.fields.length" class="empty-canvas">
                    Drop a field here or choose Add above.
                  </p>
                  <article
                    v-for="(field, index) in draft.fields"
                    :key="field.id"
                    class="field-row"
                    :data-widget-id="field.id"
                    :class="{
                      selected: selection === field.id,
                      'drop-before':
                        pointerTarget?.overId === field.id && pointerTarget.edge === 'before',
                      'drop-after':
                        pointerTarget?.overId === field.id && pointerTarget.edge === 'after',
                    }"
                    tabindex="0"
                    @focusin="(authoring.select(field.id), (settingsTab = 'field'))"
                    @click="(authoring.select(field.id), (settingsTab = 'field'))"
                    @keydown.enter.self="(authoring.select(field.id), (settingsTab = 'field'))"
                    @keydown.space.self.prevent="
                      (authoring.select(field.id), (settingsTab = 'field'))
                    "
                    @keydown.delete.self.prevent="removeField(index)"
                    :aria-description="
                      field.label + ', ' + field.kind + (field.required ? ', required' : '')
                    "
                    :aria-label="'Field ' + (index + 1)"
                  >
                    <button
                      class="form-grip"
                      @pointerdown="startFieldDrag($event, field.id, field.label)"
                      @dragstart.prevent
                      :aria-label="'Drag ' + field.label"
                      @keydown.esc="pointerDrag.cancel"
                    >
                      <i class="pi pi-ellipsis-v" aria-hidden="true" />
                    </button>
                    <small class="field-kind"
                      >{{
                        field.kind === 'choice'
                          ? 'Single select'
                          : field.kind === 'textarea'
                            ? 'Long text'
                            : field.kind
                      }}
                      · {{ index + 1 }}</small
                    >
                    <div class="canvas-field-preview" data-builder-preview inert aria-hidden="true">
                      <FormDefinitionPreview
                        :definition="draft"
                        :canvas-field="field"
                        :previous-section="draft.fields[index - 1]?.section"
                      />
                    </div>
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
                </div>
                <ul v-if="errors.length">
                  <li v-for="item in errors" :key="item">{{ item }}</li>
                </ul>
              </fieldset></FormCanvasViewport
            >
            <fieldset class="inspector-panel" :disabled="authoringLocked" @input="dirty = true">
              <nav class="settings-tabs" aria-label="Form settings tabs">
                <button :aria-pressed="settingsTab === 'form'" @click="settingsTab = 'form'">
                  <i class="pi pi-cog" aria-hidden="true" /> Form</button
                ><button :aria-pressed="settingsTab === 'field'" @click="settingsTab = 'field'">
                  <i class="pi pi-sliders-h" aria-hidden="true" /> Field</button
                ><button :aria-pressed="settingsTab === 'output'" @click="settingsTab = 'output'">
                  <i class="pi pi-check-circle" aria-hidden="true" /> Output
                </button>
              </nav>
              <section v-show="settingsTab === 'form'" aria-label="Form settings">
                <label>Form title<input v-model="draft.title" maxlength="160" /></label
                ><label>Description<textarea v-model="draft.description" /></label
                ><label
                  >Recipients<input
                    v-model="recipientText"
                    placeholder="name@example.com, another@example.com"
                /></label>
                <p>Recipients are configuration only in this local preview; no email is sent.</p>
                <p>
                  Drag a field onto the ordered canvas, or click Add to append. Select a field for
                  its inspector. Move buttons provide keyboard ordering.
                </p>
              </section>
              <FormOutputSettings
                v-if="settingsTab === 'output'"
                :definition="draft"
                :template-id="draft.id"
                @update:definition="(Object.assign(draft, $event), (dirty = true))"
              />
              <section
                v-if="selectedField && !preview"
                v-show="settingsTab === 'field'"
                aria-label="Field inspector"
                class="field-inspector"
              >
                <BuilderSelectionContext kind="Field" :scope="selectedField.label" />
                <label
                  >Selected field label<input v-model="selectedField.label" maxlength="160"
                /></label>
                <label
                  >Selected field type<select
                    aria-label="Selected field type"
                    :value="selectedField.kind"
                    @change="
                      changeFieldKind(
                        selectedField,
                        ($event.target as HTMLSelectElement).value as FormFieldKind,
                      )
                    "
                  >
                    <option v-for="kind in fieldKinds" :key="kind">{{ kind }}</option>
                  </select></label
                >
                <label
                  ><input v-model="selectedField.required" type="checkbox" />Selected field
                  required</label
                >
                <label v-if="optionFieldKinds.includes(selectedField.kind)"
                  >Selected field options<textarea
                    :value="selectedField.options.join('\n')"
                    @input="
                      selectedField.options = ($event.target as HTMLTextAreaElement).value.split(
                        '\n',
                      )
                    "
                  />
                </label>
                <label
                  >Selected field hint<input
                    :value="selectedField.hint || ''"
                    maxlength="500"
                    @input="selectedField.hint = ($event.target as HTMLInputElement).value"
                /></label>
                <label
                  >Selected field section<input
                    :value="selectedField.section || ''"
                    maxlength="160"
                    @input="selectedField.section = ($event.target as HTMLInputElement).value"
                /></label>
                <template v-if="selectedField.kind === 'number'"
                  ><label
                    >Minimum number<input
                      type="number"
                      :value="selectedField.minimum"
                      @input="
                        ($event.target as HTMLInputElement).value === ''
                          ? delete selectedField.minimum
                          : (selectedField.minimum = Number(
                              ($event.target as HTMLInputElement).value,
                            ))
                      " /></label
                  ><label
                    ><input v-model="selectedField.integer" type="checkbox" />Whole numbers
                    only</label
                  ></template
                >
                <template v-if="['text', 'textarea'].includes(selectedField.kind)">
                  <label
                    >Required note source<select
                      aria-label="Required note source"
                      :value="selectedField.requiredWhen?.fieldId || ''"
                      @change="
                        changeCondition(selectedField, ($event.target as HTMLSelectElement).value)
                      "
                    >
                      <option value="">No condition</option>
                      <option
                        v-for="source in draft.fields.filter((field) =>
                          ['choice', 'radio'].includes(field.kind),
                        )"
                        :key="source.id"
                        :value="source.id"
                      >
                        {{ source.label }}
                      </option>
                    </select></label
                  >
                  <label v-if="selectedField.requiredWhen"
                    >Required note values<select
                      aria-label="Required note values"
                      multiple
                      :value="selectedField.requiredWhen.values"
                      @change="
                        selectedField.requiredWhen.values = Array.from(
                          ($event.target as HTMLSelectElement).selectedOptions,
                        ).map((option) => option.value)
                      "
                    >
                      <option
                        v-for="option in draft.fields.find(
                          (field) => field.id === selectedField!.requiredWhen!.fieldId,
                        )?.options || []"
                        :key="option"
                      >
                        {{ option }}
                      </option>
                    </select></label
                  >
                </template>
                <button
                  :aria-label="'Delete selected ' + selectedField.label"
                  @click="
                    removeField(draft.fields.findIndex((field) => field.id === selectedField!.id))
                  "
                >
                  Delete selected field
                </button>
              </section>

              <p v-if="!selectedField">Select a field on the canvas to edit its properties.</p>
            </fieldset>
          </div>
        </section>
        <section v-else>
          <h2>Choose a form or create your first draft</h2>
          <p>
            Reusable form definitions stay separate from existing daily logs, shop orders and
            timecards.
          </p>
        </section>
      </div>
      <Teleport to="body"
        ><div
          v-if="pointerDragging"
          class="form-drag-ghost"
          :style="{ left: pointerPoint.x + 12 + 'px', top: pointerPoint.y + 12 + 'px' }"
          aria-hidden="true"
        >
          {{ pointerLabel }} · {{ pointerTarget ? 'Release to place' : 'Drag onto the canvas' }}
        </div></Teleport
      >
      <BuilderConfirmDialog ref="confirmation" />
    </section>
  </AppShell>
</template>
<style scoped>
@media (max-width: 760px) {
  :global(.app-shell__content:has(.form-builder)) {
    scroll-padding-top: 21rem;
  }
  .form-builder .form-canvas {
    max-height: max(10rem, calc(100dvh - 28rem));
    scroll-margin-top: 21rem;
  }
  .field-row {
    scroll-margin-top: 21rem;
  }
}

.canvas-field-preview {
  grid-column: 1/-1;
  min-width: 0;
  pointer-events: none;
}
.field-kind {
  text-transform: capitalize;
}
.field-row {
  background: var(--surface);
  border-radius: 0.45rem;
  margin-bottom: 0.65rem;
  padding: 0.65rem;
}
.field-row > .toolbar {
  grid-column: 1/-1;
  justify-content: flex-end;
}

.authoring-panels {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(13rem, 17rem);
  gap: 0.75rem;
  align-items: start;
}
.builder-sidebar {
  position: sticky;
  top: 0;
  align-self: start;
  max-height: calc(100dvh - 6rem);
  overflow: auto;
}
.library-list {
  max-height: 16rem;
  overflow: auto;
}
.library-list article {
  padding: 0.35rem 0;
}
.palette-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.35rem;
}
.field-palette h3 {
  font-size: 0.8rem;
  color: var(--muted);
  margin: 0.6rem 0 0.3rem;
}
.form-preview-frame {
  width: 100%;
  margin: 1rem auto;
  min-width: 0;
}
.inspector-panel {
  position: sticky;
  top: 0.5rem;
  max-height: 75dvh;
  overflow: auto;
}
button[aria-pressed='true'] {
  border-color: var(--brand-sky, #58bae9);
  background: var(--surface-raised, var(--surface));
}
@media (max-width: 1250px) {
  .authoring-panels {
    grid-template-columns: minmax(0, 1fr);
  }
  .inspector-panel {
    position: static;
    max-height: none;
  }
}
@media (max-width: 760px) {
  .builder-sidebar {
    display: contents;
    position: static;
    max-height: none;
  }
  .builder-sidebar > h2 {
    display: none;
  }
  .library-list {
    grid-row: 1;
  }
  .field-palette {
    grid-row: 2;
    position: sticky;
    top: 0;
  }
  .library-list {
    max-height: 10rem;
  }
  .palette-options {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.25rem;
  }
  .field-palette {
    padding: 0.35rem 0.5rem;
  }
  .field-palette h2 {
    font-size: 1rem;
    margin: 0.25rem 0;
  }
  .field-palette h3 {
    font-size: 0.75rem;
    margin: 0.25rem 0 0.2rem;
  }
  .palette-options button {
    font-size: 0.8rem;
    line-height: 1.15;
    padding: 0.35rem 0.25rem;
    min-height: 2rem;
  }
}
.field-palette {
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--surface);
  padding-block: 0.5rem;
}
.form-canvas {
  max-height: 65dvh;
  overflow: auto;
  min-height: 6rem;
  padding: 0.5rem;
  border: 1px dashed var(--border);
}
.form-grip {
  touch-action: none;
  user-select: none;
  cursor: grab;
}
.field-row.selected {
  outline: 2px solid var(--brand-sky, #58bae9);
  outline-offset: -2px;
}
.drop-before {
  box-shadow: 0 -3px var(--brand-sky, #58bae9);
}
.drop-after {
  box-shadow: 0 3px var(--brand-sky, #58bae9);
}
.field-inspector {
  padding: 0;
  margin-top: 0;
}
.form-drag-ghost {
  position: fixed;
  z-index: 10000;
  pointer-events: none;
  background: var(--surface);
  padding: 0.5rem;
  border: 1px solid var(--border);
}
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
  grid-template-columns: minmax(12rem, 15rem) minmax(0, 1fr);
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
  grid-template-columns: 2rem minmax(0, 1fr);
  gap: 0.5rem;
  align-items: center;
}
.field-row > .toolbar {
  grid-column: 1/-1;
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

.form-builder {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0 !important;
  gap: 0 !important;
}
.form-builder-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  padding: 0.3rem 0.4rem;
  flex-wrap: wrap;
  flex: none;
}
.form-builder-header h1 {
  font-size: 1.05rem;
  margin: 0;
}
.form-builder-header small {
  font-size: 0.75rem;
}
.form-builder-header button {
  padding: 0.3rem 0.5rem;
  font-size: 0.8rem;
}
.header-actions,
.form-builder-header nav,
.header-actions .toolbar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
}
.header-actions .toolbar {
  margin: 0;
}
.header-actions .toolbar > span {
  display: none;
}
.local-status {
  font-size: 0.75rem;
  padding: 0.1rem 0.5rem;
  flex: none;
}
.local-status p {
  margin: 0.2rem;
}
.builder-layout {
  flex: 1;
  min-height: 0;
  grid-template-columns: 15rem minmax(0, 1fr);
  gap: 0.35rem !important;
  overflow: hidden;
}
.builder-sidebar {
  position: static;
  max-height: none;
  min-height: 0;
  height: 100%;
  border-radius: 0 !important;
  padding: 0.35rem !important;
  overflow: auto;
}
.sidebar-tabs,
.settings-tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}
.sidebar-tabs button,
.settings-tabs button {
  flex: 1;
  padding: 0.35rem 0.25rem;
  font-size: 0.8rem;
}
.library-list {
  max-height: none;
}
.builder-layout > section[aria-label='Form editor'] {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.builder-layout > section[aria-label='Form editor'] > :deep(.builder-selection-context) {
  display: none;
}
.authoring-panels {
  flex: 1;
  min-height: 0;
  grid-template-columns: minmax(0, 1fr) 17rem;
  gap: 0.35rem;
}
.canvas-panel {
  border: 0 !important;
  border-radius: 0 !important;
  padding: 1rem !important;
  min-width: 0;
  margin: 0 !important;
}
.canvas-title {
  font-size: 1.4rem;
  margin: 0.2rem 0;
}
.canvas-description {
  margin: 0.4rem 0 1rem;
}
.form-canvas {
  max-height: none !important;
  overflow: visible;
  border: 0;
  padding: 0;
}
.field-row {
  margin: 0 0 0.4rem;
  padding: 0.35rem;
  border-radius: 0.25rem;
  background: transparent;
}
.field-row > .toolbar {
  margin: 0;
  opacity: 0.3;
}
.field-row.selected > .toolbar,
.field-row:hover > .toolbar {
  opacity: 1;
}
.field-row > .toolbar button {
  font-size: 0.75rem;
  padding: 0.2rem 0.35rem;
}
.field-kind {
  font-size: 0.7rem;
  opacity: 0.6;
}
.form-grip {
  padding: 0.2rem 0.35rem !important;
}
.inspector-panel {
  position: static;
  max-height: none;
  height: 100%;
  overflow: auto;
  border-radius: 0 !important;
  padding: 0.5rem !important;
  margin: 0 !important;
}
.form-preview-frame {
  margin: 0;
  max-width: none !important;
}
.field-palette {
  position: static;
}
.mobile-navigation {
  display: none;
}
.toolbar[aria-label='Preview device'] {
  margin: 0;
  display: flex;
  gap: 0.25rem;
}
.toolbar[aria-label='Preview device'] button {
  padding: 0.3rem 0.45rem;
  font-size: 0.75rem;
}
@media (max-width: 1000px) {
  .builder-layout {
    grid-template-columns: 11rem minmax(0, 1fr);
  }
  .authoring-panels {
    grid-template-columns: minmax(0, 1fr) 14rem;
  }
  .form-builder-header nav {
    order: 3;
  }
  .header-actions {
    max-width: 70%;
  }
}
@media (max-width: 760px) {
  .mobile-navigation {
    display: block;
  }
  .builder-layout {
    display: flex;
    flex-direction: column;
    overflow: auto;
  }
  .builder-sidebar {
    height: auto;
    max-height: 14rem;
    flex: none;
    display: block;
  }
  .builder-layout > section[aria-label='Form editor'] {
    min-height: 40rem;
    overflow: visible;
    flex: none;
  }
  .authoring-panels {
    display: flex;
    flex-direction: column;
    min-height: 40rem;
  }
  .authoring-panels > :deep(.canvas-viewport) {
    height: 30rem;
    flex: none;
  }
  .inspector-panel {
    height: auto;
    max-height: 30rem;
    flex: none;
  }
  .field-palette {
    display: block;
  }
  .field-palette h2 {
    display: none;
  }
  .palette-options {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .form-builder-header .header-actions {
    max-width: 100%;
  }
  .form-builder .field-row {
    scroll-margin-top: 0;
  }
  .form-builder .form-canvas {
    scroll-margin-top: 0;
  }
  .canvas-panel {
    padding: 0.65rem !important;
  }
}
@media (max-width: 760px) {
  .builder-sidebar {
    position: sticky;
    top: 0;
    z-index: 10;
    max-height: 13rem;
    background: var(--surface);
  }
}
.form-builder {
  width: 100%;
  min-width: 0;
  max-width: none;
  margin: 0;
  box-sizing: border-box;
}
.builder-layout > section[aria-label='Form editor'] > .selection-context {
  display: none;
}
.header-actions {
  min-width: 0;
}
.field-palette h2 {
  font-size: 1rem;
  margin: 0.4rem 0;
}
.field-palette {
  padding-top: 0;
}
.form-canvas[data-widget-scroll] {
  overflow: visible;
}
@media (max-width: 760px) {
  :global(.app-shell__content:has(.form-builder)) {
    scroll-padding-top: 0;
  }
  .builder-sidebar {
    max-height: 12rem;
  }
  .form-builder .form-canvas {
    scroll-margin-top: 0;
  }
}
.authoring-panels {
  align-items: stretch;
}
.form-builder-header > div {
  min-width: 0;
  flex: 0 1 auto;
}
.form-builder-header button {
  white-space: nowrap;
}
.authoring-panels > :deep(.canvas-viewport) {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}
@media (max-width: 760px) {
  .form-builder-header > .header-actions {
    flex: 1 0 100%;
    max-width: 100%;
  }
  .form-builder-header nav {
    order: 0;
  }
  .form-builder-header > div:first-of-type {
    flex: 1;
  }
  .header-actions .toolbar {
    min-width: 0;
  }
}
.form-canvas:has(.empty-canvas) {
  min-height: 20rem;
}
@media (max-width: 760px) {
  .builder-layout {
    scroll-padding-top: 13rem;
  }
  .canvas-viewport {
    scroll-margin-top: 13rem;
  }
}
</style>

<style src="../styles/form-builder.css"></style>
