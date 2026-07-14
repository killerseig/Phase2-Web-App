<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue'

const props = defineProps<{
  canCreateDailyLog: boolean
  canEditSelectedLog: boolean
  createButtonLabel: string
  creatingDraft: boolean
  deletingDraft: boolean
  hasUnsavedDraftChanges: boolean
  savingDraft: boolean
  selectedDate: string
  selectedDateIsToday: boolean
  selectedLogLabel: string
  submittingLog: boolean
  title: string
  visibleLogCount: number
}>()

const emit = defineEmits<{
  createDraft: []
  saveDraft: []
}>()
</script>

<template>
  <header class="daily-logs-header">
    <div>
      <span class="daily-logs-eyebrow">Daily Logs</span>
      <h1 class="daily-logs-title">{{ props.title }}</h1>
    </div>

    <div class="daily-logs-header__actions">
      <AppButton
        v-if="props.canEditSelectedLog"
        :disabled="props.savingDraft || props.submittingLog || props.deletingDraft || !props.hasUnsavedDraftChanges"
        @click="emit('saveDraft')"
      >
        {{ props.savingDraft ? 'Saving...' : 'Save Draft' }}
      </AppButton>

      <AppButton
        v-if="props.canCreateDailyLog"
        variant="primary"
        :disabled="props.creatingDraft"
        @click="emit('createDraft')"
      >
        {{ props.creatingDraft ? 'Creating...' : props.createButtonLabel }}
      </AppButton>
    </div>
  </header>

  <div class="daily-logs-toolbar">
    <span class="daily-logs-badge">{{ props.selectedLogLabel }}</span>
    <span class="daily-logs-badge">{{ props.visibleLogCount }} logs for {{ props.selectedDate }}</span>
    <span v-if="props.savingDraft" class="daily-logs-badge">Saving draft...</span>
    <span v-else-if="props.hasUnsavedDraftChanges" class="daily-logs-badge daily-logs-badge--warning">
      Unsaved changes
    </span>
  </div>

  <div
    v-if="!props.selectedDateIsToday"
    class="daily-logs-message daily-logs-message--info"
  >
    Logs from past or future dates are view only. New drafts can only be created for today.
  </div>
</template>

<style scoped>
.daily-logs-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0)),
    rgba(29, 38, 49, 0.92);
  box-shadow: var(--shadow);
}

.daily-logs-eyebrow {
  color: var(--accent-strong);
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.daily-logs-title {
  margin: 0.35rem 0 0;
  font-size: 1.5rem;
}

.daily-logs-header__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  justify-content: flex-end;
}

.daily-logs-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.daily-logs-badge {
  display: inline-flex;
  align-items: center;
  min-height: 1.8rem;
  padding: 0 0.7rem;
  border: 1px solid rgba(88, 186, 233, 0.22);
  border-radius: 999px;
  background: rgba(38, 74, 96, 0.28);
  color: var(--accent);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.daily-logs-badge--warning {
  border-color: rgba(245, 185, 90, 0.38);
  background: rgba(245, 185, 90, 0.12);
  color: #f8c878;
}

.daily-logs-message {
  padding: 0.95rem 1rem;
  border: 1px dashed var(--border);
  border-radius: 12px;
}

.daily-logs-message--info {
  color: var(--text-soft);
}

@media (max-width: 920px) {
  .daily-logs-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
