<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import AppLoadingRegion from '@/components/common/AppLoadingRegion.vue'
import type { JobRecord } from '@/types/domain'
import type { SharedDashboardJob } from '@/features/dashboard/sharedDashboards'
const props = defineProps<{
  job: SharedDashboardJob | null
  jobs: JobRecord[]
  loading?: boolean
  error?: string | null
  editing: boolean
  jobScope: boolean
}>()
const id = useId()
const selected = ref('')
const current = computed(() => props.job || props.jobs.find(job => job.id === selected.value))
</script>

<template>
  <div class="dashboard-job-information shared-widget-tools" :inert="editing" :class="{ 'is-loading': !jobScope && loading }">
    <AppLoadingRegion :loading="!jobScope && !!loading" label="Loading job information.">
      <p v-if="!jobScope && error" role="alert">Job information could not be loaded. {{ error }} Use Refresh to try again.</p>
      <template v-else-if="jobScope || !loading">
        <label v-if="!jobScope && jobs.length" :for="id">Choose job for information
          <select :id="id" v-model="selected">
            <option value="">Choose a job</option>
            <option v-for="entry in jobs" :key="entry.id" :value="entry.id">{{ entry.code || 'No Job #' }} · {{ entry.name }}</option>
          </select>
        </label>
        <dl v-if="current" class="shared-job-information">
          <div><dt>Job</dt><dd>{{ current.code || 'No Job #' }} · {{ current.name }}</dd></div>
          <div><dt>General contractor</dt><dd>{{ current.gc || 'Not provided' }}</dd></div>
          <div><dt>Job address</dt><dd class="dashboard-job-address">{{ current.jobAddress || 'Not provided' }}</dd></div>
          <div><dt>Start date</dt><dd><time v-if="current.startDate" :datetime="current.startDate">{{ current.startDate }}</time><span v-else>Not provided</span></dd></div>
          <div><dt>Finish date</dt><dd><time v-if="current.finishDate" :datetime="current.finishDate">{{ current.finishDate }}</time><span v-else>Not provided</span></dd></div>
        </dl>
        <p v-else>{{ jobScope || jobs.length ? 'Choose a job to see its information.' : 'No jobs are available for your account.' }}</p>
      </template>
    </AppLoadingRegion>
  </div>
</template>

<style scoped>
.dashboard-job-information { --loading-region-min-height: 0; }
.dashboard-job-information.is-loading { --loading-region-min-height: 8rem; }
.dashboard-job-information label { display: grid; gap: .5rem; }
.dashboard-job-information dl { margin-bottom: 0; }
.dashboard-job-address { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
