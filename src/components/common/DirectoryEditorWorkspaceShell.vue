<script setup lang="ts">
import AppMobilePanelTabs from '@/components/common/AppMobilePanelTabs.vue'
import AppPageLayout from '@/components/common/AppPageLayout.vue'
import AppSplitWorkspace from '@/components/common/AppSplitWorkspace.vue'
import type { DirectoryEditorMobilePanelTab } from '@/composables/useDirectoryEditorPanels'
import AppShell from '@/layouts/AppShell.vue'

defineOptions({
  inheritAttrs: false,
})

defineProps<{
  activePanel: string
  panels: readonly DirectoryEditorMobilePanelTab[]
  tabsLabel: string
  title?: string
  description?: string
}>()

const emit = defineEmits<{
  show: [panel: string]
}>()
</script>

<template>
  <AppShell>
    <AppPageLayout
      class="directory-workspace"
      :title="title"
      :description="description"
      eyebrow="Administration"
      fill
    >
      <AppSplitWorkspace
        v-bind="$attrs"
        :active-panel="activePanel"
        primary-panel="directory"
        secondary-panel="editor"
        primary-width="380px"
      >
        <template #tabs>
          <AppMobilePanelTabs
            :active-panel="activePanel"
            :label="tabsLabel"
            :panels="panels"
            @show="emit('show', $event)"
          />
        </template>

        <template #primary>
          <slot name="primary" />
        </template>

        <template #secondary>
          <slot name="secondary" />
        </template>
      </AppSplitWorkspace>
    </AppPageLayout>

    <slot />
  </AppShell>
</template>

<style scoped>
@media (min-width: 901px) and (max-width: 1180px) {
  .directory-workspace {
    height: 100%;
    min-height: 0;
  }

  .directory-workspace :deep(.app-split-workspace) {
    grid-template-columns: 340px minmax(0, 1fr);
  }

  .directory-workspace
    :deep(
      .app-split-workspace:not(.app-split-workspace--single) .app-split-workspace__primary-pane
    ) {
    max-height: none;
  }
}
</style>
