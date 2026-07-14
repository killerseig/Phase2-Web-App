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
  border-radius: var(--app-list-button-radius, 13px);
  background: var(--app-list-button-background, rgba(255, 255, 255, 0.035));
  color: var(--app-list-button-color, var(--text));
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    transform 0.2s ease;
}

.app-list-button:hover,
.app-list-button--active {
  border-color: var(--app-list-button-active-border, rgba(88, 186, 233, 0.28));
  background:
    linear-gradient(180deg, rgba(49, 83, 105, 0.35), rgba(33, 49, 62, 0.28)),
    var(--app-list-button-active-background, rgba(255, 255, 255, 0.04));
  transform: translateY(-1px);
}

.app-list-button--dashed {
  gap: var(--app-list-button-dashed-gap, 0.45rem);
  border-style: dashed;
}
</style>
