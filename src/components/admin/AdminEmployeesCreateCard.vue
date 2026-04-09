<script setup lang="ts">
import AdminAccordionFormCard from '@/components/admin/AdminAccordionFormCard.vue'
import BaseCheckboxField from '@/components/common/BaseCheckboxField.vue'
import BaseInputField from '@/components/common/BaseInputField.vue'
import BaseSelectField from '@/components/common/BaseSelectField.vue'
import type { EmployeeFormInput } from '@/types/adminEmployees'

const props = defineProps<{
  open: boolean
  form: EmployeeFormInput
  loading: boolean
  occupationOptions: readonly { value: string; label: string }[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:form': [value: EmployeeFormInput]
  submit: []
  cancel: []
}>()

function updateField<K extends keyof EmployeeFormInput>(field: K, value: EmployeeFormInput[K]) {
  emit('update:form', {
    ...props.form,
    [field]: value,
  })
}
</script>

<template>
  <AdminAccordionFormCard
    :open="open"
    title="Add Employee"
    subtitle="Create a new employee directory record for future job assignment."
    :loading="loading"
    :submit-disabled="!form.employeeNumber || !form.firstName || !form.lastName || !form.occupation"
    submit-label="Create Employee"
    @update:open="(value) => emit('update:open', value)"
    @submit="emit('submit')"
    @cancel="emit('cancel')"
  >
    <div class="col-md-2">
      <BaseInputField
        :model-value="form.employeeNumber"
        label="Employee #"
        label-class="small"
        placeholder="1234"
        required
        @update:model-value="updateField('employeeNumber', String($event))"
      />
    </div>
    <div class="col-md-3">
      <BaseInputField
        :model-value="form.firstName"
        label="First Name"
        label-class="small"
        placeholder="John"
        required
        @update:model-value="updateField('firstName', String($event))"
      />
    </div>
    <div class="col-md-3">
      <BaseInputField
        :model-value="form.lastName"
        label="Last Name"
        label-class="small"
        placeholder="Doe"
        required
        @update:model-value="updateField('lastName', String($event))"
      />
    </div>
    <div class="col-md-4">
      <BaseSelectField
        :model-value="form.occupation"
        label="Occupation"
        label-class="small"
        :options="occupationOptions"
        include-empty-option
        empty-option-label="Select occupation"
        required
        @update:model-value="updateField('occupation', String($event))"
      />
    </div>
    <div class="col-md-3">
      <BaseInputField
        :model-value="form.wageRate"
        type="number"
        min="0"
        step="0.01"
        label="Wage Rate"
        label-class="small"
        placeholder="25.00"
        @update:model-value="updateField('wageRate', String($event))"
      />
    </div>
    <div class="col-md-3 d-flex align-items-end">
      <BaseCheckboxField
        :model-value="form.active"
        label="Active employee"
        wrapper-class="pb-md-2"
        @update:model-value="updateField('active', $event)"
      />
    </div>
  </AdminAccordionFormCard>
</template>
