<script setup lang="ts">
import { computed } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  message?: string
  tone?: 'default' | 'success' | 'error' | 'warning'
}>(), {
  message: '',
  tone: 'default',
})

const statusClasses = computed(() => [
  'app-status-message',
  `app-status-message--${props.tone}`,
])
</script>

<template>
  <div
    v-if="message || $slots.default"
    v-bind="$attrs"
    :class="statusClasses"
    :role="tone === 'error' ? 'alert' : 'status'"
  >
    <slot>{{ message }}</slot>
  </div>
</template>
