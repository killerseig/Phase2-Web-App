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
  flex: var(--app-badge-flex, 0 1 auto);
  width: var(--app-badge-width, auto);
  min-height: var(--app-badge-min-height, 1.85rem);
  padding: var(--app-badge-padding, 0 0.6rem);
  border: 1px solid var(--app-badge-border-color, var(--border));
  border-radius: var(--app-badge-border-radius, var(--radius-sm));
  background: var(--app-badge-background, rgba(255, 255, 255, 0.035));
  color: var(--app-badge-color, var(--text-muted));
  font-size: var(--app-badge-font-size, 0.7rem);
  letter-spacing: var(--app-badge-letter-spacing, 0.04em);
  text-transform: var(--app-badge-text-transform, uppercase);
  white-space: var(--app-badge-white-space, normal);
}

.app-badge--accent {
  border-color: var(--app-badge-accent-border-color, var(--border));
  background: var(--app-badge-accent-background, var(--field));
  color: var(--app-badge-accent-color, var(--text-muted));
}

.app-badge--success {
  border-color: var(--app-badge-success-border-color, rgba(103, 213, 157, 0.2));
  background: var(--app-badge-success-background, rgba(50, 92, 72, 0.22));
  color: var(--app-badge-success-color, var(--success));
}

.app-badge--danger {
  border-color: var(--app-badge-danger-border-color, rgba(255, 125, 107, 0.2));
  background: var(--app-badge-danger-background, rgba(104, 52, 45, 0.22));
  color: var(--app-badge-danger-color, var(--danger));
}

.app-badge--warning {
  border-color: var(--app-badge-warning-border-color, rgba(235, 194, 90, 0.22));
  background: var(--app-badge-warning-background, rgba(107, 88, 31, 0.22));
  color: var(--app-badge-warning-color, #f2d889);
}
</style>
