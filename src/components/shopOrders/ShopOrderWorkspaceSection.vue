<script setup lang="ts">
import AppSectionHeader from '@/components/common/AppSectionHeader.vue'

defineProps<{
  title: string
}>()
</script>

<template>
  <section class="shop-order-workspace-section">
    <AppSectionHeader :title="title" class="shop-order-workspace-section__header">
      <template v-if="$slots.actions" #actions>
        <slot name="actions" />
      </template>
    </AppSectionHeader>

    <div class="shop-order-workspace-section__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.shop-order-workspace-section {
  --app-section-header-title-font-size: 0.7rem;
  --app-section-header-title-letter-spacing: var(--letter-spacing-eyebrow);
  --app-section-header-actions-gap: 0.35rem;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0.14rem;
  min-width: 0;
  min-height: 0;
  padding: 0.34rem 0 0;
  border-top: 1px solid var(--shop-line-soft);
  overflow: hidden;
}

.shop-order-workspace-section__header {
  padding-bottom: 0;
}

.shop-order-workspace-section__body {
  display: grid;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.shop-order-workspace-section__body > * {
  min-height: 0;
}

@media (max-width: 820px) {
  .shop-order-workspace-section {
    grid-template-rows: auto auto;
    overflow: visible;
  }

  .shop-order-workspace-section__body {
    overflow: visible;
  }

  .shop-order-workspace-section__header {
    --app-section-header-flex-direction: column;
    --app-section-header-align-items: flex-start;
  }
}
</style>
