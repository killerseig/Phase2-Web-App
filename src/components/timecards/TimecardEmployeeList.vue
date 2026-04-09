<script setup lang="ts">
import AppBadge from '@/components/common/AppBadge.vue'
import AppEmptyState from '@/components/common/AppEmptyState.vue'
import AppListCard from '@/components/common/AppListCard.vue'
import AppSelectableListItem from '@/components/common/AppSelectableListItem.vue'
import BaseSearchField from '@/components/common/BaseSearchField.vue'
import TimecardStatusBadge from '@/components/timecards/TimecardStatusBadge.vue'
import type { TimecardWorkspaceEmployeeItem } from '@/types/timecards'

defineOptions({
  name: 'TimecardEmployeeList',
})

interface Props {
  items: TimecardWorkspaceEmployeeItem[]
  loading?: boolean
  selectedEmployeeId?: string | null
  selectedItem?: TimecardWorkspaceEmployeeItem | null
  searchTerm?: string
}

withDefaults(defineProps<Props>(), {
  loading: false,
  selectedEmployeeId: null,
  selectedItem: null,
  searchTerm: '',
})

const emit = defineEmits<{
  'update:searchTerm': [value: string]
  select: [employeeId: string]
}>()

function handleSearchInput(value: string) {
  emit('update:searchTerm', value)
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
