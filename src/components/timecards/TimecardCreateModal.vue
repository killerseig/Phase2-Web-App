<script setup lang="ts">
import BaseModal from '@/components/common/BaseModal.vue'
import type { TimecardCreateForm } from '@/components/timecards/timecardPageModels'

const props = defineProps<{
  open: boolean
  form: TimecardCreateForm
}>()

const emit = defineEmits<{
  (e: 'update:form', value: TimecardCreateForm): void
  (e: 'close'): void
  (e: 'submit'): void
}>()

function updateField<K extends keyof TimecardCreateForm>(field: K, value: TimecardCreateForm[K]) {
  emit('update:form', {
    ...props.form,
    [field]: value,
  })
}
</script>

<template>
  <BaseModal
    :open="open"
    title="Create New Timecard"
    size="lg"
    content-class="border-0 shadow-lg"
    header-class="bg-primary text-white"
    close-button-class="btn-close-white"
    @close="emit('close')"
  >
    <form class="timecard-create-form" @submit.prevent="emit('submit')">
      <div class="mb-3">
        <label class="form-label" for="tc-create-employee-number">Employee Number *</label>
        <input
          id="tc-create-employee-number"
          :value="form.employeeNumber"
          type="text"
          class="form-control"
          placeholder="e.g., 1234"
          autocomplete="off"
          autofocus
          @input="updateField('employeeNumber', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="row g-2 mb-3">
        <div class="col-6">
          <label class="form-label" for="tc-create-first-name">First Name *</label>
          <input
            id="tc-create-first-name"
            :value="form.firstName"
            type="text"
            class="form-control"
            placeholder="First"
            autocomplete="given-name"
            @input="updateField('firstName', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div class="col-6">
          <label class="form-label" for="tc-create-last-name">Last Name *</label>
          <input
            id="tc-create-last-name"
            :value="form.lastName"
            type="text"
            class="form-control"
            placeholder="Last"
            autocomplete="family-name"
            @input="updateField('lastName', ($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
      <div class="mb-4">
        <label class="form-label" for="tc-create-occupation">Occupation</label>
        <input
          id="tc-create-occupation"
          :value="form.occupation"
          type="text"
          class="form-control"
          placeholder="e.g., Carpenter"
          @input="updateField('occupation', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="mb-4">
        <label class="form-label" for="tc-create-wage">Wage</label>
        <input
          id="tc-create-wage"
          :value="form.employeeWage"
          type="number"
          min="0"
          step="0.01"
          class="form-control"
          placeholder="e.g., 28.50"
          @input="updateField('employeeWage', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="mb-0">
        <label class="form-label" for="tc-create-subcontracted">Subcontracted Employee</label>
        <select
          id="tc-create-subcontracted"
          :value="form.subcontractedEmployee"
          class="form-select"
          @change="updateField('subcontractedEmployee', ($event.target as HTMLSelectElement).value as TimecardCreateForm['subcontractedEmployee'])"
        >
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </div>
    </form>

    <template #footer>
      <button type="button" class="btn btn-secondary" @click="emit('close')">Cancel</button>
      <button type="button" class="btn btn-primary" @click="emit('submit')">Create</button>
    </template>
  </BaseModal>
</template>

<style scoped>
input[type='number'] {
  appearance: textfield;
  -moz-appearance: textfield;
}

input[type='number']::-webkit-outer-spin-button,
input[type='number']::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.timecard-create-form {
  margin: 0;
}
</style>
