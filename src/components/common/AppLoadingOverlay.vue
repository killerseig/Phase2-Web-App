<script setup lang="ts">
import AppLoadingIndicator from './AppLoadingIndicator.vue'
withDefaults(defineProps<{ loading: boolean; label?: string }>(), { label: 'Loading content…' })
</script>

<template>
  <Transition name="app-loading-fade">
    <div v-if="loading" class="app-loading-overlay">
      <AppLoadingIndicator :label="label" />
    </div>
  </Transition>
</template>

<style scoped>
.app-loading-overlay { position: absolute; inset: 0; z-index: 4; display: grid; place-items: center; padding: 1rem; background: var(--panel-background, var(--surface)); border-radius: inherit; }
.app-loading-fade-leave-active { transition: opacity 180ms ease-out; }
.app-loading-fade-leave-to { opacity: 0; }
.app-loading-fade-leave-active { pointer-events: none; }
@media (prefers-reduced-motion: reduce) { .app-loading-fade-enter-active, .app-loading-fade-leave-active { transition: none; } }
</style>
