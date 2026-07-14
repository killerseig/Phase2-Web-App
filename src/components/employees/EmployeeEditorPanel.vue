<script setup lang="ts">
import AppBadge from '@/components/common/AppBadge.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppCheckbox from '@/components/common/AppCheckbox.vue'
import AppField from '@/components/common/AppField.vue'
import AppLoadingButton from '@/components/common/AppLoadingButton.vue'
import AppStatusMessage from '@/components/common/AppStatusMessage.vue'
import AppTextInput from '@/components/common/AppTextInput.vue'
import {
  getEmployeeCode,
  getEmployeeDisplayName,
  getEmployeeTypeLabel,
  type EmployeeBooleanField,
  type EmployeeFormState,
  type EmployeeTextField,
} from '@/features/employees/employeeViewHelpers'
import type { EmployeeRecord } from '@/types/domain'

defineProps<{
  isCreateMode: boolean
  createForm: EmployeeFormState
  detailForm: EmployeeFormState
  selectedEmployee: EmployeeRecord | null
  createLoading: boolean
  saveLoading: boolean
  deleteLoading: boolean
  detailInfo: string
  activeEmployeesCount: number
  inactiveEmployeesCount: number
}>()

const emit = defineEmits<{
  backToDirectory: []
  createSubmit: []
  detailSubmit: []
  deleteEmployee: []
  detailFieldBlur: []
  detailToggleChange: []
  updateCreateTextField: [field: EmployeeTextField, value: string]
  updateCreateBooleanField: [field: EmployeeBooleanField, value: boolean]
  updateDetailTextField: [field: EmployeeTextField, value: string]
  updateDetailBooleanField: [field: EmployeeBooleanField, value: boolean]
}>()

function handleCreateTextInput(field: EmployeeTextField, value: string) {
  emit('updateCreateTextField', field, value)
}

function handleCreateBooleanInput(field: EmployeeBooleanField, value: boolean) {
  emit('updateCreateBooleanField', field, value)
}

function handleDetailTextInput(field: EmployeeTextField, value: string) {
  emit('updateDetailTextField', field, value)
}

function handleDetailBooleanInput(field: EmployeeBooleanField, value: boolean) {
  emit('updateDetailBooleanField', field, value)
  emit('detailToggleChange')
}
</script>

<template>
  <section class="employees-detail">
    <template v-if="isCreateMode">
      <header class="employees-detail__header">
        <div>
          <button class="employees-detail__mobile-back" type="button" @click="emit('backToDirectory')">
            Back to Directory
          </button>
          <span class="employees-workspace__eyebrow">Directory</span>
          <h2 class="employees-detail__title">Create Employee</h2>
        </div>
      </header>

      <div class="employees-detail__body">
        <form class="employees-form" @submit.prevent="emit('createSubmit')">
          <div class="employees-form__grid">
            <AppField class="employees-form__field" label="Employee Number">
              <AppTextInput
                :model-value="createForm.employeeNumber"
                type="text"
                autocomplete="off"
                @update:model-value="handleCreateTextInput('employeeNumber', $event)"
              />
            </AppField>
            <AppField class="employees-form__field" label="First Name">
              <AppTextInput
                :model-value="createForm.firstName"
                type="text"
                autocomplete="given-name"
                @update:model-value="handleCreateTextInput('firstName', $event)"
              />
            </AppField>
            <AppField class="employees-form__field" label="Last Name">
              <AppTextInput
                :model-value="createForm.lastName"
                type="text"
                autocomplete="family-name"
                @update:model-value="handleCreateTextInput('lastName', $event)"
              />
            </AppField>
            <AppField class="employees-form__field employees-form__field--full" label="Occupation">
              <AppTextInput
                :model-value="createForm.occupation"
                type="text"
                list="employee-occupation-options"
                autocomplete="off"
                @update:model-value="handleCreateTextInput('occupation', $event)"
              />
            </AppField>
          </div>

          <div class="employees-detail__actions">
            <AppLoadingButton
              label="Create Employee"
              loading-label="Creating Employee..."
              variant="primary"
              :loading="createLoading"
              type="submit"
            />
          </div>

          <section class="employees-settings-panel">
            <div class="employees-settings-panel__header">
              <strong>Directory Settings</strong>
              <span>{{ activeEmployeesCount }} active / {{ inactiveEmployeesCount }} inactive</span>
            </div>

            <div class="employees-toggle-group">
              <label class="employees-toggle-row">
                <AppCheckbox
                  :model-value="createForm.active"
                  @update:model-value="handleCreateBooleanInput('active', $event)"
                />
                <span>Active Employee</span>
              </label>
              <label class="employees-toggle-row">
                <AppCheckbox
                  :model-value="createForm.isContractor"
                  @update:model-value="handleCreateBooleanInput('isContractor', $event)"
                />
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
          <button class="employees-detail__mobile-back" type="button" @click="emit('backToDirectory')">
            Back to Directory
          </button>
          <span class="employees-workspace__eyebrow">Selected Employee</span>
          <h2 class="employees-detail__title">{{ getEmployeeDisplayName(selectedEmployee) }}</h2>
        </div>
        <div class="employees-detail__status-group">
          <AppBadge tone="accent">{{ getEmployeeTypeLabel(selectedEmployee) }}</AppBadge>
          <AppBadge :tone="selectedEmployee.active ? 'success' : 'danger'">
            {{ selectedEmployee.active ? 'Active' : 'Inactive' }}
          </AppBadge>
        </div>
      </header>

      <div class="employees-detail__body">
        <form class="employees-form" @submit.prevent="emit('detailSubmit')">
          <div class="employees-form__grid">
            <AppField class="employees-form__field" label="Employee Number">
              <AppTextInput
                :model-value="detailForm.employeeNumber"
                :disabled="saveLoading"
                type="text"
                autocomplete="off"
                @update:model-value="handleDetailTextInput('employeeNumber', $event)"
                @blur="emit('detailFieldBlur')"
              />
            </AppField>
            <AppField class="employees-form__field" label="First Name">
              <AppTextInput
                :model-value="detailForm.firstName"
                :disabled="saveLoading"
                type="text"
                autocomplete="given-name"
                @update:model-value="handleDetailTextInput('firstName', $event)"
                @blur="emit('detailFieldBlur')"
              />
            </AppField>
            <AppField class="employees-form__field" label="Last Name">
              <AppTextInput
                :model-value="detailForm.lastName"
                :disabled="saveLoading"
                type="text"
                autocomplete="family-name"
                @update:model-value="handleDetailTextInput('lastName', $event)"
                @blur="emit('detailFieldBlur')"
              />
            </AppField>
            <AppField class="employees-form__field employees-form__field--full" label="Occupation">
              <AppTextInput
                :model-value="detailForm.occupation"
                :disabled="saveLoading"
                type="text"
                list="employee-occupation-options"
                autocomplete="off"
                @update:model-value="handleDetailTextInput('occupation', $event)"
                @blur="emit('detailFieldBlur')"
              />
            </AppField>
          </div>

          <section class="employees-settings-panel">
            <div class="employees-settings-panel__header">
              <strong>Employee Settings</strong>
              <span>Employee #{{ getEmployeeCode(selectedEmployee) }}</span>
            </div>

            <div class="employees-toggle-group">
              <label class="employees-toggle-row">
                <AppCheckbox
                  :model-value="detailForm.active"
                  :disabled="saveLoading"
                  @update:model-value="handleDetailBooleanInput('active', $event)"
                />
                <span>Active Employee</span>
              </label>
              <label class="employees-toggle-row">
                <AppCheckbox
                  :model-value="detailForm.isContractor"
                  :disabled="saveLoading"
                  @update:model-value="handleDetailBooleanInput('isContractor', $event)"
                />
                <span>Contractor</span>
              </label>
            </div>

            <div class="employees-settings-panel__meta">
              <span>Type: {{ getEmployeeTypeLabel(selectedEmployee) }}</span>
            </div>
          </section>

          <div class="employees-detail__actions">
            <AppButton
              class="employees-detail__danger"
              variant="danger"
              :disabled="deleteLoading || saveLoading"
              @click="emit('deleteEmployee')"
            >
              {{ deleteLoading ? 'Deleting...' : 'Delete Employee' }}
            </AppButton>
          </div>
        </form>
        <AppStatusMessage
          v-if="saveLoading || detailInfo === 'All changes saved.' || detailInfo === 'Changes save when you leave a field.'"
          :tone="!saveLoading && detailInfo === 'All changes saved.' ? 'success' : 'default'"
        >
          {{ saveLoading ? 'Saving changes...' : detailInfo || 'Changes save when you leave a field.' }}
        </AppStatusMessage>
      </div>
    </template>
  </section>
</template>

<style scoped>
.employees-detail {
  grid-template-rows: auto minmax(0, 1fr);
}

.employees-detail__body {
  display: grid;
  gap: 1rem;
  min-height: 0;
  overflow: auto;
  align-content: start;
  padding-right: 0.15rem;
}

.employees-detail__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.employees-detail__mobile-back {
  display: none;
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

.employees-detail__title {
  margin: 0.35rem 0 0;
  font-size: 1.1rem;
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

.employees-form__field--full {
  grid-column: 1 / -1;
}

.employees-toggle-row span {
  font-size: 0.9rem;
}

.employees-detail__status-group,
.employees-toggle-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
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

.employees-settings-panel__header span,
.employees-settings-panel__meta span {
  color: var(--text-muted);
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

@media (max-width: 900px) {
  .employees-detail,
  .employees-detail__body {
    height: auto;
    min-height: 0;
    overflow: visible;
    padding-right: 0;
  }

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

  .employees-detail__header,
  .employees-settings-panel__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
