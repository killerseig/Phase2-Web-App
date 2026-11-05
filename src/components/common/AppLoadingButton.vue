<script setup lang="ts">
import { computed } from 'vue'
import AppLoadingIndicator from './AppLoadingIndicator.vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  label: string
  loading?: boolean
  showSpinner?: boolean
  loadingLabel?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  variant?: 'default' | 'primary' | 'success' | 'danger' | 'ghost'
}>(), {
  loading: false,
  showSpinner: false,
  loadingLabel: '',
  disabled: false,
  type: 'button',
  variant: 'default',
})

const buttonClasses = computed(() => [
  'app-button',
  props.variant !== 'default' ? `app-button--${props.variant}` : '',
  {
    'app-loading-button--loading': props.loading,
    'app-loading-button--spinner': props.loading && props.showSpinner,
  },
])
</script>

<template>
  <button
    v-bind="loading && showSpinner ? { ...$attrs, 'aria-label': loadingLabel || label } : $attrs"
    :class="buttonClasses"
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading ? 'true' : 'false'"
  >
    <template v-if="loading && showSpinner">
      <span class="app-loading-button__placeholder" aria-hidden="true">{{ label }}</span>
      <AppLoadingIndicator class="app-loading-button__indicator" inline :label="loadingLabel || label" />
    </template>
    <slot v-else>
      {{ loading ? loadingLabel || label : label }}
    </slot>
  </button>
</template>

<style src="./button-family.css"></style>

<style scoped>
.app-loading-button--spinner { position: relative; }
.app-loading-button__placeholder { visibility: hidden; }
.app-loading-button__indicator { position: absolute; inset: 0; }
</style>
