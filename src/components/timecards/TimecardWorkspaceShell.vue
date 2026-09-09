<script setup lang="ts">
withDefaults(defineProps<{
  testId?: string
}>(), {
  testId: undefined,
})
</script>

<template>
  <div class="timecards-page" :data-testid="testId">
    <section class="timecards-workbook">
      <slot />
    </section>
  </div>
</template>

<style scoped>
.timecards-page {
  display: grid;
  min-width: 0;
  min-inline-size: 0;
  max-width: 100%;
}

.timecards-workbook {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid rgba(88, 105, 44, 0.55);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(236, 241, 213, 0.98) 0%, rgba(213, 225, 169, 0.96) 100%);
  /* Preserve the green's original appearance over the shared navy page background. */
  background-color: var(--bg);
  color: #1a1a12;
  min-width: 0;
  min-inline-size: 0;
  max-width: 100%;
  overflow: hidden;
  --timecards-toolbar-control-height: 2.3rem;
  --timecards-toolbar-control-radius: 0;
  --timecards-toolbar-control-border: rgba(88, 105, 44, 0.42);
  --timecards-toolbar-control-border-strong: rgba(63, 97, 43, 0.54);
  --timecards-toolbar-control-bg: rgba(251, 252, 246, 0.98);
  --timecards-toolbar-control-bg-muted: rgba(238, 242, 223, 0.96);
  --timecards-toolbar-control-bg-active: rgba(223, 238, 210, 0.98);
  --timecards-toolbar-control-text: #191b13;
  --timecards-toolbar-focus-ring: 0 0 0 3px rgba(102, 138, 77, 0.16);
}
</style>
