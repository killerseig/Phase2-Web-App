<script setup lang="ts">
import AppPageLayout from '@/components/common/AppPageLayout.vue'
withDefaults(
  defineProps<{
    testId?: string
  }>(),
  {
    testId: undefined,
  },
)
</script>

<template>
  <AppPageLayout class="daily-log-workspace" :data-testid="testId">
    <template #header><slot name="header" /></template>

    <div class="daily-log-workspace__layout">
      <slot name="main" />
      <slot name="sidebar" />
    </div>
  </AppPageLayout>
</template>

<style scoped>
.daily-log-workspace {
  min-height: 0;
}

.daily-log-workspace__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 380px);
  gap: var(--page-gap);
  min-height: 0;
}

@media (max-width: 1360px) {
  .daily-log-workspace__layout {
    grid-template-columns: 1fr;
  }
}
</style>
