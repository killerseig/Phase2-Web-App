<script setup lang="ts">
defineOptions({
  name: 'AppToolbarSummary',
})

withDefaults(defineProps<{
  compact?: boolean
  wrapperClass?: string
}>(), {
  compact: false,
  wrapperClass: '',
})
</script>

<template>
  <div :class="['app-toolbar-summary', compact ? 'app-toolbar-summary--compact' : '', wrapperClass]">
    <slot />
  </div>
</template>
