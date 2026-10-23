<script setup lang="ts">
import AppPageLayout from '@/components/common/AppPageLayout.vue'
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'
import AppCard from '@/components/common/AppCard.vue'
withDefaults(defineProps<{ title: string; inline?: boolean; mainLabel?: string }>(), { inline: false, mainLabel: 'Form details' })
</script>
<template>
  <section class="form-presentation" :class="{ 'form-presentation--inline': inline }">
    <AppPageLayout>
      <template #header>
        <AppPaneHeader class="form-presentation__header" eyebrow="Field Workspace" :title="title" :title-tag="inline ? 'h2' : 'h1'"><template #actions><slot name="header-actions" /></template></AppPaneHeader>
      </template>
      <slot name="messages" />
      <div class="form-presentation__layout">
        <AppCard as="section" class="form-presentation__main" :aria-label="mainLabel"><slot /></AppCard>
        <aside class="form-presentation__sidebar" aria-label="Form information"><slot name="sidebar" /></aside>
      </div>
    </AppPageLayout>
  </section>
</template>
<style scoped>
.form-presentation { container-type: inline-size; width: 100%; min-width: 0; font: 400 1rem/1.5 var(--font-body, sans-serif); color: var(--text); }
.form-presentation__header { --app-pane-header-title-font-size: 1.5rem; padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius); background: var(--panel-background); }
.form-presentation__layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 380px); gap: var(--page-gap); align-items: start; min-width: 0; }
.form-presentation__main { align-content: start; }
.form-presentation__sidebar { display: grid; gap: 1rem; align-content: start; min-width: 0; }
.form-presentation :deep(.app-card) { box-shadow: none; }
.form-presentation :deep(.form-fields) { margin: 0; }
.form-presentation :deep(.form-field) { gap: var(--field-gap, .4rem); margin: 0 0 var(--form-gap, 1rem); }
.form-presentation :deep(.form-field > label) { font: inherit; font-weight: 600; color: var(--text-muted); }
.form-presentation :deep(input:not([type=checkbox]):not([type=radio])), .form-presentation :deep(textarea), .form-presentation :deep(select) { box-sizing: border-box; width: 100%; min-width: 0; padding: .65rem; font: inherit; border: 1px solid var(--border); border-radius: var(--radius-sm, .4rem); background: var(--control-background, var(--surface)); color: var(--text); }
.form-presentation :deep(button) { font-family: inherit; font-size: .95rem; }
.form-presentation :deep(p) { margin: 0; overflow-wrap: anywhere; }
.form-presentation :deep(.form-description) { color: var(--text-muted); white-space: pre-line; }
.form-presentation :deep(.response-actions) { display: flex; flex-wrap: wrap; gap: .5rem; }
.form-presentation :deep(.response-history) { display: grid; gap: .5rem; max-height: 18rem; overflow: auto; }
.form-presentation :deep(.response-information) { display: grid; gap: .75rem; }
.form-presentation :deep(.response-information details) { font-size: .9rem; color: var(--text-muted); }
.form-presentation :deep(.response-information summary) { cursor: pointer; }
.form-presentation :deep(.response-information dl) { display: grid; grid-template-columns: auto 1fr; gap: .35rem .75rem; margin: 0; font-size: .9rem; }
.form-presentation :deep(.response-information dd) { margin: 0; overflow-wrap: anywhere; }
@container (max-width: 1080px) { .form-presentation__layout { grid-template-columns: 1fr; } }
.form-presentation--inline .form-presentation__layout { grid-template-columns: 1fr; }
</style>
