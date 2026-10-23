<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue'
defineProps<{ label: string; icon: string; expanded: boolean; controls: string; disabled?: boolean }>()
const emit = defineEmits<{ toggle: [] }>()
</script>
<template>
  <AppButton class="builder-disclosure-button" type="button" :aria-label="label" :aria-expanded="expanded" :aria-controls="controls" :disabled="disabled" @click="emit('toggle')">
    <i :class="['pi', icon]" aria-hidden="true" /><span>{{ label }}</span><i class="pi pi-chevron-down builder-disclosure-button__chevron" aria-hidden="true" />
  </AppButton>
</template>
<style scoped>
.builder-disclosure-button { width: 100%; min-width: 0; min-height: 2.45rem; gap: .35rem; padding: .45rem .5rem; font: 500 .8rem/1.2 var(--font-body, sans-serif); justify-content: flex-start; }
.builder-disclosure-button > .pi { flex: 0 0 1em; width: 1em; text-align: center; font-size: .8rem; }
.builder-disclosure-button > span { flex: 1; min-width: 0; text-align: left; }
.builder-disclosure-button__chevron { transition: transform var(--duration-fast) ease; }
.builder-disclosure-button[aria-expanded='true'] { border-color: var(--accent); background: var(--bg-accent); }
.builder-disclosure-button[aria-expanded='true'] > .builder-disclosure-button__chevron { transform: rotate(180deg); }
</style>
