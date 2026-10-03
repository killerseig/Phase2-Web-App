<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  RouterLink,
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
  useRoute,
  useRouter,
} from 'vue-router'
import AppShell from '@/layouts/AppShell.vue'
import BuilderConfirmDialog from '@/components/builder/BuilderConfirmDialog.vue'
import BuilderPanelResize from '@/components/builder/BuilderPanelResize.vue'
import SharedDashboardCanvas from '@/components/dashboard/SharedDashboardCanvas.vue'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'
import { sharedDashboardCommand } from '@/services/sharedDashboards'
import { dashboardError } from '@/services/dashboard'
import { formApi, type ServerFormTemplate } from '@/services/forms'
import { CURRENT_EDITABLE_USER_ROLE_KEYS, CURRENT_ROLE_LABELS } from '@/auth/roles'
import { getRoleDashboardJobShortcuts } from '@/features/dashboard/roleDashboardJobShortcuts'
import {
  sharedWidgetLabels,
  sharedWidgetTypes,
  newSharedWidget,
  type SharedDashboardWidget,
  type SharedDashboardLayout,
  type SharedDashboardScope,
} from '@/features/dashboard/sharedDashboards'
import { useWidgetDrag, type WidgetDrop } from '@/features/dashboard/useWidgetDrag'
import type { RawRoleKey } from '@/types/domain'
import { dashboardTextVariables, resolveDashboardText } from '@/features/dashboard/sharedText'
import type { SharedCalendarEntry } from '@/features/dashboard/sharedDashboards'
import '@/styles/shared-dashboards.css'
const auth = useAuthStore(),
  jobsStore = useJobsStore(),
  route = useRoute(),
  router = useRouter()
const scope = computed<SharedDashboardScope>(() =>
  route.name === 'shared-role-home' ? 'role' : 'job',
)
const jobId = computed(() => (typeof route.params.jobId === 'string' ? route.params.jobId : ''))
const role = ref<RawRoleKey>(auth.rawRole),
  layout = ref<SharedDashboardLayout>(),
  widgets = ref<SharedDashboardWidget[]>([])
const loading = ref(true),
  busy = ref(false),
  editing = ref(false),
  error = ref(''),
  message = ref(''),
  selected = ref(''),
  allowRoleEditing = ref(false)
const saved = ref(''),
  paletteWidth = ref(240),
  inspectorWidth = ref(300),
  device = ref<'desktop' | 'tablet' | 'phone'>('desktop'),
  fit = ref(true),
  zoom = ref(1)
const root = ref<HTMLElement>(),
  viewport = ref<HTMLElement>(),
  content = ref<HTMLElement>(),
  viewportWidth = ref(1100),
  contentHeight = ref(700)
const confirm = ref<InstanceType<typeof BuilderConfirmDialog>>(),
  canvas = ref<InstanceType<typeof SharedDashboardCanvas>>()
const forms = ref<ServerFormTemplate[]>([]),
  formsError = ref('')
const isAdmin = computed(() => auth.rawRole === 'admin'),
  canEdit = computed(() => auth.hasWorkspaceAccess && !!layout.value?.canEdit)
const snapshot = () =>
  JSON.stringify({ widgets: widgets.value, allowRoleEditing: allowRoleEditing.value })
const dirty = computed(() => !!saved.value && snapshot() !== saved.value)
const requiredType = computed(() => (scope.value === 'job' ? 'workflows' : 'jobs'))
const selectedWidget = computed(() => widgets.value.find((widget) => widget.id === selected.value))
const assigned = computed(() => [
  ...auth.assignedJobIds,
  ...jobsStore.jobs
    .filter((job) => job.assignedForemanIds?.includes(auth.currentUser?.uid || ''))
    .map((job) => job.id),
])
const visibleJobs = computed(() => {
  const ids = new Set(
    getRoleDashboardJobShortcuts({
      rawRole: auth.rawRole,
      assignedJobIds: assigned.value,
      jobs: jobsStore.jobs,
    }).map((job) => job.id),
  )
  return jobsStore.jobs.filter((job) => ids.has(job.id))
})
const palette = computed(() => sharedWidgetTypes(scope.value))
const textContext = computed(() => ({
  job: layout.value?.job ? { ...layout.value.job } : null,
  user: { name: auth.displayName, role: CURRENT_ROLE_LABELS[auth.rawRole] },
}))
const textInput = ref<HTMLTextAreaElement>()
const textResult = computed(() =>
  resolveDashboardText(selectedWidget.value?.text || '', textContext.value),
)
function insertVariable(key: string) {
  const widget = selectedWidget.value
  if (widget?.type !== 'text') return
  const input = textInput.value,
    start = input?.selectionStart ?? widget.text.length,
    end = input?.selectionEnd ?? start,
    token = '{{ ' + key + ' }}'
  widget.text = widget.text.slice(0, start) + token + widget.text.slice(end)
  void nextTick(() => {
    input?.focus()
    input?.setSelectionRange(start + token.length, start + token.length)
  })
}
function setTextStyle(key: string, value: string | number) {
  const widget = selectedWidget.value
  if (widget?.type !== 'text') return
  widget.textStyle = {
    size: 24,
    color: '#142e3e',
    weight: 400,
    align: 'left',
    lineHeight: 1.5,
    ...widget.textStyle,
    [key]: value,
  }
}
const pageTitle = computed(() =>
  scope.value === 'role' ? `${CURRENT_ROLE_LABELS[role.value]} home` : 'Job home',
)
const previewWidth = computed(() =>
  device.value === 'phone' ? 390 : device.value === 'tablet' ? 820 : 1100,
)
const previewScale = computed(() =>
  fit.value
    ? Math.min(1, Math.max(0.15, (viewportWidth.value - 24) / previewWidth.value))
    : zoom.value,
)
let generation = 0,
  observer: ResizeObserver | undefined,
  restoring = false
const undo = ref<string[]>([]),
  redo = ref<string[]>([])
watch(
  snapshot,
  (value, previous) => {
    if (!editing.value || restoring) return
    undo.value.push(previous)
    if (undo.value.length > 100) undo.value.shift()
    redo.value = []
  },
  { flush: 'sync' },
)
function restore(value: string) {
  restoring = true
  const state = JSON.parse(value)
  widgets.value = state.widgets
  allowRoleEditing.value = state.allowRoleEditing
  restoring = false
  selected.value = widgets.value.some((w) => w.id === selected.value)
    ? selected.value
    : widgets.value[0]?.id || ''
}
function undoChange() {
  const value = undo.value.pop()
  if (value) {
    redo.value.push(snapshot())
    restore(value)
  }
}
function redoChange() {
  const value = redo.value.pop()
  if (value) {
    undo.value.push(snapshot())
    restore(value)
  }
}
type Payload = { kind: 'new'; type: SharedDashboardWidget['type'] } | { kind: 'move'; id: string }
const drag = useWidgetDrag<Payload>({
  root,
  disabled: () => !editing.value || busy.value || !canEdit.value,
  drop,
})
const { dragging, point, label } = drag
function canAdd(type: SharedDashboardWidget['type']) {
  return (
    widgets.value.length < 12 &&
    (['notes', 'text', 'form'].includes(type) || !widgets.value.some((w) => w.type === type))
  )
}
function drop(payload: Payload, destination: WidgetDrop) {
  if (!editing.value || busy.value || !canEdit.value) return
  const at =
    destination.beforeId === null
      ? widgets.value.length
      : widgets.value.findIndex((w) => w.id === destination.beforeId)
  if (at < 0) return
  if (payload.kind === 'new') {
    if (!canAdd(payload.type)) return
    const widget = newSharedWidget(payload.type)
    widget.title = sharedWidgetLabels[payload.type]
    widgets.value.splice(at, 0, widget)
    selected.value = widget.id
  } else {
    const from = widgets.value.findIndex((w) => w.id === payload.id)
    if (from < 0 || from === at) return
    const [w] = widgets.value.splice(from, 1)
    widgets.value.splice(at > from ? at - 1 : at, 0, w!)
    selected.value = w!.id
  }
}
function add(type: SharedDashboardWidget['type']) {
  drop(
    { kind: 'new', type },
    { beforeId: null, overId: null, edge: 'after', surface: 'shared-dashboard' },
  )
}
function move(direction: number) {
  const from = widgets.value.findIndex((w) => w.id === selected.value),
    to = from + direction
  if (from < 0 || to < 0 || to >= widgets.value.length) return
  const [w] = widgets.value.splice(from, 1)
  widgets.value.splice(to, 0, w!)
}
async function remove() {
  const widget = selectedWidget.value
  if (!widget || widget.type === requiredType.value) return
  if (
    await confirm.value?.ask({
      title: 'Remove widget?',
      message:
        'This changes the shared layout. Stored job notes, documents and form submissions are retained.',
      confirmLabel: 'Remove',
      destructive: true,
    })
  ) {
    widgets.value = widgets.value.filter((w) => w.id !== widget.id)
    selected.value = widgets.value[0]?.id || ''
  }
}
async function prepare() {
  if (busy.value) return false
  if (!((await canvas.value?.prepareForms()) ?? true)) return false
  if (dirty.value || canvas.value?.notesDirty) {
    if (
      !(await confirm.value?.ask({
        title: 'Discard unsaved changes?',
        message:
          'Your unsaved layout, notes or calendar edits will be discarded. Saved records remain.',
        confirmLabel: 'Discard changes',
        destructive: true,
      }))
    )
      return false
    canvas.value?.discardNotes()
  }
  return true
}
function context() {
  return {
    scope: scope.value,
    ...(scope.value === 'job' ? { jobId: jobId.value } : { role: role.value }),
  }
}
async function load() {
  const request = ++generation
  drag.cancel()
  loading.value = true
  editing.value = false
  error.value = ''
  message.value = ''
  layout.value = undefined
  widgets.value = []
  saved.value = ''
  undo.value = []
  redo.value = []
  try {
    const result = await sharedDashboardCommand('load', context())
    if (request !== generation) return
    layout.value = result
    widgets.value = JSON.parse(JSON.stringify(result.widgets))
    allowRoleEditing.value = result.allowRoleEditing
    saved.value = snapshot()
    selected.value = widgets.value[0]?.id || ''
  } catch (reason) {
    if (request === generation) error.value = dashboardError(reason)
  } finally {
    if (request === generation) loading.value = false
  }
}
async function reload() {
  if (await prepare()) await load()
}
async function beginEdit() {
  if (!canEdit.value || loading.value || !(await prepare())) return
  editing.value = true
  fit.value = true
  message.value = ''
  undo.value = []
  redo.value = []
  formsError.value = ''
  if (
    palette.value.includes('form') &&
    ['admin', 'project-manager', 'foreman', 'shop-foreman'].includes(auth.rawRole)
  ) {
    const request = generation
    try {
      const response = await formApi<{ templates: ServerFormTemplate[] }>('formTemplates', {
        action: 'list',
      })
      if (request === generation)
        forms.value = response.templates.filter((form) => form.latestVersion && !form.archived)
    } catch (reason) {
      if (request === generation) formsError.value = dashboardError(reason)
    }
  }
}
async function cancel() {
  if (!(await prepare())) return
  drag.cancel()
  restore(saved.value)
  editing.value = false
  error.value = ''
  undo.value = []
  redo.value = []
}
async function save() {
  if (!canEdit.value || busy.value || !layout.value) return
  busy.value = true
  error.value = ''
  drag.cancel()
  const request = generation
  try {
    const result = await sharedDashboardCommand('save-template', {
      ...context(),
      version: layout.value.version,
      widgets: JSON.parse(JSON.stringify(widgets.value)),
      ...(scope.value === 'role' && isAdmin.value
        ? { allowRoleEditing: allowRoleEditing.value }
        : {}),
    })
    if (request !== generation) return
    layout.value = result
    widgets.value = JSON.parse(JSON.stringify(result.widgets))
    allowRoleEditing.value = result.allowRoleEditing
    saved.value = snapshot()
    editing.value = false
    message.value =
      scope.value === 'job'
        ? 'Template saved for all jobs.'
        : 'Template saved for everyone in this role.'
  } catch (reason) {
    if (request === generation) error.value = dashboardError(reason)
  } finally {
    if (request === generation) busy.value = false
  }
}
const canEditContent = computed(() =>
  scope.value === 'job' ? isAdmin.value && !!layout.value?.job : role.value === auth.rawRole,
)
async function saveContent(
  action: 'save-notes' | 'save-calendar',
  payload: Record<string, unknown>,
) {
  if (!canEditContent.value || busy.value || !layout.value) return
  busy.value = true
  error.value = ''
  const request = generation
  try {
    const result = await sharedDashboardCommand<{
      version: number
      notes: Record<string, string>
      events: SharedCalendarEntry[]
    }>(action, { ...context(), version: layout.value.notesVersion, ...payload })
    if (request !== generation) return
    layout.value.notes = result.notes
    layout.value.events = result.events
    layout.value.notesVersion = result.version
    canvas.value?.finishNote()
    message.value = scope.value === 'job' ? 'Saved for this job.' : 'Saved for your account.'
  } catch (reason) {
    if (request === generation) error.value = dashboardError(reason)
  } finally {
    if (request === generation) busy.value = false
  }
}
function saveNote(id: string, text: string) {
  void saveContent('save-notes', { widgetId: id, text })
}
function saveCalendar(events: SharedCalendarEntry[]) {
  void saveContent('save-calendar', { events })
}
async function changeRole(event: Event) {
  const select = event.target as HTMLSelectElement
  if (!(await prepare())) {
    select.value = role.value
    return
  }
  role.value = select.value as RawRoleKey
  await load()
  if (canEdit.value) await beginEdit()
}
async function changeJob(event: Event) {
  const select = event.target as HTMLSelectElement
  await router.push({
    name: 'shared-job-home',
    params: select.value ? { jobId: select.value } : {},
  })
  select.value = jobId.value
}
function selectForm(event: Event) {
  const widget = selectedWidget.value,
    form = forms.value.find((f) => f.id === (event.target as HTMLSelectElement).value)
  if (!widget || !form) return
  widget.form = {
    templateId: form.id,
    version: form.latestVersion,
    presentation: widget.form?.presentation || 'launcher',
  }
}
function manualZoom(delta: number) {
  zoom.value = Math.max(0.25, Math.min(2, previewScale.value + delta))
  fit.value = false
}
function keydown(event: KeyboardEvent) {
  if (
    !editing.value ||
    busy.value ||
    (event.target as HTMLElement).closest('input,select,textarea,[contenteditable]')
  )
    return
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    event.shiftKey ? redoChange() : undoChange()
  }
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value || busy.value || canvas.value?.notesDirty) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onBeforeRouteLeave(prepare)
onBeforeRouteUpdate(prepare)
watch(
  [scope, jobId, () => auth.currentUser?.uid, () => auth.rawRole, () => auth.hasWorkspaceAccess],
  () => {
    generation++
    busy.value = false
    role.value = auth.rawRole
    void load()
  },
)
async function syncDocumentJob() {
  if (scope.value === 'job' && jobId.value && route.query.sdsJob !== jobId.value)
    await router.replace({ query: { ...route.query, sdsJob: jobId.value } })
  else if (scope.value === 'role' && route.query.sdsJob !== undefined) {
    const query = { ...route.query }
    delete query.sdsJob
    await router.replace({ query })
  }
}
watch([scope, jobId], () => void syncDocumentJob())
onMounted(async () => {
  void jobsStore.subscribeVisibleJobs()
  await syncDocumentJob()
  void load()
  observer = new ResizeObserver(() => {
    viewportWidth.value = viewport.value?.clientWidth || 1100
    contentHeight.value = content.value?.offsetHeight || 700
  })
  await nextTick()
  if (viewport.value) observer.observe(viewport.value)
  if (content.value) observer.observe(content.value)
  window.addEventListener('beforeunload', beforeUnload)
})
onBeforeUnmount(() => {
  generation++
  observer?.disconnect()
  window.removeEventListener('beforeunload', beforeUnload)
})
</script>
<template>
  <AppShell :contained="editing" :compact="editing">
    <section
      ref="root"
      class="shared-dashboard"
      :class="{ 'is-editing': editing }"
      :aria-label="scope === 'job' ? 'Shared job dashboard' : 'Shared role home'"
      @click.capture="drag.guardClick"
      @keydown="keydown"
    >
      <header class="shared-dashboard-header" :class="{ 'builder-controls': editing }">
        <div>
          <p class="shared-dashboard-eyebrow">{{ scope === 'job' ? 'Job home' : 'Role home' }}</p>
          <h1>{{ pageTitle }}</h1>
          <p>
            {{
              scope === 'job'
                ? 'Your job tools and information in one place.'
                : 'Your jobs and the tools your team uses.'
            }}
          </p>
        </div>
        <nav class="shared-header-actions" aria-label="Dashboard actions">
          <template v-if="editing"
            ><button
              type="button"
              :disabled="busy || !undo.length"
              aria-label="Undo template edit"
              @click="undoChange"
            >
              Undo</button
            ><button
              type="button"
              :disabled="busy || !redo.length"
              aria-label="Redo template edit"
              @click="redoChange"
            >
              Redo</button
            ><button type="button" :disabled="busy || !dirty" @click="save">Save template</button
            ><button type="button" :disabled="busy" @click="cancel">Cancel edits</button></template
          >
          <button v-else-if="canEdit" type="button" :disabled="loading || busy" @click="beginEdit">
            Edit</button
          ><button type="button" :disabled="loading || busy" @click="reload">Refresh</button>
          <RouterLink :to="scope === 'job' && jobId ? `/jobs/${jobId}` : '/jobs'">{{
            scope === 'job' && jobId ? 'Existing job page' : 'Jobs'
          }}</RouterLink>
        </nav>
      </header>
      <label v-if="scope === 'job'" class="shared-job-picker"
        >Choose job<select
          aria-label="Choose job"
          :value="jobId"
          :disabled="busy"
          @change="changeJob"
        >
          <option value="">Choose a job</option>
          <option v-for="job in visibleJobs" :key="job.id" :value="job.id">
            {{ job.code }} · {{ job.name }}
          </option>
        </select></label
      >
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="message" role="status">{{ message }}</p>
      <p v-if="loading" role="status">Loading dashboard…</p>
      <div
        class="shared-dashboard-body"
        :style="{
          '--palette-width': paletteWidth + 'px',
          '--inspector-width': inspectorWidth + 'px',
        }"
      >
        <aside
          v-if="editing"
          id="shared-palette"
          class="shared-builder-sidebar builder-controls"
          aria-label="Dashboard library"
        >
          <h2>Template</h2>
          <p>
            {{
              scope === 'job'
                ? 'Changes apply to every job. Job data stays separate.'
                : 'Changes apply to everyone in this role.'
            }}
          </p>
          <label v-if="scope === 'role' && isAdmin"
            >Shared layout for<select
              aria-label="Shared layout for"
              :value="role"
              :disabled="busy"
              @change="changeRole"
            >
              <option v-for="key in CURRENT_EDITABLE_USER_ROLE_KEYS" :key="key" :value="key">
                {{ CURRENT_ROLE_LABELS[key] }}
              </option>
            </select></label
          >
          <label
            v-if="scope === 'role' && isAdmin && role !== 'admin'"
            class="shared-role-permission"
            ><input v-model="allowRoleEditing" type="checkbox" :disabled="busy" />Allow this role to
            edit its dashboard</label
          >
          <h2>Widgets</h2>
          <button
            v-for="type in palette"
            :key="type"
            type="button"
            :disabled="busy || !canAdd(type)"
            @pointerdown="drag.start($event, { kind: 'new', type }, sharedWidgetLabels[type])"
            @dragstart.prevent
            @click="add(type)"
          >
            Add {{ sharedWidgetLabels[type] }}
          </button>
          <small>Drag a widget into the page, or click to add it.</small>
          <h2>Layers</h2>
          <button
            v-for="widget in widgets"
            :key="widget.id"
            type="button"
            :aria-pressed="selected === widget.id"
            @click="selected = widget.id"
          >
            {{ widget.title || sharedWidgetLabels[widget.type] }}
          </button>
        </aside>
        <BuilderPanelResize
          v-if="editing"
          v-model:value="paletteWidth"
          label="Resize dashboard library"
          controls="shared-palette"
          :min="190"
          :max="340"
          :disabled="busy"
        />
        <main class="shared-dashboard-stage" aria-label="Dashboard page">
          <div
            v-if="editing"
            class="shared-preview-controls builder-controls"
            role="group"
            aria-label="Preview device"
          >
            <button
              v-for="item in ['desktop', 'tablet', 'phone'] as const"
              :key="item"
              type="button"
              :aria-pressed="device === item"
              @click="device = item"
            >
              {{ item === 'desktop' ? 'Desktop' : item === 'tablet' ? 'Tablet' : 'Phone' }}</button
            ><button type="button" :aria-pressed="fit" @click="fit = true">Fit</button
            ><button type="button" aria-label="Zoom out" @click="manualZoom(-0.1)">−</button
            ><span>{{ Math.round(previewScale * 100) }}%</span
            ><button type="button" aria-label="Zoom in" @click="manualZoom(0.1)">+</button>
          </div>
          <div ref="viewport" class="shared-dashboard-viewport" data-widget-scroll>
            <div
              :style="
                editing
                  ? {
                      width: previewWidth * previewScale + 'px',
                      minHeight: contentHeight * previewScale + 'px',
                    }
                  : {}
              "
              class="shared-preview-frame"
            >
              <div
                ref="content"
                :style="
                  editing
                    ? {
                        width: previewWidth + 'px',
                        transform: `scale(${previewScale})`,
                        transformOrigin: 'top left',
                      }
                    : {}
                "
              >
                <SharedDashboardCanvas
                  v-if="layout && auth.hasWorkspaceAccess"
                  ref="canvas"
                  :key="scope + ':' + jobId + ':' + role"
                  :scope="scope"
                  :widgets="widgets"
                  :job="layout.job"
                  :jobs="visibleJobs"
                  :notes="layout.notes"
                  :events="layout.events"
                  :text-context="textContext"
                  :role="auth.rawRole"
                  :editing="editing"
                  :selected="selected"
                  :can-edit-notes="canEditContent"
                  :busy="busy"
                  :phone="editing && device === 'phone'"
                  @select="selected = $event"
                  @move="
                    (event, id) =>
                      drag.start(
                        event,
                        { kind: 'move', id },
                        sharedWidgetLabels[widgets.find((w) => w.id === id)!.type],
                      )
                  "
                  @save-note="saveNote"
                  @save-calendar="saveCalendar"
                />
              </div>
            </div>
          </div>
        </main>
        <BuilderPanelResize
          v-if="editing"
          v-model:value="inspectorWidth"
          label="Resize dashboard inspector"
          controls="shared-inspector"
          :min="240"
          :max="420"
          reverse
          :disabled="busy"
        />
        <aside
          v-if="editing"
          id="shared-inspector"
          class="shared-builder-sidebar builder-controls"
          aria-label="Widget settings"
        >
          <h2>Widget settings</h2>
          <fieldset v-if="selectedWidget" :disabled="busy">
            <legend>{{ sharedWidgetLabels[selectedWidget.type] }}</legend>
            <label>Title<input v-model="selectedWidget.title" maxlength="100" /></label
            ><label
              >Width<select aria-label="Width" v-model.number="selectedWidget.span">
                <option :value="12">Full width</option>
                <option :value="6">Half width</option>
                <option :value="4">One third</option>
                <option :value="8">Two thirds</option>
              </select></label
            ><template v-if="selectedWidget.type === 'text'"
              ><label
                >Text content<textarea
                  ref="textInput"
                  v-model="selectedWidget.text"
                  maxlength="8000"
                />
              </label>
              <details open>
                <summary>Insert variable</summary>
                <p>Click a variable to insert it at the cursor.</p>
                <button
                  v-for="(label, key) in dashboardTextVariables"
                  :key="key"
                  type="button"
                  @click="insertVariable(key)"
                >
                  {{ label }}
                </button>
              </details>
              <p v-if="textResult.unavailable.length">
                These variables need a context or value: {{ textResult.unavailable.join(', ') }}.
              </p>
              <p v-if="textResult.unknown.length" role="alert">
                Unsupported variables: {{ textResult.unknown.join(', ') }}.
              </p>
              <label
                >Font size (px)<input
                  type="number"
                  min="12"
                  max="96"
                  :value="selectedWidget.textStyle?.size || 24"
                  @change="
                    setTextStyle('size', Number(($event.target as HTMLInputElement).value))
                  " /></label
              ><label
                >Text color<input
                  type="color"
                  :value="selectedWidget.textStyle?.color || '#142e3e'"
                  @input="
                    setTextStyle('color', ($event.target as HTMLInputElement).value)
                  " /></label
              ><label
                >Font weight<select
                  aria-label="Font weight"
                  :value="selectedWidget.textStyle?.weight || 400"
                  @change="
                    setTextStyle('weight', Number(($event.target as HTMLSelectElement).value))
                  "
                >
                  <option :value="400">Regular</option>
                  <option :value="500">Medium</option>
                  <option :value="600">Semibold</option>
                  <option :value="700">Bold</option>
                </select></label
              ><label
                >Text alignment<select
                  aria-label="Text alignment"
                  :value="selectedWidget.textStyle?.align || 'left'"
                  @change="setTextStyle('align', ($event.target as HTMLSelectElement).value)"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select></label
              ><label
                >Line height<input
                  type="number"
                  min="1"
                  max="2.5"
                  step="0.05"
                  :value="selectedWidget.textStyle?.lineHeight || 1.5"
                  @change="
                    setTextStyle('lineHeight', Number(($event.target as HTMLInputElement).value))
                  " /></label></template
            ><label v-if="selectedWidget.type === 'form'"
              >Employee form<select
                aria-label="Employee form"
                :value="selectedWidget.form?.templateId || ''"
                @change="selectForm"
              >
                <option value="">Choose an issued form</option>
                <option v-for="form in forms" :key="form.id" :value="form.id">
                  {{ form.definition?.title || form.draft.title }} · v{{ form.latestVersion }}
                </option>
              </select></label
            ><label v-if="selectedWidget.form"
              >Presentation<select
                aria-label="Presentation"
                v-model="selectedWidget.form.presentation"
              >
                <option value="launcher">Full-page launcher</option>
                <option value="inline">Inline (up to eight fields)</option>
              </select></label
            >
            <p v-if="formsError" role="alert">{{ formsError }}</p>
            <button type="button" @click="move(-1)">Move up</button
            ><button type="button" @click="move(1)">Move down</button
            ><button type="button" :disabled="selectedWidget.type === requiredType" @click="remove">
              Remove widget
            </button>
          </fieldset>
        </aside>
      </div>
      <div
        v-if="dragging"
        class="shared-drag-ghost builder-floating"
        :style="{ left: point.x + 12 + 'px', top: point.y + 12 + 'px' }"
      >
        {{ label }}
      </div>
      <BuilderConfirmDialog ref="confirm" />
    </section>
  </AppShell>
</template>
