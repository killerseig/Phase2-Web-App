<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  title: string
  panelId?: string
  labelledBy?: string
  mobileActive?: boolean
  mobileAlwaysVisible?: boolean
  collapseAt?: '900' | '960'
  modifiers?: string[]
}>(), {
  panelId: undefined,
  labelledBy: undefined,
  mobileActive: false,
  mobileAlwaysVisible: false,
  collapseAt: '900',
  modifiers: () => [],
})

const modifierClasses = computed(() => props.modifiers.map((modifier) => `timecards-toolbar__group--${modifier}`))
</script>

<template>
  <fieldset
    :id="panelId"
    class="timecards-toolbar__group timecard-toolbar-panel"
    :class="[
      ...modifierClasses,
      `timecard-toolbar-panel--collapse-${collapseAt}`,
      {
        'timecards-toolbar__group--mobile-active': mobileActive,
        'timecard-toolbar-panel--mobile-active': mobileActive,
        'timecard-toolbar-panel--mobile-always-visible': mobileAlwaysVisible,
      },
    ]"
    :role="labelledBy ? 'tabpanel' : undefined"
    :aria-labelledby="labelledBy"
  >
    <legend class="timecards-toolbar__legend timecard-toolbar-panel__legend">{{ title }}</legend>
    <slot />
  </fieldset>
</template>

<style scoped>
.timecard-toolbar-panel {
  display: grid;
  gap: var(--timecards-toolbar-group-gap);
  min-width: 0;
  min-inline-size: 0;
  max-width: 100%;
  overflow: hidden;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
}

.timecard-toolbar-panel__legend {
  padding: 0;
  color: rgba(64, 85, 36, 0.82);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

@media (min-width: 901px) {
  .timecard-toolbar-panel--collapse-900 {
    align-content: start;
    min-height: 100%;
    padding: 0.72rem 0.82rem 0.82rem;
    border: 1px solid rgba(101, 120, 60, 0.2);
    background:
      linear-gradient(180deg, rgba(255, 255, 251, 0.46) 0%, rgba(244, 247, 232, 0.42) 100%);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.44),
      inset 0 0 0 1px rgba(255, 255, 255, 0.18);
  }

  .timecard-toolbar-panel--collapse-900.timecards-toolbar__group--status-bar {
    padding-top: 0.68rem;
  }
}

@media (min-width: 961px) {
  .timecard-toolbar-panel--collapse-960 {
    align-content: start;
    min-height: 100%;
    padding: 0.72rem 0.82rem 0.82rem;
    border: 1px solid rgba(101, 120, 60, 0.2);
    background:
      linear-gradient(180deg, rgba(255, 255, 251, 0.46) 0%, rgba(244, 247, 232, 0.42) 100%);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.44),
      inset 0 0 0 1px rgba(255, 255, 255, 0.18);
  }

  .timecard-toolbar-panel--collapse-960.timecards-toolbar__group--status-bar {
    padding-top: 0.68rem;
  }
}

@media (max-width: 900px) {
  .timecard-toolbar-panel--collapse-900 .timecard-toolbar-panel__legend {
    display: none;
  }

  .timecard-toolbar-panel--collapse-900 {
    display: none;
  }

  .timecard-toolbar-panel--collapse-900.timecard-toolbar-panel--mobile-active,
  .timecard-toolbar-panel--collapse-900.timecard-toolbar-panel--mobile-always-visible {
    display: grid;
  }

  .timecard-toolbar-panel--collapse-900.timecard-toolbar-panel--mobile-active {
    gap: 0.7rem;
    padding: 0.8rem;
    border: 1px solid rgba(88, 105, 44, 0.24);
    background: rgba(255, 255, 255, 0.32);
  }
}

@media (max-width: 960px) {
  .timecard-toolbar-panel--collapse-960 .timecard-toolbar-panel__legend {
    display: none;
  }

  .timecard-toolbar-panel--collapse-960 {
    display: none;
  }

  .timecard-toolbar-panel--collapse-960.timecard-toolbar-panel--mobile-active,
  .timecard-toolbar-panel--collapse-960.timecard-toolbar-panel--mobile-always-visible {
    display: grid;
  }

  .timecard-toolbar-panel--collapse-960.timecard-toolbar-panel--mobile-active {
    gap: 0.7rem;
    padding: 0.8rem;
    border: 1px solid rgba(88, 105, 44, 0.24);
    background: rgba(255, 255, 255, 0.32);
  }
}
</style>
