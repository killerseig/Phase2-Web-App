<script setup lang="ts">
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'

defineProps<{
  eyebrow: string
  title: string
  description?: string
}>()
</script>

<template>
  <section class="page-panel">
    <AppPaneHeader
      class="app-page-header page-panel__header"
      :eyebrow="eyebrow"
      :title="title"
      title-tag="h2"
      :description="description"
    />

    <div class="page-panel__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.page-panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--panel-background);
  box-shadow: var(--shadow-md);
}

.page-panel__header {
  --app-pane-header-eyebrow-font-size: var(--font-size-eyebrow);
  --app-pane-header-eyebrow-letter-spacing: var(--letter-spacing-eyebrow);
  --app-pane-header-title-margin: 0.35rem 0 0;
  --app-pane-header-title-font-size: var(--font-size-pane-title);
  --app-pane-header-description-margin: 0.45rem 0 0;
  padding: var(--space-4) var(--space-4) 0;
}

.page-panel__body {
  padding: var(--space-4);
}
</style>
