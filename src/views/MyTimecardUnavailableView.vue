<script setup lang="ts">
import AppShell from '@/layouts/AppShell.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
</script>

<template>
  <AppShell contained>
    <AppEmptyState panel title="My Timecard is temporarily unavailable"
      message="We are redesigning this workflow. Existing timecards are preserved. Please use the existing job timecard process with your foreman or payroll team." />
  </AppShell>
</template>
