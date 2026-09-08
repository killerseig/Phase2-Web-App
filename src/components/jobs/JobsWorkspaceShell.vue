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
  <AppShell>
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
.jobs-edit-mode-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.55rem;
  padding: 0 0.95rem;
  border: 1px solid rgba(168, 190, 209, 0.11);
  border-radius: var(--radius-sm);
  background: var(--panel-background);
  color: var(--text-muted);
  box-shadow: none;
  font-size: 0.84rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  transition:
    border-color 0.2s ease,
    color 0.2s ease,
    background 0.2s ease,
    transform 0.2s ease;
}

.jobs-edit-mode-button :deep(.pi) {
  color: var(--accent);
  font-size: 0.84rem;
}

.jobs-edit-mode-button:hover:not(:disabled) {
  color: var(--text);
  border-color: rgba(145, 220, 255, 0.38);
  background: var(--field-hover);
  box-shadow: none;
  transform: none;
}

.jobs-edit-mode-button--active {
  color: var(--text);
  border-color: rgba(145, 220, 255, 0.38);
  background: var(--bg-accent);
  box-shadow: none;
}
</style>
