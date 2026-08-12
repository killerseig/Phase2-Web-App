<script setup lang="ts">
withDefaults(defineProps<{
  testId?: string
}>(), {
  testId: undefined,
})
</script>

<template>
  <div class="shop-orders-explorer" :data-testid="testId">
    <div class="shop-orders-explorer__pane">
      <slot name="catalog" />
    </div>
    <div class="shop-orders-explorer__pane">
      <slot name="workspace" />
    </div>
  </div>
</template>

<style scoped>
.shop-orders-explorer {
  --shop-line: rgba(168, 190, 209, 0.16);
  --shop-line-soft: rgba(168, 190, 209, 0.08);
  --shop-surface: rgba(255, 255, 255, 0.018);
  --shop-surface-soft: rgba(255, 255, 255, 0.035);
  --shop-field: rgba(237, 245, 248, 0.052);
  --shop-radius-md: 10px;
  --shop-radius-lg: 12px;
  --shop-control-height: 1.9rem;
  display: grid;
  grid-template-columns: minmax(340px, 0.92fr) minmax(540px, 1.08fr);
  gap: 0.75rem;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.shop-orders-explorer__pane {
  display: grid;
  min-width: 0;
  min-height: 0;
}

@media (max-width: 1440px) {
  .shop-orders-explorer {
    grid-template-columns: minmax(320px, 0.88fr) minmax(480px, 1.12fr);
  }
}

@media (max-width: 1180px) {
  .shop-orders-explorer {
    grid-template-columns: 1fr;
    grid-auto-rows: auto;
    align-content: start;
    height: auto;
    min-height: 100%;
    overflow: visible;
  }
}

@media (max-width: 820px) {
  .shop-orders-explorer {
    gap: 0.95rem;
  }
}
</style>
