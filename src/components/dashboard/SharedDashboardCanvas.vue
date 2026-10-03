<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import { RouterLink } from 'vue-router'
import ModuleLauncherGrid from '@/components/jobs/ModuleLauncherGrid.vue'
import { getJobDashboardModules } from '@/features/jobs/jobDashboardModules'
import SdsExplorerModule from './SdsExplorerModule.vue'
import RoleResourcesModule from './RoleResourcesModule.vue'
import {
  sharedWidgetLabels,
  type SharedDashboardWidget,
  type SharedDashboardJob,
  type SharedDashboardScope,
  type SharedCalendarEntry,
} from '@/features/dashboard/sharedDashboards'
import { resolveDashboardText, type DashboardTextContext } from '@/features/dashboard/sharedText'
import type { JobRecord, RawRoleKey } from '@/types/domain'
const SharedDashboardForm = defineAsyncComponent(() => import('./SharedDashboardForm.vue'))
const props = defineProps<{
  scope: SharedDashboardScope
  widgets: SharedDashboardWidget[]
  job: SharedDashboardJob | null
  jobs: JobRecord[]
  notes: Record<string, string>
  events: SharedCalendarEntry[]
  role: RawRoleKey
  textContext: DashboardTextContext
  editing: boolean
  selected: string
  canEditNotes: boolean
  busy: boolean
  phone?: boolean
}>()
const emit = defineEmits<{
  select: [id: string]
  move: [event: PointerEvent, id: string]
  'save-note': [id: string, text: string]
  'save-calendar': [events: SharedCalendarEntry[]]
}>()
const forms = ref<{ prepareNavigation: () => Promise<boolean> }[]>([])
const noteId = ref(''),
  noteText = ref(''),
  calendarEditing = ref(false),
  calendarDraft = ref<SharedCalendarEntry[]>([]),
  toolJobId = ref('')
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
    for (const form of forms.value) if (!(await form.prepareNavigation())) return false
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
    :class="{ 'phone-preview': phone }"
    data-widget-surface="shared-dashboard"
  >
    <article
      v-for="widget in widgets"
      :key="widget.id"
      :data-widget-id="widget.id"
      class="shared-dashboard-widget"
      :class="{ 'is-selected': editing && selected === widget.id }"
      :style="{ '--widget-span': widget.span }"
      @click="editing && emit('select', widget.id)"
    >
      <header class="shared-widget-heading">
        <h2>{{ widget.title || sharedWidgetLabels[widget.type] }}</h2>
        <button
          v-if="editing"
          class="shared-widget-move builder-floating"
          type="button"
          :aria-label="`Move ${widget.title || sharedWidgetLabels[widget.type]}`"
          @pointerdown="emit('move', $event, widget.id)"
          @click.stop="emit('select', widget.id)"
        >
          Move
        </button>
      </header>
      <div v-if="widget.type === 'text'" class="shared-variable-text" :style="textStyle(widget)">
        {{ resolveDashboardText(widget.text, textContext).text }}
      </div>
      <template v-else-if="widget.type === 'workflows'">
        <label v-if="scope === 'role' && !editing"
          >Choose job for tools<select v-model="toolJobId">
            <option value="">Choose a job</option>
            <option v-for="entry in jobs" :key="entry.id" :value="entry.id">
              {{ entry.code }} · {{ entry.name }}
            </option>
          </select></label
        >
        <ModuleLauncherGrid
          v-if="toolJob"
          :job-id="toolJob.id"
          :modules="getJobDashboardModules()"
          :inert="editing"
        />
        <p v-else>Choose a job to open Timecards, Daily Logs and Shop Orders.</p>
      </template>
      <div v-else-if="widget.type === 'jobs'" class="shared-job-links" :inert="editing">
        <p v-if="!jobs.length">No jobs are available for your account.</p>
        <article v-for="entry in jobs" :key="entry.id">
          <RouterLink :to="{ name: 'shared-job-home', params: { jobId: entry.id } }"
            >{{ entry.code || 'No Job #' }} · {{ entry.name }}</RouterLink
          >
          <nav :aria-label="`${entry.name} tools`">
            <RouterLink :to="`/jobs/${entry.id}/timecards`">Timecards</RouterLink
            ><RouterLink :to="`/jobs/${entry.id}/daily-logs`">Daily Logs</RouterLink
            ><RouterLink :to="`/jobs/${entry.id}/shop-orders`">Shop Orders</RouterLink>
          </nav>
        </article>
      </div>
      <div v-else-if="widget.type === 'dates'">
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
            ><button
              type="button"
              :disabled="busy"
              :aria-label="`Remove calendar date ${index + 1}`"
              @click="calendarDraft.splice(index, 1)"
            >
              Remove
            </button>
          </div>
          <button type="button" :disabled="busy || calendarDraft.length >= 100" @click="addDate">
            Add date</button
          ><button type="submit" :disabled="busy">Save calendar</button
          ><button type="button" :disabled="busy" @click="cancelNote">Cancel calendar</button>
        </form>
        <template v-else
          ><p v-if="!dates.length">No calendar dates yet.</p>
          <ul v-else class="shared-dates">
            <li v-for="date in dates" :key="date.id">
              <time :datetime="date.date">{{ date.date }}</time
              ><span>{{ date.title }}</span>
            </li>
          </ul>
          <button
            v-if="canEditNotes"
            type="button"
            :disabled="busy || !!noteId"
            @click="editCalendar"
          >
            Edit calendar
          </button></template
        >
      </div>
      <div v-else-if="widget.type === 'notes'">
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
          ><button type="submit" :disabled="busy || !notesDirty">Save notes</button
          ><button type="button" :disabled="busy" @click="cancelNote">Cancel notes</button>
        </form>
        <template v-else
          ><p class="shared-note-text">{{ notes[widget.id] || 'No notes yet.' }}</p>
          <button
            v-if="canEditNotes"
            type="button"
            :disabled="busy || !!noteId || calendarEditing"
            @click="beginNote(widget.id)"
          >
            Edit notes
          </button></template
        >
      </div>
      <template v-else-if="editing"
        ><p>
          {{ sharedWidgetLabels[widget.type] }} appears here when you finish editing the template.
        </p></template
      >
      <p v-else-if="scope==='job'&&!job&&(widget.type==='form'||widget.type==='documents')">Choose a job to use {{sharedWidgetLabels[widget.type].toLowerCase()}}.</p>
      <SdsExplorerModule
        v-else-if="widget.type === 'documents'"
        :key="scope === 'job' ? job?.id : 'role-documents'"
        :title="widget.title || 'Documents'"
      />
      <RoleResourcesModule v-else-if="widget.type === 'resources'" :key="role" :fixed-role="role" />
      <SharedDashboardForm
        v-else-if="widget.type === 'form'"
        ref="forms"
        :widget="widget"
        :can-respond="['admin', 'project-manager', 'foreman', 'shop-foreman'].includes(role)"
        :job-id="scope === 'job' ? job?.id : undefined"
      />
    </article>
  </div>
</template>
