<script setup lang="ts">
import AdminCardWrapper from '@/components/admin/AdminCardWrapper.vue'
import AppAlert from '@/components/common/AppAlert.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import BaseAccordionCard from '@/components/common/BaseAccordionCard.vue'
import EmailRecipientInput from '@/components/common/EmailRecipientInput.vue'
import type { Job } from '@/services'

const props = defineProps<{
  jobs: Job[]
  loading: boolean
  error: string
  saving: boolean
  jobRecipients: Map<string, string[]>
  openJobId: string | null
}>()

const emit = defineEmits<{
  'update:openJobId': [value: string | null]
  'add-job-recipient': [payload: { jobId: string; email: string }]
  'remove-job-recipient': [payload: { jobId: string; email: string }]
}>()

function getJobRecipients(jobId: string) {
  return props.jobRecipients.get(jobId) ?? []
}

function getRecipientSummary(jobId: string) {
  const count = getJobRecipients(jobId).length
  return count ? `${count} recipients` : 'No recipients'
}
</script>

<template>
  <AdminCardWrapper
    title="Job-Specific Recipients"
    icon="briefcase"
    subtitle="Configure daily log recipients for individual jobs. These override the global defaults."
    :loading="props.loading"
    :error="props.error"
  >
    <AppAlert
      class="app-note small mb-3"
      icon="bi bi-info-circle"
      icon-class="flex-shrink-0 mt-1"
      title="Tip:"
    >
      Department supervisors can be added as job-specific recipients. When a daily log is submitted for a
      job, the supervisor's email will automatically receive the report.
    </AppAlert>

    <AppEmptyState
      v-if="props.jobs.length === 0"
      compact
      icon="bi bi-briefcase"
      icon-class="fs-4"
      title="No jobs found"
      message="Job-specific recipient lists will appear here once jobs exist."
      message-class="small mb-0"
    />

    <div v-else>
      <BaseAccordionCard
        v-for="job in props.jobs"
        :key="job.id"
        :open="props.openJobId === job.id"
        :title="job.name"
        :subtitle="getRecipientSummary(job.id)"
        body-class="p-3"
        @update:open="emit('update:openJobId', $event ? job.id : null)"
      >
        <p class="small text-uppercase text-muted mb-2">Daily Logs</p>

        <EmailRecipientInput
          :emails="getJobRecipients(job.id)"
          :label="`Recipients for ${job.name}`"
          :disabled="props.saving"
          @add="emit('add-job-recipient', { jobId: job.id, email: $event })"
          @remove="emit('remove-job-recipient', { jobId: job.id, email: $event })"
        />
      </BaseAccordionCard>
    </div>
  </AdminCardWrapper>
</template>
