<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue'
import AppLoadingIndicator from '@/components/common/AppLoadingIndicator.vue'
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import DashboardAnnouncements from './DashboardAnnouncements.vue'
import DashboardAnnouncementDrafts from './DashboardAnnouncementDrafts.vue'
import DashboardPersonalTasks from './DashboardPersonalTasks.vue'
import DashboardJobInformation from './DashboardJobInformation.vue'
import DashboardCalendarAgenda from './DashboardCalendarAgenda.vue'
import DashboardWorkflowsWidget from './DashboardWorkflowsWidget.vue'
import CompanyLibraryWidget from './CompanyLibraryWidget.vue'
import DashboardJobsWidget from './DashboardJobsWidget.vue'
import RoleResourcesModule from './RoleResourcesModule.vue'
import {
  sharedWidgetLabels,
  type SharedDashboardWidget,
  type SharedDashboardJob,
  type SharedDashboardScope,
  type SharedCalendarEntry,
} from '@/features/dashboard/sharedDashboards'
import { resolveDashboardText, type DashboardTextContext } from '@/features/dashboard/sharedText'
import { fallbackPlacements } from '@/features/dashboard/widgetPlacement'
import {
  resizeDirections,
  locked as geometryLocked,
  type Direction,
} from '@/features/dashboard/editorGeometry'
import type { WidgetDrop } from '@/features/dashboard/useWidgetDrag'
import type { JobRecord, RawRoleKey } from '@/types/domain'
const SharedDashboardForm = defineAsyncComponent(() => import('./SharedDashboardForm.vue'))
const props = defineProps<{
  scope: SharedDashboardScope
  widgets: SharedDashboardWidget[]
  job: SharedDashboardJob | null
  jobs: JobRecord[]
  initialToolJobId?: string
  jobsLoading?: boolean
  jobsError?: string | null
  canCreateJobs?: boolean
  canManageJobs?: boolean
  editableJobIds?: string[]
  publishedDraftIds?: string[]
  announcementDrafts?: import('@/features/dashboard/sharedDashboards').AnnouncementDraft[]
  tasks?: import('@/features/dashboard/sharedDashboards').PersonalTask[]
  notes: Record<string, string>
  events: SharedCalendarEntry[]
  role: RawRoleKey
  resourceRole?: RawRoleKey
  textContext: DashboardTextContext
  editing: boolean
  gridVisible?: boolean
  placementPreview?: SharedDashboardWidget['placement']
  dropTarget?: WidgetDrop
  selected: string
  canEditNotes: boolean
  busy: boolean
  phone?: boolean
  device?: 'desktop' | 'tablet' | 'phone'
  fixedFrame?: boolean
  parentId?: string
  region?: string
  tabLabelId?: string
  selectedIds?: string[]
  gridSpacing?: { x: number; y: number }
  placementPreviews?: Record<string, NonNullable<SharedDashboardWidget['placement']>>
}>()
const visibleWidgets = computed(() =>
  props.widgets.filter(
    (w) =>
      (w.parentId || '') === (props.parentId || '') && (w.region || '0') === (props.region || '0'),
  ),
)
const positioned = computed(() =>
  visibleWidgets.value.some(
    (widget) =>
      widget.placement ||
      (props.device && props.device !== 'desktop' && widget.devices?.[props.device]),
  ),
)
const positions = computed(() =>
  fallbackPlacements(
    visibleWidgets.value.map((w) => ({
      ...w,
      placement:
        props.placementPreviews?.[w.id] ||
        (props.device && props.device !== 'desktop'
          ? w.devices?.[props.device] || w.placement
          : w.placement),
    })),
  ),
)
const canvasStyle = computed(() =>
  positioned.value
    ? {
        minHeight:
          Math.max(
            props.editing ? (props.parentId ? 200 : 960) : 0,
            ...positions.value.map((p) => (p.y + p.h) * 32 + 64),
          ) + 'px',
        '--grid-x': ((props.gridSpacing?.x || 1) / 24) * 100 + '%',
        '--grid-y': (props.gridSpacing?.y || 1) * 32 + 'px',
      }
    : undefined,
)
function startWidgetMove(event: PointerEvent, id: string) {
  if (
    !props.editing ||
    props.busy ||
    event.button !== 0 ||
    (event.target as HTMLElement).closest('button,input,select,textarea,a,[contenteditable]')
  )
    return
  if (event.shiftKey || event.ctrlKey || event.metaKey) return
  if (geometryLocked(props.widgets, props.widgets.find((w) => w.id === id)!, 'positionLocked'))
    return
  emit('move', event, id)
}
function widgetStyle(widget: SharedDashboardWidget, index: number) {
  const p = positions.value[index]!
  return positioned.value
    ? {
        position: 'absolute' as const,
        left: (p.x / 24) * 100 + '%',
        top: p.y * 32 + 'px',
        width: (p.w / 24) * 100 + '%',
        height: p.h * 32 + 'px',
        boxSizing: 'border-box' as const,
      }
    : { '--widget-span': widget.span }
}
const emit = defineEmits<{
  select: [id: string, event?: MouseEvent | PointerEvent]
  edit: [id: string]
  resize: [event: PointerEvent, id: string, direction?: Direction]
  move: [event: PointerEvent, id: string]
  'save-note': [id: string, text: string]
  'publish-announcement': [draftId: string]
  'save-announcement-drafts': [
    items: import('@/features/dashboard/sharedDashboards').AnnouncementDraft[],
  ]
  'save-tasks': [tasks: import('@/features/dashboard/sharedDashboards').PersonalTask[]]
  'save-calendar': [events: SharedCalendarEntry[]]
}>()
type NavigationParticipant = { prepareNavigation: () => boolean | Promise<boolean> }
const forms = ref<NavigationParticipant[]>([])
type ContentAction = 'save-notes' | 'save-calendar' | 'save-tasks' | 'save-announcement-drafts'
type ChildCanvas = {
  notesDirty: boolean
  discardNotes: () => void
  finishNote: (action: ContentAction, id?: string) => void
  prepareForms: () => Promise<boolean>
}
const childCanvases = ref<ChildCanvas[]>([])
const activeTabs = ref<Record<string, string>>({}),
  collapsed = ref<Record<string, boolean>>({})
function regions(widget: SharedDashboardWidget) {
  return widget.container?.kind === 'split'
    ? ['0', '1']
    : widget.container?.kind === 'tabs'
      ? widget.container.labels.map((_, i) => String(i))
      : ['0']
}
watch(
  () => props.selected,
  (id) => {
    let child = props.widgets.find((w) => w.id === id)
    const seen = new Set<string>()
    while (child?.parentId && !seen.has(child.id)) {
      seen.add(child.id)
      activeTabs.value[child.parentId] = child.region || '0'
      collapsed.value[child.parentId] = false
      child = props.widgets.find((w) => w.id === child!.parentId)
    }
  },
  { immediate: true },
)
function navigateTab(event: KeyboardEvent, widget: SharedDashboardWidget, index: number) {
  const count = widget.container!.labels.length
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? count - 1
        : event.key === 'ArrowRight'
          ? (index + 1) % count
          : event.key === 'ArrowLeft'
            ? (index + count - 1) % count
            : -1
  if (next < 0) return
  event.preventDefault()
  activeTabs.value[widget.id] = String(next)
  const tabs = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>(
    '[role="tab"]',
  )
  tabs?.[next]?.focus()
}
const libraries = ref<NavigationParticipant[]>([])
const resources = ref<NavigationParticipant[]>([])
const announcementEditors = ref<InstanceType<typeof DashboardAnnouncementDrafts>[]>([])
const announcementsEditing = computed(() =>
  announcementEditors.value.some((editor) => editor.editing),
)
const taskEditors = ref<InstanceType<typeof DashboardPersonalTasks>[]>([])
const tasksEditing = computed(() => taskEditors.value.some((editor) => editor.editing))
const noteId = ref(''),
  noteText = ref(''),
  calendarEditing = ref(false),
  calendarDraft = ref<SharedCalendarEntry[]>([]),
  toolJobId = ref(props.initialToolJobId || '')
watch(
  () => props.initialToolJobId,
  (id) => {
    toolJobId.value = id || ''
  },
)
const notesDirty = computed(
  () =>
    childCanvases.value.some((child) => child.notesDirty) ||
    announcementEditors.value.some((editor) => editor.dirty) ||
    taskEditors.value.some((editor) => editor.dirty) ||
    (!!noteId.value && noteText.value !== (props.notes[noteId.value] || '')) ||
    (calendarEditing.value && JSON.stringify(calendarDraft.value) !== JSON.stringify(props.events)),
)
const toolJob = computed(() => props.job || props.jobs.find((job) => job.id === toolJobId.value))
function beginNote(id: string) {
  if (
    !props.canEditNotes ||
    props.busy ||
    noteId.value ||
    calendarEditing.value ||
    tasksEditing.value ||
    announcementsEditing.value
  )
    return
  noteId.value = id
  noteText.value = props.notes[id] || ''
}
function cancelNote() {
  childCanvases.value.forEach((child) => child.discardNotes())
  announcementEditors.value.forEach((editor) => editor.discard())
  taskEditors.value.forEach((editor) => editor.discard())
  noteId.value = ''
  noteText.value = ''
  calendarEditing.value = false
  calendarDraft.value = []
}
function cancelLocalNote() {
  noteId.value = ''
  noteText.value = ''
}
function cancelLocalCalendar() {
  calendarEditing.value = false
  calendarDraft.value = []
}
function finishNote(action: ContentAction, id?: string) {
  childCanvases.value.forEach((child) => child.finishNote(action, id))
  if (action === 'save-notes' && noteId.value === id) {
    noteId.value = ''
    noteText.value = ''
  }
  if (action === 'save-calendar') {
    calendarEditing.value = false
    calendarDraft.value = []
  }
  if (action === 'save-tasks') taskEditors.value.forEach((editor) => editor.discard())
  if (action === 'save-announcement-drafts')
    announcementEditors.value.forEach((editor) => editor.discard())
}
function editCalendar() {
  calendarDraft.value = JSON.parse(JSON.stringify(props.events))
  calendarEditing.value = true
}
function addDate() {
  calendarDraft.value.push({ id: crypto.randomUUID(), title: '', date: '' })
}
defineExpose({
  notesDirty,
  discardNotes: cancelNote,
  finishNote,
  prepareForms: async () => {
    for (const child of childCanvases.value) if (!(await child.prepareForms())) return false
    for (const child of [...forms.value, ...libraries.value, ...resources.value])
      if (!(await child.prepareNavigation())) return false
    return true
  },
})
const dates = computed(() =>
  [
    ...(props.scope === 'job' && props.job?.startDate
      ? [{ id: 'job-start', title: 'Job start', date: props.job.startDate }]
      : []),
    ...(props.scope === 'job' && props.job?.finishDate
      ? [{ id: 'job-finish', title: 'Job finish', date: props.job.finishDate }]
      : []),
    ...props.events,
  ].sort((a, b) => a.date.localeCompare(b.date)),
)
function textStyle(widget: SharedDashboardWidget) {
  const style = widget.textStyle
  return style
    ? {
        fontSize: style.size + 'px',
        color: style.color,
        fontWeight: style.weight,
        textAlign: style.align,
        lineHeight: style.lineHeight,
      }
    : undefined
}
</script>
<template>
  <div
    class="shared-dashboard-grid"
    :style="canvasStyle"
    :class="{
      'is-grid-visible': gridVisible,
      'is-positioned': positioned,
      'is-placement-editor': editing,
      'is-nested': parentId,
      'phone-preview': phone,
      'has-phone-placement': fixedFrame || visibleWidgets.some((w) => w.devices?.phone),
      'is-empty-editor': editing && !visibleWidgets.length,
      'is-drop-target': editing && dropTarget?.surface === (parentId || 'shared-dashboard'),
    }"
    :data-widget-surface="parentId || 'shared-dashboard'"
    :data-region="region || '0'"
    :role="tabLabelId ? 'tabpanel' : undefined"
    :aria-labelledby="tabLabelId"
  >
    <div
      v-if="editing && placementPreview && dropTarget?.surface === (parentId || 'shared-dashboard')"
      data-widget-placement-preview
      aria-hidden="true"
      :style="{
        left: (placementPreview.x / 24) * 100 + '%',
        top: placementPreview.y * 32 + 'px',
        width: (placementPreview.w / 24) * 100 + '%',
        height: placementPreview.h * 32 + 'px',
      }"
    />
    <div v-if="editing && !visibleWidgets.length" class="shared-empty-canvas">
      <h2>Start your dashboard</h2>
      <p>Drag a widget here, or choose one from the widget library.</p>
    </div>
    <article
      v-for="(widget, widgetIndex) in visibleWidgets"
      :key="widget.id"
      :data-widget-id="widget.id"
      class="shared-dashboard-widget"
      :tabindex="editing ? 0 : undefined"
      :aria-label="
        editing ? 'Widget ' + (widget.title || sharedWidgetLabels[widget.type]) : undefined
      "
      :aria-keyshortcuts="editing ? 'ArrowLeft ArrowRight ArrowUp ArrowDown' : undefined"
      @pointerdown.stop="startWidgetMove($event, widget.id)"
      :class="{
        'is-selected': editing && (selectedIds || [selected]).includes(widget.id),
        'is-container': widget.type === 'container',
      }"
      :data-drop-edge="
        editing &&
        !placementPreview &&
        dropTarget?.surface === 'shared-dashboard' &&
        dropTarget.overId === widget.id
          ? dropTarget.edge
          : undefined
      "
      :style="widgetStyle(widget, widgetIndex)"
      @click.stop="editing && emit('select', widget.id, $event)"
    >
      <header class="shared-widget-heading">
        <h2>{{ widget.title || sharedWidgetLabels[widget.type] }}</h2>
        <AppButton
          v-if="editing"
          class="shared-widget-edit builder-floating"
          :disabled="busy"
          :aria-label="`Edit ${widget.title || sharedWidgetLabels[widget.type]}`"
          @click.stop="emit('edit', widget.id)"
          >Edit</AppButton
        >
        <AppButton
          v-if="editing"
          class="shared-widget-move builder-floating"
          type="button"
          :disabled="busy || geometryLocked(widgets, widget, 'positionLocked')"
          :aria-label="`Move ${widget.title || sharedWidgetLabels[widget.type]}`"
          @pointerdown.stop="emit('move', $event, widget.id)"
          @click.stop="emit('select', widget.id)"
        >
          Move
        </AppButton>
      </header>
      <div v-if="widget.container" class="shared-container-content">
        <div
          v-if="widget.container.kind === 'tabs'"
          role="tablist"
          :aria-label="widget.title || 'Container tabs'"
          class="shared-container-tabs"
        >
          <AppButton
            v-for="(tab, index) in widget.container.labels"
            :key="index"
            role="tab"
            :id="`tab-${widget.id}-${index}`"
            :aria-controls="`region-${widget.id}-${index}`"
            :tabindex="(activeTabs[widget.id] || '0') === String(index) ? 0 : -1"
            :aria-selected="(activeTabs[widget.id] || '0') === String(index)"
            @keydown="navigateTab($event, widget, index)"
            @click.stop="activeTabs[widget.id] = String(index)"
            >{{ tab }}</AppButton
          >
        </div>
        <AppButton
          v-if="widget.container.kind === 'collapsible'"
          :aria-expanded="!(collapsed[widget.id] ?? widget.container.collapsed)"
          @click.stop="collapsed[widget.id] = !(collapsed[widget.id] ?? widget.container.collapsed)"
          >{{ (collapsed[widget.id] ?? widget.container.collapsed) ? 'Expand' : 'Collapse' }}
          {{ widget.title || 'section' }}</AppButton
        >
        <div
          v-show="
            editing ||
            widget.container.kind !== 'collapsible' ||
            !(collapsed[widget.id] ?? widget.container.collapsed)
          "
          :class="['shared-container-regions', { 'is-split': widget.container.kind === 'split' }]"
          :style="
            widget.container.kind === 'split'
              ? {
                  display: 'grid',
                  [widget.container.direction === 'row'
                    ? 'gridTemplateColumns'
                    : 'gridTemplateRows']:
                    `${widget.container.ratio}fr ${100 - widget.container.ratio}fr`,
                }
              : undefined
          "
        >
          <SharedDashboardCanvas
            v-for="slot in regions(widget)"
            :key="slot"
            ref="childCanvases"
            v-show="widget.container.kind !== 'tabs' || (activeTabs[widget.id] || '0') === slot"
            v-bind="props"
            :parent-id="widget.id"
            :region="slot"
            :id="`region-${widget.id}-${slot}`"
            :tab-label-id="
              widget.container.kind === 'tabs' ? `tab-${widget.id}-${slot}` : undefined
            "
            @select="(id, event) => emit('select', id, event)"
            @edit="emit('edit', $event)"
            @resize="(event, id, direction) => emit('resize', event, id, direction)"
            @move="(event, id) => emit('move', event, id)"
            @save-note="(id, text) => emit('save-note', id, text)"
            @save-calendar="emit('save-calendar', $event)"
            @save-tasks="emit('save-tasks', $event)"
            @publish-announcement="emit('publish-announcement', $event)"
            @save-announcement-drafts="emit('save-announcement-drafts', $event)"
          />
        </div>
      </div>
      <div
        v-else-if="widget.type === 'text'"
        class="shared-variable-text"
        :style="textStyle(widget)"
      >
        {{ resolveDashboardText(widget.text, textContext).text }}
      </div>
      <template v-else-if="widget.type === 'workflows'">
        <AppLoadingIndicator
          v-if="scope !== 'job' && !editing && jobsLoading"
          inline
          label="Loading jobs for tools."
        />
        <p v-else-if="scope !== 'job' && !editing && jobsError" role="alert">
          Jobs could not be loaded. {{ jobsError }} Use Refresh to try again.
        </p>
        <p v-else-if="scope !== 'job' && !editing && !jobs.length">
          No jobs are available for your account.
        </p>
        <label v-else-if="scope !== 'job' && !editing" class="shared-widget-tools"
          >Choose job for tools<select v-model="toolJobId">
            <option value="">Choose a job</option>
            <option v-for="entry in jobs" :key="entry.id" :value="entry.id">
              {{ entry.code }} · {{ entry.name }}
            </option>
          </select></label
        >
        <DashboardWorkflowsWidget
          v-if="toolJob && (scope === 'job' || (!jobsLoading && !jobsError))"
          :job-id="toolJob.id"
          :scope="scope"
          :editing="editing"
        />
        <p v-else-if="!jobsLoading && !jobsError && (scope === 'job' || jobs.length || editing)">
          Choose a job to open Timecards, Daily Logs, Shop Orders, Company Library and available
          forms.
        </p>
      </template>
      <DashboardJobInformation
        v-else-if="widget.type === 'job-info'"
        :job="job"
        :jobs="jobs"
        :loading="jobsLoading"
        :error="jobsError"
        :editing="editing"
        :job-scope="scope === 'job'"
      />
      <DashboardJobsWidget
        v-else-if="widget.type === 'jobs'"
        :scope="scope"
        :job-id="job?.id"
        :can-create-jobs="canCreateJobs"
        :can-manage-jobs="canManageJobs"
        :editable-job-ids="editableJobIds"
        :jobs="jobs"
        :editing="editing"
        :jobs-loading="jobsLoading"
        :jobs-error="jobsError"
      />
      <div v-else-if="widget.type === 'dates'" class="shared-widget-tools">
        <p v-if="editing">
          Calendar entries stay separate for each
          {{ scope === 'job' ? 'job' : 'signed-in person' }}.
        </p>
        <form v-else-if="calendarEditing" @submit.prevent="emit('save-calendar', calendarDraft)">
          <div
            v-for="(entry, index) in calendarDraft"
            :key="entry.id"
            class="shared-calendar-entry"
          >
            <label
              >Event title<input
                v-model="entry.title"
                required
                maxlength="200"
                :disabled="busy" /></label
            ><label>Date<input v-model="entry.date" type="date" required :disabled="busy" /></label
            ><AppButton
              type="button"
              :disabled="busy"
              :aria-label="`Remove calendar date ${index + 1}`"
              @click="calendarDraft.splice(index, 1)"
            >
              Remove
            </AppButton>
          </div>
          <AppButton type="button" :disabled="busy || calendarDraft.length >= 100" @click="addDate">
            Add date</AppButton
          ><AppButton variant="primary" type="submit" :disabled="busy">Save calendar</AppButton
          ><AppButton type="button" :disabled="busy" @click="cancelLocalCalendar"
            >Cancel calendar</AppButton
          >
        </form>
        <template v-else
          ><DashboardCalendarAgenda :events="dates" />
          <AppButton
            v-if="canEditNotes"
            type="button"
            :disabled="busy || !!noteId || tasksEditing || announcementsEditing"
            @click="editCalendar"
          >
            Edit calendar
          </AppButton></template
        >
      </div>
      <DashboardAnnouncements
        v-else-if="widget.type === 'announcements'"
        :scope="scope"
        :job-id="job?.id"
        :jobs="jobs"
        :layout-editing="editing"
      />
      <DashboardAnnouncementDrafts
        v-else-if="
          widget.type === 'announcement-drafts' && scope === 'personal' && role === 'admin'
        "
        ref="announcementEditors"
        :items="announcementDrafts || []"
        :jobs="jobs"
        :published-draft-ids="publishedDraftIds || []"
        @publish="emit('publish-announcement', $event)"
        :busy="busy || !!noteId || calendarEditing || tasksEditing"
        :layout-editing="editing"
        @save="emit('save-announcement-drafts', $event)"
      />
      <DashboardPersonalTasks
        v-else-if="widget.type === 'tasks' && scope === 'personal'"
        ref="taskEditors"
        :items="tasks || []"
        :busy="busy || !!noteId || calendarEditing || announcementsEditing"
        :layout-editing="editing"
        @save="emit('save-tasks', $event)"
      />
      <div v-else-if="widget.type === 'notes'" class="shared-widget-tools">
        <p v-if="editing">
          Notes stay separate for each {{ scope === 'job' ? 'job' : 'signed-in person' }}.
        </p>
        <form
          v-else-if="noteId === widget.id"
          @submit.prevent="emit('save-note', widget.id, noteText)"
        >
          <label :for="'dashboard-note-' + widget.id"
            >{{ scope === 'job' ? 'Job notes' : 'Your notes'
            }}<textarea
              :id="'dashboard-note-' + widget.id"
              v-model="noteText"
              maxlength="8000"
              :disabled="busy"
            /></label
          ><AppButton variant="primary" type="submit" :disabled="busy || !notesDirty"
            >Save notes</AppButton
          ><AppButton type="button" :disabled="busy" @click="cancelLocalNote"
            >Cancel notes</AppButton
          >
        </form>
        <template v-else
          ><p class="shared-note-text">{{ notes[widget.id] || 'No notes yet.' }}</p>
          <AppButton
            v-if="canEditNotes"
            type="button"
            :disabled="busy || !!noteId || calendarEditing || tasksEditing || announcementsEditing"
            @click="beginNote(widget.id)"
          >
            Edit notes
          </AppButton></template
        >
      </div>
      <template v-else-if="editing"
        ><p>
          {{ sharedWidgetLabels[widget.type] }} appears here when you finish editing the template.
        </p></template
      >
      <p
        v-else-if="
          scope === 'job' && !job && (widget.type === 'form' || widget.type === 'documents')
        "
      >
        Choose a job to use {{ sharedWidgetLabels[widget.type].toLowerCase() }}.
      </p>
      <CompanyLibraryWidget
        ref="libraries"
        v-else-if="widget.type === 'documents'"
        :key="scope === 'job' ? job?.id : 'role-documents'"
        class="shared-library-widget"
        :show-heading="false"
      />
      <RoleResourcesModule
        ref="resources"
        v-else-if="widget.type === 'resources'"
        :key="resourceRole || role"
        :fixed-role="resourceRole || role"
      />
      <SharedDashboardForm
        v-else-if="widget.type === 'form'"
        ref="forms"
        :widget="widget"
        :scope="scope"
        :can-respond="['admin', 'project-manager', 'foreman', 'shop-foreman'].includes(role)"
        :job-id="scope === 'job' ? job?.id : undefined"
      />
      <template v-if="editing">
        <button
          v-for="direction in resizeDirections"
          v-show="direction === 'se' || (selectedIds || [selected]).includes(widget.id)"
          :key="direction"
          type="button"
          :class="['shared-widget-resize', 'resize-' + direction]"
          :aria-label="
            'Resize ' +
            (widget.title || sharedWidgetLabels[widget.type]) +
            (direction === 'se' ? '' : ' from ' + direction)
          "
          :disabled="
            busy ||
            geometryLocked(widgets, widget, 'sizeLocked') ||
            (geometryLocked(widgets, widget, 'positionLocked') && /[nw]/.test(direction))
          "
          @pointerdown.stop="emit('resize', $event, widget.id, direction)"
          @dragstart.prevent
          @click.stop="emit('edit', widget.id)"
        >
          {{ direction === 'se' ? '↘' : '' }}
        </button>
      </template>
    </article>
  </div>
</template>
