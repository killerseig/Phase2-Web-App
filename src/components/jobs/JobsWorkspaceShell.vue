<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue'
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
    <template v-if="canUseJobSetupEditor" #topbar-actions>
      <AppButton
        class="jobs-edit-mode-button"
        :class="{ 'jobs-edit-mode-button--active': editMode }"
        variant="ghost"
        data-testid="jobs-edit-mode"
        :aria-pressed="editMode"
        @click="emit('toggleEditMode')"
      >
        <i
          :class="editMode ? 'pi pi-check' : 'pi pi-pencil'"
          aria-hidden="true"
        ></i>
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

    <slot />
  </AppShell>
</template>

<style scoped>
/* Directory geometry stays local; brand styling lives in the shared shell. */
.jobs-workspace {
  --letter-spacing-eyebrow: 0.09em;
  --app-pane-border: 0;
  --app-pane-radius: 0;
  --app-pane-gap: var(--space-5);
  --app-pane-padding: var(--space-4);
  --app-pane-header-title-font-size: 1.5rem;
  --app-pane-header-title-margin: 0.45rem 0 0;
  --app-pane-header-eyebrow-font-size: 0.6875rem;
  font-family: var(--font-sans);
}

.jobs-workspace :deep(.app-shell__content) {
  padding: var(--space-6);
}

.jobs-workspace :deep(.app-pane-header) {
  position: relative;
  align-items: center;
  min-height: 5.5rem;
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--border);
}

.jobs-workspace :deep(.app-pane-header::after) {
  content: "";
  position: absolute;
  bottom: -1px;
  left: 0;
  width: 2rem;
  height: 2px;
  background: var(--accent);
}

.jobs-workspace :deep(.app-pane-header__eyebrow) {
  font-weight: var(--font-weight-heading);
}

.jobs-workspace :deep(.app-pane-header__title) {
  letter-spacing: -0.035em;
  line-height: 1.2;
}

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
  .jobs-workspace {
    --app-pane-header-title-margin: var(--space-1) 0 0;
  }

  .jobs-workspace :deep(.jobs-browser) {
    --app-pane-header-title-font-size: 1.5rem;
  }

  .jobs-workspace :deep(.app-pane-header) {
    min-height: 0;
    padding-bottom: var(--space-2);
  }

  /* Keep a complete list row and a usable editor on shorter tablet screens. */
  .jobs-workspace :deep(.app-split-workspace--equal) {
    grid-template-rows: minmax(27rem, 1fr) minmax(24rem, 1fr);
    min-height: 52rem;
  }

  .jobs-workspace :deep(.app-split-workspace--equal .jobs-browser) {
    max-height: none;
  }
}

@media (max-width: 720px) {
  .jobs-workspace :deep(.app-pane-header) {
    align-items: flex-start;
    min-height: auto;
  }
}

@media (max-width: 560px) {
  .jobs-workspace {
    --app-pane-padding: 0;
  }

  .jobs-workspace :deep(.app-shell__topbar),
  .jobs-workspace :deep(.app-shell__content) {
    padding-inline: var(--space-4);
  }
}
</style>
