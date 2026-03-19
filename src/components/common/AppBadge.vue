<script setup lang="ts">
import { computed } from 'vue'

defineOptions({
  name: 'AppBadge',
  inheritAttrs: false,
})

interface Props {
  label?: string | number
  variantClass?: string
  size?: 'sm' | 'md'
  uppercase?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  variantClass: 'text-bg-secondary',
  size: 'sm',
  uppercase: false,
})

const badgeClasses = computed(() => [
  'badge',
  'app-badge-pill',
  props.size === 'sm' ? 'app-badge-pill--sm' : null,
  props.uppercase ? 'text-uppercase' : null,
  props.variantClass,
])
</script>

<template>
  <span v-bind="$attrs" :class="badgeClasses">
    <slot>{{ label }}</slot>
  </span>
</template>
