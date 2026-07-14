<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

const props = withDefaults(defineProps<{
  to: RouteLocationRaw
  variant?: 'default' | 'primary' | 'success' | 'danger' | 'ghost'
}>(), {
  variant: 'default',
})

const linkClasses = computed(() => [
  'app-button',
  props.variant !== 'default' ? `app-button--${props.variant}` : '',
])
</script>

<template>
  <RouterLink :to="to" :class="linkClasses">
    <slot />
  </RouterLink>
</template>
