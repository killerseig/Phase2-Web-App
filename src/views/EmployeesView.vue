<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppShell from '@/layouts/AppShell.vue'
import { useAuthStore } from '@/stores/auth'
import { useAdminRequestContext } from '@/features/admin/useAdminRequestContext'
import DirectoryEditorWorkspaceShell from '@/components/common/DirectoryEditorWorkspaceShell.vue'
import EmployeeConfirmDialogs from '@/components/employees/EmployeeConfirmDialogs.vue'
import EmployeeDirectoryPanel from '@/components/employees/EmployeeDirectoryPanel.vue'
import EmployeeEditorPanel from '@/components/employees/EmployeeEditorPanel.vue'
import {
  buildDirectoryEditorMobilePanelTabs,
  useDirectoryEditorPanels,
} from '@/composables/useDirectoryEditorPanels'
import { usePageMessages } from '@/composables/usePageMessages'
import { useToastMessages } from '@/composables/useToastMessages'
import { useEmployeeActions } from '@/features/employees/useEmployeeActions'
import { useEmployeeAdminRecords } from '@/features/employees/useEmployeeAdminRecords'
import { useEmployeeAdminViewSync } from '@/features/employees/useEmployeeAdminViewSync'
import {
  shouldShowEmployeeDetailSuccessToast,
  useEmployeeAdminViewState,
} from '@/features/employees/useEmployeeAdminViewState'
import { useEmployeeFormState } from '@/features/employees/useEmployeeFormState'
import type { DirectoryStatusFilter } from '@/utils/directoryFilters'

const mobilePanelTabs = buildDirectoryEditorMobilePanelTabs('Employees')
const auth = useAuthStore()
const context = useAdminRequestContext(
  computed(() => auth.currentUser?.uid || ''),
  computed(() => auth.hasWorkspaceAccess && ['admin', 'payroll'].includes(auth.rawRole)),
  computed(() => auth.rawRole),
)

const searchTerm = ref('')
const statusFilter = ref<DirectoryStatusFilter>('active')
const selectedEmployeeId = ref<string | 'new'>('new')
const deleteLoading = ref(false)
const {
  employees,
  employeesError,
  employeesLoading,
  startEmployeesSubscription,
  stopEmployeesSubscription,
} = useEmployeeAdminRecords({
  context,
  deleting: deleteLoading,
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
const deleteConfirmOpen = ref(false)

const {
  activeEmployeesCount,
  deleteEmployeeConfirmMessage,
  filteredEmployees,
  inactiveEmployeesCount,
  isCreateMode,
  occupationSuggestions,
  selectedEmployee,
} = useEmployeeAdminViewState({
  employees,
  searchTerm,
  selectedEmployeeId,
  statusFilter,
})

useToastMessages([
  { source: employeesError, severity: 'error', summary: 'Employees' },
  { source: createError, severity: 'error', summary: 'Create Employee' },
  { source: createInfo, severity: 'success', summary: 'Create Employee' },
  { source: detailError, severity: 'error', summary: 'Employee Editor' },
  {
    source: detailInfo,
    severity: 'success',
    summary: 'Employee Editor',
    when: shouldShowEmployeeDetailSuccessToast,
  },
])

const {
  applyEmployeeToDetailForm,
  createForm,
  detailForm,
  hasUnsavedDetailChanges,
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
  context,
  createForm,
  createLoading,
  deleteConfirmOpen,
  deleteLoading,
  detailForm,
  hasUnsavedDetailChanges,
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

const {
  activeMobilePanel,
  openCreateMode,
  selectRecord: selectEmployee,
  showMobilePanel,
} = useDirectoryEditorPanels<string | 'new', string>({
  createSelection: 'new',
  selectedId: selectedEmployeeId,
  onCreateMode: resetCreateForm,
})

watch(context.revision, () => {
  selectedEmployeeId.value = 'new'
  searchTerm.value = ''
  resetCreateForm()
  void applyEmployeeToDetailForm(null)
  resetDetailMessages()
}, { flush: 'sync' })

useEmployeeAdminViewSync({
  context,
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
  <DirectoryEditorWorkspaceShell
    v-if="context.allowed.value"
    title="Employees"
    description="Manage employee details and keep your crew directory up to date."
    class="employees-workspace"
    data-testid="employees-page"
    :active-panel="activeMobilePanel"
    :panels="mobilePanelTabs"
    tabs-label="Employees workspace"
    @show="showMobilePanel"
  >
    <template #primary>
      <EmployeeDirectoryPanel
        v-model:search-term="searchTerm"
        v-model:status-filter="statusFilter"
        class="app-split-workspace__primary-pane"
        :employees="filteredEmployees"
        :employees-loading="employeesLoading"
        :selected-employee-id="selectedEmployeeId === 'new' ? null : selectedEmployeeId"
        :is-create-mode="isCreateMode"
        @create-employee="openCreateMode"
        @select-employee="selectEmployee"
      />
    </template>

    <template #secondary>
      <EmployeeEditorPanel
        class="app-split-workspace__secondary-pane"
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
        @detail-field-blur="handleAutoSaveEmployee"
        @detail-toggle-change="handleAutoSaveEmployee"
        @update-create-text-field="updateCreateTextField"
        @update-create-boolean-field="updateCreateBooleanField"
        @update-detail-text-field="updateDetailTextField"
        @update-detail-boolean-field="updateDetailBooleanField"
      />
    </template>

    <datalist id="employee-occupation-options">
      <option v-for="occupation in occupationSuggestions" :key="occupation" :value="occupation" />
    </datalist>

    <EmployeeConfirmDialogs
      :delete-busy="deleteLoading"
      :delete-message="deleteEmployeeConfirmMessage"
      :delete-open="deleteConfirmOpen"
      @confirm-delete="confirmDeleteEmployee"
      @update-delete-open="deleteConfirmOpen = $event"
    />
  </DirectoryEditorWorkspaceShell>
  <AppShell v-else><p role="status">You do not have access to manage employees.</p></AppShell>
</template>
