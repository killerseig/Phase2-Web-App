<script setup lang="ts">
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'

defineProps<{
  visibleFolderCount: number
  visibleItemCount: number
}>()
</script>

<template>
  <div class="shop-catalog-root-inspector">
    <AppPaneHeader
      class="shop-catalog-root-inspector__header"
      eyebrow="Inspector"
      title="Shop Catalog"
      title-tag="h2"
    />

    <div class="shop-catalog-root-inspector__body">
      <section class="shop-catalog-root-inspector__card">
        <strong>Overview</strong>
        <span>{{ visibleFolderCount }} folders visible</span>
        <span>{{ visibleItemCount }} items visible</span>
      </section>

      <section class="shop-catalog-root-inspector__card">
        <strong>Adding Entries</strong>
        <span>Right-click a folder or the empty catalog area to open actions.</span>
        <span>On touch devices, press and hold to open the same menu.</span>
      </section>
    </div>
  </div>
</template>

<style scoped>
.shop-catalog-root-inspector {
  display: grid;
  gap: 0.7rem;
  grid-template-rows: auto minmax(0, 1fr);
  height: 100%;
  min-height: 0;
}

.shop-catalog-root-inspector__header {
  --app-pane-header-eyebrow-font-size: 0.68rem;
  --app-pane-header-eyebrow-letter-spacing: 0.12em;
  --app-pane-header-title-font-size: 1.35rem;
  --app-pane-header-title-margin: 0.3rem 0 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.shop-catalog-root-inspector__body {
  display: grid;
  gap: 1rem;
  min-height: 0;
}

.shop-catalog-root-inspector__card {
  display: grid;
  gap: 0.4rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.035);
}

.shop-catalog-root-inspector__card span {
  color: var(--text-muted);
}

@media (max-width: 720px) {
  .shop-catalog-root-inspector__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
