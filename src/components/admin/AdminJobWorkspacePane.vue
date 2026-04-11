<script setup lang="ts">
import { computed } from 'vue'
import AppAlert from '@/components/common/AppAlert.vue'
import AppSectionCard from '@/components/common/AppSectionCard.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import TimecardWeekStatusBadge from '@/components/common/TimecardWeekStatusBadge.vue'
import AdminJobDetailsCard from '@/components/admin/AdminJobDetailsCard.vue'
import type { JobFormInput } from '@/types/adminJobs'
import type { Job } from '@/types/models'

const props = defineProps<{
  job: Job | null
  form: JobFormInput
  foremanOptions: readonly { value: string; label: string }[]
  dirty: boolean
  saving: boolean
  togglingJobId: string
  currentWeekEnd: string
  currentWeekLabel: string
}>()

const emit = defineEmits<{
  'update:form': [value: JobFormInput]
  save: []
  reset: []
  close: []
  delete: [job: Job]
  'toggle-archive': [payload: { job: Job; active: boolean }]
}>()

const summaryMeta = computed(() => {
  if (!props.job) return []
  return [
    props.job.code || 'No job #',
    props.job.projectManager ? `PM ${props.job.projectManager}` : 'No PM',
    props.job.foreman ? `Foreman ${props.job.foreman}` : 'No foreman assigned',
    props.job.gc || 'No GC listed',
  ]
})
</script>

<template>
  <AppSectionCard
    class="admin-job-workspace"
    body-class="d-flex flex-column gap-3"
    header-class="admin-job-workspace__header-shell"
  >
    <template #header>
      <div v-if="job" class="admin-job-workspace__header">
        <div class="admin-job-workspace__identity">
          <div class="admin-job-workspace__eyebrow">Selected Job</div>
          <div class="admin-job-workspace__title-row">
            <h3 class="mb-0">{{ job.name }}</h3>
            <StatusBadge :status="job.active ? 'active' : 'archived'" />
          </div>
          <div class="admin-job-workspace__meta">
            <span
              v-for="item in summaryMeta"
              :key="item"
              class="admin-job-workspace__meta-item"
            >
              {{ item }}
            </span>
          </div>
        </div>

        <div class="admin-job-workspace__actions">
          <button
            type="button"
            class="btn btn-sm btn-primary"
            :disabled="saving || !dirty"
            @click="emit('save')"
          >
            Save
          </button>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            :disabled="saving || !dirty"
            @click="emit('reset')"
          >
            Reset
          </button>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            @click="emit('close')"
          >
            Close
          </button>
          <button
            type="button"
            class="btn btn-sm"
            :class="job.active ? 'btn-outline-warning' : 'btn-outline-success'"
            :disabled="togglingJobId === job.id"
            @click="emit('toggle-archive', { job, active: !job.active })"
          >
            {{ job.active ? 'Archive' : 'Restore' }}
          </button>
          <button
            type="button"
            class="btn btn-sm btn-outline-danger"
            @click="emit('delete', job)"
          >
            Delete
          </button>
        </div>
      </div>

      <div v-if="job" class="admin-job-workspace__toolbar">
        <TimecardWeekStatusBadge
          :status="job.timecardStatus"
          :period-end-date="job.timecardPeriodEndDate"
          :current-week-end="currentWeekEnd"
          :current-week-label="currentWeekLabel"
        />
      </div>
    </template>

    <AppAlert
      v-if="!job"
      variant="info"
      class="mb-0"
      message="Select a job from the list to edit its details."
    />

    <AdminJobDetailsCard
      v-else
      embedded
      :job="job"
      :form="form"
      :foreman-options="foremanOptions"
      :dirty="dirty"
      :saving="saving"
      :toggling-job-id="togglingJobId"
      :current-week-end="currentWeekEnd"
      :current-week-label="currentWeekLabel"
      @update:form="emit('update:form', $event)"
      @save="emit('save')"
      @reset="emit('reset')"
      @close="emit('close')"
      @delete="emit('delete', $event)"
      @toggle-archive="emit('toggle-archive', $event)"
    />
  </AppSectionCard>
</template>
