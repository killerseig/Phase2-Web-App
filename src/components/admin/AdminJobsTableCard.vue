<script setup lang="ts">
import { computed } from 'vue'
import ActionToggleGroup from '@/components/common/ActionToggleGroup.vue'
import AppAlert from '@/components/common/AppAlert.vue'
import BaseTable from '@/components/common/BaseTable.vue'
import InlineField from '@/components/common/InlineField.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import TimecardWeekStatusBadge from '@/components/common/TimecardWeekStatusBadge.vue'
import AdminCardWrapper from '@/components/admin/AdminCardWrapper.vue'
import type { Job } from '@/services'
import type { JobFormInput, JobSortKey, SortDir } from '@/types/adminJobs'

type Align = 'start' | 'center' | 'end'
type Column = { key: string; label: string; sortable?: boolean; width?: string; align?: Align; slot?: string }
type JobTableRow = Job & Record<string, unknown>

const props = defineProps<{
  jobs: Job[]
  loading: boolean
  error: string
  editingJobId: string
  editForm: JobFormInput
  editingJobSaving: boolean
  activeJobActionsId: string
  togglingJobId: string
  foremanOptions: readonly { value: string; label: string }[]
  sortKey: JobSortKey
  sortDir: SortDir
  currentWeekEnd: string
  currentWeekLabel: string
}>()

const emit = defineEmits<{
  'update:editForm': [value: JobFormInput]
  'sort-change': [payload: { sortKey: string; sortDir: SortDir }]
  'toggle-actions': [job: Job]
  'delete-job': [job: Job]
  'toggle-archive': [payload: { job: Job; active: boolean }]
}>()

const jobColumns: Column[] = [
  { key: 'code', label: 'Job #', sortable: true, width: '8%', slot: 'code' },
  { key: 'name', label: 'Job Name', sortable: true, width: '14%' },
  { key: 'projectManager', label: 'Project Manager', sortable: true, width: '10%', slot: 'projectManager' },
  { key: 'foreman', label: 'Foreman', sortable: true, width: '10%', slot: 'foreman' },
  { key: 'gc', label: 'GC', sortable: true, width: '8%', slot: 'gc' },
  { key: 'jobAddress', label: 'Job Address', sortable: true, width: '16%', slot: 'jobAddress' },
  { key: 'startDate', label: 'Start', sortable: true, width: '8%', slot: 'startDate' },
  { key: 'finishDate', label: 'Finish', sortable: true, width: '8%', slot: 'finishDate' },
  { key: 'status', label: 'Status', sortable: true, width: '8%', slot: 'status' },
  { key: 'taxExempt', label: 'Tax Exempt', sortable: true, width: '8%', slot: 'taxExempt' },
  { key: 'certified', label: 'Certified', sortable: true, width: '8%', slot: 'certified' },
  { key: 'cip', label: '?CIP', sortable: true, width: '8%', slot: 'cip' },
  { key: 'kjic', label: 'KJIC', sortable: true, width: '8%', slot: 'kjic' },
  { key: 'timecards', label: 'Timecards This Week', width: '12%', slot: 'timecards' },
  { key: 'actions', label: 'Actions', width: '16%', align: 'end', slot: 'actions' },
]

const tableJobs = computed<JobTableRow[]>(() => props.jobs as JobTableRow[])

function updateEditField<K extends keyof JobFormInput>(field: K, value: JobFormInput[K]) {
  emit('update:editForm', {
    ...props.editForm,
    [field]: value,
  })
}

function asJob(row: unknown): Job {
  return row as Job
}

function asText(value: unknown, fallback = '--') {
  if (value === null || value === undefined) return fallback
  const text = String(value).trim()
  return text ? text : fallback
}
</script>

<template>
  <AdminCardWrapper
    title="Jobs"
    icon="briefcase"
    :loading="loading"
    :error="error"
  >
    <AppAlert
      v-if="jobs.length === 0"
      variant="info"
      class="text-center mb-0"
      message="No jobs found. Create your first job above."
    />

    <BaseTable
      v-else
      :rows="tableJobs"
      :columns="jobColumns"
      row-key="id"
      :sort-key="sortKey"
      :sort-dir="sortDir"
      table-class="jobs-sheet-table"
      @sort-change="emit('sort-change', $event)"
    >
      <template #cell-name="{ row }">
        <InlineField
          :editing="editingJobId === asJob(row).id"
          :model-value="editForm.name"
          :disabled="editingJobSaving"
          @update:model-value="updateEditField('name', String($event))"
        >
          <span class="cell-ellipsis" :title="asText(asJob(row).name, '')">{{ asText(asJob(row).name) }}</span>
        </InlineField>
      </template>

      <template #code="{ row }">
        <InlineField
          :editing="editingJobId === asJob(row).id"
          :model-value="editForm.code"
          placeholder="Job #"
          :disabled="editingJobSaving"
          @update:model-value="updateEditField('code', String($event))"
        >
          {{ asJob(row).code || '--' }}
        </InlineField>
      </template>

      <template #projectManager="{ row }">
        <InlineField
          :editing="editingJobId === asJob(row).id"
          :model-value="editForm.projectManager"
          placeholder="Project Manager"
          :disabled="editingJobSaving"
          @update:model-value="updateEditField('projectManager', String($event))"
        >
          <span class="cell-ellipsis" :title="asText(asJob(row).projectManager)">{{ asText(asJob(row).projectManager) }}</span>
        </InlineField>
      </template>

      <template #foreman="{ row }">
        <InlineField
          :editing="editingJobId === asJob(row).id"
          :model-value="editForm.foreman"
          type="select"
          :options="[{ value: '', label: '-- Select Foreman --' }, ...foremanOptions]"
          :disabled="editingJobSaving"
          @update:model-value="updateEditField('foreman', String($event))"
        >
          <span class="cell-ellipsis" :title="asText(asJob(row).foreman)">{{ asText(asJob(row).foreman) }}</span>
        </InlineField>
      </template>

      <template #gc="{ row }">
        <InlineField
          :editing="editingJobId === asJob(row).id"
          :model-value="editForm.gc"
          placeholder="GC"
          :disabled="editingJobSaving"
          @update:model-value="updateEditField('gc', String($event))"
        >
          <span class="cell-ellipsis" :title="asText(asJob(row).gc)">{{ asText(asJob(row).gc) }}</span>
        </InlineField>
      </template>

      <template #jobAddress="{ row }">
        <InlineField
          :editing="editingJobId === asJob(row).id"
          :model-value="editForm.jobAddress"
          placeholder="Job Address"
          :disabled="editingJobSaving"
          @update:model-value="updateEditField('jobAddress', String($event))"
        >
          <span class="cell-ellipsis" :title="asText(asJob(row).jobAddress)">{{ asText(asJob(row).jobAddress) }}</span>
        </InlineField>
      </template>

      <template #startDate="{ row }">
        <InlineField
          :editing="editingJobId === asJob(row).id"
          :model-value="editForm.startDate"
          type="date"
          :disabled="editingJobSaving"
          @update:model-value="updateEditField('startDate', String($event))"
        >
          <span class="cell-nowrap">{{ asJob(row).startDate || '--' }}</span>
        </InlineField>
      </template>

      <template #finishDate="{ row }">
        <InlineField
          :editing="editingJobId === asJob(row).id"
          :model-value="editForm.finishDate"
          type="date"
          :disabled="editingJobSaving"
          @update:model-value="updateEditField('finishDate', String($event))"
        >
          <span class="cell-nowrap">{{ asJob(row).finishDate || '--' }}</span>
        </InlineField>
      </template>

      <template #status="{ row }">
        <StatusBadge :status="asJob(row).active ? 'active' : 'archived'" />
      </template>

      <template #taxExempt="{ row }">
        <InlineField
          :editing="editingJobId === asJob(row).id"
          :model-value="editForm.taxExempt"
          placeholder="Tax Exempt"
          :disabled="editingJobSaving"
          @update:model-value="updateEditField('taxExempt', String($event))"
        >
          {{ asJob(row).taxExempt || '--' }}
        </InlineField>
      </template>

      <template #certified="{ row }">
        <InlineField
          :editing="editingJobId === asJob(row).id"
          :model-value="editForm.certified"
          placeholder="Certified"
          :disabled="editingJobSaving"
          @update:model-value="updateEditField('certified', String($event))"
        >
          {{ asJob(row).certified || '--' }}
        </InlineField>
      </template>

      <template #cip="{ row }">
        <InlineField
          :editing="editingJobId === asJob(row).id"
          :model-value="editForm.cip"
          placeholder="CIP"
          :disabled="editingJobSaving"
          @update:model-value="updateEditField('cip', String($event))"
        >
          {{ asJob(row).cip || '--' }}
        </InlineField>
      </template>

      <template #kjic="{ row }">
        <InlineField
          :editing="editingJobId === asJob(row).id"
          :model-value="editForm.kjic"
          placeholder="KJIC"
          :disabled="editingJobSaving"
          @update:model-value="updateEditField('kjic', String($event))"
        >
          {{ asJob(row).kjic || '--' }}
        </InlineField>
      </template>

      <template #timecards="{ row }">
        <TimecardWeekStatusBadge
          :status="asJob(row).timecardStatus"
          :period-end-date="asJob(row).timecardPeriodEndDate"
          :current-week-end="currentWeekEnd"
          :current-week-label="currentWeekLabel"
        />
      </template>

      <template #actions="{ row }">
        <ActionToggleGroup
          :open="activeJobActionsId === asJob(row).id"
          wrapper-class="d-flex align-items-center justify-content-end gap-1 flex-nowrap"
          :toggle-disabled="editingJobSaving && editingJobId === asJob(row).id"
          @toggle="emit('toggle-actions', asJob(row))"
        >
          <button
            type="button"
            class="btn btn-outline-danger"
            title="Delete job permanently"
            @click.stop="emit('delete-job', asJob(row))"
          >
            <i class="bi bi-trash text-danger"></i>
          </button>
          <button
            v-if="asJob(row).active"
            type="button"
            class="btn btn-outline-warning"
            :disabled="togglingJobId === asJob(row).id"
            title="Archive job"
            @click.stop="emit('toggle-archive', { job: asJob(row), active: false })"
          >
            <i class="bi bi-archive text-warning"></i>
          </button>
          <button
            v-else
            type="button"
            class="btn btn-outline-success"
            :disabled="togglingJobId === asJob(row).id"
            title="Restore job"
            @click.stop="emit('toggle-archive', { job: asJob(row), active: true })"
          >
            <i class="bi bi-arrow-counterclockwise text-success"></i>
          </button>
        </ActionToggleGroup>
      </template>
    </BaseTable>
  </AdminCardWrapper>
</template>

<style scoped lang="scss">
:deep(.jobs-sheet-table thead th) {
  white-space: nowrap;
  font-size: 0.75rem;
}

:deep(.jobs-sheet-table .table-sort-trigger) {
  white-space: nowrap;
}

:deep(.jobs-sheet-table td) {
  vertical-align: middle;
}

.cell-ellipsis {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-nowrap {
  white-space: nowrap;
}
</style>
