<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useToastMessages } from '@/composables/useToastMessages'
import AppShell from '@/layouts/AppShell.vue'
import {
  createEmployeeRecord,
  deleteEmployeeRecord,
  subscribeEmployees,
  updateEmployeeRecord,
} from '@/services/employees'
import type { EmployeeRecord } from '@/types/domain'
import { normalizeError } from '@/utils/normalizeError'

interface EmployeeFormState {
  employeeNumber: string
  firstName: string
  lastName: string
  occupation: string
  wageRate: string
  active: boolean
  isContractor: boolean
}

type MobileEmployeesPanel = 'directory' | 'editor'

const employees = ref<EmployeeRecord[]>([])
const searchTerm = ref('')
const selectedEmployeeId = ref<string | 'new'>('new')
const activeMobilePanel = ref<MobileEmployeesPanel>('directory')
const employeesLoading = ref(true)
const employeesError = ref('')
const createError = ref('')
const createInfo = ref('')
const detailError = ref('')
const detailInfo = ref('')
const createLoading = ref(false)
const saveLoading = ref(false)
const deleteLoading = ref(false)
const syncingDetailForm = ref(false)

const createForm = reactive<EmployeeFormState>({
  employeeNumber: '',
  firstName: '',
  lastName: '',
  occupation: '',
  wageRate: '',
  active: true,
  isContractor: false,
})

const detailForm = reactive<EmployeeFormState>({
  employeeNumber: '',
  firstName: '',
  lastName: '',
  occupation: '',
  wageRate: '',
  active: true,
  isContractor: false,
})

let unsubscribeEmployees: (() => void) | null = null

const filteredEmployees = computed(() => {
  const query = searchTerm.value.trim().toLowerCase()
  if (!query) return employees.value

  return employees.value.filter((employee) => {
    const name = `${employee.firstName} ${employee.lastName}`.trim().toLowerCase()
    return (
      name.includes(query)
      || employee.employeeNumber.toLowerCase().includes(query)
      || employee.occupation.toLowerCase().includes(query)
    )
  })
})

const selectedEmployee = computed(() =>
  employees.value.find((employee) => employee.id === selectedEmployeeId.value) ?? null,
)

const isCreateMode = computed(() => selectedEmployeeId.value === 'new')
const activeEmployeesCount = computed(() => employees.value.filter((employee) => employee.active).length)
const occupationSuggestions = computed(() => {
  const unique = new Set(
    employees.value
      .map((employee) => employee.occupation.trim())
      .filter(Boolean),
  )

  return Array.from(unique).sort((left, right) => left.localeCompare(right))
})

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

function resetCreateForm() {
  createForm.employeeNumber = ''
  createForm.firstName = ''
  createForm.lastName = ''
  createForm.occupation = ''
  createForm.wageRate = ''
  createForm.active = true
  createForm.isContractor = false
  createError.value = ''
  createInfo.value = ''
}

function applySelectedEmployeeToForm(employee: EmployeeRecord | null) {
  syncingDetailForm.value = true
  detailError.value = ''

  if (!employee) {
    detailForm.employeeNumber = ''
    detailForm.firstName = ''
    detailForm.lastName = ''
    detailForm.occupation = ''
    detailForm.wageRate = ''
    detailForm.active = true
    detailForm.isContractor = false
    nextTick(() => {
      syncingDetailForm.value = false
    })
    return
  }

  detailForm.employeeNumber = employee.employeeNumber
  detailForm.firstName = employee.firstName
  detailForm.lastName = employee.lastName
  detailForm.occupation = employee.occupation
  detailForm.wageRate = employee.wageRate == null ? '' : formatWageInput(String(employee.wageRate))
  detailForm.active = employee.active
  detailForm.isContractor = employee.isContractor
  nextTick(() => {
    syncingDetailForm.value = false
  })
}

function parseWageRate(value: string): number | null {
  const trimmed = value.replaceAll('$', '').replaceAll(',', '').trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function formatWageInput(value: string) {
  const parsed = parseWageRate(value)
  if (parsed === null) return value.replaceAll('$', '').trim()
  return parsed.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function handleCreateWageBlur() {
  createForm.wageRate = formatWageInput(createForm.wageRate)
}

async function handleDetailFieldBlur() {
  await handleAutoSaveEmployee()
}

async function handleDetailWageBlur() {
  detailForm.wageRate = formatWageInput(detailForm.wageRate)
  await handleAutoSaveEmployee()
}

async function handleDetailToggleChange() {
  await handleAutoSaveEmployee()
}

function validateEmployeeForm(form: EmployeeFormState) {
  if (!form.employeeNumber.trim()) return 'Enter the employee number.'
  if (!form.firstName.trim()) return 'Enter the first name.'
  if (!form.lastName.trim()) return 'Enter the last name.'
  if (!form.occupation.trim()) return 'Enter the occupation.'
  if (parseWageRate(form.wageRate) === null) return 'Enter a wage amount.'
  return ''
}

function getEmployeeDisplayName(employee: EmployeeRecord) {
  return `${employee.firstName} ${employee.lastName}`.trim() || employee.employeeNumber || 'Unnamed Employee'
}

function getEmployeeTypeLabel(employee: Pick<EmployeeRecord, 'isContractor'> | Pick<EmployeeFormState, 'isContractor'>) {
  return employee.isContractor ? 'Contractor' : 'Employee'
}

function getEmployeeOccupation(employee: Pick<EmployeeRecord, 'occupation'>) {
  return employee.occupation.trim() || 'No occupation'
}

function getEmployeeCode(employee: Pick<EmployeeRecord, 'employeeNumber'>) {
  return employee.employeeNumber.trim() || 'No Number'
}

function formatWageLabel(wageRate: number | null) {
  if (wageRate == null) return 'No Wage'
  return wageRate.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function getSelectedEmployeeSnapshot(employee: EmployeeRecord | null) {
  if (!employee) return null

  return {
    employeeNumber: employee.employeeNumber.trim(),
    firstName: employee.firstName.trim(),
    lastName: employee.lastName.trim(),
    occupation: employee.occupation.trim(),
    wageRate: employee.wageRate,
    active: employee.active,
    isContractor: employee.isContractor,
  }
}

function getDetailFormSnapshot() {
  return {
    employeeNumber: detailForm.employeeNumber.trim(),
    firstName: detailForm.firstName.trim(),
    lastName: detailForm.lastName.trim(),
    occupation: detailForm.occupation.trim(),
    wageRate: parseWageRate(detailForm.wageRate),
    active: detailForm.active,
    isContractor: detailForm.isContractor,
  }
}

function areDetailSnapshotsEqual(
  left: ReturnType<typeof getSelectedEmployeeSnapshot>,
  right: ReturnType<typeof getDetailFormSnapshot> | null,
) {
  if (!left || !right) return false

  return (
    left.employeeNumber === right.employeeNumber
    && left.firstName === right.firstName
    && left.lastName === right.lastName
    && left.occupation === right.occupation
    && Object.is(left.wageRate, right.wageRate)
    && left.active === right.active
    && left.isContractor === right.isContractor
  )
}

function hasUnsavedDetailChanges() {
  return !areDetailSnapshotsEqual(getSelectedEmployeeSnapshot(selectedEmployee.value), getDetailFormSnapshot())
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

async function handleCreateEmployee() {
  createError.value = ''
  createInfo.value = ''

  const validationMessage = validateEmployeeForm(createForm)
  if (validationMessage) {
    createError.value = validationMessage
    return
  }

  createLoading.value = true
  try {
    const employeeId = await createEmployeeRecord({
      employeeNumber: createForm.employeeNumber,
      firstName: createForm.firstName,
      lastName: createForm.lastName,
      occupation: createForm.occupation,
      wageRate: parseWageRate(createForm.wageRate),
      active: createForm.active,
      isContractor: createForm.isContractor,
    })

    createInfo.value = 'Employee created.'
    selectedEmployeeId.value = employeeId
  } catch (error) {
    createError.value = normalizeError(error, 'Failed to create employee.')
  } finally {
    createLoading.value = false
  }
}

async function handleAutoSaveEmployee() {
  if (!selectedEmployee.value) return
  if (syncingDetailForm.value) return

  detailError.value = ''

  if (!hasUnsavedDetailChanges()) {
    detailInfo.value = 'Changes save when you leave a field.'
    return
  }

  const validationMessage = validateEmployeeForm(detailForm)
  if (validationMessage) {
    detailError.value = validationMessage
    detailInfo.value = ''
    return
  }

  saveLoading.value = true
  detailInfo.value = 'Saving changes...'
  try {
    await updateEmployeeRecord(selectedEmployee.value.id, {
      employeeNumber: detailForm.employeeNumber,
      firstName: detailForm.firstName,
      lastName: detailForm.lastName,
      occupation: detailForm.occupation,
      wageRate: parseWageRate(detailForm.wageRate),
      active: detailForm.active,
      isContractor: detailForm.isContractor,
    })

    detailInfo.value = 'All changes saved.'
  } catch (error) {
    detailError.value = normalizeError(error, 'Failed to update employee.')
    detailInfo.value = ''
  } finally {
    saveLoading.value = false
  }
}

async function handleDeleteEmployee() {
  if (!selectedEmployee.value) return

  const confirmed = window.confirm(
    `Delete ${getEmployeeDisplayName(selectedEmployee.value)} from the employee directory? This will not remove them from historical records.`,
  )
  if (!confirmed) return

  detailError.value = ''
  detailInfo.value = ''
  deleteLoading.value = true
  try {
    await deleteEmployeeRecord(selectedEmployee.value.id)
    detailInfo.value = 'Employee deleted.'
    selectedEmployeeId.value = 'new'
    resetCreateForm()
  } catch (error) {
    detailError.value = normalizeError(error, 'Failed to delete employee.')
  } finally {
    deleteLoading.value = false
  }
}

watch(selectedEmployee, (employee) => {
  if (!employee) {
    if (selectedEmployeeId.value === 'new') {
      resetCreateForm()
    }
    applySelectedEmployeeToForm(null)
    return
  }

  applySelectedEmployeeToForm(employee)
})

watch(selectedEmployeeId, (nextValue) => {
  detailError.value = ''
  detailInfo.value = nextValue === 'new' ? '' : 'Changes save when you leave a field.'
})

onMounted(() => {
  employeesLoading.value = true

  unsubscribeEmployees = subscribeEmployees(
    (nextEmployees) => {
      employees.value = nextEmployees
      employeesLoading.value = false

      if (
        selectedEmployeeId.value !== 'new'
        && !nextEmployees.some((employee) => employee.id === selectedEmployeeId.value)
      ) {
        selectedEmployeeId.value = 'new'
      }
    },
    (error) => {
      employeesError.value = normalizeError(error, 'Failed to load employees.')
      employeesLoading.value = false
    },
  )
})

onBeforeUnmount(() => {
  unsubscribeEmployees?.()
})
</script>

<template>
  <AppShell>
    <div
      class="employees-workspace"
      :class="{
        'employees-workspace--mobile-directory': activeMobilePanel === 'directory',
        'employees-workspace--mobile-editor': activeMobilePanel === 'editor',
      }"
    >
      <div class="employees-workspace__mobile-nav" role="tablist" aria-label="Employees workspace">
        <button
          class="employees-workspace__mobile-toggle"
          :class="{ 'employees-workspace__mobile-toggle--active': activeMobilePanel === 'directory' }"
          type="button"
          role="tab"
          :aria-selected="activeMobilePanel === 'directory'"
          @click="showMobilePanel('directory')"
        >
          Directory
        </button>
        <button
          class="employees-workspace__mobile-toggle"
          :class="{ 'employees-workspace__mobile-toggle--active': activeMobilePanel === 'editor' }"
          type="button"
          role="tab"
          :aria-selected="activeMobilePanel === 'editor'"
          @click="showMobilePanel('editor')"
        >
          Editor
        </button>
      </div>

      <section class="employees-browser">
        <header class="employees-browser__header">
          <div>
            <span class="employees-workspace__eyebrow">Admin</span>
            <h1 class="employees-workspace__title">Employees</h1>
          </div>
          <button class="app-button app-button--primary" type="button" @click="openCreateMode">
            New Employee
          </button>
        </header>

        <div class="employees-browser__body">
          <div class="employees-browser__search">
            <input v-model="searchTerm" type="search" placeholder="Search employees" />
          </div>

          <div class="employees-browser__list">
            <button
              type="button"
              class="employees-browser__row"
              :class="{ 'employees-browser__row--active': isCreateMode }"
              @click="openCreateMode"
            >
              <div class="employees-browser__row-main">
                <strong>Create Employee</strong>
                <span>Add a record to the global employee directory.</span>
              </div>
            </button>

            <div v-if="employeesLoading" class="employees-browser__empty">Loading employees...</div>

            <button
              v-for="employee in filteredEmployees"
              v-else
              :key="employee.id"
              type="button"
              class="employees-browser__row"
              :class="{ 'employees-browser__row--active': selectedEmployeeId === employee.id }"
              @click="selectEmployee(employee.id)"
            >
              <div class="employees-browser__row-main">
                <strong>{{ getEmployeeDisplayName(employee) }}</strong>
                <span>{{ getEmployeeOccupation(employee) }}</span>
                <span class="employees-browser__secondary">Employee #{{ getEmployeeCode(employee) }}</span>
              </div>
              <div class="employees-browser__row-meta">
                <span class="employees-browser__badge">{{ getEmployeeTypeLabel(employee) }}</span>
                <span :class="['employees-browser__status', { 'employees-browser__status--inactive': !employee.active }]">
                  {{ employee.active ? 'Active' : 'Inactive' }}
                </span>
              </div>
            </button>

            <div v-if="!employeesLoading && filteredEmployees.length === 0" class="employees-browser__empty">
              No employees match your search.
            </div>
          </div>
        </div>
      </section>

      <section class="employees-detail">
        <template v-if="isCreateMode">
          <header class="employees-detail__header">
            <div>
              <button class="employees-detail__mobile-back" type="button" @click="showMobilePanel('directory')">
                Back to Directory
              </button>
              <span class="employees-workspace__eyebrow">Directory</span>
              <h2 class="employees-detail__title">Create Employee</h2>
            </div>
          </header>

          <div class="employees-detail__body">
            <form class="employees-form" @submit.prevent="handleCreateEmployee">
              <div class="employees-form__grid">
                <label class="employees-form__field">
                  <span>Employee Number</span>
                  <input v-model="createForm.employeeNumber" type="text" autocomplete="off" />
                </label>
                <label class="employees-form__field">
                  <span>Wage</span>
                  <div class="employees-form__currency-input">
                    <input
                      v-model="createForm.wageRate"
                      type="text"
                      inputmode="decimal"
                      placeholder="0.00"
                      @blur="handleCreateWageBlur"
                    />
                  </div>
                </label>
                <label class="employees-form__field">
                  <span>First Name</span>
                  <input v-model="createForm.firstName" type="text" autocomplete="given-name" />
                </label>
                <label class="employees-form__field">
                  <span>Last Name</span>
                  <input v-model="createForm.lastName" type="text" autocomplete="family-name" />
                </label>
                <label class="employees-form__field employees-form__field--full">
                  <span>Occupation</span>
                  <input
                    v-model="createForm.occupation"
                    type="text"
                    list="employee-occupation-options"
                    autocomplete="off"
                  />
                </label>
              </div>

              <div class="employees-detail__actions">
                <button class="app-button app-button--primary" :disabled="createLoading" type="submit">
                  {{ createLoading ? 'Creating Employee...' : 'Create Employee' }}
                </button>
              </div>

              <section class="employees-settings-panel">
                <div class="employees-settings-panel__header">
                  <strong>Directory Settings</strong>
                  <span>{{ activeEmployeesCount }} active employees</span>
                </div>

                <div class="employees-toggle-group">
                  <label class="employees-toggle-row">
                    <input v-model="createForm.active" type="checkbox" />
                    <span>Active Employee</span>
                  </label>
                  <label class="employees-toggle-row">
                    <input v-model="createForm.isContractor" type="checkbox" />
                    <span>Contractor</span>
                  </label>
                </div>

                <div class="employees-settings-panel__meta">
                  <span>Type: {{ getEmployeeTypeLabel(createForm) }}</span>
                  <span>Global directory record for timecards</span>
                </div>
              </section>
            </form>
          </div>
        </template>

        <template v-else-if="selectedEmployee">
          <header class="employees-detail__header">
            <div>
              <button class="employees-detail__mobile-back" type="button" @click="showMobilePanel('directory')">
                Back to Directory
              </button>
              <span class="employees-workspace__eyebrow">Selected Employee</span>
              <h2 class="employees-detail__title">{{ getEmployeeDisplayName(selectedEmployee) }}</h2>
            </div>
            <div class="employees-detail__status-group">
              <span class="employees-browser__badge">{{ getEmployeeTypeLabel(selectedEmployee) }}</span>
              <span :class="['employees-browser__status', { 'employees-browser__status--inactive': !selectedEmployee.active }]">
                {{ selectedEmployee.active ? 'Active' : 'Inactive' }}
              </span>
            </div>
          </header>

          <div class="employees-detail__body">
            <form class="employees-form" @submit.prevent="handleAutoSaveEmployee">
              <div class="employees-form__grid">
                <label class="employees-form__field">
                  <span>Employee Number</span>
                  <input
                    v-model="detailForm.employeeNumber"
                    :disabled="saveLoading"
                    type="text"
                    autocomplete="off"
                    @blur="handleDetailFieldBlur"
                  />
                </label>
                <label class="employees-form__field">
                  <span>Wage</span>
                  <div class="employees-form__currency-input">
                    <input
                      v-model="detailForm.wageRate"
                      :disabled="saveLoading"
                      type="text"
                      inputmode="decimal"
                      placeholder="0.00"
                      @blur="handleDetailWageBlur"
                    />
                  </div>
                </label>
                <label class="employees-form__field">
                  <span>First Name</span>
                  <input
                    v-model="detailForm.firstName"
                    :disabled="saveLoading"
                    type="text"
                    autocomplete="given-name"
                    @blur="handleDetailFieldBlur"
                  />
                </label>
                <label class="employees-form__field">
                  <span>Last Name</span>
                  <input
                    v-model="detailForm.lastName"
                    :disabled="saveLoading"
                    type="text"
                    autocomplete="family-name"
                    @blur="handleDetailFieldBlur"
                  />
                </label>
                <label class="employees-form__field employees-form__field--full">
                  <span>Occupation</span>
                  <input
                    v-model="detailForm.occupation"
                    :disabled="saveLoading"
                    type="text"
                    list="employee-occupation-options"
                    autocomplete="off"
                    @blur="handleDetailFieldBlur"
                  />
                </label>
              </div>

              <section class="employees-settings-panel">
                <div class="employees-settings-panel__header">
                  <strong>Employee Settings</strong>
                  <span>Employee #{{ getEmployeeCode(selectedEmployee) }}</span>
                </div>

                <div class="employees-toggle-group">
                  <label class="employees-toggle-row">
                    <input
                      v-model="detailForm.active"
                      :disabled="saveLoading"
                      type="checkbox"
                      @change="handleDetailToggleChange"
                    />
                    <span>Active Employee</span>
                  </label>
                  <label class="employees-toggle-row">
                    <input
                      v-model="detailForm.isContractor"
                      :disabled="saveLoading"
                      type="checkbox"
                      @change="handleDetailToggleChange"
                    />
                    <span>Contractor</span>
                  </label>
                </div>

                <div class="employees-settings-panel__meta">
                  <span>Current Wage: {{ formatWageLabel(selectedEmployee.wageRate) }}</span>
                  <span>Type: {{ getEmployeeTypeLabel(selectedEmployee) }}</span>
                </div>
              </section>

              <div class="employees-detail__actions">
                <button
                  class="app-button employees-detail__danger"
                  :disabled="deleteLoading || saveLoading"
                  type="button"
                  @click="handleDeleteEmployee"
                >
                  {{ deleteLoading ? 'Deleting...' : 'Delete Employee' }}
                </button>
              </div>
            </form>
            <div
              v-if="saveLoading || detailInfo === 'All changes saved.' || detailInfo === 'Changes save when you leave a field.'"
              :class="[
                'employees-workspace__note',
                { 'employees-workspace__note--success': detailInfo === 'All changes saved.' },
              ]"
            >
              {{ saveLoading ? 'Saving changes...' : detailInfo || 'Changes save when you leave a field.' }}
            </div>
          </div>
        </template>
      </section>
    </div>

    <datalist id="employee-occupation-options">
      <option v-for="occupation in occupationSuggestions" :key="occupation" :value="occupation" />
    </datalist>
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

.employees-detail {
  grid-template-rows: auto minmax(0, 1fr);
}

.employees-browser__body {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 1rem;
  min-height: 0;
}

.employees-detail__body {
  display: grid;
  gap: 1rem;
  min-height: 0;
  overflow: auto;
  align-content: start;
  padding-right: 0.15rem;
}

.employees-browser__header,
.employees-detail__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.employees-workspace__mobile-nav,
.employees-detail__mobile-back {
  display: none;
}

.employees-workspace__mobile-nav {
  gap: 0.7rem;
}

.employees-workspace__mobile-toggle {
  min-height: 2.45rem;
  padding: 0 1rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-muted);
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    color 0.2s ease;
}

.employees-workspace__mobile-toggle--active {
  border-color: rgba(88, 186, 233, 0.28);
  background:
    linear-gradient(180deg, rgba(49, 83, 105, 0.35), rgba(33, 49, 62, 0.28)),
    rgba(255, 255, 255, 0.04);
  color: var(--text);
}

.employees-detail__mobile-back {
  align-items: center;
  min-height: 2.1rem;
  padding: 0 0.85rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-muted);
}

.employees-workspace__eyebrow {
  color: var(--accent-strong);
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.employees-workspace__title,
.employees-detail__title {
  margin: 0.35rem 0 0;
  font-size: 1.1rem;
}

.employees-browser__search input,
.employees-form__field input {
  width: 100%;
  min-height: 2.8rem;
  padding: 0 0.9rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.045);
  color: var(--text);
}

.employees-form__currency-input {
  position: relative;
}

.employees-form__currency-input input {
  padding-left: 2rem;
}

.employees-form__currency-input::before {
  content: '$';
  position: absolute;
  top: 50%;
  left: 0.9rem;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.employees-browser__list {
  display: grid;
  gap: 0.55rem;
  align-content: start;
  min-height: 0;
  overflow: auto;
  padding-right: 0.15rem;
}

.employees-browser__row {
  display: grid;
  gap: 0.7rem;
  width: 100%;
  padding: 0.9rem;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.035);
  color: var(--text);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    transform 0.2s ease;
}

.employees-browser__row:hover,
.employees-browser__row--active {
  border-color: rgba(88, 186, 233, 0.28);
  background:
    linear-gradient(180deg, rgba(49, 83, 105, 0.35), rgba(33, 49, 62, 0.28)),
    rgba(255, 255, 255, 0.04);
  transform: translateY(-1px);
}

.employees-browser__row-main {
  display: grid;
  gap: 0.2rem;
}

.employees-browser__row-main span,
.employees-browser__empty,
.employees-settings-panel__header span,
.employees-settings-panel__meta span {
  color: var(--text-muted);
}

.employees-browser__secondary {
  font-size: 0.84rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.employees-browser__row-meta,
.employees-detail__status-group,
.employees-toggle-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.employees-browser__badge,
.employees-browser__status {
  display: inline-flex;
  align-items: center;
  min-height: 1.85rem;
  padding: 0 0.6rem;
  border-radius: 999px;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.employees-browser__badge {
  border: 1px solid rgba(88, 186, 233, 0.22);
  background: rgba(38, 74, 96, 0.28);
  color: var(--accent);
}

.employees-browser__status {
  border: 1px solid rgba(103, 213, 157, 0.2);
  background: rgba(50, 92, 72, 0.22);
  color: var(--success);
}

.employees-browser__status--inactive {
  border-color: rgba(255, 125, 107, 0.2);
  background: rgba(104, 52, 45, 0.22);
  color: var(--danger);
}

.employees-form {
  display: grid;
  gap: 1rem;
  align-content: start;
}

.employees-form__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.employees-form__field {
  display: grid;
  gap: 0.45rem;
  color: var(--text-muted);
}

.employees-form__field--full {
  grid-column: 1 / -1;
}

.employees-form__field span,
.employees-toggle-row span {
  font-size: 0.9rem;
}

.employees-toggle-row {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--text-muted);
}

.employees-toggle-row input {
  margin-top: 0.2rem;
  accent-color: var(--accent-strong);
}

.employees-settings-panel {
  display: grid;
  gap: 0.85rem;
  min-height: 0;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.03);
}

.employees-settings-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.employees-settings-panel__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
}

.employees-detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.employees-detail__danger {
  border-color: rgba(255, 125, 107, 0.24);
  color: var(--danger);
}

.employees-workspace__note {
  padding: 0.95rem 1rem;
  border: 1px dashed var(--border);
  border-radius: 12px;
  color: var(--text-muted);
}

.employees-workspace__note--error {
  border-color: rgba(255, 125, 107, 0.24);
  color: var(--danger);
}

.employees-workspace__note--success {
  border-color: rgba(103, 213, 157, 0.24);
  color: var(--success);
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

  .employees-workspace__mobile-nav {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .employees-workspace--mobile-directory .employees-detail {
    display: none;
  }

  .employees-workspace--mobile-editor .employees-browser {
    display: none;
  }

  .employees-browser,
  .employees-detail,
  .employees-browser__body,
  .employees-detail__body,
  .employees-browser__list {
    height: auto;
    min-height: 0;
    overflow: visible;
    padding-right: 0;
  }

  .employees-browser {
    max-height: none;
  }

  .employees-browser__header .app-button,
  .employees-detail__actions,
  .employees-detail__danger {
    width: 100%;
  }

  .employees-detail__mobile-back {
    display: inline-flex;
    margin-bottom: 0.55rem;
  }

  .employees-detail__actions .app-button {
    width: 100%;
  }
}

@media (max-width: 720px) {
  .employees-form__grid {
    grid-template-columns: 1fr;
  }

  .employees-browser__header,
  .employees-detail__header,
  .employees-settings-panel__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
