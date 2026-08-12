<script setup lang="ts">
import AppMobilePanelTabs from '@/components/common/AppMobilePanelTabs.vue'
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
}>()

const emit = defineEmits<{
  show: [panel: string]
}>()
</script>

<template>
  <AppShell>
    <AppSplitWorkspace
      v-bind="$attrs"
      :active-panel="activePanel"
      primary-panel="directory"
      secondary-panel="editor"
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

    <slot />
  </AppShell>
</template>
