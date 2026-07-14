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

<style scoped>
.app-status-message {
  border: 1px solid rgba(168, 190, 209, 0.18);
  border-radius: var(--radius-sm);
  padding: 0.75rem 0.9rem;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.012)),
    rgba(255, 255, 255, 0.035);
  color: var(--text-muted);
}

.app-status-message--success {
  border-color: rgba(103, 213, 157, 0.24);
  background: rgba(103, 213, 157, 0.08);
  color: var(--success);
}

.app-status-message--error {
  border-color: rgba(255, 125, 107, 0.3);
  background: rgba(255, 125, 107, 0.08);
  color: var(--danger);
}

.app-status-message--warning {
  border-color: rgba(251, 191, 36, 0.28);
  background: rgba(251, 191, 36, 0.08);
  color: #f3c96b;
}
</style>
