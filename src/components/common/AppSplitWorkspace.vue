<script setup lang="ts">
import { computed } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  activePanel?: string
  density?: 'compact' | 'default' | 'spacious'
  mode?: 'fixed' | 'equal' | 'single'
  primaryPanel?: string
  secondaryPanel?: string
  primaryWidth?: string
}>(), {
  activePanel: '',
  density: 'default',
  mode: 'fixed',
  primaryPanel: 'primary',
  secondaryPanel: 'secondary',
  primaryWidth: '360px',
})

const workspaceClasses = computed(() => ({
  'app-split-workspace--density-compact': props.density === 'compact',
  'app-split-workspace--density-spacious': props.density === 'spacious',
  'app-split-workspace--equal': props.mode === 'equal',
  'app-split-workspace--primary-active': props.activePanel === props.primaryPanel,
  'app-split-workspace--secondary-active': props.activePanel === props.secondaryPanel,
  'app-split-workspace--single': props.mode === 'single',
}))

const workspaceStyle = computed(() => ({
  '--app-split-workspace-primary-width': props.primaryWidth,
}))
</script>

<template>
  <div
    v-bind="$attrs"
    class="app-split-workspace"
    :class="workspaceClasses"
    :style="workspaceStyle"
  >
    <slot name="tabs" />
    <slot name="primary" />
    <slot name="secondary" />
  </div>
</template>

<style scoped>
.app-split-workspace {
  display: grid;
  grid-template-columns: var(--app-split-workspace-primary-width) minmax(0, 1fr);
  gap: var(--app-split-workspace-gap, var(--space-4));
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.app-split-workspace--density-compact {
  --app-split-workspace-gap: var(--space-3);
}

.app-split-workspace--density-spacious {
  --app-split-workspace-gap: var(--space-6);
}

.app-split-workspace--equal {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.app-split-workspace--single {
  grid-template-columns: minmax(0, 1fr);
}

@media (max-width: 1180px) {
  .app-split-workspace {
    grid-template-columns: 1fr;
  }

  .app-split-workspace:not(.app-split-workspace--single) :slotted(.app-split-workspace__primary-pane) {
    max-height: 26rem;
  }
}

@media (max-width: 900px) {
  .app-split-workspace {
    height: auto;
    overflow: visible;
  }

  .app-split-workspace--primary-active :slotted(.app-split-workspace__secondary-pane),
  .app-split-workspace--secondary-active :slotted(.app-split-workspace__primary-pane) {
    display: none;
  }

  .app-split-workspace :slotted(.app-split-workspace__primary-pane),
  .app-split-workspace :slotted(.app-split-workspace__secondary-pane) {
    height: auto;
    min-height: 0;
    overflow: visible;
  }

  .app-split-workspace :slotted(.app-split-workspace__primary-pane) {
    max-height: none;
  }
}
</style>
