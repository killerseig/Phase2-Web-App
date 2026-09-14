<script setup lang="ts">
type ShopCatalogPanel = 'catalog' | 'inspector'

withDefaults(
  defineProps<{
    activePanel: ShopCatalogPanel
    testId?: string
  }>(),
  {
    testId: undefined,
  },
)
</script>

<template>
  <div
    class="catalog-explorer"
    :class="{
      'catalog-explorer--mobile-catalog': activePanel === 'catalog',
      'catalog-explorer--mobile-inspector': activePanel === 'inspector',
    }"
    :data-testid="testId"
  >
    <slot name="mobile-nav" />

    <div class="catalog-explorer__pane catalog-explorer__pane--catalog">
      <slot name="catalog" />
    </div>

    <div class="catalog-explorer__pane catalog-explorer__pane--inspector">
      <slot name="inspector" />
    </div>

    <slot name="context-menu" />
  </div>
</template>

<style scoped>
.catalog-explorer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) clamp(320px, 32%, 440px);
  gap: 1rem;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.catalog-explorer__pane {
  display: grid;
  min-width: 0;
  min-height: 0;
}

@media (max-width: 1180px) {
  .catalog-explorer {
    grid-template-columns: 1fr;
    height: auto;
    overflow: visible;
    align-content: start;
  }

  .catalog-explorer--mobile-inspector .catalog-explorer__pane--catalog {
    display: none;
  }
}
</style>
