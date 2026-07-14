<script setup lang="ts">
import { computed } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  type?: 'button' | 'submit' | 'reset'
  variant?: 'default' | 'primary'
}>(), {
  type: 'button',
  variant: 'default',
})

const buttonClasses = computed(() => [
  'timecards-button',
  props.variant === 'primary' ? 'timecards-button--primary' : '',
])
</script>

<template>
  <button v-bind="$attrs" :class="buttonClasses" :type="type">
    <slot />
  </button>
</template>

<style scoped>
.timecards-button {
  min-height: var(--timecards-toolbar-control-height);
  padding: 0 0.95rem;
  border: 1px solid var(--timecards-toolbar-control-border);
  border-radius: var(--timecards-toolbar-control-radius);
  background: var(--timecards-toolbar-control-bg-muted);
  color: var(--timecards-toolbar-control-text);
  font-weight: 600;
  box-shadow: none;
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    box-shadow 0.18s ease;
}

.timecards-button:hover:not(:disabled) {
  border-color: var(--timecards-toolbar-control-border-strong);
  background: rgba(245, 248, 233, 0.98);
}

.timecards-button:focus-visible {
  outline: none;
  border-color: var(--timecards-toolbar-control-border-strong);
  box-shadow: var(--timecards-toolbar-focus-ring);
}

.timecards-button:disabled {
  opacity: 0.58;
  cursor: not-allowed;
}

.timecards-button--primary {
  border-color: rgba(63, 120, 67, 0.46);
  background: var(--timecards-toolbar-control-bg-active);
  color: #24411c;
}
</style>
