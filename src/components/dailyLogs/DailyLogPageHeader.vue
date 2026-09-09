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
    class="app-page-header daily-logs-header"
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
  --app-pane-header-eyebrow-font-size: var(--font-size-eyebrow);
  --app-pane-header-eyebrow-letter-spacing: var(--letter-spacing-eyebrow);
  --app-pane-header-title-margin: 0.35rem 0 0;
  --app-pane-header-title-font-size: 1.5rem;
  padding: var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--panel-background);
  box-shadow: var(--shadow);
}

.daily-logs-header__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--action-gap);
  justify-content: flex-end;
}

.daily-logs-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.daily-logs-message {
  padding: 0.95rem 1rem;
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
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
