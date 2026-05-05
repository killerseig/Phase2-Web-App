<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { cloneDailyLogPayload, createEmptyDailyLogPayload } from '@/features/dailyLogs/schema'
import type { DailyLogPayload } from '@/types/domain'

interface HarnessDailyLogRecord {
  id: string
  status: 'draft' | 'submitted'
  logDate: string
  foremanUserId: string | null
  payload: DailyLogPayload
}

const currentUserId = 'foreman-e2e'
const selectedDate = '2026-05-01'
const autoSaveDelayMs = 120

const logs = ref<HarnessDailyLogRecord[]>([
  {
    id: 'log-1',
    status: 'draft',
    logDate: selectedDate,
    foremanUserId: currentUserId,
    payload: createEmptyDailyLogPayload(),
  },
])

const selectedLogId = ref<string | null>('log-1')
const form = ref<DailyLogPayload>(createEmptyDailyLogPayload())
const hydratingForm = ref(false)
const lastSavedSignature = ref('')
const lastHydratedLogId = ref<string | null>(null)
const saveCount = ref(0)

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

const selectedLog = computed(() => logs.value.find((log) => log.id === selectedLogId.value) ?? null)
const canEditSelectedLog = computed(() => (
  selectedLog.value?.status === 'draft'
  && selectedLog.value.logDate === selectedDate
  && selectedLog.value.foremanUserId === currentUserId
))

function serializePayload(payload: DailyLogPayload = form.value) {
  return JSON.stringify(payload)
}

function resetForm(log: HarnessDailyLogRecord | null = null) {
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

function queueAutoSave() {
  if (hydratingForm.value || !selectedLog.value || !canEditSelectedLog.value) return

  const nextSignature = serializePayload(form.value)
  if (nextSignature === lastSavedSignature.value) return

  clearAutoSaveTimer()
  autoSaveTimer = setTimeout(() => {
    const log = selectedLog.value
    if (!log) return

    const nextPayload = cloneDailyLogPayload(form.value)
    logs.value = logs.value.map((entry) => (
      entry.id === log.id
        ? { ...entry, payload: nextPayload }
        : entry
    ))
    lastSavedSignature.value = serializePayload(nextPayload)
    saveCount.value += 1
  }, autoSaveDelayMs)
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
    const hasUnsavedLocalChanges = canEditSelectedLog.value && localSignature !== lastSavedSignature.value

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
  <main class="e2e-dailylog-page" data-testid="e2e-dailylog-page">
    <div class="e2e-dailylog-meta">
      <div data-testid="dailylog-save-count">{{ saveCount }}</div>
      <div data-testid="dailylog-selected-log">{{ selectedLog?.id ?? 'none' }}</div>
    </div>

    <label class="e2e-dailylog-field">
      <span>Weekly Schedule</span>
      <textarea v-model="form.weeklySchedule" data-testid="dailylog-weekly-schedule" rows="4" />
    </label>

    <label class="e2e-dailylog-field">
      <span>Safety Concerns</span>
      <textarea v-model="form.safetyConcerns" data-testid="dailylog-safety-concerns" rows="3" />
    </label>

    <label class="e2e-dailylog-field">
      <span>Budget Concerns</span>
      <textarea v-model="form.budgetConcerns" data-testid="dailylog-budget-concerns" rows="3" />
    </label>

    <label class="e2e-dailylog-field">
      <span>Deliveries Needed</span>
      <textarea v-model="form.deliveriesNeeded" data-testid="dailylog-deliveries-needed" rows="3" />
    </label>

    <div class="e2e-dailylog-summary">
      <div data-testid="dailylog-weekly-schedule-summary">{{ form.weeklySchedule }}</div>
      <div data-testid="dailylog-safety-concerns-summary">{{ form.safetyConcerns }}</div>
      <div data-testid="dailylog-budget-concerns-summary">{{ form.budgetConcerns }}</div>
      <div data-testid="dailylog-deliveries-needed-summary">{{ form.deliveriesNeeded }}</div>
    </div>
  </main>
</template>

<style scoped>
.e2e-dailylog-page {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  max-width: 52rem;
}

.e2e-dailylog-meta {
  display: flex;
  gap: 1rem;
  font-family: monospace;
}

.e2e-dailylog-field {
  display: grid;
  gap: 0.25rem;
}

.e2e-dailylog-summary {
  display: grid;
  gap: 0.25rem;
  font-family: monospace;
  white-space: pre-wrap;
}
</style>
