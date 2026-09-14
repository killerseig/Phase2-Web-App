<script setup lang="ts">
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'
</script>

<template>
  <AppPaneHeader class="shop-catalog-tree-header" title="Catalog folders & items" title-tag="h2" />
</template>

<style scoped>
.shop-catalog-tree-header {
  --app-pane-header-eyebrow-font-size: var(--font-size-eyebrow);
  --app-pane-header-eyebrow-letter-spacing: var(--letter-spacing-eyebrow);
  --app-pane-header-title-font-size: var(--font-size-pane-title);
  --app-pane-header-title-margin: 0.25rem 0 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--form-gap);
  padding-bottom: 0.2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

@media (max-width: 1180px) {
  .shop-catalog-tree-header {
    align-items: flex-start;
  }
}

@media (max-width: 820px) {
  .shop-catalog-tree-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
