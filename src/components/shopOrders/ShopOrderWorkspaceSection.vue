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
  min-width: 0;
  min-height: 0;
  padding: var(--space-2) 0 0;
  border-top: 1px solid var(--shop-line-soft);
}

.shop-order-workspace-section__header {
  padding-bottom: 0;
}

.shop-order-workspace-section__body {
  margin-top: var(--space-2);
  min-width: 0;
  min-height: 0;
}

.shop-order-workspace-section__body > * {
  min-height: 0;
}

@media (max-width: 820px) {
  .shop-order-workspace-section__header {
    --app-section-header-flex-direction: column;
    --app-section-header-align-items: flex-start;
  }
}
</style>
