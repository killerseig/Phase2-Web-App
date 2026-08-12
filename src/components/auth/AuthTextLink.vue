<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { RouterLink } from 'vue-router'

defineOptions({
  inheritAttrs: false,
})

defineProps<{
  to: RouteLocationRaw
}>()
</script>

<template>
  <RouterLink v-bind="$attrs" class="auth-card__link" :to="to">
    <slot />
  </RouterLink>
</template>
