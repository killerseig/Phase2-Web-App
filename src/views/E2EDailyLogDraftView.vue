<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  cloneDailyLogPayload,
  createEmptyDailyLogPayload,
} from '@/features/dailyLogs/schema'
import type { DailyLogPayload, DailyLogRecord } from '@/types/domain'

const form = ref<DailyLogPayload>(createEmptyDailyLogPayload())
const hydratingForm = ref(false)
const lastSavedSignature = ref('')
const lastHydratedLogId = ref<string | null>(null)
const savingDraft = ref(false)
const saveTick = ref(0)

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

const draftLog = ref<DailyLogRecord>({
  id: 'e2e-daily-log-1',
  jobId: 'job-e2e',
  jobCode: '1A',
  jobName: 'Phase 2 Company Acoustical remodel',
  logDate: '2026-05-01',
  sequenceNumber: 1,
  status: 'draft',
  foremanUserId: 'foreman-e2e',
  foremanName: 'Chris (CJ) Larsen',
  additionalRecipients: [],
  payload: createEmptyDailyLogPayload(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
})

const selectedLog = computed(() => draftLog.value)

function serializePayload(payload: DailyLogPayload = form.value) {
  return JSON.stringify(cloneDailyLogPayload(payload))
}

function resetForm(log: DailyLogRecord | null = null) {
  hydratingForm.value = true
  form.value = log ? cloneDailyLogPayload(log.payload) : createEmptyDailyLogPayload()
  lastSavedSignature.value = serializePayload(form.value)
  lastHydratedLogId.value = log?.id ?? null
  hydratingForm.value = false
}

function clearAutoSaveTimer() {
  if (!autoSaveTimer) return
  clearTimeout(autoSaveTimer)
  autoSaveTimer = null
}

async function saveDraftImmediately() {
  if (!selectedLog.value) return true

  const nextSignature = serializePayload(form.value)
  if (nextSignature === lastSavedSignature.value) return true

  savingDraft.value = true

  try {
    await new Promise((resolve) => setTimeout(resolve, 40))
    draftLog.value = {
      ...draftLog.value,
      payload: cloneDailyLogPayload(form.value),
      updatedAt: Date.now(),
    }
    lastSavedSignature.value = nextSignature
    saveTick.value += 1
    return true
  } finally {
    savingDraft.value = false
  }
}

function queueAutoSave() {
  if (!selectedLog.value || hydratingForm.value) return

  const nextSignature = serializePayload(form.value)
  if (nextSignature === lastSavedSignature.value) return

  clearAutoSaveTimer()
  autoSaveTimer = setTimeout(() => {
    void saveDraftImmediately()
  }, 700)
}

watch(
  selectedLog,
  (log, previousLog) => {
    if (!log) {
      resetForm(null)
      return
    }

    const nextLogId = log.id
    const previousLogId = previousLog?.id ?? null
    const selectionChanged = nextLogId !== previousLogId || nextLogId !== lastHydratedLogId.value

    if (selectionChanged) {
      clearAutoSaveTimer()
      resetForm(log)
      return
    }

    const localSignature = serializePayload(form.value)
    const incomingSignature = serializePayload(log.payload)
    const hasUnsavedLocalChanges = localSignature !== lastSavedSignature.value

    if (hasUnsavedLocalChanges) return
    if (incomingSignature === lastSavedSignature.value) return

    resetForm(log)
  },
  { immediate: true },
)

watch(
  form,
  () => {
    queueAutoSave()
  },
  { deep: true },
)
</script>

<template>
  <main class="e2e-daily-log-page" data-testid="e2e-daily-log-page">
    <header class="e2e-daily-log-header">
      <h1>E2E Daily Log Draft</h1>
      <div class="e2e-daily-log-meta">
        <span data-testid="dailylog-save-state">{{ savingDraft ? 'saving' : 'idle' }}</span>
        <span data-testid="dailylog-save-count">{{ saveTick }}</span>
      </div>
    </header>

    <label class="e2e-daily-log-field">
      <span>Weekly Schedule</span>
      <textarea
        v-model="form.weeklySchedule"
        data-testid="dailylog-weeklySchedule"
        rows="4"
      ></textarea>
    </label>

    <label class="e2e-daily-log-field">
      <span>Safety Concerns</span>
      <textarea
        v-model="form.safetyConcerns"
        data-testid="dailylog-safetyConcerns"
        rows="3"
      ></textarea>
    </label>

    <label class="e2e-daily-log-field">
      <span>Budget Concerns</span>
      <textarea
        v-model="form.budgetConcerns"
        data-testid="dailylog-budgetConcerns"
        rows="3"
      ></textarea>
    </label>

    <label class="e2e-daily-log-field">
      <span>Deliveries Needed</span>
      <textarea
        v-model="form.deliveriesNeeded"
        data-testid="dailylog-deliveriesNeeded"
        rows="3"
      ></textarea>
    </label>

    <section class="e2e-daily-log-summary">
      <div data-testid="dailylog-saved-weeklySchedule">{{ selectedLog?.payload.weeklySchedule }}</div>
      <div data-testid="dailylog-saved-safetyConcerns">{{ selectedLog?.payload.safetyConcerns }}</div>
      <div data-testid="dailylog-saved-budgetConcerns">{{ selectedLog?.payload.budgetConcerns }}</div>
      <div data-testid="dailylog-saved-deliveriesNeeded">{{ selectedLog?.payload.deliveriesNeeded }}</div>
    </section>
  </main>
</template>

<style scoped>
.e2e-daily-log-page {
  display: grid;
  gap: 1rem;
  max-width: 56rem;
  padding: 1rem;
}

.e2e-daily-log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.e2e-daily-log-meta {
  display: flex;
  gap: 1rem;
  font-family: monospace;
}

.e2e-daily-log-field {
  display: grid;
  gap: 0.375rem;
}

.e2e-daily-log-field textarea {
  width: 100%;
  font: inherit;
}

.e2e-daily-log-summary {
  display: grid;
  gap: 0.25rem;
  font-family: monospace;
}
</style>
