<script setup lang="ts">
import { computed } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  label: string
  title?: string
  type?: 'button' | 'submit' | 'reset'
  variant?: 'default' | 'success' | 'danger'
}>(), {
  title: '',
  type: 'button',
  variant: 'default',
})

const buttonClasses = computed(() => [
  'app-icon-button',
  props.variant !== 'default' ? `app-icon-button--${props.variant}` : '',
])
</script>

<template>
  <button
    v-bind="$attrs"
    :aria-label="label"
    :class="buttonClasses"
    :title="title || label"
    :type="type"
  >
    <slot />
  </button>
</template>

<style scoped>
.app-icon-button {
  display: inline-grid;
  place-items: center;
  width: var(--app-icon-button-size, 2rem);
  height: var(--app-icon-button-size, 2rem);
  padding: 0;
  border: 1px solid var(--app-icon-button-border, var(--border));
  border-radius: 999px;
  background: var(--app-icon-button-background, transparent);
  color: var(--app-icon-button-color, var(--text));
  cursor: pointer;
  line-height: 1;
}

.app-icon-button:disabled {
  cursor: default;
  opacity: 0.6;
}

.app-icon-button--success {
  --app-icon-button-border: rgba(103, 213, 157, 0.32);
  --app-icon-button-background: rgba(103, 213, 157, 0.12);
  --app-icon-button-color: var(--success);
  font-size: 1.45rem;
  font-weight: 700;
}

.app-icon-button--danger {
  --app-icon-button-border: rgba(255, 125, 107, 0.24);
  --app-icon-button-color: var(--danger);
}
</style>
