<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { CURRENT_EDITABLE_USER_ROLE_KEYS, CURRENT_ROLE_LABELS } from '@/auth/roles'
import type { RawRoleKey } from '@/types/domain'
import { dashboardCommand, dashboardError } from '@/services/dashboard'
import {
  dashboardWidgetLabels,
  newDashboardWidget,
  type DashboardWidget,
  type DashboardWidgetType,
} from '@/features/dashboard/widgets'
import { useWidgetDrag, type WidgetDrop } from '@/features/dashboard/useWidgetDrag'
import SdsExplorerModule from './SdsExplorerModule.vue'
import RoleResourcesModule from './RoleResourcesModule.vue'
import { formApi, isFormServerEnabled, type ServerFormTemplate } from '@/services/forms'
const FormDashboardWidget = import.meta.env.DEV
  ? defineAsyncComponent(() => import('./FormDashboardWidget.vue'))
  : undefined
const formWidgets = ref<{ prepareNavigation: () => Promise<boolean> }[]>([])
const formTemplates = ref<ServerFormTemplate[]>([])
const formError = ref('')
const availableWidgetLabels = computed(
  () =>
    Object.fromEntries(
      Object.entries(dashboardWidgetLabels).filter(
        ([type]) =>
          type !== 'form' ||
          (isFormServerEnabled() &&
            ['admin', 'project-manager', 'foreman', 'shop-foreman'].includes(auth.rawRole) &&
            (props.scope !== 'role' ||
              ['admin', 'project-manager', 'foreman', 'shop-foreman'].includes(role.value))),
      ),
    ) as Partial<typeof dashboardWidgetLabels>,
)
async function prepareFormWidgets() {
  for (const widget of formWidgets.value) if (!(await widget.prepareNavigation())) return false
  return true
}
async function reloadLayout() {
  if (await prepareFormWidgets()) await load()
}
async function editLayout() {
  if (!canEdit.value || locked.value) return
  if (!(await prepareFormWidgets())) return
  editing.value = true
  if (
    !isFormServerEnabled() ||
    !['admin', 'project-manager', 'foreman', 'shop-foreman'].includes(auth.rawRole)
  )
    return
  formError.value = ''
  try {
    formTemplates.value = (
      await formApi<{ templates: ServerFormTemplate[] }>('formTemplates', { action: 'list' })
    ).templates.filter((item) => item.latestVersion && !item.archived)
  } catch (reason) {
    formError.value = dashboardError(reason)
  }
}
function selectForm(widget: DashboardWidget, event: Event) {
  const template = formTemplates.value.find(
    (item) => item.id === (event.target as HTMLSelectElement).value,
  )
  if (!template) {
    delete widget.form
    return
  }
  widget.form = {
    templateId: template.id,
    version: template.latestVersion,
    presentation: widget.form?.presentation || 'launcher',
  }
  widget.title = template.definition?.title || template.draft?.title || 'Form'
}

const props = defineProps<{ scope: 'personal' | 'role' }>()
const auth = useAuthStore()
const role = ref<RawRoleKey>(auth.rawRole)
const widgets = ref<DashboardWidget[]>([
  { id: 'documents', type: 'documents', span: 12, title: 'Documents', text: '' },
])
const version = ref(0)
const saved = ref(JSON.stringify(widgets.value))
const canEdit = ref(false)
const loading = ref(true)
const busy = ref(false)
const editing = ref(false)
const error = ref('')
const message = ref('')
const root = ref<HTMLElement>()
const dirty = computed(() => JSON.stringify(widgets.value) !== saved.value)
const locked = computed(() => loading.value || busy.value)
type Payload = { kind: 'new'; type: DashboardWidgetType } | { kind: 'move'; id: string }
const drag = useWidgetDrag<Payload>({
  root,
  disabled: () => !editing.value || locked.value || !canEdit.value,
  drop,
})
const { dragging, target, point, label } = drag
let generation = 0
function canAdd(type: DashboardWidgetType) {
  return (
    widgets.value.length < 12 &&
    (type === 'notes' || !widgets.value.some((widget) => widget.type === type))
  )
}
function drop(payload: Payload, destination: WidgetDrop) {
  if (!editing.value || locked.value || !canEdit.value) return
  const at =
    destination.beforeId === null
      ? widgets.value.length
      : widgets.value.findIndex((widget) => widget.id === destination.beforeId)
  if (at < 0) return
  if (payload.kind === 'new') {
    if (canAdd(payload.type)) widgets.value.splice(at, 0, newDashboardWidget(payload.type))
  } else {
    const from = widgets.value.findIndex((widget) => widget.id === payload.id)
    if (from < 0 || from === at) return
    const [widget] = widgets.value.splice(from, 1)
    widgets.value.splice(at > from ? at - 1 : at, 0, widget!)
  }
  message.value = ''
}
function add(type: DashboardWidgetType) {
  drop({ kind: 'new', type }, { beforeId: null, overId: null, edge: 'after', surface: 'dashboard' })
}
function move(index: number, direction: number) {
  const to = index + direction
  if (to < 0 || to >= widgets.value.length) return
  const [widget] = widgets.value.splice(index, 1)
  widgets.value.splice(to, 0, widget!)
}
function remove(widget: DashboardWidget) {
  if (
    !window.confirm(
      `Remove ${widget.title || dashboardWidgetLabels[widget.type]} from this layout? Unsaved edits inside this widget will be lost. Stored documents and resources are retained.`,
    )
  )
    return
  widgets.value = widgets.value.filter((entry) => entry.id !== widget.id)
}
function discard() {
  return !dirty.value || window.confirm('Discard your unsaved dashboard layout changes?')
}
function cancel() {
  if (!discard()) return
  drag.cancel()
  widgets.value = JSON.parse(saved.value) as DashboardWidget[]
  editing.value = false
  error.value = ''
}
async function load() {
  if (!discard()) return
  drag.cancel()
  const request = ++generation
  loading.value = true
  error.value = ''
  message.value = ''
  canEdit.value = false
  try {
    const result = await dashboardCommand('load', {
      scope: props.scope,
      ...(props.scope === 'role' ? { role: role.value } : {}),
    })
    if (request !== generation) return
    widgets.value = result.widgets
    version.value = result.version
    saved.value = JSON.stringify(result.widgets)
    canEdit.value = result.canEdit
    editing.value = false
  } catch (reason) {
    if (request === generation) error.value = dashboardError(reason)
  } finally {
    if (request === generation) loading.value = false
  }
}
async function save() {
  if (!canEdit.value || locked.value) return
  drag.cancel()
  busy.value = true
  const request = generation
  error.value = ''
  try {
    const result = await dashboardCommand('save', {
      scope: props.scope,
      ...(props.scope === 'role' ? { role: role.value } : {}),
      version: version.value,
      widgets: widgets.value,
    })
    if (request !== generation) return
    version.value = result.version
    saved.value = JSON.stringify(widgets.value)
    editing.value = false
    message.value = props.scope === 'role' ? 'Shared role layout saved.' : 'Personal layout saved.'
  } catch (reason) {
    if (request === generation) error.value = dashboardError(reason)
  } finally {
    busy.value = false
  }
}
async function changeRole(event: Event) {
  const select = event.target as HTMLSelectElement
  if (!(await prepareFormWidgets()) || !discard()) {
    select.value = role.value
    return
  }
  // Clear the old draft before loading a different shared role.
  widgets.value = [{ id: 'documents', type: 'documents', span: 12, title: 'Documents', text: '' }]
  saved.value = JSON.stringify(widgets.value)
  editing.value = false
  role.value = select.value as RawRoleKey
  void load()
}
watch([() => auth.rawRole, () => auth.currentUser?.uid], ([value]) => {
  generation++
  drag.cancel()
  canEdit.value = false
  editing.value = false
  role.value = value
  widgets.value = []
  saved.value = '[]'
  void load()
})
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value || busy.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onMounted(() => {
  void load()
  window.addEventListener('beforeunload', beforeUnload)
})
onBeforeUnmount(() => {
  generation++
  window.removeEventListener('beforeunload', beforeUnload)
})
onBeforeRouteLeave(() => !busy.value && discard())
</script>

<template>
  <section
    ref="root"
    class="widget-dashboard"
    :aria-label="scope === 'role' ? 'Role dashboard' : 'Personal dashboard'"
    @click.capture="drag.guardClick"
  >
    <header class="dashboard-toolbar">
      <span>{{
        scope === 'role' ? `${CURRENT_ROLE_LABELS[role]} dashboard` : 'Personal dashboard'
      }}</span>
      <label v-if="scope === 'role' && auth.rawRole === 'admin'"
        >Shared layout for
        <select
          :value="role"
          :disabled="locked"
          aria-label="Shared layout for"
          @change="changeRole"
        >
          <option v-for="key in CURRENT_EDITABLE_USER_ROLE_KEYS" :key="key" :value="key">
            {{ CURRENT_ROLE_LABELS[key] }}
          </option>
        </select>
      </label>
      <span v-if="loading">Loading layout…</span>
      <template v-if="editing">
        <button :disabled="locked || !dirty" @click="save">Save layout</button>
        <button :disabled="locked" @click="cancel">Cancel layout edits</button>
      </template>
      <button v-else-if="canEdit" :disabled="locked" @click="editLayout">Edit layout</button>
      <button :disabled="locked" @click="reloadLayout">Reload layout</button>
    </header>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="message" role="status">{{ message }}</p>
    <fieldset v-if="editing" :disabled="locked" class="dashboard-library">
      <legend>Add widgets</legend>
      <button
        v-for="(name, type) in availableWidgetLabels"
        :key="type"
        class="widget-grip"
        :disabled="!canAdd(type as DashboardWidgetType)"
        @pointerdown="
          drag.start($event, { kind: 'new', type: type as DashboardWidgetType }, name || '')
        "
        @dragstart.prevent
        @click="add(type as DashboardWidgetType)"
      >
        Add {{ name }}
      </button>
      <small>Drag to place, or click to add. Changes take effect when you save the layout.</small>
    </fieldset>
    <p v-if="formError" role="alert">{{ formError }}</p>
    <div class="dashboard-scroll" data-widget-scroll>
      <div
        class="dashboard-widgets"
        data-widget-surface="dashboard"
        :class="{ 'is-dragging': dragging }"
      >
        <article
          v-for="(widget, index) in widgets"
          :key="widget.id"
          :data-widget-id="widget.id"
          class="dashboard-widget"
          :style="{ '--widget-span': widget.span }"
          :class="{
            'drop-before': target?.overId === widget.id && target.edge === 'before',
            'drop-after': target?.overId === widget.id && target.edge === 'after',
          }"
        >
          <fieldset v-if="editing" class="widget-controls" :disabled="locked">
            <legend>{{ dashboardWidgetLabels[widget.type] }}</legend>
            <button
              class="widget-grip"
              :aria-label="`Drag ${widget.title || dashboardWidgetLabels[widget.type]} widget`"
              @pointerdown="drag.start($event, { kind: 'move', id: widget.id }, widget.title)"
              @dragstart.prevent
            >
              Move
            </button>
            <label
              >Width<select v-model.number="widget.span" :aria-label="`Widget ${index + 1} width`">
                <option :value="12">Full width</option>
                <option :value="6">Half width</option>
                <option :value="4">One third</option>
                <option :value="8">Two thirds</option>
              </select></label
            >
            <button
              :disabled="index === 0"
              :aria-label="`Move widget ${index + 1} up`"
              @click="move(index, -1)"
            >
              ↑
            </button>
            <button
              :disabled="index === widgets.length - 1"
              :aria-label="`Move widget ${index + 1} down`"
              @click="move(index, 1)"
            >
              ↓
            </button>
            <button :aria-label="`Remove widget ${index + 1}`" @click="remove(widget)">
              Remove
            </button>
            <template v-if="widget.type === 'form'">
              <label
                >Issued form<select
                  :value="widget.form?.templateId || ''"
                  :aria-label="`Widget ${index + 1} form`"
                  @change="selectForm(widget, $event)"
                >
                  <option value="">Choose a form</option>
                  <option v-for="item in formTemplates" :key="item.id" :value="item.id">
                    {{ item.definition?.title || item.draft?.title }} · version
                    {{ item.latestVersion }}
                  </option>
                </select></label
              >
              <label v-if="widget.form"
                >Presentation<select
                  v-model="widget.form.presentation"
                  :aria-label="`Widget ${index + 1} presentation`"
                >
                  <option value="launcher">Full-page launcher</option>
                  <option value="inline">Inline (small forms)</option>
                </select></label
              >
              <small v-if="widget.form"
                >Pinned version {{ widget.form.version }}. Select a form again to adopt its latest
                issued version. Inline is limited to eight fields.</small
              >
            </template>
            <template v-if="widget.type === 'notes'">
              <label class="note-field"
                >Title<input
                  v-model="widget.title"
                  maxlength="100"
                  :aria-label="`Widget ${index + 1} title`"
              /></label>
              <label class="note-field"
                >Notes<textarea
                  v-model="widget.text"
                  maxlength="8000"
                  rows="5"
                  :aria-label="`Widget ${index + 1} notes`"
                />
              </label>
            </template>
          </fieldset>
          <div class="widget-content" :inert="editing || locked">
            <component
              :is="FormDashboardWidget"
              v-if="widget.type === 'form' && FormDashboardWidget"
              ref="formWidgets"
              :widget="widget"
              :scope="scope"
            />
            <SdsExplorerModule v-else-if="widget.type === 'documents'" />
            <RoleResourcesModule v-else-if="widget.type === 'resources'" :fixed-role="role" />
            <section v-else-if="widget.type === 'notes'" class="note-widget">
              <h2>{{ widget.title || 'Notes' }}</h2>
              <p>{{ widget.text || 'Add notes in Edit layout.' }}</p>
            </section>
            <nav v-else class="quick-links" aria-label="Dashboard quick links">
              <h2>Quick links</h2>
              <RouterLink to="/jobs">Open Jobs</RouterLink
              ><RouterLink to="/dashboards/personal">Personal dashboard</RouterLink
              ><RouterLink to="/dashboards/role">Role dashboard</RouterLink>
            </nav>
          </div>
        </article>
        <p v-if="!widgets.length" class="empty-dashboard">
          {{
            editing ? 'Drop a widget here or choose one above.' : 'No widgets have been added yet.'
          }}
        </p>
      </div>
    </div>
    <Teleport to="body"
      ><div
        v-if="dragging"
        class="dashboard-drag-ghost"
        :style="{ left: `${point.x + 12}px`, top: `${point.y + 12}px` }"
        aria-hidden="true"
      >
        {{ label }} · {{ target ? 'Release to place' : 'Drag onto the dashboard' }}
      </div></Teleport
    >
  </section>
</template>

<style scoped>
.widget-dashboard {
  min-width: 0;
}
.dashboard-toolbar,
.dashboard-library,
.widget-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
.dashboard-toolbar {
  margin-bottom: 0.6rem;
  font-size: 0.8rem;
}
.dashboard-toolbar > span:first-child {
  margin-right: auto;
  font-weight: 600;
}
button,
input,
textarea,
select {
  font: inherit;
  color: var(--text);
  background: var(--field);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.45rem;
  min-width: 0;
}
button {
  cursor: pointer;
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
fieldset {
  margin: 0 0 0.6rem;
  padding: 0.6rem;
  border: 1px solid var(--border);
  border-radius: 5px;
  font-size: 0.8rem;
  min-width: 0;
}
.dashboard-library small {
  width: 100%;
}
.dashboard-scroll {
  max-height: calc(100dvh - 200px);
  min-height: 100px;
  overflow: auto;
  overscroll-behavior: contain;
  container-type: inline-size;
}
.dashboard-widgets {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 0.75rem;
  min-height: 100px;
  padding: 3px;
}
.dashboard-widget {
  grid-column: span var(--widget-span);
  min-width: 0;
  position: relative;
}
.widget-content {
  overflow: auto;
}
.widget-content[inert] {
  pointer-events: none;
}
.widget-grip {
  touch-action: none;
  user-select: none;
  cursor: grab;
}
.drop-before {
  box-shadow: 0 -3px var(--accent);
}
.drop-after {
  box-shadow: 0 3px var(--accent);
}
.is-dragging {
  outline: 1px dashed var(--accent);
  outline-offset: -1px;
}
.note-widget,
.quick-links {
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-panel);
}
h2 {
  font-size: 1rem;
  margin-top: 0;
}
.note-widget p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.quick-links {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.quick-links a {
  color: var(--accent);
}
.note-field {
  width: 100%;
  display: grid;
}
.note-field input,
.note-field textarea {
  width: 100%;
  box-sizing: border-box;
}
.empty-dashboard {
  grid-column: 1 / -1;
  padding: 1rem;
}
.dashboard-drag-ghost {
  position: fixed;
  z-index: 10000;
  pointer-events: none;
  background: #174878;
  color: #fff;
  padding: 0.5rem;
  border-radius: 4px;
  max-width: 240px;
}
@container (max-width: 700px) {
  .dashboard-widget {
    grid-column: 1 / -1;
  }
}
</style>
