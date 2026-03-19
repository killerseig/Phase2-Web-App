<script setup lang="ts">
withDefaults(defineProps<{
  message?: string
  srLabel?: string
  ariaLive?: 'off' | 'polite' | 'assertive'
  spinnerClass?: string
  messageClass?: string
}>(), {
  message: 'Loading...',
  srLabel: 'Loading...',
  ariaLive: 'polite',
  spinnerClass: '',
  messageClass: 'text-muted mb-0',
})
</script>

<template>
  <div class="app-loading-state text-center py-5">
    <div :class="['spinner-border text-primary', spinnerClass]" role="status" :aria-live="ariaLive">
      <span class="visually-hidden">{{ srLabel }}</span>
    </div>
    <p v-if="message" :class="messageClass">{{ message }}</p>
  </div>
</template>
