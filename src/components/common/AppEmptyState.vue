<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
})

defineProps<{
  title?: string
  message?: string
  panel?: boolean
}>()
</script>

<template>
  <div v-bind="$attrs" class="app-empty-state" :class="{ 'app-empty-state--panel': panel }">
    <strong v-if="title" class="app-empty-state__title">{{ title }}</strong>
    <p v-if="message" class="app-empty-state__message">{{ message }}</p>
    <slot v-else />
  </div>
</template>

<style scoped>
.app-empty-state--panel {
  display: grid;
  place-content: center;
  gap: var(--space-1);
  min-width: 0;
  min-height: var(--app-empty-state-min-height, 8rem);
  padding: var(--space-4);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: var(--font-size-sm);
  text-align: center;
  overflow-wrap: anywhere;
}

.app-empty-state--panel .app-empty-state__message {
  margin: 0;
}

.app-empty-state__title {
  display: block;
  color: var(--text);
  font-weight: var(--font-weight-heading);
}

.app-empty-state__message {
  margin: 0.2rem 0 0;
  color: var(--text-muted);
}
</style>
