<script setup lang="ts">
import AppStatusMessage from '@/components/common/AppStatusMessage.vue'

defineOptions({
  inheritAttrs: false,
})

withDefaults(defineProps<{
  message?: string
  tone?: 'default' | 'success' | 'error' | 'warning'
}>(), {
  message: '',
  tone: 'default',
})
</script>

<template>
  <AppStatusMessage
    v-if="message || $slots.default"
    v-bind="$attrs"
    class="auth-card__status"
    :message="message"
    :tone="tone"
  >
    <slot />
  </AppStatusMessage>
</template>
