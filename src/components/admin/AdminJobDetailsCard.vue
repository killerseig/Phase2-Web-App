<script setup lang="ts">
import AppAlert from '@/components/common/AppAlert.vue'
import AppSectionCard from '@/components/common/AppSectionCard.vue'
import BaseInputField from '@/components/common/BaseInputField.vue'
import BaseSelectField from '@/components/common/BaseSelectField.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import TimecardWeekStatusBadge from '@/components/common/TimecardWeekStatusBadge.vue'
import { JOB_TYPE_OPTIONS } from '@/constants/jobs'
import type { Job } from '@/types/models'
import type { JobFormInput } from '@/types/adminJobs'

const props = defineProps<{
  job: Job | null
  form: JobFormInput
  foremanOptions: readonly { value: string; label: string }[]
  dirty: boolean
  saving: boolean
  togglingJobId: string
  currentWeekEnd: string
  currentWeekLabel: string
  embedded?: boolean
}>()

const emit = defineEmits<{
  'update:form': [value: JobFormInput]
  save: []
  reset: []
  close: []
  delete: [job: Job]
  'toggle-archive': [payload: { job: Job; active: boolean }]
}>()

function updateField<K extends keyof JobFormInput>(field: K, value: JobFormInput[K]) {
  emit('update:form', {
    ...props.form,
    [field]: value,
  })
}
</script>

<template>
  <component
    :is="embedded ? 'div' : AppSectionCard"
    v-bind="embedded
      ? {}
        : {
          title: 'Selected Job',
          subtitle: 'Job details and foreman assignment are edited here.',
          icon: 'bi bi-building',
        }"
    class="admin-job-details-card"
    :class="{ 'admin-job-details-card--embedded': embedded }"
  >
    <AppAlert
      v-if="!job"
      variant="info"
      class="mb-0"
      message="Select a job from the list to edit its details and foreman assignment."
    />

    <div v-else class="d-flex flex-column gap-3">
      <div
        v-if="!embedded"
        class="d-flex flex-wrap justify-content-between align-items-start gap-3"
      >
        <div class="d-flex flex-column gap-2">
          <div class="d-flex flex-wrap align-items-center gap-2">
            <h5 class="mb-0">{{ job.name }}</h5>
            <StatusBadge :status="job.active ? 'active' : 'archived'" />
          </div>
          <div class="d-flex flex-wrap align-items-center gap-2 text-muted small">
            <span>{{ job.code || 'No job #' }}</span>
            <span>|</span>
            <span>{{ job.projectManager || 'No PM' }}</span>
          </div>
        </div>

        <div class="d-flex flex-wrap gap-2">
          <button
            type="button"
            class="btn btn-sm btn-primary"
            :disabled="saving || !dirty"
            @click="emit('save')"
          >
            Save Changes
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

      <TimecardWeekStatusBadge
        v-if="!embedded"
        :status="job.timecardStatus"
        :period-end-date="job.timecardPeriodEndDate"
        :current-week-end="currentWeekEnd"
        :current-week-label="currentWeekLabel"
      />

      <div class="row g-3 admin-job-details-card__fields">
        <div class="col-md-3">
          <BaseInputField
            :model-value="form.code"
            label="Job #"
            label-class="small"
            placeholder="4197"
            @update:model-value="updateField('code', String($event))"
          />
        </div>
        <div class="col-md-9">
          <BaseInputField
            :model-value="form.name"
            label="Job Name"
            label-class="small"
            placeholder="Project name"
            @update:model-value="updateField('name', String($event))"
          />
        </div>

        <div class="col-md-4">
          <BaseInputField
            :model-value="form.projectManager"
            label="Project Manager"
            label-class="small"
            placeholder="Project manager"
            @update:model-value="updateField('projectManager', String($event))"
          />
        </div>
        <div class="col-md-4">
          <BaseSelectField
            :model-value="form.foreman"
            label="Assigned Foreman"
            label-class="small"
            :options="foremanOptions"
            include-empty-option
            empty-option-label="Select foreman"
            @update:model-value="updateField('foreman', String($event))"
          />
        </div>
        <div class="col-md-4">
          <BaseInputField
            :model-value="form.gc"
            label="GC"
            label-class="small"
            placeholder="General contractor"
            @update:model-value="updateField('gc', String($event))"
          />
        </div>
        <div class="col-md-4">
          <BaseSelectField
            :model-value="form.type"
            label="Job Type"
            label-class="small"
            :options="JOB_TYPE_OPTIONS"
            include-empty-option
            empty-option-label="Select job type"
            @update:model-value="updateField('type', $event as JobFormInput['type'])"
          />
        </div>

        <div class="col-md-8">
          <BaseInputField
            :model-value="form.jobAddress"
            label="Job Address"
            label-class="small"
            placeholder="Job address"
            @update:model-value="updateField('jobAddress', String($event))"
          />
        </div>

        <div class="col-md-3">
          <BaseInputField
            :model-value="form.startDate"
            type="date"
            label="Start Date"
            label-class="small"
            @update:model-value="updateField('startDate', String($event))"
          />
        </div>
        <div class="col-md-3">
          <BaseInputField
            :model-value="form.finishDate"
            type="date"
            label="Finish Date"
            label-class="small"
            @update:model-value="updateField('finishDate', String($event))"
          />
        </div>
        <div class="col-md-3">
          <BaseInputField
            :model-value="form.productionBurden"
            type="number"
            min="0"
            step="0.01"
            label="Burden"
            label-class="small"
            placeholder="0.33"
            @update:model-value="updateField('productionBurden', String($event))"
          />
        </div>

        <div class="col-md-3">
          <BaseInputField
            :model-value="form.taxExempt"
            label="Tax Exempt"
            label-class="small"
            placeholder="TE / No"
            @update:model-value="updateField('taxExempt', String($event))"
          />
        </div>
        <div class="col-md-3">
          <BaseInputField
            :model-value="form.certified"
            label="Certified"
            label-class="small"
            placeholder="Yes / No"
            @update:model-value="updateField('certified', String($event))"
          />
        </div>
        <div class="col-md-3">
          <BaseInputField
            :model-value="form.cip"
            label="CIP"
            label-class="small"
            placeholder="2445"
            @update:model-value="updateField('cip', String($event))"
          />
        </div>
        <div class="col-md-3">
          <BaseInputField
            :model-value="form.kjic"
            label="KJIC"
            label-class="small"
            placeholder="Yes / No"
            @update:model-value="updateField('kjic', String($event))"
          />
        </div>
      </div>
    </div>
  </component>
</template>
