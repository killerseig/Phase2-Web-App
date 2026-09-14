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
  <AppPageLayout class="job-dashboard-workspace" :data-testid="testId">
    <template #header><slot name="header" /></template>
    <slot name="modules" />
  </AppPageLayout>
</template>

<style scoped>
.job-dashboard-workspace {
  min-width: 0;
}
</style>
