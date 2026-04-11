<script setup lang="ts">
import AppAlert from '@/components/common/AppAlert.vue'
import AppBadge from '@/components/common/AppBadge.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppListCard from '@/components/common/AppListCard.vue'
import AppSelectableListItem from '@/components/common/AppSelectableListItem.vue'
import BaseSearchField from '@/components/common/BaseSearchField.vue'
import SearchSelectField from '@/components/common/SearchSelectField.vue'
import TimecardStatusBadge from '@/components/timecards/TimecardStatusBadge.vue'
import type { TimecardWorkspaceEmployeeItem } from '@/types/timecards'
import type { TimecardStaffingEmployee } from '@/services/TimecardStaffing'

defineOptions({
  name: 'TimecardEmployeeList',
})

interface Props {
  items: TimecardWorkspaceEmployeeItem[]
  staffingOptions?: Array<{ id: string; label: string }>
  staffingLoading?: boolean
  staffingError?: string
  selectedStaffingEmployeeId?: string
  selectedStaffingEmployee?: TimecardStaffingEmployee | null
  addingStaffingEmployee?: boolean
  loading?: boolean
  selectedEmployeeId?: string | null
  selectedItem?: TimecardWorkspaceEmployeeItem | null
  searchTerm?: string
}

withDefaults(defineProps<Props>(), {
  staffingOptions: () => [],
  staffingLoading: false,
  staffingError: '',
  selectedStaffingEmployeeId: '',
  selectedStaffingEmployee: null,
  addingStaffingEmployee: false,
  loading: false,
  selectedEmployeeId: null,
  selectedItem: null,
  searchTerm: '',
})

const emit = defineEmits<{
  'update:selectedStaffingEmployeeId': [value: string]
  'update:searchTerm': [value: string]
  'add-staffing-employee': []
  select: [employeeId: string]
}>()

function handleSearchInput(value: string) {
  emit('update:searchTerm', value)
}

function handleStaffingSelection(value: string) {
  emit('update:selectedStaffingEmployeeId', value)
}

function handleAddStaffingEmployee() {
  emit('add-staffing-employee')
}

function handleSelect(employeeId: string) {
  emit('select', employeeId)
}
</script>

<template>
  <AppListCard
    class="timecard-employee-list"
    title="Roster"
    icon="bi bi-people"
    :badge-label="items.length"
    body-class="p-0"
    muted
  >
    <div class="timecard-employee-list__staffing border-bottom">
      <div class="timecard-employee-list__staffing-header">
        <div class="timecard-employee-list__staffing-eyebrow">Timecard Staffing</div>
        <div class="timecard-employee-list__staffing-title">Add employees from the master list</div>
      </div>

      <AppAlert
        v-if="staffingError"
        variant="danger"
        class="mb-2"
        :message="staffingError"
      />

      <AppAlert
        v-else-if="!staffingLoading && !staffingOptions.length"
        variant="secondary"
        class="mb-2"
        message="All active employees are already on this job's timecard roster."
      />

      <div class="timecard-employee-list__staffing-form">
        <SearchSelectField
          :model-value="selectedStaffingEmployeeId"
          :options="staffingOptions"
          :disabled="staffingLoading || !!staffingError"
          label="Add Employee"
          placeholder="Search employees by name, #, or occupation"
          prepend-icon="bi bi-search"
          clear-label="Clear selection"
          @update:model-value="handleStaffingSelection"
        />

        <button
          type="button"
          class="btn btn-sm btn-outline-primary"
          :disabled="addingStaffingEmployee || !selectedStaffingEmployeeId"
          @click="handleAddStaffingEmployee"
        >
          <span
            v-if="addingStaffingEmployee"
            class="spinner-border spinner-border-sm me-2"
            aria-hidden="true"
          ></span>
          Add
        </button>
      </div>

      <div v-if="selectedStaffingEmployee" class="timecard-employee-list__staffing-selected">
        <span class="fw-semibold">
          {{ selectedStaffingEmployee.firstName }} {{ selectedStaffingEmployee.lastName }}
        </span>
        <span>#{{ selectedStaffingEmployee.employeeNumber }}</span>
        <span>{{ selectedStaffingEmployee.occupation || 'No occupation' }}</span>
      </div>
    </div>

    <div v-if="selectedItem" class="timecard-employee-list__selected border-bottom">
      <div class="timecard-employee-list__selected-top">
        <div class="timecard-employee-list__selected-copy">
          <div class="timecard-employee-list__selected-eyebrow">Selected Workbook</div>
          <div class="timecard-employee-list__selected-name">{{ selectedItem.employeeName }}</div>
        </div>

        <TimecardStatusBadge
          v-if="selectedItem.status === 'draft' || selectedItem.status === 'submitted'"
          :status="selectedItem.status"
        />
        <AppBadge
          v-else
          label="Missing"
          variant-class="text-bg-secondary"
        />
      </div>

      <div class="timecard-employee-list__selected-meta">
        <span>#{{ selectedItem.employeeNumber }}</span>
        <span aria-hidden="true">|</span>
        <span>{{ selectedItem.occupation || 'No occupation' }}</span>
        <span aria-hidden="true">|</span>
        <span>{{ selectedItem.hoursTotal.toFixed(2) }} hrs</span>
        <span aria-hidden="true">|</span>
        <span>{{ selectedItem.productionTotal.toFixed(2) }} prod</span>
      </div>
    </div>

    <div class="timecard-employee-list__toolbar border-bottom">
      <BaseSearchField
        :model-value="searchTerm"
        input-class="form-control form-control-sm"
        group-class="input-group input-group-sm"
        placeholder="Search roster"
        clearable
        input-aria-label="Search roster"
        @update:model-value="handleSearchInput"
      />
    </div>

    <div class="timecard-employee-list__results">
      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border spinner-border-sm"></div>
      </div>

      <AppEmptyState
        v-else-if="!items.length"
        icon="bi bi-person-x"
        icon-class="fs-4"
        title="No employees found"
        message="Try a different search or check the job roster."
        message-class="small mb-0"
      />

      <div v-else class="list-group list-group-flush app-selectable-list--stacked">
        <AppSelectableListItem
          v-for="item in items"
          :key="item.employeeId"
          class="timecard-employee-list-item text-start d-flex justify-content-between align-items-start gap-3"
          :selected="selectedEmployeeId === item.employeeId"
          @activate="handleSelect(item.employeeId)"
        >
          <div class="me-2">
            <div class="fw-semibold">{{ item.employeeName }}</div>
            <div class="app-selectable-list-meta small">
              #{{ item.employeeNumber }} | {{ item.occupation || 'No occupation' }}
            </div>
            <div class="app-selectable-list-meta small mt-1">
              {{ item.hoursTotal.toFixed(2) }} hrs | {{ item.productionTotal.toFixed(2) }} prod
            </div>
          </div>

          <div class="d-flex flex-column align-items-end gap-2">
            <TimecardStatusBadge
              v-if="item.status === 'draft' || item.status === 'submitted'"
              :status="item.status"
            />
            <AppBadge
              v-else
              label="Missing"
              variant-class="text-bg-secondary"
            />
            <AppBadge
              v-if="item.subcontractedEmployee"
              label="Sub"
              variant-class="text-bg-info"
            />
          </div>
        </AppSelectableListItem>
      </div>
    </div>
  </AppListCard>
</template>
