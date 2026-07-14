<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  type?: 'button' | 'submit' | 'reset'
  variant?: 'default' | 'primary' | 'success' | 'danger' | 'ghost'
}>(), {
  type: 'button',
  variant: 'default',
})

const buttonClasses = computed(() => [
  'app-button',
  props.variant !== 'default' ? `app-button--${props.variant}` : '',
])
</script>

<template>
  <button :class="buttonClasses" :type="type">
    <slot />
  </button>
</template>
