<script setup lang="ts">
withDefaults(defineProps<{
  as?: 'header' | 'section'
  stretchAt?: '900' | '960'
}>(), {
  as: 'section',
  stretchAt: '900',
})
</script>

<template>
  <component
    :is="as"
    class="timecards-toolbar timecard-toolbar-shell"
    :class="`timecard-toolbar-shell--stretch-${stretchAt}`"
  >
    <slot />
  </component>
</template>

<style scoped>
.timecard-toolbar-shell {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
  gap: 0.75rem;
  align-items: start;
  min-width: 0;
  min-inline-size: 0;
  max-width: 100%;
  overflow: hidden;
  padding: 0.95rem;
  border: 1px solid rgba(88, 105, 44, 0.42);
  background: rgba(247, 249, 239, 0.95);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
  --timecards-toolbar-label-height: 1.15rem;
  --timecards-toolbar-label-gap: 0.4rem;
  --timecards-toolbar-group-gap: 0.65rem;
  --timecards-toolbar-lead-overlap: 0.52rem;
  --app-text-input-min-height: var(--timecards-toolbar-control-height);
  --app-text-input-padding-x: 0.75rem;
  --app-text-input-border: var(--timecards-toolbar-control-border);
  --app-text-input-radius: var(--timecards-toolbar-control-radius);
  --app-text-input-background: var(--timecards-toolbar-control-bg);
  --app-text-input-color: var(--timecards-toolbar-control-text);
  --app-text-input-color-scheme: light;
  --app-text-input-font: inherit;
  --app-text-input-box-shadow: none;
  --app-text-input-placeholder-color: rgba(70, 77, 48, 0.72);
  --app-text-input-focus-border: var(--timecards-toolbar-control-border-strong);
  --app-text-input-focus-background: rgba(248, 250, 240, 0.98);
  --app-text-input-focus-box-shadow: var(--timecards-toolbar-focus-ring);
  --app-search-input-min-height: var(--timecards-toolbar-control-height);
  --app-search-input-padding-x: 0.75rem;
  --app-search-input-border: var(--timecards-toolbar-control-border);
  --app-search-input-radius: var(--timecards-toolbar-control-radius);
  --app-search-input-background: var(--timecards-toolbar-control-bg);
  --app-search-input-color: var(--timecards-toolbar-control-text);
  --app-search-input-color-scheme: light;
  --app-search-input-font: inherit;
  --app-search-input-placeholder-color: rgba(70, 77, 48, 0.72);
  --app-search-input-focus-border: var(--timecards-toolbar-control-border-strong);
  --app-search-input-focus-outline: none;
  --app-search-input-focus-background: rgba(248, 250, 240, 0.98);
  --app-search-input-focus-box-shadow: var(--timecards-toolbar-focus-ring);
}

@media (min-width: 901px) {
  .timecard-toolbar-shell--stretch-900 {
    align-items: stretch;
  }
}

@media (min-width: 961px) {
  .timecard-toolbar-shell--stretch-960 {
    align-items: stretch;
  }
}
</style>
