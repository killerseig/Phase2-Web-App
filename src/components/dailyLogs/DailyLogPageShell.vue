<script setup lang="ts">
import DailyLogWorkspaceShell from '@/components/dailyLogs/DailyLogWorkspaceShell.vue'
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
    <DailyLogWorkspaceShell v-bind="$attrs" :test-id="testId">
      <template #header>
        <slot name="header" />
      </template>

      <template #main>
        <slot name="main" />
      </template>

      <template #sidebar>
        <slot name="sidebar" />
      </template>
    </DailyLogWorkspaceShell>

    <slot />
  </AppShell>
</template>
