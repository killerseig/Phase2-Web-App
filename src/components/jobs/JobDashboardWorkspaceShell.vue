<script setup lang="ts">
withDefaults(defineProps<{
  testId?: string
}>(), {
  testId: undefined,
})
</script>

<template>
  <div class="job-dashboard-workspace" :data-testid="testId">
    <slot name="header" />
    <slot name="modules" />
  </div>
</template>

<style scoped>
.job-dashboard-workspace {
  display: grid;
  gap: 1rem;
}
</style>
