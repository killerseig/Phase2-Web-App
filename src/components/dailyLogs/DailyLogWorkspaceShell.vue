<script setup lang="ts">
withDefaults(defineProps<{
  testId?: string
}>(), {
  testId: undefined,
})
</script>

<template>
  <div class="daily-log-workspace" :data-testid="testId">
    <slot name="header" />

    <div class="daily-log-workspace__layout">
      <slot name="main" />
      <slot name="sidebar" />
    </div>
  </div>
</template>

<style scoped>
.daily-log-workspace {
  display: grid;
  gap: 1rem;
  min-height: 0;
}

.daily-log-workspace__layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.85fr);
  gap: 1rem;
  min-height: 0;
}

@media (max-width: 1360px) {
  .daily-log-workspace__layout {
    grid-template-columns: 1fr;
  }
}
</style>
