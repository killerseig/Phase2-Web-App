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
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0.75rem 0.9rem;
  background: var(--panel-background);
  color: var(--text-muted);
}

.app-status-message--success {
  border-color: var(--success-border);
  background: var(--success-surface);
  color: var(--success);
}

.app-status-message--error {
  border-color: var(--danger-border);
  background: var(--danger-surface);
  color: var(--danger);
}

.app-status-message--warning {
  border-color: var(--warning-border);
  background: var(--warning-surface);
  color: var(--warning);
}
</style>
