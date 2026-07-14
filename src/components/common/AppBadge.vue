<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
})

export type AppBadgeTone = 'default' | 'accent' | 'success' | 'danger' | 'warning'

withDefaults(defineProps<{
  tone?: AppBadgeTone
}>(), {
  tone: 'default',
})
</script>

<template>
  <span v-bind="$attrs" :class="['app-badge', `app-badge--${tone}`]">
    <slot />
  </span>
</template>

<style scoped>
.app-badge {
  display: inline-flex;
  align-items: center;
  min-height: 1.85rem;
  padding: 0 0.6rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.035);
  color: var(--text-muted);
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.app-badge--accent {
  border-color: rgba(88, 186, 233, 0.24);
  background: rgba(38, 74, 96, 0.28);
  color: var(--accent);
}

.app-badge--success {
  border-color: rgba(103, 213, 157, 0.2);
  background: rgba(50, 92, 72, 0.22);
  color: var(--success);
}

.app-badge--danger {
  border-color: rgba(255, 125, 107, 0.2);
  background: rgba(104, 52, 45, 0.22);
  color: var(--danger);
}

.app-badge--warning {
  border-color: rgba(235, 194, 90, 0.22);
  background: rgba(107, 88, 31, 0.22);
  color: #f2d889;
}
</style>
