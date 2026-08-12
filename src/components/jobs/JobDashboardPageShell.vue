<script setup lang="ts">
import JobDashboardWorkspaceShell from '@/components/jobs/JobDashboardWorkspaceShell.vue'
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
    <JobDashboardWorkspaceShell v-bind="$attrs" :test-id="testId">
      <template #header>
        <slot name="header" />
      </template>

      <template #modules>
        <slot name="modules" />
      </template>
    </JobDashboardWorkspaceShell>

    <slot />
  </AppShell>
</template>
