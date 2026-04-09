<script setup lang="ts">
import AppMasterDetailWorkspace from '@/components/common/AppMasterDetailWorkspace.vue'

defineOptions({
  name: 'TimecardWeekWorkspaceLayout',
})
</script>

<template>
  <AppMasterDetailWorkspace
    browse-label="Roster"
    controls-label="Week"
    browser-title="Roster"
    controls-title="Week"
    browser-column="minmax(250px, 280px)"
    controls-column="minmax(280px, 315px)"
  >
    <slot />

    <template #browser>
      <slot name="browser" />
    </template>

    <template #controls>
      <slot name="controls" />
    </template>
  </AppMasterDetailWorkspace>
</template>
