<script setup lang="ts">
import { ref, watch } from 'vue'
import AppSectionCard from '@/components/common/AppSectionCard.vue'
import BaseFormActions from '@/components/common/BaseFormActions.vue'
import BaseInputField from '@/components/common/BaseInputField.vue'
import BaseSelectField from '@/components/common/BaseSelectField.vue'
import { JOB_TYPE_OPTIONS } from '@/constants/jobs'
import type { JobFormInput } from '@/types/adminJobs'

const props = defineProps<{
  open: boolean
  form: JobFormInput
  loading: boolean
  foremanOptions: readonly { value: string; label: string }[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:form': [value: JobFormInput]
  submit: []
  cancel: []
}>()

function updateField<K extends keyof JobFormInput>(field: K, value: JobFormInput[K]) {
  emit('update:form', {
    ...props.form,
    [field]: value,
  })
}

const showAdvancedFields = ref(false)

function hasAdvancedValues(form: JobFormInput) {
  return [
    form.startDate,
    form.finishDate,
    form.productionBurden,
    form.taxExempt,
    form.certified,
    form.cip,
    form.kjic,
  ].some((value) => String(value ?? '').trim().length > 0)
}

watch(
  () => props.form,
  (form) => {
    if (hasAdvancedValues(form)) {
      showAdvancedFields.value = true
    }
  },
  { deep: true, immediate: true }
)
</script>

<template>
  <AppSectionCard
    v-if="open"
    class="admin-jobs-create-card"
    title="New Job Draft"
    subtitle="Create a job record without leaving the workspace."
    icon="bi bi-plus-square"
  >
    <form class="row g-2 g-lg-3" @submit.prevent="emit('submit')">
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
          placeholder="Project Name"
          required
          @update:model-value="updateField('name', String($event))"
        />
      </div>
      <div class="col-md-6">
        <BaseInputField
          :model-value="form.projectManager"
          label="Project Manager"
          label-class="small"
          placeholder="Brian"
          @update:model-value="updateField('projectManager', String($event))"
        />
      </div>
      <div class="col-md-6">
        <BaseSelectField
          :model-value="form.foreman"
          label="Assigned Foreman"
          label-class="small"
          :options="[...foremanOptions]"
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
          placeholder="Turner"
          @update:model-value="updateField('gc', String($event))"
        />
      </div>
      <div class="col-md-8">
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
      <div class="col-12">
        <BaseInputField
          :model-value="form.jobAddress"
          label="Job Address"
          label-class="small"
          placeholder="12605 E 16th Ave Aurora"
          @update:model-value="updateField('jobAddress', String($event))"
        />
      </div>
      <div class="col-12">
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary admin-jobs-create-card__toggle"
          @click="showAdvancedFields = !showAdvancedFields"
        >
          <i class="bi" :class="showAdvancedFields ? 'bi-dash-lg' : 'bi-plus-lg'"></i>
          {{ showAdvancedFields ? 'Hide schedule & compliance fields' : 'Add schedule & compliance fields' }}
        </button>
      </div>

      <template v-if="showAdvancedFields">
        <div class="col-md-3">
          <BaseInputField
            :model-value="form.startDate"
            type="date"
            label="Start"
            label-class="small"
            @update:model-value="updateField('startDate', String($event))"
          />
        </div>
        <div class="col-md-3">
          <BaseInputField
            :model-value="form.finishDate"
            type="date"
            label="Finish"
            label-class="small"
            @update:model-value="updateField('finishDate', String($event))"
          />
        </div>
        <div class="col-md-3">
          <BaseInputField
            :model-value="form.productionBurden"
            type="number"
            step="0.01"
            min="0"
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
        <div class="col-md-4">
          <BaseInputField
            :model-value="form.certified"
            label="Certified"
            label-class="small"
            placeholder="Yes / No"
            @update:model-value="updateField('certified', String($event))"
          />
        </div>
        <div class="col-md-4">
          <BaseInputField
            :model-value="form.cip"
            label="CIP"
            label-class="small"
            placeholder="2445"
            @update:model-value="updateField('cip', String($event))"
          />
        </div>
        <div class="col-md-4">
          <BaseInputField
            :model-value="form.kjic"
            label="KJIC"
            label-class="small"
            placeholder="Yes / No"
            @update:model-value="updateField('kjic', String($event))"
          />
        </div>
      </template>

      <BaseFormActions
        :loading="loading"
        submit-label="Create Job"
        :submit-disabled="!form.name || !form.type"
        wrapper-class="col-12 d-flex gap-2 justify-content-end pt-1"
        @cancel="emit('cancel')"
      />
    </form>
  </AppSectionCard>
</template>
