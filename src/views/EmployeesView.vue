<script setup lang="ts">
import { computed, ref } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import AppMobilePanelTabs from '@/components/common/AppMobilePanelTabs.vue'
import EmployeeDirectoryPanel from '@/components/employees/EmployeeDirectoryPanel.vue'
import EmployeeEditorPanel from '@/components/employees/EmployeeEditorPanel.vue'
import { usePageMessages } from '@/composables/usePageMessages'
import { useToastMessages } from '@/composables/useToastMessages'
import {
  buildEmployeeOccupationSuggestions,
  buildEmployeeSearchTokens,
  getEmployeeDisplayName,
  getEmployeeStatusCounts,
} from '@/features/employees/employeeViewHelpers'
import { useEmployeeActions } from '@/features/employees/useEmployeeActions'
import { useEmployeeAdminRecords } from '@/features/employees/useEmployeeAdminRecords'
import { useEmployeeAdminViewSync } from '@/features/employees/useEmployeeAdminViewSync'
import { useEmployeeFormState } from '@/features/employees/useEmployeeFormState'
import AppShell from '@/layouts/AppShell.vue'
import { filterDirectoryRecords, type DirectoryStatusFilter } from '@/utils/directoryFilters'

type MobileEmployeesPanel = 'directory' | 'editor'

const mobilePanelTabs = [
  { key: 'directory', label: 'Directory' },
  { key: 'editor', label: 'Editor' },
] as const

const searchTerm = ref('')
const statusFilter = ref<DirectoryStatusFilter>('active')
const selectedEmployeeId = ref<string | 'new'>('new')
const activeMobilePanel = ref<MobileEmployeesPanel>('directory')
const {
  employees,
  employeesError,
  employeesLoading,
  startEmployeesSubscription,
  stopEmployeesSubscription,
} = useEmployeeAdminRecords({
  selectedEmployeeId,
})
const {
  pageError: createError,
  pageInfo: createInfo,
  resetMessages: resetCreateMessages,
  setPageError: setCreateError,
  setPageErrorMessage: setCreateErrorMessage,
  setPageInfo: setCreateInfo,
} = usePageMessages()
const {
  pageError: detailError,
  pageInfo: detailInfo,
  resetMessages: resetDetailMessages,
  setPageError: setDetailError,
  setPageErrorMessage: setDetailErrorMessage,
  setPageInfo: setDetailInfo,
} = usePageMessages()
const createLoading = ref(false)
const saveLoading = ref(false)
const deleteLoading = ref(false)
const deleteConfirmOpen = ref(false)

const filteredEmployees = computed(() => {
  return filterDirectoryRecords(employees.value, statusFilter.value, searchTerm.value, buildEmployeeSearchTokens)
})

const selectedEmployee = computed(() =>
  employees.value.find((employee) => employee.id === selectedEmployeeId.value) ?? null,
)
const deleteEmployeeConfirmMessage = computed(() => (
  selectedEmployee.value
    ? `Delete ${getEmployeeDisplayName(selectedEmployee.value)} from the employee directory? This will not remove them from historical records.`
    : ''
))

const isCreateMode = computed(() => selectedEmployeeId.value === 'new')
const employeeStatusCounts = computed(() => getEmployeeStatusCounts(employees.value))
const activeEmployeesCount = computed(() => employeeStatusCounts.value.active)
const inactiveEmployeesCount = computed(() => employeeStatusCounts.value.inactive)
const occupationSuggestions = computed(() => buildEmployeeOccupationSuggestions(employees.value))

const passiveEmployeeDetailMessages = new Set([
  'Changes save when you leave a field.',
  'Saving changes...',
  'All changes saved.',
])

useToastMessages([
  { source: employeesError, severity: 'error', summary: 'Employees' },
  { source: createError, severity: 'error', summary: 'Create Employee' },
  { source: createInfo, severity: 'success', summary: 'Create Employee' },
  { source: detailError, severity: 'error', summary: 'Employee Editor' },
  {
    source: detailInfo,
    severity: 'success',
    summary: 'Employee Editor',
    when: (message) => !passiveEmployeeDetailMessages.has(message),
  },
])

const {
  applyEmployeeToDetailForm,
  createForm,
  detailForm,
  resetCreateForm,
  syncingDetailForm,
  updateCreateBooleanField,
  updateCreateTextField,
  updateDetailBooleanField,
  updateDetailTextField,
} = useEmployeeFormState({
  clearDetailError: () => setDetailErrorMessage(''),
  resetCreateMessages,
})

const {
  confirmDeleteEmployee,
  handleAutoSaveEmployee,
  handleCreateEmployee,
  handleDeleteEmployee,
} = useEmployeeActions({
  createForm,
  createLoading,
  deleteConfirmOpen,
  deleteLoading,
  detailForm,
  resetCreateForm,
  resetCreateMessages,
  resetDetailMessages,
  saveLoading,
  selectedEmployee,
  selectedEmployeeId,
  setCreateError,
  setCreateErrorMessage,
  setCreateInfo,
  setDetailError,
  setDetailErrorMessage,
  setDetailInfo,
  syncingDetailForm,
})

async function handleDetailFieldBlur() {
  await handleAutoSaveEmployee()
}

async function handleDetailToggleChange() {
  await handleAutoSaveEmployee()
}

function openCreateMode() {
  selectedEmployeeId.value = 'new'
  activeMobilePanel.value = 'editor'
  resetCreateForm()
}

function selectEmployee(employeeId: string) {
  selectedEmployeeId.value = employeeId
  activeMobilePanel.value = 'editor'
}

function showMobilePanel(panel: MobileEmployeesPanel) {
  activeMobilePanel.value = panel
}

useEmployeeAdminViewSync({
  applyEmployeeToDetailForm,
  resetCreateForm,
  selectedEmployee,
  selectedEmployeeId,
  setDetailErrorMessage,
  setDetailInfo,
  startEmployeesSubscription,
  stopEmployeesSubscription,
})
</script>

<template>
  <AppShell>
    <div
      class="employees-workspace"
      data-testid="employees-page"
      :class="{
        'employees-workspace--mobile-directory': activeMobilePanel === 'directory',
        'employees-workspace--mobile-editor': activeMobilePanel === 'editor',
      }"
    >
      <AppMobilePanelTabs
        label="Employees workspace"
        :active-panel="activeMobilePanel"
        :panels="mobilePanelTabs"
        @show="(panel) => showMobilePanel(panel as MobileEmployeesPanel)"
      />

      <EmployeeDirectoryPanel
        v-model:search-term="searchTerm"
        v-model:status-filter="statusFilter"
        :employees="filteredEmployees"
        :employees-loading="employeesLoading"
        :selected-employee-id="selectedEmployeeId === 'new' ? null : selectedEmployeeId"
        :is-create-mode="isCreateMode"
        @create-employee="openCreateMode"
        @select-employee="selectEmployee"
      />

      <EmployeeEditorPanel
        :is-create-mode="isCreateMode"
        :create-form="createForm"
        :detail-form="detailForm"
        :selected-employee="selectedEmployee"
        :create-loading="createLoading"
        :save-loading="saveLoading"
        :delete-loading="deleteLoading"
        :detail-info="detailInfo"
        :active-employees-count="activeEmployeesCount"
        :inactive-employees-count="inactiveEmployeesCount"
        @back-to-directory="showMobilePanel('directory')"
        @create-submit="handleCreateEmployee"
        @detail-submit="handleAutoSaveEmployee"
        @delete-employee="handleDeleteEmployee"
        @detail-field-blur="handleDetailFieldBlur"
        @detail-toggle-change="handleDetailToggleChange"
        @update-create-text-field="updateCreateTextField"
        @update-create-boolean-field="updateCreateBooleanField"
        @update-detail-text-field="updateDetailTextField"
        @update-detail-boolean-field="updateDetailBooleanField"
      />
    </div>

    <datalist id="employee-occupation-options">
      <option v-for="occupation in occupationSuggestions" :key="occupation" :value="occupation" />
    </datalist>

    <ConfirmDialog
      :open="deleteConfirmOpen"
      title="Delete employee?"
      :message="deleteEmployeeConfirmMessage"
      confirm-label="Delete Employee"
      destructive
      :busy="deleteLoading"
      @update:open="deleteConfirmOpen = $event"
      @confirm="confirmDeleteEmployee"
    />
  </AppShell>
</template>

<style scoped>
.employees-workspace {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 1rem;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.employees-browser,
.employees-detail {
  display: grid;
  gap: 1rem;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.018), rgba(255, 255, 255, 0)),
    rgba(29, 38, 49, 0.92);
  box-shadow: var(--shadow);
}

.employees-browser {
  grid-template-rows: auto minmax(0, 1fr);
}

@media (max-width: 1180px) {
  .employees-workspace {
    grid-template-columns: 1fr;
  }

  .employees-browser {
    max-height: 26rem;
  }
}

@media (max-width: 900px) {
  .employees-workspace {
    height: auto;
    overflow: visible;
  }

  .employees-workspace--mobile-directory .employees-detail {
    display: none;
  }

  .employees-workspace--mobile-editor .employees-browser {
    display: none;
  }

  .employees-browser,
  .employees-detail {
    height: auto;
    min-height: 0;
    overflow: visible;
  }

  .employees-browser {
    max-height: none;
  }
}
</style>
