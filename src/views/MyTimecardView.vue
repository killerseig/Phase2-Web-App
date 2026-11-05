<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import AppShell from '@/layouts/AppShell.vue'
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppField from '@/components/common/AppField.vue'
import AppSelect from '@/components/common/AppSelect.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'
import AppStatusMessage from '@/components/common/AppStatusMessage.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useJobsStore } from '@/stores/jobs'
import {
  getTodayIsoDate,
  snapToSaturday,
  TIMECARD_VISIBLE_DAY_INDEXES,
  TIMECARD_VISIBLE_DAY_LABELS,
} from '@/features/timecards/workbook'
import {
  personalTimecardRequest,
  type PersonalTimecardInput,
  type PersonalTimecardResult,
} from '@/services/personalTimecard'
const auth = useAuthStore(),
  jobs = useJobsStore(),
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
const dayIndexes = TIMECARD_VISIBLE_DAY_INDEXES,
  dayLabels = TIMECARD_VISIBLE_DAY_LABELS
const totalHours = computed(
  () =>
    draft.value?.lines.reduce((sum, line) => sum + line.hours.reduce((a, b) => a + b, 0), 0) || 0,
)
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
  else week.value = value
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
    result.value = next
    draft.value = next.card ? structuredClone(next.card) : null
    baseline.value = JSON.stringify(draft.value)
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
    result.value = next
    draft.value = structuredClone(next.card)
    baseline.value = JSON.stringify(draft.value)
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
  },
)
onMounted(() => {
  window.addEventListener('beforeunload', leave)
  void jobs.subscribeVisibleJobs()
})
onBeforeUnmount(() => {
  epoch++
  finishDiscard(false)
  window.removeEventListener('beforeunload', leave)
})
</script>
<template>
  <AppShell
    ><main class="my-timecard">
      <AppPaneHeader title="My Timecard" eyebrow="Workspace" description="Enter your own time across job lines using the existing payroll workbook. Your administrator must confirm your employee link and enable your role first." />
      <div class="my-timecard__toolbar">
        <AppField label="Payroll job"
          ><AppSelect
            v-model="jobChoice"
            :disabled="busy"
            @update:model-value="changeScope('job', $event)"
            ><option value="">Select a job</option>
            <option v-for="job in jobs.activeJobs" :key="job.id" :value="job.id">
              {{ job.code }} · {{ job.name }}
            </option></AppSelect
          ></AppField
        >
        <AppField label="Week ending (Saturday)"
          ><AppTextInput
            v-model="weekChoice"
            type="date"
            :disabled="busy"
            @update:model-value="changeScope('week', $event)"
        /></AppField>
        <AppButton :disabled="busy || !jobId" @click="load">{{
          busy ? 'Working…' : draft ? 'Reload saved card' : 'Open my timecard'
        }}</AppButton>
      </div>
      <AppStatusMessage v-if="error" tone="error" :message="error" /><AppStatusMessage
        v-if="info"
        tone="success"
        :message="info"
      />
      <AppStatusMessage
        v-if="result?.state === 'week-not-open'"
        message="The job lead or payroll must open this job’s week first. Personal entry does not copy the crew roster."
      />
      <template v-if="draft && result"
        ><h2>{{ result.employeeName }}</h2>
        <p v-if="result.readOnly">This week is locked. Contact payroll for a correction.</p>
        <p v-else>
          Split hours between job numbers below. Saving updates only your draft card; it does not
          submit the crew’s week or send email.
        </p>
        <fieldset :disabled="busy || result.readOnly">
          <legend class="my-timecard__legend">Personal job lines</legend>
          <div
            class="my-timecard__scroll"
            tabindex="0"
            aria-label="Timecard job lines, scroll horizontally for all days"
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Job #</th>
                  <th scope="col">Area</th>
                  <th scope="col">Account</th>
                  <th v-for="day in dayLabels" :key="day" scope="col">{{ day }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(line, index) in draft.lines" :key="index">
                  <td>
                    <AppTextInput
                      v-model="line.jobNumber"
                      :aria-label="`Line ${index + 1} job number`"
                      maxlength="120"
                    />
                  </td>
                  <td>
                    <AppTextInput
                      v-model="line.subsectionArea"
                      :aria-label="`Line ${index + 1} area`"
                      maxlength="120"
                    />
                  </td>
                  <td>
                    <AppTextInput
                      v-model="line.account"
                      :aria-label="`Line ${index + 1} account`"
                      maxlength="120"
                    />
                  </td>
                  <td v-for="(day, position) in dayIndexes" :key="day">
                    <AppTextInput
                      :model-value="line.hours[day] || ''"
                      type="number"
                      min="0"
                      max="24"
                      step=".25"
                      :aria-label="`Line ${index + 1} ${dayLabels[position]} hours`"
                      @update:model-value="line.hours[day] = Number($event)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <AppField label="Notes">
            <textarea v-model="draft.notes" maxlength="4000" rows="3" />
          </AppField>
        </fieldset>
        <footer>
          <span>Total hours: {{ totalHours }} <span v-if="dirty">· Unsaved changes</span></span
          ><AppButton
            variant="primary"
            :disabled="busy || result.readOnly || !dirty"
            @click="save"
            >{{ busy ? 'Saving…' : 'Save my timecard' }}</AppButton
          >
        </footer>
      </template>
      <ConfirmDialog
        :open="confirmOpen"
        title="Discard unsaved time?"
        message="Your unsaved edits will be discarded. Saved payroll entries are unchanged."
        confirm-label="Discard edits"
        @confirm="finishDiscard(true)"
        @cancel="finishDiscard(false)"
      /></main
  ></AppShell>
</template>
<style scoped>
.my-timecard {
  display: grid;
  gap: 1rem;
  padding: var(--page-padding, 1rem);
  min-width: 0;
}
.my-timecard h1,
.my-timecard h2,
.my-timecard p {
  margin: 0;
}
.my-timecard p {
  color: var(--text-muted);
  line-height: 1.5;
}
.my-timecard__toolbar {
  display: flex;
  align-items: end;
  gap: 1rem;
  flex-wrap: wrap;
}
.my-timecard__toolbar .app-field {
  flex: 1 1 14rem;
}
.my-timecard fieldset {
  border: 1px solid var(--border);
  border-radius: var(--radius-md, 8px);
  background: var(--panel-background);
  padding: 1rem;
  min-width: 0;
  display: grid;
  gap: 1rem;
}
.my-timecard__legend {
  padding: 0 0.5rem;
}
.my-timecard__scroll {
  overflow: auto;
  max-height: 32rem;
}
.my-timecard table {
  border-collapse: collapse;
  min-width: 55rem;
  width: 100%;
  color: var(--text);
}
.my-timecard th,
.my-timecard td {
  padding: 0.35rem;
  border-bottom: 1px solid var(--border);
  text-align: left;
}
.my-timecard th {
  position: sticky;
  top: 0;
  background: var(--panel-background);
  z-index: 1;
}
.my-timecard td:first-child {
  min-width: 7rem;
}
.my-timecard td:nth-child(2) {
  min-width: 9rem;
}
.my-timecard td:nth-child(3) {
  min-width: 7rem;
}
.my-timecard footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}
.my-timecard textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: var(--control-radius);
  padding: 0.7rem;
  background: var(--control-background);
  color: var(--text);
  font: inherit;
  resize: vertical;
}
@media (max-width: 600px) {
  .my-timecard__toolbar > * {
    width: 100%;
  }
  .my-timecard footer .app-button {
    width: 100%;
  }
  .my-timecard fieldset {
    padding: 0.5rem;
  }
}
</style>
