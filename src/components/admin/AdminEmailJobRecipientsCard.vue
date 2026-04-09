<script setup lang="ts">
import { computed, ref } from 'vue'
import AdminCardWrapper from '@/components/admin/AdminCardWrapper.vue'
import AppBadge from '@/components/common/AppBadge.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import BaseSearchField from '@/components/common/BaseSearchField.vue'
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
  return count ? `${count} recipient${count === 1 ? '' : 's'}` : 'No overrides'
}

const searchTerm = ref('')

const jobsWithOverridesCount = computed(() => (
  props.jobs.filter((job) => getJobRecipients(job.id).length > 0).length
))

const filteredJobs = computed(() => {
  const normalizedSearch = searchTerm.value.trim().toLowerCase()

  return [...props.jobs]
    .sort((left, right) => {
      const leftCount = getJobRecipients(left.id).length
      const rightCount = getJobRecipients(right.id).length
      if (leftCount !== rightCount) return rightCount - leftCount
      return (left.name || '').localeCompare(right.name || '')
    })
    .filter((job) => {
      if (!normalizedSearch) return true
      const haystack = [job.name, job.code, job.projectManager, job.gc]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalizedSearch)
    })
})
</script>

<template>
  <AdminCardWrapper
    title="Job-Specific Recipients"
    icon="briefcase"
    subtitle="Configure daily log recipients for individual jobs. These override the global defaults."
    :loading="props.loading"
    :error="props.error"
  >
    <template #header-actions>
      <AppBadge
        :label="`${jobsWithOverridesCount} override job${jobsWithOverridesCount === 1 ? '' : 's'}`"
        variant-class="text-bg-secondary"
      />
    </template>

    <div class="admin-email-job-recipients-card__tools">
      <BaseSearchField
        :model-value="searchTerm"
        label="Find Job"
        label-class="small mb-1"
        wrapper-class="mb-0"
        placeholder="Search jobs by name, code, PM, or GC"
        clearable
        @update:model-value="searchTerm = $event"
      />
    </div>

    <AppEmptyState
      v-if="props.jobs.length === 0"
      compact
      icon="bi bi-briefcase"
      icon-class="fs-4"
      title="No jobs found"
      message="Job-specific recipient lists will appear here once jobs exist."
      message-class="small mb-0"
    />

    <AppEmptyState
      v-else-if="filteredJobs.length === 0"
      compact
      icon="bi bi-search"
      icon-class="fs-4"
      title="No matching jobs"
      message="Try a different search to find the job recipient list you need."
      message-class="small mb-0"
    />

    <div v-else class="admin-email-job-recipients-card__list">
      <BaseAccordionCard
        v-for="job in filteredJobs"
        :key="job.id"
        :open="props.openJobId === job.id"
        :title="job.name"
        body-class="admin-email-job-recipients-card__body"
        @update:open="emit('update:openJobId', $event ? job.id : null)"
      >
        <template #header>
          <div class="admin-email-job-recipients-card__item-header">
            <h5 class="admin-email-job-recipients-card__item-title mb-0">{{ job.name }}</h5>
            <p
              v-if="job.code || job.projectManager || job.gc"
              class="admin-email-job-recipients-card__item-meta mb-0"
            >
              <span v-if="job.code">Job #{{ job.code }}</span>
              <span v-if="job.projectManager">PM {{ job.projectManager }}</span>
              <span v-if="job.gc">{{ job.gc }}</span>
            </p>
          </div>
        </template>

        <template #header-actions>
          <AppBadge
            :label="getRecipientSummary(job.id)"
            :variant-class="getJobRecipients(job.id).length ? 'text-bg-info' : 'text-bg-secondary'"
          />
        </template>

        <div class="admin-email-job-recipients-card__editor">
          <EmailRecipientInput
            :emails="getJobRecipients(job.id)"
            :show-label="false"
            compact
            placeholder="email@example.com"
            empty-text="No override recipients yet"
            :disabled="props.saving"
            @add="emit('add-job-recipient', { jobId: job.id, email: $event })"
            @remove="emit('remove-job-recipient', { jobId: job.id, email: $event })"
          />
        </div>
      </BaseAccordionCard>
    </div>
  </AdminCardWrapper>
</template>
