<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue'
import AppPageLayout from '@/components/common/AppPageLayout.vue'
import AppSplitWorkspace from '@/components/common/AppSplitWorkspace.vue'
import AppShell from '@/layouts/AppShell.vue'

defineOptions({
  inheritAttrs: false,
})

defineProps<{
  canUseJobSetupEditor: boolean
  editMode: boolean
}>()

const emit = defineEmits<{
  toggleEditMode: []
}>()
</script>

<template>
  <AppShell class="jobs-workspace">
    <AppPageLayout
      title="Jobs"
      description="Find a job to open its timecards, daily logs, and shop orders."
      fill
    >
      <template v-if="canUseJobSetupEditor" #actions>
        <AppButton
          class="jobs-edit-mode-button"
          :class="{ 'jobs-edit-mode-button--active': editMode }"
          variant="ghost"
          data-testid="jobs-edit-mode"
          :aria-pressed="editMode"
          @click="emit('toggleEditMode')"
        >
          <i :class="editMode ? 'pi pi-check' : 'pi pi-pencil'" aria-hidden="true"></i>
          <span>{{ editMode ? 'Done Editing' : 'Edit Mode' }}</span>
        </AppButton>
      </template>

      <AppSplitWorkspace
        v-bind="$attrs"
        :mode="canUseJobSetupEditor && editMode ? 'equal' : 'single'"
      >
        <template #primary>
          <slot name="primary" />
        </template>

        <template #secondary>
          <slot name="secondary" />
        </template>
      </AppSplitWorkspace>
    </AppPageLayout>

    <slot />
  </AppShell>
</template>

<style scoped>
.jobs-edit-mode-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--control-height-md);
  padding: 0 var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  box-shadow: none;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-heading);
  letter-spacing: normal;
  transition:
    border-color var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard),
    background-color var(--duration-fast) var(--ease-standard);
}

.jobs-edit-mode-button :deep(.pi) {
  color: var(--accent);
  font-size: var(--font-size-sm);
}

.jobs-edit-mode-button:hover:not(:disabled) {
  color: var(--text);
  border-color: var(--text-soft);
  background: var(--field-hover);
  box-shadow: none;
  transform: none;
}

.jobs-edit-mode-button--active {
  color: var(--text);
  border-color: var(--border);
  background: var(--field);
  box-shadow: none;
}

@media (min-width: 901px) and (max-width: 1180px) {
  /* Keep a complete list row and a usable editor on shorter tablet screens. */
  .jobs-workspace :deep(.app-split-workspace--equal) {
    grid-template-rows: minmax(27rem, 1fr) minmax(24rem, 1fr);
    min-height: 52rem;
  }

  .jobs-workspace :deep(.app-split-workspace--equal .jobs-browser) {
    max-height: none;
  }
}
</style>
