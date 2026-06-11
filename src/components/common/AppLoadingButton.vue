<script setup lang="ts">
import { computed } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  label: string
  loading?: boolean
  loadingLabel?: string
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  variant?: 'default' | 'primary' | 'success' | 'ghost'
}>(), {
  loading: false,
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
  },
])
</script>

<template>
  <button
    v-bind="$attrs"
    :class="buttonClasses"
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading ? 'true' : 'false'"
  >
    <slot>
      {{ loading ? loadingLabel || label : label }}
    </slot>
  </button>
</template>
