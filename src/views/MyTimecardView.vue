<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import TimecardPageShell from '@/components/timecards/TimecardPageShell.vue'
import TimecardWorkbookCard from '@/components/timecards/TimecardWorkbookCard.vue'
import TimecardButton from '@/components/timecards/TimecardButton.vue'
import type { TimecardCardRecord } from '@/types/domain'
import TimecardPageMessage from '@/components/timecards/TimecardPageMessage.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useAuthStore } from '@/stores/auth'
import {
  getTodayIsoDate,
  snapToSaturday,
  buildEmployeeCard,
  getWeekStartFromSaturday,
  recalculateCardTotals,
} from '@/features/timecards/workbook'
import {
  personalTimecardRequest,
  type PersonalTimecardInput,
  type PersonalTimecardResult,
} from '@/services/personalTimecard'
const auth = useAuthStore(),
  jobId = ref(''),
  week = ref(snapToSaturday(getTodayIsoDate()))
const jobChoice = ref(''),
  weekChoice = ref(week.value)
const result = ref<PersonalTimecardResult | null>(null),
  draft = ref<PersonalTimecardInput | null>(null),
  baseline = ref(''),
  error = ref(''),
  info = ref(''),
  busy = ref(false),
  confirmOpen = ref(false)
const dirty = computed(() => !!draft.value && JSON.stringify(draft.value) !== baseline.value)
const assignedJobs = ref<Array<{ id: string; code: string; name: string }>>([])
const currentPeriod = ref(week.value)
const workbook = ref<TimecardCardRecord | null>(null)
function acceptCard(next: PersonalTimecardResult) {
  result.value = next
  draft.value = next.card ? { lines: structuredClone(next.card.lines), notes: next.card.notes } : null
  baseline.value = JSON.stringify(draft.value)
  workbook.value = next.card ? {
    id: 'personal', ...buildEmployeeCard({
      employeeId: 'self', firstName: next.identity?.firstName ?? next.employeeName,
      lastName: next.identity?.lastName ?? '', employeeNumber: next.identity?.employeeNumber ?? '',
      occupation: next.identity?.occupation ?? '', wageRate: null, isContractor: false,
    }, week.value, 0),
  } : null
  if (workbook.value && next.card) {
    workbook.value.notes = next.card.notes
    workbook.value.regularHoursOverride = next.card.display?.regularHoursOverride ?? null
    workbook.value.overtimeHoursOverride = next.card.display?.overtimeHoursOverride ?? null
    workbook.value.lines.forEach((line, index) => {
      const saved = next.card!.lines[index]!
      Object.assign(line, { jobNumber: saved.jobNumber, subsectionArea: saved.subsectionArea, account: saved.account })
      const display = next.card!.display?.lines[index]
      if (display) Object.assign(line, { difH: display.difH, difP: display.difP, offHours: display.offHours, offProduction: display.offProduction })
      line.days.forEach((day, dayIndex) => {
        day.hours = saved.hours[dayIndex] ?? 0
        day.production = display?.production[dayIndex] ?? 0
      })
    })
    recalculateCardTotals(workbook.value, getWeekStartFromSaturday(week.value))
  }
}
function workbookChanged() {
  if (!workbook.value || !draft.value) return
  recalculateCardTotals(workbook.value, getWeekStartFromSaturday(week.value))
  draft.value = { notes: workbook.value.notes, lines: workbook.value.lines.map(line => ({
    jobNumber: line.jobNumber, subsectionArea: line.subsectionArea, account: line.account,
    hours: line.days.map(day => day.hours),
  })) }
}
async function initialize() {
  clear()
  assignedJobs.value = []
  jobId.value = jobChoice.value = ''
  const current = epoch
  busy.value = true
  try {
    const context = await personalTimecardRequest({ personalAction: 'context' })
    if (current !== epoch) return
    assignedJobs.value = context.jobs ?? []
    currentPeriod.value = week.value = weekChoice.value = context.currentWeekEndDate ?? snapToSaturday(getTodayIsoDate())
    jobId.value = jobChoice.value = context.defaultJobId ?? ''
  } catch (cause) {
    if (current === epoch) error.value = (cause as Error).message
  } finally { if (current === epoch) busy.value = false }
  if (current === epoch && jobId.value) await load()
}
let epoch = 0,
  pendingDiscard: ((answer: boolean) => void) | null = null,
  retry: { signature: string; requestId: string } | null = null
function askDiscard() {
  if (!dirty.value) return Promise.resolve(true)
  return new Promise<boolean>((resolve) => {
    pendingDiscard?.(false)
    pendingDiscard = resolve
    confirmOpen.value = true
  })
}
function finishDiscard(answer: boolean) {
  confirmOpen.value = false
  pendingDiscard?.(answer)
  pendingDiscard = null
}
function clear() {
  epoch++
  result.value = null
  draft.value = null
  workbook.value = null
  baseline.value = ''
  error.value = ''
  info.value = ''
  busy.value = false
  retry = null
}
async function changeScope(kind: 'job' | 'week', value: string) {
  if (busy.value || !(await askDiscard())) {
    jobChoice.value = jobId.value
    weekChoice.value = week.value
    return
  }
  clear()
  if (kind === 'job') jobId.value = value
  else week.value = weekChoice.value = snapToSaturday(value)
  await load()
}
async function load() {
  if (busy.value || !jobId.value || !(await askDiscard())) return
  const current = ++epoch
  busy.value = true
  error.value = ''
  info.value = ''
  try {
    const next = await personalTimecardRequest({
      personalAction: 'load',
      jobId: jobId.value,
      weekEndDate: week.value,
    })
    if (current !== epoch) return
    acceptCard(next)
    retry = null
  } catch (cause) {
    if (current === epoch) error.value = (cause as Error).message
  } finally {
    if (current === epoch) busy.value = false
  }
}
async function save() {
  if (busy.value || !draft.value || result.value?.readOnly || !dirty.value) return
  const current = epoch,
    payload = JSON.parse(JSON.stringify(draft.value)) as PersonalTimecardInput,
    signature = JSON.stringify(payload)
  if (retry?.signature !== signature) retry = { signature, requestId: crypto.randomUUID() }
  busy.value = true
  error.value = ''
  info.value = ''
  try {
    const next = await personalTimecardRequest({
      personalAction: 'save',
      jobId: jobId.value,
      weekEndDate: week.value,
      card: payload,
      expectedVersion: result.value?.version ?? null,
      requestId: retry.requestId,
    })
    if (current !== epoch) return
    if (next.state !== 'ready' || !next.card)
      throw new Error('The payroll week is unavailable. Your unsaved edits are retained.')
    acceptCard(next)
    retry = null
    info.value = 'Your timecard draft was saved. The job lead or payroll submits the full week.'
  } catch (cause) {
    if (current === epoch) error.value = (cause as Error).message
  } finally {
    if (current === epoch) busy.value = false
  }
}
function leave(event: BeforeUnloadEvent) {
  if (dirty.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onBeforeRouteLeave(() => (busy.value ? false : askDiscard()))
watch(
  () => [auth.currentUser?.uid, auth.rawRole, auth.hasWorkspaceAccess],
  () => {
    clear()
    jobId.value = ''
    jobChoice.value = ''
    weekChoice.value = week.value
    finishDiscard(false)
    if (auth.hasWorkspaceAccess) void initialize()
  },
)
onMounted(() => {
  window.addEventListener('beforeunload', leave)
  void initialize()
})
onBeforeUnmount(() => {
  epoch++
  finishDiscard(false)
  window.removeEventListener('beforeunload', leave)
})
</script>
<template>
  <TimecardPageShell test-id="personal-timecard-workspace">
    <template #workspace>
      <header class="personal-heading"><h1>My Timecard</h1><p>Enter your hours on the shared job timecard.</p></header>
      <div class="personal-toolbar">
        <label>Payroll job<select v-model="jobChoice" :disabled="busy" @change="changeScope('job', jobChoice)">
          <option value="">Select a job</option><option v-for="job in assignedJobs" :key="job.id" :value="job.id">{{ job.code }} — {{ job.name }}</option>
        </select></label>
        <label>Week ending (Saturday)<input v-model="weekChoice" type="date" :max="currentPeriod" :disabled="busy" @change="changeScope('week', weekChoice)" /></label>
        <TimecardButton :disabled="busy || !jobId" @click="load">{{ busy ? 'Working…' : 'Reload saved card' }}</TimecardButton>
      </div>
      <TimecardPageMessage v-if="error" tone="error" :message="error" />
      <TimecardPageMessage v-if="info" :message="info" />
      <p v-if="!busy && !error && !assignedJobs.length">No active jobs are assigned to your linked employee account. Contact your administrator.</p>
      <p v-if="result?.state === 'week-not-open'">No timecard is open for this period. The job lead or payroll opens the job's week.</p>
      <template v-if="workbook && result">
        <p v-if="result.readOnly" role="status">This timecard is locked and available to view only.</p>
        <p v-else>Saving updates your card in the foreman's job timecard. Payroll fields remain protected.</p>
        <div class="my-timecard__scroll" tabindex="0" aria-label="Timecard worksheet, scroll horizontally for all days">
          <TimecardWorkbookCard :key="jobId + week + result.version" :card="workbook" :week-end-date="week"
            :read-only="busy || result.readOnly" :show-employee-wage="false" :show-cost-values="false" personal-entry @changed="workbookChanged" />
        </div>
        <TimecardButton variant="primary" :disabled="busy || result.readOnly || !dirty" @click="save">Save my timecard</TimecardButton>
      </template>
    </template>
    <ConfirmDialog :open="confirmOpen" title="Discard unsaved timecard changes?" message="Your unsaved changes will be lost." confirm-label="Discard changes" @confirm="finishDiscard(true)" @cancel="finishDiscard(false)" />
  </TimecardPageShell>
</template>
<style scoped>
.personal-heading h1 { margin: 0; font-size: 1.5rem; }
.personal-heading p { margin: .35rem 0 0; }
.personal-toolbar { display: flex; align-items: end; gap: .75rem; flex-wrap: wrap; }
.personal-toolbar label { display: grid; gap: .3rem; font-weight: 700; min-width: 0; }
.personal-toolbar input, .personal-toolbar select { color-scheme: light; min-height: var(--timecards-toolbar-control-height); border: 1px solid var(--timecards-toolbar-control-border); border-radius: var(--timecards-toolbar-control-radius); background: var(--timecards-toolbar-control-bg); color: var(--timecards-toolbar-control-text); padding: .4rem .6rem; max-width: 100%; font: inherit; }
.personal-toolbar input:focus-visible, .personal-toolbar select:focus-visible { outline: none; box-shadow: var(--timecards-toolbar-focus-ring); }
.my-timecard__scroll { max-width: 100%; min-width: 0; overflow: auto; padding: .5rem; background: rgba(255,255,255,.22); }
@media(max-width: 600px) { .personal-toolbar { display: grid; } }
</style>
