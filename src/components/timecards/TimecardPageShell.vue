<script setup lang="ts">
import TimecardWorkspaceShell from '@/components/timecards/TimecardWorkspaceShell.vue'
import AppShell from '@/layouts/AppShell.vue'

defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  testId?: string
  beforeSignOut?: () => boolean | Promise<boolean>
}>(), {
  testId: undefined,
})
</script>

<template>
  <AppShell :before-sign-out="beforeSignOut">
    <TimecardWorkspaceShell v-bind="$attrs" :test-id="testId">
      <slot name="workspace" />
    </TimecardWorkspaceShell>

    <slot />
  </AppShell>
</template>
