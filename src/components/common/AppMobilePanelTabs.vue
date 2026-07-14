<script setup lang="ts">
export interface AppMobilePanelTab {
  key: string
  label: string
}

defineProps<{
  activePanel: string
  label: string
  panels: readonly AppMobilePanelTab[]
}>()

const emit = defineEmits<{
  show: [panel: string]
}>()
</script>

<template>
  <div class="app-mobile-panel-tabs" role="tablist" :aria-label="label">
    <button
      v-for="panel in panels"
      :key="panel.key"
      class="app-mobile-panel-tabs__button"
      :class="{ 'app-mobile-panel-tabs__button--active': activePanel === panel.key }"
      type="button"
      role="tab"
      :aria-selected="activePanel === panel.key"
      @click="emit('show', panel.key)"
    >
      {{ panel.label }}
    </button>
  </div>
</template>

<style scoped>
.app-mobile-panel-tabs {
  display: none;
  gap: 0.7rem;
}

.app-mobile-panel-tabs__button {
  min-height: 2.45rem;
  padding: 0 1rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-muted);
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    color 0.2s ease;
}

.app-mobile-panel-tabs__button--active {
  border-color: rgba(88, 186, 233, 0.28);
  background:
    linear-gradient(180deg, rgba(49, 83, 105, 0.35), rgba(33, 49, 62, 0.28)),
    rgba(255, 255, 255, 0.04);
  color: var(--text);
}

@media (max-width: 900px) {
  .app-mobile-panel-tabs {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  }
}
</style>
