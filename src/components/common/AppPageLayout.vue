<script setup lang="ts">
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'

withDefaults(
  defineProps<{
    title?: string
    eyebrow?: string
    description?: string
    fill?: boolean
  }>(),
  {
    title: '',
    eyebrow: 'Workspace',
    description: '',
    fill: false,
  },
)
</script>

<template>
  <div class="app-page-layout" :class="{ 'app-page-layout--fill': fill }">
    <div v-if="title || $slots.header" class="app-page-layout__heading">
      <slot name="header">
        <AppPaneHeader
          class="app-page-header"
          :eyebrow="eyebrow"
          :title="title"
          :description="description"
          title-tag="h1"
        >
          <template v-if="$slots.actions" #actions><slot name="actions" /></template>
        </AppPaneHeader>
      </slot>
    </div>
    <div class="app-page-layout__body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.app-page-layout {
  --page-gap: 1.25rem;
  --page-panel-padding: 1.25rem;
  --app-pane-shadow: none;
  --app-card-shadow: none;
  display: flex;
  flex-direction: column;
  gap: var(--page-gap);
  min-width: 0;
  min-height: 0;
}

.app-page-layout--fill {
  height: 100%;
}

.app-page-layout__heading {
  display: grid;
  flex: 0 0 auto;
  gap: 0.75rem;
  min-width: 0;
}

.app-page-layout__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--page-gap);
  min-width: 0;
  min-height: 0;
}

.app-page-layout :deep(.app-pane),
.app-page-layout :deep(.app-card) {
  --app-pane-padding: var(--page-panel-padding);
  --app-card-padding: var(--page-panel-padding);
  border-radius: 6px;
}

.app-page-layout :deep(.app-pane-header:not(.app-page-header)) {
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-soft);
}

.app-page-layout :deep(.app-pane-header__actions) {
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.app-page-layout :deep(.app-split-workspace),
.app-page-layout :deep(.catalog-explorer),
.app-page-layout :deep(.shop-orders-explorer) {
  gap: var(--page-gap);
}

@media (max-width: 1180px) {
  .app-page-layout--fill {
    height: auto;
    min-height: 100%;
  }
}

@media (max-width: 560px) {
  .app-page-layout {
    --page-gap: 1rem;
    --page-panel-padding: 1rem;
  }
}
</style>
