<script setup lang="ts">
import AppBadge from '@/components/common/AppBadge.vue'
import AppLoadingButton from '@/components/common/AppLoadingButton.vue'
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'

const props = defineProps<{
  canCreateDailyLog: boolean
  canEditSelectedLog: boolean
  createButtonLabel: string
  creatingDraft: boolean
  deletingDraft: boolean
  hasUnsavedDraftChanges: boolean
  savingDraft: boolean
  selectedDate: string
  selectedDateIsFuture: boolean
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
  <AppPaneHeader
    class="daily-logs-header"
    eyebrow="Daily Logs"
    :title="props.title"
    title-tag="h1"
  >
    <template #actions>
      <div class="daily-logs-header__actions">
        <AppLoadingButton
          v-if="props.canEditSelectedLog"
          label="Save Draft"
          loading-label="Saving..."
          :loading="props.savingDraft"
          :disabled="props.submittingLog || props.deletingDraft || !props.hasUnsavedDraftChanges"
          @click="emit('saveDraft')"
        />

        <AppLoadingButton
          v-if="props.canCreateDailyLog"
          :label="props.createButtonLabel"
          loading-label="Creating..."
          variant="primary"
          :loading="props.creatingDraft"
          @click="emit('createDraft')"
        />
      </div>
    </template>
  </AppPaneHeader>

  <div class="daily-logs-toolbar">
    <AppBadge class="daily-logs-badge" tone="accent">{{ props.selectedLogLabel }}</AppBadge>
    <AppBadge class="daily-logs-badge" tone="accent">
      {{ props.visibleLogCount }} logs for {{ props.selectedDate }}
    </AppBadge>
    <AppBadge v-if="props.savingDraft" class="daily-logs-badge" tone="accent">
      Saving draft...
    </AppBadge>
    <AppBadge v-else-if="props.hasUnsavedDraftChanges" class="daily-logs-badge" tone="warning">
      Unsaved changes
    </AppBadge>
  </div>

  <div
    v-if="props.selectedDateIsFuture"
    class="daily-logs-message daily-logs-message--info"
  >
    Future daily logs are view only. Choose today or an earlier date to create a draft.
  </div>
</template>

<style scoped>
.daily-logs-header {
  --app-pane-header-eyebrow-font-size: 0.68rem;
  --app-pane-header-eyebrow-letter-spacing: 0.12em;
  --app-pane-header-title-margin: 0.35rem 0 0;
  --app-pane-header-title-font-size: 1.5rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0)),
    rgba(29, 38, 49, 0.92);
  box-shadow: var(--shadow);
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
  --app-badge-min-height: 1.8rem;
  --app-badge-padding: 0 0.7rem;
  --app-badge-font-size: 0.72rem;
  --app-badge-letter-spacing: 0.08em;
  --app-badge-accent-border-color: rgba(88, 186, 233, 0.22);
  --app-badge-warning-border-color: rgba(245, 185, 90, 0.38);
  --app-badge-warning-background: rgba(245, 185, 90, 0.12);
  --app-badge-warning-color: #f8c878;
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
