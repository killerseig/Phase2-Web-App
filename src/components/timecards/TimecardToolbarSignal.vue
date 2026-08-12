<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'default' | 'success' | 'error'
  }>(),
  {
    tone: 'default',
  },
)
</script>

<template>
  <span
    class="timecard-toolbar-signal timecards-signal"
    :class="{
      'timecard-toolbar-signal--success': tone === 'success',
      'timecard-toolbar-signal--error': tone === 'error',
    }"
  >
    <slot />
  </span>
</template>

<style scoped>
.timecard-toolbar-signal {
  min-height: var(--timecards-toolbar-control-height);
  min-width: 0;
  padding: 0 0.8rem;
  border: 1px solid var(--timecards-toolbar-control-border);
  border-radius: var(--timecards-toolbar-control-radius);
  background: var(--timecards-toolbar-control-bg-muted);
  display: inline-flex;
  align-items: center;
  font-size: 0.84rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.timecard-toolbar-signal--success {
  border-color: rgba(46, 109, 61, 0.36);
  color: #1e5c34;
  background: rgba(221, 241, 214, 0.96);
}

.timecard-toolbar-signal--error {
  border-color: rgba(167, 53, 53, 0.36);
  color: #8a2828;
  background: rgba(248, 224, 220, 0.96);
}
</style>
