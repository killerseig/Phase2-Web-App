<script setup lang="ts">
import DailyLogWorkspaceShell from '@/components/dailyLogs/DailyLogWorkspaceShell.vue'
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
