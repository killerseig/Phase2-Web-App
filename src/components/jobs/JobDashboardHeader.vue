<script setup lang="ts">
import AppPaneHeader from '@/components/common/AppPaneHeader.vue'
import { formatJobTypeLabel } from '@/types/domain'
import type { JobRecord } from '@/types/domain'

defineProps<{
  job: JobRecord | null
}>()
</script>

<template>
  <AppPaneHeader
    eyebrow="Job"
    :title="job ? `${job.code || 'No Job #'} - ${job.name}` : 'Job not found'"
    :description="job ? [formatJobTypeLabel(job.type), job.gc].filter(Boolean).join(' · ') : ''"
  >
  </AppPaneHeader>
</template>
