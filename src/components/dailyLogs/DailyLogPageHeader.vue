<script setup lang="ts">
import AppBadge from '@/components/common/AppBadge.vue'
import AppLoadingButton from '@/components/common/AppLoadingButton.vue'
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'
import AppStatusMessage from '@/components/common/AppStatusMessage.vue'

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
      {{ props.visibleLogCount }} {{ props.visibleLogCount === 1 ? 'log' : 'logs' }} for {{ props.selectedDate }}
    </AppBadge>
    <AppBadge v-if="props.savingDraft" class="daily-logs-badge" tone="accent">
      Saving draft...
    </AppBadge>
    <AppBadge v-else-if="props.hasUnsavedDraftChanges" class="daily-logs-badge" tone="warning">
      Unsaved changes
    </AppBadge>
  </div>

  <AppStatusMessage v-if="props.selectedDateIsFuture">
    Future daily logs are view only. Choose today or an earlier date to create a draft.
  </AppStatusMessage>
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

@media (max-width: 920px) {
  .daily-logs-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
