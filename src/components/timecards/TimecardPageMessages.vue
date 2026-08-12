<script setup lang="ts">
import TimecardPageMessage from '@/components/timecards/TimecardPageMessage.vue'

defineProps<{
  error?: string | null
  info?: string | null
}>()
</script>

<template>
  <TimecardPageMessage v-if="error" :message="error" tone="error" />
  <TimecardPageMessage v-else-if="info" :message="info" />
</template>
