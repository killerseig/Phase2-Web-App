<script setup lang="ts">
import AppBadge from '@/components/common/AppBadge.vue'

withDefaults(defineProps<{
  draftCount: number
  submittedCount: number
  tag?: string
  wrapperClass?: string
}>(), {
  tag: 'span',
  wrapperClass: '',
})
</script>

<template>
  <component :is="tag" :class="wrapperClass">
    <AppBadge :label="`${draftCount} Draft`" variant-class="bg-warning text-dark" />
    <AppBadge :label="`${submittedCount} Submitted`" variant-class="bg-success" class="ms-2" />
  </component>
</template>
