<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
})

defineProps<{
  title?: string
  message?: string
}>()
</script>

<template>
  <div v-bind="$attrs" class="app-empty-state">
    <strong v-if="title" class="app-empty-state__title">{{ title }}</strong>
    <p v-if="message" class="app-empty-state__message">{{ message }}</p>
    <slot v-else />
  </div>
</template>
