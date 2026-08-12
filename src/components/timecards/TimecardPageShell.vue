<script setup lang="ts">
import TimecardWorkspaceShell from '@/components/timecards/TimecardWorkspaceShell.vue'
import AppShell from '@/layouts/AppShell.vue'

defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  testId?: string
}>(), {
  testId: undefined,
})
</script>

<template>
  <AppShell>
    <TimecardWorkspaceShell v-bind="$attrs" :test-id="testId">
      <slot name="workspace" />
    </TimecardWorkspaceShell>

    <slot />
  </AppShell>
</template>
