<script setup lang="ts">
import AppPageLayout from '@/components/common/AppPageLayout.vue'

defineProps<{
  eyebrow: string
  title: string
  description?: string
}>()
</script>

<template>
  <AppPageLayout class="page-panel" :eyebrow="eyebrow" :title="title" :description="description">
    <div class="page-panel__body">
      <slot />
    </div>
  </AppPageLayout>
</template>

<style scoped>
.page-panel__body {
  display: grid;
  gap: var(--page-gap);
  min-width: 0;
  padding: var(--page-panel-padding);
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel-background);
}
</style>
