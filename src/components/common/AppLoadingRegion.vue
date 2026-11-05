<script setup lang="ts">
import { ref, watch } from 'vue'
import AppLoadingOverlay from './AppLoadingOverlay.vue'
const props = withDefaults(defineProps<{ loading: boolean; label?: string }>(), { label: 'Loading content…' })
// A body loader owns the loading presentation until its exit transition ends.
const covered = ref(props.loading)
watch(() => props.loading, loading => { if (loading) covered.value = true }, { flush: 'sync' })
function reveal() { if (!props.loading) covered.value = false }
</script>

<template>
  <section class="app-loading-region" :class="{ 'is-covered': covered }" :aria-busy="covered">
    <div class="app-loading-region__content" :class="{ 'is-loading': loading }" :inert="covered || undefined"><slot /></div>
    <AppLoadingOverlay :loading="loading" :label="label" @after-leave="reveal" />
  </section>
</template>

<style scoped>
.app-loading-region { position: relative; display: flex; flex-direction: column; min-width: 0; min-height: var(--loading-region-min-height, 0); }
.app-loading-region__content { display: flex; flex-direction: column; gap: var(--loading-region-gap, .75rem); flex: 1; min-width: 0; min-height: 0; }
.app-loading-region__content.is-loading { visibility: hidden; }
/* Prevent an underlying element loader from appearing through a fading body loader. */
.app-loading-region.is-covered > .app-loading-region__content :deep(.app-loading-overlay),
.app-loading-region.is-covered > .app-loading-region__content :deep(.app-loading-indicator) { visibility: hidden; }
</style>
