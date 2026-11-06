<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue'
import AppLoadingIndicator from '@/components/common/AppLoadingIndicator.vue'
import { computed, defineAsyncComponent, ref, watch } from 'vue'
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
  notes: Record<string, string>
  events: SharedCalendarEntry[]
  role: RawRoleKey
  resourceRole?: RawRoleKey
  textContext: DashboardTextContext
  editing: boolean
  dropTarget?: WidgetDrop
  selected: string
  canEditNotes: boolean
  busy: boolean
  phone?: boolean
}>()
const emit = defineEmits<{
  select: [id: string]
  edit: [id: string]
  move: [event: PointerEvent, id: string]
  'save-note': [id: string, text: string]
  'save-calendar': [events: SharedCalendarEntry[]]
}>()
type NavigationParticipant = { prepareNavigation: () => boolean | Promise<boolean> }
const forms = ref<NavigationParticipant[]>([])
const libraries = ref<NavigationParticipant[]>([])
const resources = ref<NavigationParticipant[]>([])
const noteId = ref(''),
  noteText = ref(''),
  calendarEditing = ref(false),
  calendarDraft = ref<SharedCalendarEntry[]>([]),
  toolJobId = ref(props.initialToolJobId || '')
watch(() => props.initialToolJobId, id => { toolJobId.value = id || '' })
const notesDirty = computed(
  () =>
    (!!noteId.value && noteText.value !== (props.notes[noteId.value] || '')) ||
    (calendarEditing.value && JSON.stringify(calendarDraft.value) !== JSON.stringify(props.events)),
)
const toolJob = computed(() => props.job || props.jobs.find((job) => job.id === toolJobId.value))
function beginNote(id: string) {
  if (!props.canEditNotes || props.busy || noteId.value || calendarEditing.value) return
  noteId.value = id
  noteText.value = props.notes[id] || ''
}
function cancelNote() {
  noteId.value = ''
  noteText.value = ''
  calendarEditing.value = false
  calendarDraft.value = []
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
  finishNote: cancelNote,
  prepareForms: async () => {
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
    :class="{ 'phone-preview': phone, 'is-empty-editor': editing && !widgets.length, 'is-drop-target': editing && dropTarget?.surface === 'shared-dashboard' }"
    data-widget-surface="shared-dashboard"
  >
    <div v-if="editing && !widgets.length" class="shared-empty-canvas">
      <h2>Start your dashboard</h2>
      <p>Drag a widget here, or choose one from the widget library.</p>
    </div>
    <article
      v-for="widget in widgets"
      :key="widget.id"
      :data-widget-id="widget.id"
      class="shared-dashboard-widget"
      :class="{ 'is-selected': editing && selected === widget.id }"
      :data-drop-edge="editing && dropTarget?.surface === 'shared-dashboard' && dropTarget.overId === widget.id ? dropTarget.edge : undefined"
      :style="{ '--widget-span': widget.span }"
      @click="editing && emit('select', widget.id)"
    >
      <header class="shared-widget-heading">
        <h2>{{ widget.title || sharedWidgetLabels[widget.type] }}</h2>
        <AppButton
          v-if="editing"
          class="shared-widget-edit builder-floating"
          :disabled="busy"
          :aria-label="`Edit ${widget.title || sharedWidgetLabels[widget.type]}`"
          @click.stop="emit('edit', widget.id)"
        >Edit</AppButton>
        <AppButton
          v-if="editing"
          class="shared-widget-move builder-floating"
          type="button"
          :disabled="busy"
          :aria-label="`Move ${widget.title || sharedWidgetLabels[widget.type]}`"
          @pointerdown="emit('move', $event, widget.id)"
          @click.stop="emit('select', widget.id)"
        >
          Move
        </AppButton>
      </header>
      <div v-if="widget.type === 'text'" class="shared-variable-text" :style="textStyle(widget)">
        {{ resolveDashboardText(widget.text, textContext).text }}
      </div>
      <template v-else-if="widget.type === 'workflows'">
        <AppLoadingIndicator v-if="scope !== 'job' && !editing && jobsLoading" inline label="Loading jobs for tools." />
        <p v-else-if="scope !== 'job' && !editing && jobsError" role="alert">Jobs could not be loaded. {{ jobsError }} Use Refresh to try again.</p>
        <p v-else-if="scope !== 'job' && !editing && !jobs.length">No jobs are available for your account.</p>
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
        <p v-else-if="!jobsLoading && !jobsError && (scope === 'job' || jobs.length || editing)">Choose a job to open Timecards, Daily Logs, Shop Orders, Company Library and available forms.</p>
      </template>
      <DashboardJobInformation v-else-if="widget.type === 'job-info'" :job="job" :jobs="jobs" :loading="jobsLoading" :error="jobsError" :editing="editing" :job-scope="scope === 'job'" />
      <DashboardJobsWidget v-else-if="widget.type === 'jobs'" :jobs="jobs" :editing="editing" :jobs-loading="jobsLoading" :jobs-error="jobsError" />
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
          ><AppButton type="button" :disabled="busy" @click="cancelNote">Cancel calendar</AppButton>
        </form>
        <template v-else
          ><DashboardCalendarAgenda :events="dates" />
          <AppButton
            v-if="canEditNotes"
            type="button"
            :disabled="busy || !!noteId"
            @click="editCalendar"
          >
            Edit calendar
          </AppButton></template
        >
      </div>
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
          ><AppButton variant="primary" type="submit" :disabled="busy || !notesDirty">Save notes</AppButton
          ><AppButton type="button" :disabled="busy" @click="cancelNote">Cancel notes</AppButton>
        </form>
        <template v-else
          ><p class="shared-note-text">{{ notes[widget.id] || 'No notes yet.' }}</p>
          <AppButton
            v-if="canEditNotes"
            type="button"
            :disabled="busy || !!noteId || calendarEditing"
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
      <p v-else-if="scope==='job'&&!job&&(widget.type==='form'||widget.type==='documents')">Choose a job to use {{sharedWidgetLabels[widget.type].toLowerCase()}}.</p>
      <CompanyLibraryWidget
        ref="libraries"
        v-else-if="widget.type === 'documents'"
        :key="scope === 'job' ? job?.id : 'role-documents'"
        class="shared-library-widget"
        :show-heading="false"
      />
      <RoleResourcesModule ref="resources" v-else-if="widget.type === 'resources'" :key="resourceRole || role" :fixed-role="resourceRole || role" />
      <SharedDashboardForm
        v-else-if="widget.type === 'form'"
        ref="forms"
        :widget="widget"
        :scope="scope"
        :can-respond="['admin', 'project-manager', 'foreman', 'shop-foreman'].includes(role)"
        :job-id="scope === 'job' ? job?.id : undefined"
      />
    </article>
  </div>
</template>
