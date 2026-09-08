<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  active?: boolean
  type?: 'button' | 'submit' | 'reset'
  variant?: 'default' | 'dashed'
}>(), {
  active: false,
  type: 'button',
  variant: 'default',
})

const listButtonClasses = computed(() => [
  'app-list-button',
  props.active ? 'app-list-button--active' : '',
  props.variant !== 'default' ? `app-list-button--${props.variant}` : '',
])
</script>

<template>
  <button v-bind="$attrs" :class="listButtonClasses" :type="type">
    <slot />
  </button>
</template>

<style scoped>
.app-list-button {
  display: grid;
  gap: var(--app-list-button-gap, 0.7rem);
  width: 100%;
  padding: var(--app-list-button-padding, 0.9rem);
  border: 1px solid var(--app-list-button-border, var(--border));
  border-radius: var(--app-list-button-radius, var(--radius-sm));
  background: var(--app-list-button-background, transparent);
  color: var(--app-list-button-color, var(--text));
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    transform 0.2s ease;
}

.app-list-button:hover {
  border-color: var(--border);
  background: var(--field-hover);
  transform: none;
}

.app-list-button--active,
.app-list-button--active:hover {
  border-color: var(--app-list-button-active-border, var(--border-strong));
  background: var(--app-list-button-active-background, var(--bg-accent));
  transform: none;
}

.app-list-button:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: -1px;
}

.app-list-button--dashed {
  gap: var(--app-list-button-dashed-gap, 0.45rem);
  border-style: dashed;
}
</style>
