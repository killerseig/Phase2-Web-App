<script setup lang="ts">
import AppMasterDetailWorkspace from '@/components/common/AppMasterDetailWorkspace.vue'

defineOptions({
  name: 'TimecardWeekWorkspaceLayout',
})
</script>

<template>
  <AppMasterDetailWorkspace
    browse-label="Employees"
    controls-label="Week Controls"
    browser-title="Employees"
    controls-title="Week Controls"
    browser-column="minmax(250px, 290px)"
    controls-column="minmax(280px, 330px)"
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
