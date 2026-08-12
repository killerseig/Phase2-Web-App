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
      class="page-panel__header"
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
  border: 1px solid rgba(168, 190, 209, 0.18);
  border-radius: var(--radius-lg);
  background:
    radial-gradient(circle at 8% 0%, rgba(99, 199, 230, 0.08), transparent 30%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0)),
    var(--surface);
  box-shadow: var(--shadow-soft);
}

.page-panel__header {
  --app-pane-header-eyebrow-font-size: 0.74rem;
  --app-pane-header-eyebrow-letter-spacing: 0.08em;
  --app-pane-header-title-margin: 0.45rem 0 0;
  --app-pane-header-title-font-size: 1.2rem;
  --app-pane-header-description-margin: 0.45rem 0 0;
  padding: 1.1rem 1.25rem 0;
}

.page-panel__body {
  padding: 1.25rem;
}
</style>
