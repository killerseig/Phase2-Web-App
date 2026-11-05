<script setup lang="ts">
withDefaults(defineProps<{ label?: string; inline?: boolean }>(), { label: 'Loading content…', inline: false })
</script>

<template>
  <span class="app-loading-indicator" :class="{ 'app-loading-indicator--inline': inline }" role="status" aria-live="polite" aria-atomic="true">
    <span class="app-loading-indicator__wheel" aria-hidden="true" />
    <span>{{ label }}</span>
  </span>
</template>

<style scoped>
.app-loading-indicator { display: grid; justify-items: center; align-content: center; gap: .75rem; color: var(--text-muted); font-size: .875rem; text-align: center; }
.app-loading-indicator__wheel { width: 2.5rem; height: 2.5rem; box-sizing: border-box; border: 3px solid var(--border); border-top-color: var(--accent, var(--text)); border-radius: 50%; animation: app-loading-spin .8s linear infinite; }
.app-loading-indicator--inline { display: inline-flex; align-items: center; justify-content: center; gap: .5rem; color: inherit; font: inherit; }
.app-loading-indicator--inline .app-loading-indicator__wheel { width: 1em; height: 1em; border-width: 2px; flex: none; }
@keyframes app-loading-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .app-loading-indicator__wheel { animation: none; } }
</style>
