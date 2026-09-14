<script setup lang="ts">
import AppPageLayout from '@/components/common/AppPageLayout.vue'
import TimecardWorkspaceShell from '@/components/timecards/TimecardWorkspaceShell.vue'
import AppShell from '@/layouts/AppShell.vue'

defineOptions({ inheritAttrs: false })
defineProps<{ testId?: string }>()
</script>

<template>
  <AppShell>
    <AppPageLayout
      title="Timecard Export"
      eyebrow="Reporting"
      description="Filter saved weeks, review timecards, and export a PDF or CSV."
      class="timecard-export-layout"
    >
      <TimecardWorkspaceShell v-bind="$attrs" :test-id="testId">
        <slot name="workspace" />
      </TimecardWorkspaceShell>
    </AppPageLayout>
    <slot />
  </AppShell>
</template>

<style scoped>
/* Export-only framing. The main worksheet and shared components keep their styles. */
.timecard-export-layout :deep(.timecards-workbook) {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  gap: var(--page-gap);
}

.timecard-export-layout :deep(.timecard-toolbar-shell),
.timecard-export-layout :deep(.timecard-summary),
.timecard-export-layout :deep(.timecards-canvas-panel) {
  border-radius: 6px;
  padding: var(--page-panel-padding);
}
</style>
