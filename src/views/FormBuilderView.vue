<script setup lang="ts">
import { adminTemplateCommand } from '@/features/forms/templateCommands'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, RouterLink } from 'vue-router'
import { isFormServerEnabled, isFormEmulatorEnabled, type ServerFormTemplate } from '@/services/forms'
import AppShell from '@/layouts/AppShell.vue'
import { useAuthStore } from '@/stores/auth'
import BuilderConfirmDialog from '@/components/builder/BuilderConfirmDialog.vue'
import BuilderSelectionContext from '@/components/builder/BuilderSelectionContext.vue'
import FormEntriesView from '@/components/forms/FormEntriesView.vue'
import FormShareLinks from '@/components/forms/FormShareLinks.vue'
import FormCanvasViewport from '@/components/forms/FormCanvasViewport.vue'
import FormOutputSettings from '@/components/forms/FormOutputSettings.vue'
import FormDefinitionPreview from '@/components/forms/FormDefinitionPreview.vue'
import FormSelectorList from '@/components/forms/FormSelectorList.vue'
import BuilderEditingTools from '@/components/builder/BuilderEditingTools.vue'
import BuilderPanelSwitcher from '@/components/builder/BuilderPanelSwitcher.vue'
import BuilderSettingsTabs from '@/components/builder/BuilderSettingsTabs.vue'
import { useFormPersistence } from '@/features/forms/useFormPersistence'
import { alphabetizeFormChoices } from '@/features/forms/selectorOrder'
import {
  clone,
  committeeAudit,
  definitionErrors,
  duplicateTemplate,
  emptyLibrary,
  fieldKinds,
  optionFieldKinds,
  moveField,
  moveGroupField,
  newField,
  newTemplate,
  removeOrArchive,
  type FormFieldKind,
  type FormField,
  type FormTemplate,
} from '@/features/forms/model'
import { useFormAuthoring } from '@/features/forms/useFormAuthoring'
import { reportingStarter, type ReportingStarter } from '@/features/forms/reportingStarters'
import { committeeFieldsToRemove, applyApprovedCommitteeCorrections } from '@/features/forms/committeeCorrection'
import { useWidgetDrag, type WidgetDrop } from '@/features/dashboard/useWidgetDrag'
import { readLibrary } from '@/features/forms/localLibrary'
import { usePrivateReferences } from '@/features/intranet/usePrivateReferences'
import { suppliedReportStarter, suppliedStarterDecision } from '@/features/forms/suppliedStarters'
import type { IntranetForm } from '@/features/intranet/content'
import PrivateReferenceStatus from '@/components/intranet/PrivateReferenceStatus.vue'
const localPreview = isFormEmulatorEnabled()
const fieldGroups: { label: string; kinds: FormFieldKind[] }[] = [
  {
    label: 'Basic fields',
    kinds: ['text', 'textarea', 'email', 'phone', 'time', 'date', 'number'],
  },
  { label: 'Choices', kinds: ['choice', 'checkbox', 'radio', 'multiselect', 'matrix'] },
  { label: 'Photos', kinds: ['photo'] },
  { label: 'Groups and routing', kinds: ['repeat', 'recipients'] },
]
const entriesMode = ref(false)
const fieldsExpanded = ref(false), formActionsExpanded = ref(false)
const activePane = ref<'outline' | 'preview' | 'inspector'>('outline')
const inspectorPane = ref<HTMLElement>()
function focusInspector() {
  activePane.value = 'inspector'
  void nextTick(() => {
    if (window.matchMedia?.('(max-width: 900px)').matches) inspectorPane.value?.focus({ preventScroll: true })
  })
}
function selectCanvasField(id: string) {
  authoring.select(id)
  settingsTab.value = 'field'
  focusInspector()
}
function openPublishing() {
  entriesMode.value = false
  preview.value = false
  settingsTab.value = 'output'
  focusInspector()
}
const settingsTab = ref<'form' | 'field' | 'output'>('field')
const previewDevice = ref<'desktop' | 'tablet' | 'phone'>('desktop')
const auth = useAuthStore()
const uid = computed(() => auth.currentUser?.uid || '')
const { content: suppliedContent, packages: sourcePackages, selectedPackage: sourcePackage, loading: sourcesLoading, error: sourcesError, notice: sourceNotice, selectSource, reload: reloadSources, cancel: cancelSource } = usePrivateReferences(() => auth.rawRole === 'admin')
const suppliedStarters = computed(() => suppliedContent.value?.forms.filter(form => !suppliedStarterDecision(form)) ?? [])
const serverEnabled = isFormServerEnabled()
const legacyImportId = ref(''), legacyError = ref('')
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
    await adminTemplateCommand('remove', {
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
const persistence = useFormPersistence({
  uid, draft, library, dirty, blocked, message, error, authoring, serverEnabled, localPreview,
  storage: () => localStorage,
  confirmPublish: async () => confirmation.value?.ask({
    title: 'Publish this form?',
    message: 'Save this draft and publish it as an immutable version. New respondents use this version; completed entries retain their original questions and answers.',
    confirmLabel: 'Save and publish',
  }),
  showPublicationIssues: () => { settingsTab.value = 'output' },
})
const { serverTemplates, serverBusy, serverAvailable, publishPhase, loadServer, saveServer, issueServer, persist, save } = persistence
const { selection, canUndo, canRedo } = authoring
const starterSelection = ref('')
const selectedServerForm = computed(() => serverEnabled ? serverTemplates.value.find(item => item.id === draft.value?.id) : undefined)
const selectedLocalForm = computed(() => !serverEnabled ? library.value.templates.find(item => item.id === draft.value?.id) : undefined)
const selectedFormKey = computed(() => !draft.value ? '' : selectedServerForm.value ? 'server:' + draft.value.id : selectedLocalForm.value ? 'local:' + draft.value.id : starterSelection.value)
type FormChoice = { key: string; label: string; meta: string; disabled: boolean; templateId?: string } & (
  { kind: 'starter'; starter: ReportingStarter } | { kind: 'source'; source: IntranetForm } |
  { kind: 'server'; server: ServerFormTemplate } | { kind: 'local'; local: FormTemplate })
const formChoices = computed(() => {
  const starters: { starter: ReportingStarter; label: string }[] = [
    { starter: 'committee', label: 'Corrected Committee inspection' }, { starter: 'bbs', label: 'BBS Observation' },
    { starter: 'general-visit', label: 'General Site Visit' }, { starter: 'near-miss', label: 'Near Miss / Safety Observation' },
  ]
  const rows: FormChoice[] = starters.map(item => ({ ...item, key: 'starter:' + item.starter, kind: 'starter', meta: 'Starter', disabled: creationLocked.value }))
  if (auth.rawRole === 'admin') rows.push(...suppliedStarters.value.map(source => ({ key: 'source:' + source.id, label: source.title + ' draft', meta: 'Starter', disabled: creationLocked.value, kind: 'source' as const, source })))
  if (serverEnabled) rows.push(...serverTemplates.value.map(server => ({ key: 'server:' + server.id, templateId: server.id, label: server.draft.title, meta: server.archived ? 'Archived' : server.latestVersion ? 'Published' : 'Draft', disabled: serverBusy.value || !!publishPhase.value, kind: 'server' as const, server })))
  else rows.push(...library.value.templates.map(local => ({ key: 'local:' + local.id, templateId: local.id, label: local.title, meta: local.archived ? 'Archived' : local.versions.length ? 'Published' : 'Draft', disabled: blocked.value, kind: 'local' as const, local })))
  return alphabetizeFormChoices(rows)
})
async function chooseForm(key: string) {
  const choice = formChoices.value.find(item => item.key === key)
  if (!choice || choice.disabled) return
  if (choice.kind === 'starter') await create(choice.starter)
  else if (choice.kind === 'source') await create(choice.source)
  else if (choice.kind === 'server') await selectServer(choice.server)
  else await select(choice.local)
}
const publishedChanges = computed(() => {
  if (!draft.value) return []
  const previous = serverTemplates.value.find(
    (template) => template.id === draft.value!.id,
  )?.definition
  if (!previous) return ['First published version; no existing version to compare.']
  const changes: string[] = []
  for (const key of [
    'title',
    'description',
    'recipients',
    'recipientGroups',
    'access',
    'output',
  ] as const)
    if (JSON.stringify(previous[key] ?? null) !== JSON.stringify(draft.value[key] ?? null))
      changes.push(key + ' changed')
  const current = draft.value.fields
  for (const field of previous.fields) {
    const next = current.find((item) => item.id === field.id)
    if (!next) changes.push('Removed question: ' + field.label + ' (retained in old entries)')
    else if (JSON.stringify(next) !== JSON.stringify(field))
      changes.push('Changed question: ' + field.label)
  }
  for (const field of current)
    if (!previous.fields.some((item) => item.id === field.id))
      changes.push('Added question: ' + field.label)
  if (
    previous.fields.map((field) => field.id).join(',') !==
    current.map((field) => field.id).join(',')
  )
    changes.push('Question order changed')
  return changes.length ? changes : ['No definition changes from the published version.']
})
function addMatrixRow(field: FormField) {
  if ((field.rows?.length || 0) >= 30) return
  ;(field.rows ||= []).push({ id: crypto.randomUUID(), label: 'Statement' })
}
const selectedField = computed(() =>
  draft.value?.fields.find((field) => field.id === selection.value),
)
const builderRoot = ref<HTMLElement>()
const creationLocked = computed(
  () => blocked.value || serverBusy.value || !!publishPhase.value || (serverEnabled && !serverAvailable.value),
)
const authoringLocked = computed(
  () =>
    blocked.value ||
    serverBusy.value ||
    !!publishPhase.value ||
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
    const result = await adminTemplateCommand('duplicate', {
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
  await persistence.importDeviceDraft(legacyImportId.value)
}
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
function correctCommitteeDraft() {
  if (!draft.value || authoringLocked.value) return
  draft.value = applyApprovedCommitteeCorrections(draft.value)
  authoring.select(draft.value.fields[0]?.id || '')
  message.value = 'Removed the obsolete Committee fields from this draft. Date of Inspection and prior versions are retained. Save and publish separately after reviewing the draft.'
  settingsTab.value = 'output'
}
async function create(audit: boolean | ReportingStarter | IntranetForm = false) {
  const owner = uid.value
  if (blocked.value) return
  if (typeof audit === 'object' && (auth.rawRole !== 'admin' || creationLocked.value)) return
  if (
    dirty.value &&
    !(await confirmation.value?.ask({
      title: 'Discard unsaved form edits?',
      message: 'Create a new form without saving these edits.',
      confirmLabel: 'Discard edits',
    }))
  )
    return
  if (uid.value !== owner) return
  pointerDrag.cancel()
  try {
    draft.value = typeof audit === 'object' ? suppliedReportStarter(audit) :
      typeof audit === 'string' ? reportingStarter(audit) : audit ? committeeAudit() : newTemplate()
  } catch (caught) { error.value = (caught as Error).message; return }
  starterSelection.value = typeof audit === 'string' ? 'starter:' + audit : typeof audit === 'object' ? 'source:' + audit.id : ''
  // Source starters are reproducible initial content, just like the blank shell.
  // Establish their baseline now; subsequent user edits still require confirmation.
  authoring.reset()
  preview.value = false
  if (typeof audit === 'object') {
    await nextTick()
    settingsTab.value = 'form'
    message.value = 'Prepared an unsaved Admin-only draft. Review fields, audience and delivery before saving or publishing. No notification was sent.'
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
  if (kind !== 'matrix') delete field.rows
  if (kind !== 'repeat') {
    delete field.fields
    delete field.minInstances
    delete field.maxInstances
  }
  if (kind === 'matrix' && !field.rows?.length)
    field.rows = [{ id: crypto.randomUUID(), label: 'Statement' }]
  if (kind === 'repeat' && !field.fields?.length)
    Object.assign(field, {
      fields: [newField('text', 'Site visited')],
      minInstances: 1,
      maxInstances: 20,
    })
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
  if (serverBusy.value || publishPhase.value) return false
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
  if (dirty.value || serverBusy.value || publishPhase.value) {
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
      focusInspector()
      fieldsExpanded.value = false
      formActionsExpanded.value = false
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
          <small
            >{{ dirty ? 'Unsaved edits' : draft && !serverTemplates.some(item => item.id === draft?.id) && !library.templates.some(item => item.id === draft?.id) ? 'New form - no edits' : 'Draft saved' }} ·
            {{ localPreview ? 'Local preview' : 'Forms' }}</small
          >
        </div>
        <nav aria-label="Builder modes">
          <button
            :aria-pressed="!entriesMode && !preview && settingsTab !== 'output'"
            @click="
              ((entriesMode = false),
              (preview = false),
              (settingsTab = selection ? 'field' : 'form'))
            "
          >
            Edit</button
          ><button
            :aria-pressed="!entriesMode && preview && settingsTab !== 'output'"
            @click="((entriesMode = false), (preview = true), (settingsTab = 'form'))"
          >
            Preview</button
          ><button
            aria-label="Publishing settings"
            title="Audience, delivery and publishing checks"
            :aria-pressed="!entriesMode && settingsTab === 'output'"
            @click="openPublishing"
          >
            Publishing
          </button>
          <button
            :disabled="!serverEnabled || !draft"
            :aria-pressed="entriesMode"
            @click="entriesMode = true"
          >
            View Entries
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
              :aria-label="localPreview ? 'Save to local server' : 'Save to server'"
            >
              Save draft</button
            ><button
                v-if="settingsTab === 'output'"
                :disabled="serverBusy || !!publishPhase || !serverAvailable || !draft || draft.archived || localPreview"
                :title="localPreview ? 'Publishing is disabled in this local preview.' : undefined"
              @click="issueServer"
            >
              {{ publishPhase === 'saving' ? 'Saving draft…' : publishPhase === 'publishing' ? 'Publishing…' : 'Publish' }}
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
            ><span>{{ dirty ? 'Unsaved edits' : 'Saved draft' }}</span>
          </div>
          <details class="builder-library-tools" :open="!!sourcesError">
            <summary>Library tools</summary><div class="builder-library-menu">          <PrivateReferenceStatus v-if="auth.rawRole === 'admin'" :loading="sourcesLoading" :error="sourcesError" :notice="sourceNotice" :packages="sourcePackages" :selected="sourcePackage" @select="selectSource" @retry="reloadSources" @cancel="cancelSource" />
          <div class="library-tools-content">
            <p v-if="!serverEnabled && !library.templates.length">No saved forms yet. Choose a starter or New form.</p>
            <section v-if="serverEnabled" aria-label="Server form library">
              <div class="library-utilities"><button class="library-refresh" aria-label="Refresh server library" title="Refresh server library" :disabled="serverBusy" @click="loadServer"><i class="pi pi-refresh" aria-hidden="true" /> Refresh forms</button></div>
              <details v-if="library.templates.length">
                <summary>Import an existing device draft</summary>
                <p>Creates a new server draft. Device versions stay on this device and are not merged with server history.</p>
                <label>Device draft to import<select v-model="legacyImportId" aria-label="Device draft to import"><option value="">Choose a device draft</option><option v-for="item in library.templates.filter((item) => !item.archived)" :key="item.id" :value="item.id">{{ item.title }}</option></select></label>
                <button :disabled="!legacyImportId || !serverAvailable || serverBusy || dirty" @click="importDeviceDraft">Import as new server draft</button>
              </details>
            </section>
          </div>
</div>
          </details>
        </div>
      </header>
      <p v-if="legacyError" role="alert">{{ legacyError }}</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="message && !preview" role="status">{{ message }}</p>
      <BuilderPanelSwitcher v-if="!entriesMode && !preview" v-model="activePane" outline-label="Forms" outline-controls="form-library" canvas-controls="form-canvas-pane" inspector-controls="form-inspector" />
      <FormEntriesView v-if="entriesMode && draft" :template-id="draft.id" />
      <FormDefinitionPreview v-else-if="preview && draft" class="builder-full-preview" :definition="draft" />
      <div v-else class="builder-layout" :data-active-pane="activePane">
        <aside id="form-library" class="builder-sidebar" aria-label="Form library">
          <FormSelectorList :options="formChoices" :selected-key="selectedFormKey" :create-disabled="creationLocked" @create="create()" @select="chooseForm" />
        </aside>
        <section v-if="draft" aria-label="Form editor">
          <BuilderSelectionContext kind="Form" :scope="draft.title" />
          <div class="authoring-panels">
            <FormCanvasViewport id="form-canvas-pane" :device="previewDevice"
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
              <fieldset
                class="canvas-panel"
                :disabled="authoringLocked"
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
                    @click="selectCanvasField(field.id)"
                    @keydown.enter.self="selectCanvasField(field.id)"
                    @keydown.space.self.prevent="
                      selectCanvasField(field.id)
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
            <aside id="form-inspector" ref="inspectorPane" class="inspector-panel" aria-label="Form inspector" tabindex="-1">
              <BuilderEditingTools add-label="Add fields" :add-expanded="fieldsExpanded" add-controls="form-field-palette" :add-disabled="authoringLocked" action-label="Form actions" :action-expanded="formActionsExpanded" action-controls="form-actions-panel" :action-disabled="serverBusy || !!publishPhase || (!selectedServerForm && !selectedLocalForm)" @add="fieldsExpanded = !fieldsExpanded" @actions="formActionsExpanded = !formActionsExpanded" />
              <section v-if="selectedServerForm || selectedLocalForm" v-show="formActionsExpanded" id="form-actions-panel" class="builder-form-actions__content" aria-label="Form actions">
                  <p v-if="selectedServerForm" class="builder-context-meta">Published version: {{ selectedServerForm.latestVersion || 'None' }} · Draft revision: {{ selectedServerForm.revision }}</p>
                  <p v-else-if="selectedLocalForm" class="builder-context-meta">{{ selectedLocalForm.versions.length }} retained versions on this device.</p>

              <template v-if="selectedServerForm">
                <FormShareLinks :template="selectedServerForm" />
                <RouterLink v-if="selectedServerForm.latestVersion && !selectedServerForm.archived && selectedServerForm.definition?.access?.respondents !== 'public'" :to="'/forms/' + selectedServerForm.id" class="library-open" aria-label="Open authenticated form"><i class="pi pi-external-link" aria-hidden="true" />Open signed-in form</RouterLink>
                <button :disabled="serverBusy || !!publishPhase || !serverAvailable || selectedServerForm.archived || dirty" class="library-action" aria-label="Duplicate server form" @click="duplicateServer(selectedServerForm)"><i class="pi pi-copy" aria-hidden="true" />Duplicate</button>
                <button :disabled="serverBusy || !!publishPhase || !serverAvailable || selectedServerForm.archived" class="library-action" aria-label="Remove or archive server form" @click="removeServer(selectedServerForm)"><i class="pi pi-inbox" aria-hidden="true" />{{ selectedServerForm.latestVersion || selectedServerForm.used ? 'Archive' : 'Delete' }}</button>
              </template>
              <template v-else-if="selectedLocalForm">
                <button class="library-action" :disabled="selectedLocalForm.archived || blocked" @click="duplicate(selectedLocalForm)"><i class="pi pi-copy" aria-hidden="true" />Duplicate</button>
                <button class="library-action" :disabled="selectedLocalForm.archived || blocked" @click="remove(selectedLocalForm)"><i :class="['pi', selectedLocalForm.versions.length ? 'pi-inbox' : 'pi-trash']" aria-hidden="true" />{{ selectedLocalForm.versions.length ? 'Archive' : 'Delete' }}</button>
              </template>

                </section>
              <fieldset class="inspector-fields" :disabled="authoringLocked">
              <section
            v-if="draft && !preview"
            v-show="fieldsExpanded"
            id="form-field-palette"
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
                  @click="add(kind); fieldsExpanded = false"
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
                        repeat: 'pi-clone',
                        matrix: 'pi-table',
                        recipients: 'pi-envelope',
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

              <BuilderSettingsTabs v-model="settingsTab" class="settings-tabs" label="Form settings" id-prefix="form-settings" :disabled="authoringLocked" :tabs="[{ id: 'form', label: 'Form' }, { id: 'field', label: 'Field', disabled: !selectedField }, { id: 'output', label: 'Publishing' }]" />
              <section v-show="settingsTab === 'form'" id="form-settings-panel-form" role="tabpanel" aria-labelledby="form-settings-tab-form" aria-label="Form settings">
                <div v-if="committeeFieldsToRemove(draft).length">
                  <p>This Committee draft still contains obsolete fields. The correction removes Site Safety assistant and the closing Signature/Date while retaining Date of Inspection, all other wording and existing access/output settings. Published versions and submissions are unchanged.</p>
                  <button type="button" @click="correctCommitteeDraft">Apply approved Committee field removals</button>
                </div>
                <label>Form title<input v-model="draft.title" maxlength="160" /></label
                ><label>Description<textarea v-model="draft.description" class="form-description-editor" /></label
                ><label
                  >Recipients<input
                    v-model="recipientText"
                    placeholder="name@example.com, another@example.com"
                /></label>
                <p>
                  {{
                    localPreview
                      ? 'Recipients are configuration only in this local preview; no email is sent.'
                      : 'Submitted forms email these recipients. Recipient addresses do not grant access to private submissions.'
                  }}
                </p>
                <p>
                  Drag a field onto the ordered canvas, or click Add to append. Select a field for
                  its inspector. Move buttons provide keyboard ordering.
                </p>
              </section>
              <div v-if="settingsTab === 'output'" id="form-settings-panel-output" role="tabpanel" aria-labelledby="form-settings-tab-output">
              <section aria-label="Publishing checks">
                <h2>Publishing checks</h2>
                <details><summary>Changes since publication</summary>
                <ul>
                  <li v-for="change in publishedChanges" :key="change">{{ change }}</li>
                </ul>
                </details>
                <p>
                  {{
                    definitionErrors(draft).length
                      ? 'Resolve these checks before publishing.'
                      : 'Definition checks passed.'
                  }}
                </p>
                <ul v-if="definitionErrors(draft).length">
                  <li v-for="issue in definitionErrors(draft)" :key="issue">{{ issue }}</li>
                </ul>
                <p>
                  Current published version:
                  {{
                    serverTemplates.find((template) => template.id === draft?.id)?.latestVersion ||
                    'None'
                  }}. Publish saves this draft first. Existing entries keep their original version.
                </p>
              </section>
              <FormOutputSettings
                :definition="draft"
                :template-id="draft.id"
                @update:definition="Object.assign(draft, $event)"
              />
              </div>
              <section
                v-if="selectedField && !preview"
                v-show="settingsTab === 'field'"
                id="form-settings-panel-field"
                role="tabpanel"
                aria-labelledby="form-settings-tab-field"
                aria-label="Field inspector"
                class="field-inspector"
              >
                <BuilderSelectionContext kind="Field" :scope="selectedField.label" />
                <label
                  >Selected field label<input v-model="selectedField.label" maxlength="1000"
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
                <section v-if="selectedField.kind === 'matrix'">
                  <h3>Matrix statements</h3>
                  <label v-for="row in selectedField.rows" :key="row.id"
                    >Statement<input v-model="row.label" maxlength="1000" /><button
                      type="button"
                      @click="
                        selectedField.rows = selectedField.rows?.filter(
                          (item) => item.id !== row.id,
                        )
                      "
                    >
                      Remove statement
                    </button></label
                  >
                  <button type="button" @click="addMatrixRow(selectedField)">Add statement</button>
                </section>
                <section v-if="selectedField.kind === 'repeat'">
                  <label
                    >Minimum groups<input
                      v-model.number="selectedField.minInstances"
                      type="number"
                      min="1"
                      max="20"
                  /></label>
                  <label
                    >Maximum groups<input
                      v-model.number="selectedField.maxInstances"
                      type="number"
                      min="1"
                      max="20"
                  /></label>
                  <div v-for="(child, childIndex) in selectedField.fields" :key="child.id">
                    <label>Group field label<input v-model="child.label" maxlength="1000" /></label>
                    <label
                      >Type<select
                        :value="child.kind"
                        @change="
                          changeFieldKind(
                            child,
                            ($event.target as HTMLSelectElement).value as FormFieldKind,
                          )
                        "
                      >
                        <option
                          v-for="kind in fieldKinds.filter((kind) => kind !== 'repeat')"
                          :key="kind"
                        >
                          {{ kind }}
                        </option>
                      </select></label
                    >
                    <label><input v-model="child.required" type="checkbox" />Required</label>
                    <section v-if="child.kind === 'matrix'">
                      <label v-for="row in child.rows" :key="row.id"
                        >Statement<input v-model="row.label" maxlength="1000" />
                        <button
                          type="button"
                          @click="child.rows = child.rows?.filter((item) => item.id !== row.id)"
                        >
                          Remove statement
                        </button>
                      </label>
                      <button type="button" @click="addMatrixRow(child)">Add statement</button>
                    </section>
                    <button
                      type="button"
                      :disabled="childIndex === 0"
                      @click="moveGroupField(selectedField, child.id, childIndex - 1)"
                    >
                      Move group field up
                    </button>
                    <button
                      type="button"
                      :disabled="childIndex === (selectedField.fields?.length || 0) - 1"
                      @click="moveGroupField(selectedField, child.id, childIndex + 1)"
                    >
                      Move group field down
                    </button>
                    <label>Help text<input v-model="child.hint" maxlength="1000" /></label>
                    <label v-if="optionFieldKinds.includes(child.kind)"
                      >Options<textarea
                        :value="child.options.join('\n')"
                        @input="
                          child.options = ($event.target as HTMLTextAreaElement).value.split('\n')
                        "
                      />
                    </label>
                    <button
                      type="button"
                      @click="
                        selectedField.fields = selectedField.fields?.filter(
                          (field) => field.id !== child.id,
                        )
                      "
                    >
                      Remove group field
                    </button>
                  </div>
                  <button
                    type="button"
                    @click="(selectedField.fields ||= []).push(newField('text'))"
                  >
                    Add group field
                  </button>
                </section>
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
            </aside>
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
  .field-palette {
    grid-row: 2;
    position: sticky;
    top: 0;
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
.settings-tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
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
    flex: 1 0 100%;
    justify-content: space-between;
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
.inspector-fields { border: 0; border-radius: 0; margin: 0; padding: 0; min-width: 0; }
.inspector-panel { overflow-anchor: none; }
.inspector-panel:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.inspector-panel .field-palette { position: static; padding: .5rem 0 .75rem; margin: 0; }
.builder-library-tools summary { cursor: pointer; padding: .4rem .5rem; border: 1px solid var(--border); border-radius: .35rem; font-size: .8rem; }
.builder-form-actions__content { display: grid; gap: .5rem; padding: .75rem 0; }
.builder-context-meta { color: var(--text-muted); font-size: .8rem; }
.builder-library-tools { position: relative; }
.builder-library-menu { position: absolute; right: 0; top: calc(100% + .35rem); z-index: 30; width: min(22rem, calc(100vw - 2rem)); max-height: min(28rem, 70vh); overflow: auto; padding: .85rem; border: 1px solid var(--border); border-radius: .5rem; background: var(--surface); box-shadow: var(--shadow); }
.form-builder .builder-sidebar { display: flex; flex-direction: column; overflow: hidden; }
.form-builder .builder-sidebar :deep(.form-selector) { flex: 1; }
@media (max-width: 760px) { .form-builder .builder-sidebar { width: 100%; box-sizing: border-box; height: 12rem; max-height: 12rem; position: static; } }
.builder-full-preview { flex: 1; min-height: 0; overflow: auto; box-sizing: border-box; padding: .9rem; }
.form-builder .inspector-panel textarea.form-description-editor { height: calc(4lh + 36px); resize: vertical; }
@media (max-width: 760px) { .builder-full-preview { padding: .75rem; } }
@media (max-width: 760px) {
  .builder-layout {
    scroll-padding-top: 13rem;
  }
  .canvas-viewport {
    scroll-margin-top: 13rem;
  }
}
@media (max-width: 900px) {
  .form-builder .builder-layout { display: block; flex: 1; min-height: 0; overflow: hidden; scroll-padding: 0; }
  .form-builder .builder-sidebar { position: static; width: 100%; height: 100%; max-height: none; padding: .6rem !important; }
  .form-builder .builder-layout > section[aria-label='Form editor'] { height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
  .form-builder .authoring-panels { display: block; flex: 1; min-height: 0; height: 100%; overflow: hidden; }
  .form-builder .canvas-viewport { height: 100%; min-height: 0; scroll-margin: 0; }
  .form-builder .form-canvas { max-height: none; }
  .form-builder .inspector-panel { height: 100%; max-height: none; box-sizing: border-box; overflow: auto; padding: .75rem; }
  .form-builder .builder-layout:not([data-active-pane='outline']) > .builder-sidebar,
  .form-builder .builder-layout[data-active-pane='outline'] > section[aria-label='Form editor'],
  .form-builder .builder-layout:not([data-active-pane='preview']) .canvas-viewport,
  .form-builder .builder-layout:not([data-active-pane='inspector']) .inspector-panel { display: none; }
}
</style>

<style src="../styles/form-builder.css"></style>
